"use client";

import { useCallback, useRef, useState } from "react";
import type { RenderConfig } from "@repo/shared";
import { API_BASE_URL } from "@/lib/studio/projects-api";
import { pickRenderPath } from "@/lib/studio/render-path";
import type { ExportMessage, ExportRequest } from "@/lib/studio/export-worker";

/** Font phải nằm ở `public/` để worker tải được bằng URL — xem ghi chú trong worker. */
const FONT_URL = "/fonts/BeVietnamPro-Bold.woff2";

export interface ExportState {
  running: boolean;
  /** 0–100. */
  percent: number;
  stage: "chuẩn bị" | "dựng hình" | "ghép tiếng" | "đóng gói" | null;
}

const STAGE_LABEL: Record<string, ExportState["stage"]> = {
  video: "dựng hình",
  audio: "ghép tiếng",
  mux: "đóng gói",
};

const request = async <T,>(path: string, body?: unknown): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Không gọi được máy chủ");
  }

  return payload as T;
};

/**
 * Điều phối việc xuất MP4.
 *
 * Chia việc rất rõ: **máy chủ giữ tiền, worker giữ việc nặng, hook này chỉ nối hai bên**.
 *
 * Credit được giữ chỗ ngay khi bắt đầu và hoàn lại nếu hỏng. Chờ tới lúc có file mới trừ
 * thì chỉ cần không gửi request kết thúc là xuất video miễn phí — mà việc dựng hình chạy
 * hoàn toàn trên máy người dùng nên máy chủ không có cách nào tự kiểm chứng.
 */
export function useExport({
  onError,
  onBalanceChange,
}: {
  /** Lỗi báo ra ngoài thay vì giữ trong hook: cả trang chỉ có một chỗ hiện lỗi. */
  onError: (message: string) => void;
  onBalanceChange?: (balance: number) => void;
}) {
  const [state, setState] = useState<ExportState>({
    running: false,
    percent: 0,
    stage: null,
  });

  const workerRef = useRef<Worker | null>(null);

  const start = useCallback(
    async (projectId: string, fileName: string) => {
      const path = pickRenderPath();

      if (path.kind === "unsupported") {
        onError(path.reason);
        return;
      }

      setState({ running: true, percent: 0, stage: "chuẩn bị" });

      // Ngăn máy ngủ giữa chừng; không phải trình duyệt nào cũng cho, nên không bắt buộc.
      const wakeLock = await navigator.wakeLock
        ?.request("screen")
        .catch(() => null);

      let renderId: string | null = null;

      const abandon = async (reason: string) => {
        setState({ running: false, percent: 0, stage: null });
        onError(reason);
        void wakeLock?.release().catch(() => undefined);
        workerRef.current?.terminate();
        workerRef.current = null;

        if (renderId) {
          const result = await request<{ balance: number | null }>(
            `/renders/${renderId}/fail`,
            { reason },
          ).catch(() => null);

          if (result?.balance != null) onBalanceChange?.(result.balance);
        }
      };

      try {
        const started = await request<{
          renderId: string;
          config: RenderConfig;
          balance: number;
        }>("/renders", { projectId });

        renderId = started.renderId;
        onBalanceChange?.(started.balance);

        const config = started.config;

        /*
         * Tải media và tiếng ở luồng chính rồi **chuyển quyền sở hữu** sang worker.
         *
         * Worker không có cookie phiên nên tự đi tải sẽ nhận 403 với URL cần xác thực.
         * Ảnh giải mã sẵn thành `ImageBitmap`; video và GIF gửi byte thô vì worker phải tự
         * giải mã theo từng mốc thời gian.
         */
        const seen = new Map<string, RenderConfig["scenes"][number]["assetKind"]>();
        for (const scene of config.scenes) {
          if (scene.assetUrl) seen.set(scene.assetUrl, scene.assetKind);
        }

        const media = await Promise.all(
          [...seen.entries()].map(async ([url, kind]) => {
            const response = await fetch(url);

            if (kind === "image") {
              return {
                url,
                kind,
                bitmap: await createImageBitmap(await response.blob()),
              };
            }

            return { url, kind, buffer: await response.arrayBuffer() };
          }),
        );

        const voice = await Promise.all(
          config.audio.voiceClips.map(async (clip) => ({
            startMs: clip.startMs,
            buffer: await (await fetch(clip.url)).arrayBuffer(),
          })),
        );

        const worker = new Worker(
          new URL("./export-worker.ts", import.meta.url),
          { type: "module" },
        );
        workerRef.current = worker;

        const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          worker.onmessage = (event: MessageEvent<ExportMessage>) => {
            const message = event.data;

            if (message.type === "progress") {
              setState({
                running: true,
                percent: Math.round((message.done / Math.max(1, message.total)) * 100),
                stage: STAGE_LABEL[message.stage] ?? "dựng hình",
              });
              return;
            }

            if (message.type === "warning") {
              // Cảnh báo không dừng việc xuất: người dùng vẫn nhận được file.
              onError(message.message);
              return;
            }

            if (message.type === "done") {
              resolve(message.buffer);
              return;
            }

            reject(new Error(message.message));
          };

          worker.onerror = (event) =>
            reject(new Error(event.message || "Bộ xuất video gặp lỗi"));

          const payload: ExportRequest = {
            type: "start",
            config,
            media,
            voice,
            fontUrl: new URL(FONT_URL, location.origin).href,
          };

          // Chuyển quyền sở hữu thay vì sao chép: một video 50MB mà copy sang worker là
          // 50MB nữa trong RAM, đúng lúc quá trình encode cần nhiều bộ nhớ nhất.
          const transfer = [
            ...media.map((item) => item.bitmap ?? item.buffer),
            ...voice.map((item) => item.buffer),
          ].filter((item) => item !== undefined);

          worker.postMessage(payload, transfer);
        });

        worker.terminate();
        workerRef.current = null;

        const blob = new Blob([buffer], { type: "video/mp4" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${fileName}.mp4`;
        link.click();
        // Thu hồi muộn một nhịp: thu ngay thì Safari huỷ luôn cả lượt tải vừa bắt đầu.
        setTimeout(() => URL.revokeObjectURL(link.href), 60_000);

        await request(`/renders/${renderId}/complete`, {
          fileSize: blob.size,
          durationMs: config.meta.totalDurationMs,
        }).catch(() => undefined);

        setState({ running: false, percent: 100, stage: null });
        void wakeLock?.release().catch(() => undefined);
      } catch (cause) {
        await abandon(
          cause instanceof Error ? cause.message : "Không xuất được video",
        );
      }
    },
    [onBalanceChange, onError],
  );

  const cancel = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setState({ running: false, percent: 0, stage: null });
  }, []);

  return { state, start, cancel };
}
