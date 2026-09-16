"use client";

import {
  Heart,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Share2,
  ShoppingBag,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { captionBounds, drawFrame, sceneAt, type ImageMap } from "@repo/render-core";
import {
  DEFAULT_CROP,
  SAFE_TOP,
  type Crop,
  type FrameLayout,
  type RenderConfig,
} from "@repo/shared";
import { formatTimecode } from "@/lib/studio/timecode";
import { usePlayhead, type Playback } from "@/lib/studio/use-playback";

/** Giới hạn cỡ chữ, khớp với `SubtitleStyleSchema` — kéo tay không được tạo giá trị schema từ chối. */
const MIN_FONT_SCALE = 0.02;
const MAX_FONT_SCALE = 0.14;

/** Kéo hết chiều cao khung đổi được 0.25 đơn vị cỡ chữ; đủ nhanh mà vẫn đặt được chính xác. */
const FONT_DRAG_GAIN = 0.25;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Phân vùng 2 — khung xem trước.
 *
 * Gọi thẳng `drawFrame` của `@repo/render-core`, **đúng hàm mà bộ xuất video sẽ dùng**;
 * nhờ vậy file xuất ra không thể khác thứ người dùng vừa xem.
 *
 * Đây cũng là nơi người dùng dựng bố cục bằng tay: kéo phụ đề lên xuống, kéo tay cầm để
 * đổi cỡ chữ, kéo ảnh để chọn vùng hiển thị và lăn chuột để phóng. Mọi giá trị đó lưu
 * **riêng cho từng khổ video** — xem `frame-layout.ts` của `@repo/shared`.
 *
 * Lớp mô phỏng nút TikTok nằm **ngoài canvas**, chỉ là chỉ dẫn bố cục. Vẽ nó vào canvas
 * thì nó sẽ đi thẳng vào video thật.
 */
export function Stage({
  config,
  images,
  crops,
  seekMedia,
  playback,
  showSafeZone,
  showCaption,
  showImage,
  onToggleSafeZone,
  onLayoutChange,
  onLayoutCommit,
  onCropChange,
  onCropCommit,
}: {
  config: RenderConfig;
  images: ImageMap;
  /** Khung cắt của **khổ đang mở**, theo chỉ số cảnh. Thiếu = cảnh đó chưa cắt. */
  crops: (Crop | undefined)[];
  /** Tua mọi video về đúng mốc trước khi vẽ; ảnh và GIF không cần. */
  seekMedia: (timeMs: number) => void;
  playback: Playback;
  showSafeZone: boolean;
  /** Hai công tắc này do thước thời gian điều khiển, giống mọi phần mềm dựng phim. */
  showCaption: boolean;
  showImage: boolean;
  onToggleSafeZone: () => void;
  /** Kéo: cập nhật ngay để nhìn thấy; thả tay mới lưu. */
  onLayoutChange: (patch: Partial<FrameLayout>) => void;
  onLayoutCommit: (patch: Partial<FrameLayout>) => void;
  onCropChange: (sceneIndex: number, crop: Crop) => void;
  onCropCommit: (sceneIndex: number, crop: Crop) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState<"subtitle" | "font" | "image" | null>(null);
  const [overflowing, setOverflowing] = useState<number[]>([]);
  const { playing, toggle, seek } = playback;
  // Canvas phải vẽ lại mỗi khung hình nên đây là một trong số ít chỗ được đăng ký playhead.
  const timeMs = usePlayhead(playback);
  const total = config.meta.totalDurationMs;

  const scene = sceneAt(config, timeMs);
  const crop = (scene ? crops[scene.index] : undefined) ?? DEFAULT_CROP;
  const cropped =
    crop.x !== DEFAULT_CROP.x || crop.y !== DEFAULT_CROP.y || crop.zoom !== DEFAULT_CROP.zoom;

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

  /**
   * Soát xem cảnh nào có chữ thò ra ngoài vùng an toàn.
   *
   * Đo bằng `captionBounds` của `@repo/render-core` — **đúng phép đo mà bộ vẽ dùng**, nên
   * cảnh báo không thể nói một đằng còn khung hình một nẻo. Quét cả video thay vì chỉ cảnh
   * đang xem: hai cảnh cùng cỡ chữ vẫn khác nhau vì câu dài hơn thì xuống nhiều dòng hơn,
   * và người dùng nên thấy hết vấn đề trong một lần.
   *
   * Chỉ chạy lại khi `config` đổi, không theo mốc thời gian, nên phát video không kéo theo
   * một lượt dựng lại nào.
   */
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    let cancelled = false;

    void document.fonts.ready.then(() => {
      if (cancelled) return;

      const safeBottom = 1 - config.template.layout.safeBottom;
      const found = config.scenes
        .filter((item) => {
          const bounds = captionBounds(ctx, config, item);
          return bounds !== null && (bounds.bottom > safeBottom || bounds.top < SAFE_TOP);
        })
        .map((item) => item.index);

      setOverflowing(found);
    });

    return () => {
      cancelled = true;
    };
  }, [config]);

  const subtitleY = config.template.layout.subtitleY;
  const fontScale = config.template.subtitle.fontScale;

  /** Quy đổi toạ độ con trỏ sang tỉ lệ trong khung hình thật. */
  const ratioAt = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;

    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  };

  /**
   * Bắt một cú kéo và gỡ listener khi thả tay.
   *
   * Gắn lên `window` chứ không lên phần tử: con trỏ đi ra ngoài khung trong lúc kéo là
   * chuyện bình thường, và nếu listener nằm trên phần tử thì thao tác đứt giữa chừng.
   */
  const startDrag = (
    kind: "subtitle" | "font" | "image",
    onMove: (event: PointerEvent) => void,
    onEnd: (event: PointerEvent) => void,
  ) => {
    setDragging(kind);

    const move = (event: PointerEvent) => onMove(event);

    const up = (event: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragging(null);
      onEnd(event);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-4">
      <div data-tour="studio.stage" className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          width={config.output.width}
          height={config.output.height}
          className="h-full max-h-full w-auto max-w-full rounded-card border border-line bg-[#0B0F17] shadow-[0_18px_50px_-24px_rgba(0,0,0,0.65)]"
        />

        {showImage && scene ? (
          <ImageFrame
            crop={crop}
            dragging={dragging === "image"}
            ratioAt={ratioAt}
            onStart={startDrag}
            onChange={(value) => onCropChange(scene.index, value)}
            onCommit={(value) => onCropCommit(scene.index, value)}
          />
        ) : null}

        {showSafeZone ? <TikTokChrome /> : null}

        {showCaption ? (
          <SubtitleHandle
            subtitleY={subtitleY}
            fontScale={fontScale}
            dragging={dragging}
            ratioAt={ratioAt}
            onStart={startDrag}
            onChange={onLayoutChange}
            onCommit={onLayoutCommit}
          />
        ) : null}
      </div>

      {showCaption && overflowing.length > 0 ? (
        <p className="flex shrink-0 items-center gap-1.5 rounded-btn bg-amber/12 px-2.5 py-1.5 text-[11px] leading-snug text-amber">
          <TriangleAlert size={13} className="shrink-0" aria-hidden />
          <span>
            Chữ ở cảnh {overflowing.map((index) => index + 1).join(", ")} nằm ngoài vùng an
            toàn, nút của nền tảng sẽ che mất. Kéo phụ đề lên hoặc thu nhỏ cỡ chữ.
          </span>
        </p>
      ) : null}

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

        {scene && cropped ? (
          <button
            type="button"
            onClick={() => onCropCommit(scene.index, DEFAULT_CROP)}
            className="rounded-btn border border-line bg-subtle px-3 py-2 text-xs font-semibold text-muted transition-colors hover:text-ink"
          >
            Đặt lại khung ảnh
          </button>
        ) : null}
      </div>

      <p className="shrink-0 text-center text-[11px] leading-snug text-muted">
        Kéo ảnh để chọn vùng hiển thị, lăn chuột để phóng to. Kéo dải phụ đề để đổi vị trí,
        kéo nút tròn để đổi cỡ chữ. Mỗi khổ video nhớ riêng.
      </p>
    </div>
  );
}

