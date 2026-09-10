"use client";

import {
  Heart,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Share2,
  ShoppingBag,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { drawFrame, type ImageMap } from "@repo/render-core";
import type { RenderConfig } from "@repo/shared";
import { formatTimecode } from "@/lib/studio/timecode";
import { usePlayhead, type Playback } from "@/lib/studio/use-playback";

/**
 * Phân vùng 2 — khung xem trước.
 *
 * Gọi thẳng `drawFrame` của `@repo/render-core`, **đúng hàm mà bộ xuất video sẽ dùng**;
 * nhờ vậy file xuất ra không thể khác thứ người dùng vừa xem.
 *
 * Lớp mô phỏng nút TikTok nằm **ngoài canvas**, chỉ là chỉ dẫn bố cục. Vẽ nó vào canvas
 * thì nó sẽ đi thẳng vào video thật.
 */
export function Stage({
  config,
  images,
  seekMedia,
  playback,
  showSafeZone,
  showCaption,
  showImage,
  onToggleSafeZone,
  onSubtitleYChange,
  onSubtitleYCommit,
}: {
  config: RenderConfig;
  images: ImageMap;
  /** Tua mọi video về đúng mốc trước khi vẽ; ảnh và GIF không cần. */
  seekMedia: (timeMs: number) => void;
  playback: Playback;
  showSafeZone: boolean;
  /** Hai công tắc này do thước thời gian điều khiển, giống mọi phần mềm dựng phim. */
  showCaption: boolean;
  showImage: boolean;
  onToggleSafeZone: () => void;
  /** Kéo: cập nhật ngay để nhìn thấy; thả tay mới lưu. */
  onSubtitleYChange: (value: number) => void;
  onSubtitleYCommit: (value: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState(false);
  const { playing, toggle, seek } = playback;
  // Canvas phải vẽ lại mỗi khung hình nên đây là một trong số ít chỗ được đăng ký playhead.
  const timeMs = usePlayhead(playback);
  const total = config.meta.totalDurationMs;

  // Vẽ lại mỗi khi mốc thời gian, config hay ảnh đổi — kể cả lúc đang tạm dừng.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    let cancelled = false;

    // Video phải ở đúng khung hình trước khi canvas đọc nó.
    seekMedia(timeMs);

    // Chờ font trước khi vẽ khung đầu tiên, nếu không phụ đề tiếng Việt sẽ mất dấu.
    void document.fonts.ready.then(() => {
      if (!cancelled) {
        drawFrame(ctx, config, timeMs, images, {
          showSafeZone,
          showCaption,
          showImage,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [config, images, seekMedia, timeMs, showSafeZone, showCaption, showImage]);

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-4">
      <div data-tour="studio.stage" className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          width={config.output.width}
          height={config.output.height}
          className="h-full max-h-full w-auto max-w-full rounded-card border border-line bg-[#0B0F17] shadow-[0_18px_50px_-24px_rgba(0,0,0,0.65)]"
        />

        {showSafeZone ? <TikTokChrome /> : null}

        {showCaption ? (
          <SubtitleHandle
            canvasRef={canvasRef}
            subtitleY={config.template.layout.subtitleY}
            dragging={dragging}
            onDraggingChange={setDragging}
            onChange={onSubtitleYChange}
            onCommit={onSubtitleYCommit}
          />
        ) : null}
      </div>

      <div data-tour="studio.transport" className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Tạm dừng" : "Phát"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-btn bg-brand text-[#10151e] transition-colors hover:bg-brand-hover"
        >
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>

        <button
          type="button"
          onClick={() => seek(0)}
          aria-label="Về đầu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-btn border border-line bg-subtle text-muted transition-colors hover:text-ink"
        >
          <RotateCcw size={16} />
        </button>

        <span className="rounded-btn bg-subtle px-3 py-2 font-mono text-xs font-bold tabular-nums text-ink">
          {formatTimecode(timeMs)}
          <span className="text-muted"> / {formatTimecode(total)}</span>
        </span>

        {/* Safe zone là lớp chỉ dẫn phủ lên khung hình, không phải một track. */}
        <button
          type="button"
          onClick={onToggleSafeZone}
          aria-pressed={showSafeZone}
          className={`rounded-btn border px-3 py-2 text-xs font-semibold transition-colors ${
            showSafeZone
              ? "border-brand bg-brand/15 text-ink"
              : "border-line bg-subtle text-muted hover:text-ink"
          }`}
        >
          Safe zone
        </button>
      </div>
    </div>
  );
}

/**
 * Tay cầm kéo vị trí phụ đề.
 *
 * Đặt **ngoài canvas** vì canvas không có phần tử con để bắt sự kiện; toạ độ quy đổi theo
 * hình chữ nhật thật của canvas trên màn hình, nên kéo đúng chỗ ở mọi cỡ cửa sổ.
 *
 * Chỉ chặn chuột trong đúng dải tay cầm (`pointer-events-auto` trên dải, `none` ở lớp
 * bọc): phủ cả khung thì mọi cú bấm vào khung hình đều thành thao tác kéo phụ đề.
 */
function SubtitleHandle({
  canvasRef,
  subtitleY,
  dragging,
  onDraggingChange,
  onChange,
  onCommit,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  subtitleY: number;
  dragging: boolean;
  onDraggingChange: (value: boolean) => void;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const start = (event: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    onDraggingChange(true);

    // Giới hạn theo `positionY` của `SubtitleStyleSchema`: ngoài khoảng này chữ chạm mép.
    const ratioAt = (clientY: number) =>
      Math.min(0.95, Math.max(0.1, (clientY - rect.top) / rect.height));

    const move = (pointer: PointerEvent) => onChange(ratioAt(pointer.clientY));

    const up = (pointer: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onDraggingChange(false);
      onCommit(ratioAt(pointer.clientY));
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Kéo để đổi vị trí phụ đề"
        aria-valuemin={10}
        aria-valuemax={95}
        aria-valuenow={Math.round(subtitleY * 100)}
        onPointerDown={start}
        onKeyDown={(event) => {
          const step = event.key === "ArrowUp" ? -0.01 : event.key === "ArrowDown" ? 0.01 : 0;
          if (step === 0) return;
          event.preventDefault();
          const next = Math.min(0.95, Math.max(0.1, subtitleY + step));
          onChange(next);
          onCommit(next);
        }}
        style={{ top: `${subtitleY * 100}%` }}
        className={`pointer-events-auto absolute inset-x-0 -translate-y-1/2 cursor-ns-resize border-y border-dashed transition-colors ${
          dragging ? "border-brand bg-brand/10" : "border-transparent hover:border-brand/60"
        }`}
      >
        <span className="block h-14" />
      </div>
    </div>
  );
}

/**
 * Mô phỏng thanh nút của TikTok để thấy chữ có bị che không.
 *
 * `pointer-events-none` là bắt buộc: đây là hình minh hoạ, bấm vào phải xuyên xuống nút
 * điều khiển bên dưới chứ không được nuốt cú bấm.
 */
function TikTokChrome() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-3 text-white/70">
      <div className="mb-10 ml-auto flex flex-col items-center gap-3">
        {[Heart, MessageCircle, ShoppingBag, Share2].map((Icon, index) => (
          <span
            key={index}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#10151e]/45 backdrop-blur-[1px]"
          >
            <Icon size={15} />
          </span>
        ))}
      </div>

      <div className="h-8 rounded-btn bg-[#10151e]/35 backdrop-blur-[1px]" />
    </div>
  );
}
