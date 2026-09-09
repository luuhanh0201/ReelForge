"use client";

import {
  Eye,
  EyeOff,
  Music,
  Subtitles,
  Volume2,
  VolumeX,
  Image as ImageIcon,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
  MAX_SCENE_MS,
  MIN_SCENE_MS,
  type MediaAssetView,
  type ProjectLine,
} from "@/lib/studio/projects-api";
import { formatTimecode } from "@/lib/studio/timecode";
import type { Playback } from "@/lib/studio/use-playback";

const TRACK_LABEL_WIDTH = 116;

/**
 * 220px của đặc tả chia đúng: 36 cho hàng đầu, 24 cho thước giây, còn lại 160 cho 4 track.
 * Track cao hơn 40px thì track cuối bị cắt mất, mà đó lại là chỗ có núm âm lượng.
 */
const TRACK_HEIGHT = "h-10";

/**
 * Phân vùng 4 — thước thời gian nhiều track, cao 220px.
 *
 * Mọi khối định vị bằng **phần trăm** thay vì pixel: đổi kích thước cửa sổ thì không phải
 * đo lại gì. Chỉ lúc kéo đổi thời lượng mới cần biết bề rộng thật, và lúc đó đo một lần.
 */
export function Timeline({
  lines,
  assets,
  activeIndex,
  playback,
  totalMs,
  musicVolume,
  showImage,
  showCaption,
  onSelect,
  onDurationChange,
  onMusicVolumeChange,
  onToggleImage,
  onToggleCaption,
}: {
  lines: ProjectLine[];
  assets: MediaAssetView[];
  activeIndex: number;
  playback: Playback;
  totalMs: number;
  musicVolume: number;
  showImage: boolean;
  showCaption: boolean;
  onSelect: (index: number) => void;
  onDurationChange: (index: number, durationMs: number) => void;
  onMusicVolumeChange: (value: number) => void;
  onToggleImage: () => void;
  onToggleCaption: () => void;
}) {
  const laneRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ index: number; durationMs: number } | null>(
    null,
  );

  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const percent = (ms: number) => `${(ms / Math.max(1, totalMs)) * 100}%`;

  // Mốc bắt đầu cộng dồn, cùng công thức với `buildPreviewConfig` — hai chỗ lệch nhau thì
  // khối trên thước sẽ không trùng với hình đang hiện. Mốc của cảnh sau đọc từ phần tử
  // ngay trước, nên không cần biến đếm chạy ngoài vòng lặp.
  const blocks: { line: ProjectLine; startMs: number; durationMs: number }[] = [];
  for (const line of lines) {
    const previous = blocks[blocks.length - 1];
    blocks.push({
      line,
      startMs: previous ? previous.startMs + previous.durationMs : 0,
      durationMs:
        dragging?.index === line.index ? dragging.durationMs : line.durationMs,
    });
  }

  const seekFromEvent = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      playback.seek(ratio * totalMs);
    },
    [playback, totalMs],
  );

  /**
   * Kéo mép phải để đổi thời lượng cảnh.
   *
   * Chỉ gọi lên máy chủ khi **thả chuột**: gửi theo từng pixel di chuyển sẽ bắn hàng trăm
   * request cho một thao tác kéo.
   */
  const startResize = (index: number, current: number) => (
    event: React.PointerEvent<HTMLSpanElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const lane = laneRef.current;
    if (!lane) return;

    const msPerPixel = totalMs / lane.getBoundingClientRect().width;
    const startX = event.clientX;
    let latest = current;

    const onMove = (move: PointerEvent) => {
      latest = Math.round(
        Math.min(
          MAX_SCENE_MS,
          Math.max(MIN_SCENE_MS, current + (move.clientX - startX) * msPerPixel),
        ),
      );
      setDragging({ index, durationMs: latest });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragging(null);
      if (latest !== current) onDurationChange(index, latest);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <section className="flex h-[220px] shrink-0 flex-col border-t border-line bg-surface">
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-line px-3">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          Thước thời gian
        </span>
        <span className="font-mono text-[11px] font-bold tabular-nums text-ink">
          {formatTimecode(playback.timeMs)}
        </span>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-muted">
          Tổng {formatTimecode(totalMs)}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Cột nhãn track, cố định để các track thẳng hàng khi cuộn dọc. */}
        <div
          className="shrink-0 border-r border-line"
          style={{ width: TRACK_LABEL_WIDTH }}
        >
          <div className="h-6 border-b border-line" />

          <TrackLabel
            icon={<ImageIcon size={12} />}
            label="Hình ảnh"
            visible={showImage}
            onToggle={onToggleImage}
          />
          <TrackLabel
            icon={<Subtitles size={12} />}
            label="Phụ đề"
            visible={showCaption}
            onToggle={onToggleCaption}
          />
          {/* Hai track dưới chưa có dữ liệu, nên công tắc để mờ chứ không giả vờ bật được. */}
          <TrackLabel
            icon={<Volume2 size={12} />}
            label="Giọng đọc"
            muteIcon
            visible={false}
            disabledReason="Chưa lồng tiếng"
          />
          <TrackLabel
            icon={<Music size={12} />}
            label="Nhạc nền"
            muteIcon
            visible={false}
            disabledReason="Chưa có nhạc nền"
          >
            <input
              type="range"
              min={0}
              max={100}
              value={musicVolume}
              aria-label="Âm lượng nhạc nền"
              onChange={(event) => onMusicVolumeChange(Number(event.target.value))}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-[#60a5fa]"
            />
          </TrackLabel>
        </div>

        <div className="relative min-w-0 flex-1" ref={laneRef}>
          {/* Thước giây — bấm vào đâu nhảy tới đó. */}
          <div
            className="relative h-6 cursor-pointer border-b border-line"
            onClick={seekFromEvent}
            role="presentation"
          >
            {Array.from({ length: Math.floor(totalMs / 1000) + 1 }, (_, second) => (
              <span
                key={second}
                className="absolute top-0 h-full border-l border-line/70"
                style={{ left: percent(second * 1000) }}
              >
                {second % 5 === 0 ? (
                  <span className="ml-1 font-mono text-[9px] tabular-nums text-muted">
                    {second}s
                  </span>
                ) : null}
              </span>
            ))}
          </div>

          <div className="relative">
            {/* Track 1 — hình ảnh, khối kéo được để đổi thời lượng cảnh. */}
            <div
              className={`relative ${TRACK_HEIGHT} border-b border-line ${
                showImage ? "" : "opacity-40"
              }`}
            >
              {blocks.map(({ line, startMs, durationMs }) => {
                const asset = line.assetId ? byId.get(line.assetId) : undefined;

                return (
                  <div
                    key={line.index}
                    className={`absolute inset-y-1 overflow-hidden rounded-[4px] border ${
                      line.index === activeIndex
                        ? "border-brand bg-brand/20"
                        : "border-line bg-subtle"
                    }`}
                    style={{ left: percent(startMs), width: percent(durationMs) }}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(line.index)}
                      className="flex h-full w-full items-center gap-1.5 px-1.5 text-left"
                    >
                      {asset ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.url}
                          alt=""
                          crossOrigin="anonymous"
                          className="h-6 w-6 shrink-0 rounded-[3px] object-cover"
                        />
                      ) : null}
                      <span className="truncate font-mono text-[10px] font-bold tabular-nums text-ink">
                        {String(line.index + 1).padStart(2, "0")}
                      </span>
                    </button>

                    <span
                      role="separator"
                      aria-label={`Kéo để đổi thời lượng cảnh ${line.index + 1}`}
                      onPointerDown={startResize(line.index, line.durationMs)}
                      className="absolute inset-y-0 right-0 w-1.5 cursor-col-resize bg-brand/60 hover:bg-brand"
                    />
                  </div>
                );
              })}
            </div>

            {/* Track 2 — phụ đề. */}
            <div
              className={`relative ${TRACK_HEIGHT} border-b border-line ${
                showCaption ? "" : "opacity-40"
              }`}
            >
              {blocks.map(({ line, startMs, durationMs }) => (
                <button
                  key={line.index}
                  type="button"
                  onClick={() => onSelect(line.index)}
                  className={`absolute inset-y-1 overflow-hidden rounded-[4px] border px-1.5 text-left ${
                    line.index === activeIndex
                      ? "border-amber bg-amber/20"
                      : "border-line bg-subtle"
                  }`}
                  style={{ left: percent(startMs), width: percent(durationMs) }}
                >
                  <span className="line-clamp-2 text-[10px] leading-tight text-ink">
                    {line.text}
                  </span>
                </button>
              ))}
            </div>

            {/* Track 3 và 4 — chưa có dữ liệu thật, nói thẳng thay vì vẽ sóng âm giả. */}
            <EmptyTrack label="Chưa lồng tiếng — chọn giọng ở cột phải, phần tạo tiếng làm ở bước sau" />
            <EmptyTrack label="Chưa có thư viện nhạc nền" />
          </div>

          {/* Kim playhead phủ lên toàn bộ các track. */}
          <div
            className="pointer-events-none absolute inset-y-0 z-10 w-px bg-brand"
            style={{ left: percent(playback.timeMs) }}
          >
            <span className="absolute -left-[3px] top-0 h-1.5 w-1.5 rounded-full bg-brand" />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Nhãn track kèm công tắc hiển thị, đặt cạnh tên track như mọi phần mềm dựng phim.
 *
 * Công tắc chỉ đổi **cách xem trước**, không đổi video sẽ xuất ra — nên track nào chưa có
 * dữ liệu thì công tắc để mờ kèm lý do, chứ không bật tắt một thứ không tồn tại.
 */