/**
 * Lớp bắt thao tác kéo và lăn trên ảnh nền.
 *
 * Đặt dưới dải phụ đề trong thứ tự dựng, nên kéo trúng dải phụ đề thì dải thắng — người
 * dùng không bao giờ vô tình dời ảnh khi định dời chữ.
 *
 * Lăn chuột phải gắn listener thủ công với `passive: false`: React gắn `wheel` ở chế độ
 * passive, và ở đó `preventDefault` không có tác dụng, nên trang sẽ cuộn theo trong lúc
 * người dùng phóng ảnh.
 */
function ImageFrame({
  crop,
  dragging,
  ratioAt,
  onStart,
  onChange,
  onCommit,
}: {
  crop: Crop;
  dragging: boolean;
  ratioAt: (clientX: number, clientY: number) => { x: number; y: number } | null;
  onStart: (
    kind: "image",
    onMove: (event: PointerEvent) => void,
    onEnd: (event: PointerEvent) => void,
  ) => void;
  onChange: (crop: Crop) => void;
  onCommit: (crop: Crop) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  /*
   * Giá trị và callback mới nhất, đọc qua ref chứ không qua closure.
   *
   * Listener `wheel` chỉ được gắn **một lần**. Cho nó phụ thuộc vào `onChange`/`onCommit`
   * — vốn là hàm mới ở mỗi lần render — thì mỗi cú lăn sẽ tự huỷ luôn bộ đếm lưu của
   * chính nó, và thao tác phóng ảnh không bao giờ được ghi lại.
   */
  const latest = useRef(crop);
  const handlers = useRef({ onChange, onCommit });

  useEffect(() => {
    latest.current = crop;
    handlers.current = { onChange, onCommit };
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    /*
     * Lăn xong mới lưu, chứ không lưu từng nấc.
     *
     * Một cú lăn chuột sinh ra hàng chục sự kiện; gửi từng cái lên máy chủ là hàng chục
     * request cho một thao tác, và cái về sau có thể về trước cái trước.
     */
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      const zoom = clamp(latest.current.zoom * (1 - event.deltaY / 600), 1, 3);
      const next = { ...latest.current, zoom: Number(zoom.toFixed(3)) };

      latest.current = next;
      handlers.current.onChange(next);

      clearTimeout(timer);
      timer = setTimeout(() => handlers.current.onCommit(latest.current), 400);
    };

    element.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      clearTimeout(timer);
      element.removeEventListener("wheel", onWheel);
    };
  }, []);

  const start = (event: React.PointerEvent<HTMLButtonElement>) => {
    const from = ratioAt(event.clientX, event.clientY);
    if (!from) return;

    event.preventDefault();
    const origin = latest.current;

    const cropAt = (pointer: PointerEvent): Crop => {
      const to = ratioAt(pointer.clientX, pointer.clientY);
      if (!to) return latest.current;

      return {
        ...origin,
        x: clamp(origin.x + (to.x - from.x), 0, 1),
        y: clamp(origin.y + (to.y - from.y), 0, 1),
      };
    };

    onStart(
      "image",
      (pointer) => {
        const next = cropAt(pointer);
        latest.current = next;
        onChange(next);
      },
      (pointer) => onCommit(cropAt(pointer)),
    );
  };

  /** Bàn phím: mũi tên dời khung 1%, `+`/`-` phóng 5%. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = 0.01;
    const moves: Record<string, Partial<Crop>> = {
      ArrowLeft: { x: clamp(crop.x - step, 0, 1) },
      ArrowRight: { x: clamp(crop.x + step, 0, 1) },
      ArrowUp: { y: clamp(crop.y - step, 0, 1) },
      ArrowDown: { y: clamp(crop.y + step, 0, 1) },
      "+": { zoom: clamp(crop.zoom * 1.05, 1, 3) },
      "=": { zoom: clamp(crop.zoom * 1.05, 1, 3) },
      "-": { zoom: clamp(crop.zoom / 1.05, 1, 3) },
    };

    const patch = moves[event.key];
    if (!patch) return;

    event.preventDefault();
    const next = { ...crop, ...patch };
    latest.current = next;
    onChange(next);
    onCommit(next);
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-label="Kéo để chọn vùng ảnh hiển thị; phím mũi tên để dời, cộng trừ để phóng"
      onPointerDown={start}
      onKeyDown={onKeyDown}
      className={`absolute inset-0 rounded-card ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
    />
  );
}

/**
 * Tay cầm của khối phụ đề: kéo dải để đổi vị trí, kéo nút tròn để đổi cỡ chữ.
 *
 * Đặt **ngoài canvas** vì canvas không có phần tử con để bắt sự kiện; toạ độ quy đổi theo
 * hình chữ nhật thật của canvas trên màn hình, nên kéo đúng chỗ ở mọi cỡ cửa sổ.
 *
 * Chỉ chặn chuột trong đúng dải tay cầm (`pointer-events-auto` trên dải, `none` ở lớp
 * bọc): phủ cả khung thì mọi cú bấm vào khung hình đều thành thao tác kéo phụ đề, và lớp
 * chỉnh ảnh bên dưới sẽ không bao giờ nhận được gì.
 */
function SubtitleHandle({
  subtitleY,
  fontScale,
  dragging,
  ratioAt,
  onStart,
  onChange,
  onCommit,
}: {
  subtitleY: number;
  fontScale: number;
  dragging: "subtitle" | "font" | "image" | null;
  ratioAt: (clientX: number, clientY: number) => { x: number; y: number } | null;
  onStart: (
    kind: "subtitle" | "font",
    onMove: (event: PointerEvent) => void,
    onEnd: (event: PointerEvent) => void,
  ) => void;
  onChange: (patch: Partial<FrameLayout>) => void;
  onCommit: (patch: Partial<FrameLayout>) => void;
}) {
  const startPosition = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();

    // Giới hạn theo `FrameLayoutSchema`: ngoài khoảng này chữ chạm mép khung.
    const valueAt = (pointer: PointerEvent) => {
      const point = ratioAt(pointer.clientX, pointer.clientY);
      return point ? clamp(point.y, 0.05, 0.98) : subtitleY;
    };

    onStart(
      "subtitle",
      (pointer) => onChange({ subtitleY: valueAt(pointer) }),
      (pointer) => onCommit({ subtitleY: valueAt(pointer) }),
    );
  };

  const startSize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const from = ratioAt(event.clientX, event.clientY);
    if (!from) return;

    // Kéo xuống là to ra, giống kéo góc dưới của một khối văn bản.
    const valueAt = (pointer: PointerEvent) => {
      const point = ratioAt(pointer.clientX, pointer.clientY);
      if (!point) return fontScale;

      return Number(
        clamp(
          fontScale + (point.y - from.y) * FONT_DRAG_GAIN,
          MIN_FONT_SCALE,
          MAX_FONT_SCALE,
        ).toFixed(4),
      );
    };

    onStart(
      "font",
      (pointer) => onChange({ fontScale: valueAt(pointer) }),
      (pointer) => onCommit({ fontScale: valueAt(pointer) }),
    );
  };

  const nudge = (patch: Partial<FrameLayout>) => {
    onChange(patch);
    onCommit(patch);
  };

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Kéo để đổi vị trí phụ đề"
        aria-valuemin={5}
        aria-valuemax={98}
        aria-valuenow={Math.round(subtitleY * 100)}
        onPointerDown={startPosition}
        onKeyDown={(event) => {
          const step = event.key === "ArrowUp" ? -0.01 : event.key === "ArrowDown" ? 0.01 : 0;
          if (step === 0) return;
          event.preventDefault();
          nudge({ subtitleY: clamp(subtitleY + step, 0.05, 0.98) });
        }}
        style={{ top: `${subtitleY * 100}%` }}
        className={`pointer-events-auto absolute inset-x-0 -translate-y-1/2 cursor-ns-resize border-y border-dashed transition-colors ${
          dragging === "subtitle"
            ? "border-brand bg-brand/10"
            : "border-transparent hover:border-brand/60"
        }`}
      >
        <span className="block h-14" />

        <button
          type="button"
          aria-label="Kéo để đổi cỡ chữ phụ đề"
          aria-valuemin={MIN_FONT_SCALE * 1000}
          aria-valuemax={MAX_FONT_SCALE * 1000}
          aria-valuenow={Math.round(fontScale * 1000)}
          role="slider"
          tabIndex={0}
          onPointerDown={startSize}
          onKeyDown={(event) => {
            const step =
              event.key === "ArrowUp" ? 0.002 : event.key === "ArrowDown" ? -0.002 : 0;
            if (step === 0) return;
            event.preventDefault();
            event.stopPropagation();
            nudge({
              fontScale: clamp(fontScale + step, MIN_FONT_SCALE, MAX_FONT_SCALE),
            });
          }}
          className={`absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 cursor-ns-resize rounded-full border text-[10px] font-bold leading-none transition-colors ${
            dragging === "font"
              ? "border-brand bg-brand text-[#10151e]"
              : "border-brand/70 bg-[#10151e]/70 text-brand hover:bg-brand hover:text-[#10151e]"
          }`}
        >
          A
        </button>
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