function TrackLabel({
  icon,
  label,
  visible,
  muteIcon = false,
  disabledReason,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  visible: boolean;
  /** Track tiếng dùng biểu tượng loa thay vì con mắt. */
  muteIcon?: boolean;
  disabledReason?: string;
  onToggle?: () => void;
  children?: React.ReactNode;
}) {
  const OnIcon = muteIcon ? Volume2 : Eye;
  const OffIcon = muteIcon ? VolumeX : EyeOff;
  const Icon = visible ? OnIcon : OffIcon;

  return (
    <div
      className={`flex ${TRACK_HEIGHT} flex-col justify-center gap-0.5 border-b border-line px-2.5`}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
        {icon}
        <span className="min-w-0 flex-1 truncate">{label}</span>

        <button
          type="button"
          onClick={onToggle}
          disabled={!onToggle}
          aria-pressed={visible}
          title={disabledReason ?? (visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`)}
          aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] transition-colors ${
            !onToggle
              ? "cursor-not-allowed text-muted/40"
              : visible
                ? "text-ink hover:bg-subtle"
                : "text-muted/60 hover:bg-subtle hover:text-ink"
          }`}
        >
          <Icon size={12} />
        </button>
      </span>
      {children}
    </div>
  );
}

function EmptyTrack({ label }: { label: string }) {
  return (
    <div className={`flex ${TRACK_HEIGHT} items-center border-b border-line px-2`}>
      <span className="w-full truncate rounded-[4px] border border-dashed border-line px-2 py-1.5 text-[10px] text-muted">
        {label}
      </span>
    </div>
  );
}
