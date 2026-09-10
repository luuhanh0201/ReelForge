"use client";

import {
  Film,
  ImagePlus,
  Info,
  Loader2,
  Mic,
  Pause,
  Play,
  Sparkles,
  Trash2,
  Volume2,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SUBTITLE_PRESETS, type SubtitleStyle } from "@repo/shared";
import {
  DURATION_OPTIONS,
  MAX_VOICE_SPEED,
  MIN_VOICE_SPEED,
  type MediaAssetView,
  type Project,
  type ProjectLine,
  type ScriptTemplateOption,
  type StudioVoice,
  type TtsQuota,
} from "@/lib/studio/projects-api";
import { useVoicePreview } from "@/lib/studio/use-voice-preview";

export type PanelTab = "content" | "subtitle" | "voice";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "content", label: "Nội dung" },
  { id: "subtitle", label: "Phụ đề" },
  { id: "voice", label: "Giọng đọc" },
];

/** Nhãn dán khuyến mãi — chèn vào thoại và đăng ký luôn là cụm được tô màu nhấn. */
const PROMO_STICKERS = ["GIẢM 50%", "FREESHIP", "MUA 1 TẶNG 1", "CHỈ HÔM NAY"];

/**
 * `input[type=color]` chỉ nhận `#rrggbb`. Preset có màu dạng `rgba(...)`, đưa thẳng vào
 * thì ô màu hiện đen mà không báo gì — nên quy về một giá trị hiển thị được.
 */
const toHex = (value: string | undefined, fallback: string): string =>
  value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;

/**
 * Phân vùng 3 — nội dung, phụ đề và giọng đọc. Rộng 320px.
 *
 * Ba tab thay vì một cột cuộn dài: ở 320px mà xếp hết theo chiều dọc thì thao tác nào cũng
 * phải cuộn tìm, và người dùng mất dấu thứ mình vừa đổi.
 */
export function SubtitlePanel({
  tab,
  onTabChange,
  project,
  line,
  assets,
  templates,
  voices,
  duration,
  subtitle,
  busy,
  onDurationChange,
  onApplyTemplate,
  onLineTextChange,
  onLineTextCommit,
  onEmphasisChange,
  onSubtitleChange,
  onSubtitleCommit,
  onAssignAsset,
  onUploadAsset,
  onDeleteAsset,
  onVoiceChange,
  onSpeedChange,
  onSpeedCommit,
  quota,
  voicedLines,
  synthesizing,
  onSynthesize,
}: {
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  project: Project;
  line: ProjectLine | undefined;
  assets: MediaAssetView[];
  templates: ScriptTemplateOption[];
  voices: StudioVoice[];
  duration: number;
  subtitle: Partial<SubtitleStyle>;
  busy: boolean;
  onDurationChange: (value: number) => void;
  onApplyTemplate: (code: string) => void;
  onLineTextChange: (value: string) => void;
  onLineTextCommit: (value: string) => void;
  onEmphasisChange: (emphasis: string[]) => void;
  onSubtitleChange: (patch: Partial<SubtitleStyle>) => void;
  /**
   * Nhận thẳng kiểu chữ **sau khi đổi**, không để nơi gọi tự đọc lại state.
   *
   * `setState` của React không cập nhật ngay trong cùng một trình xử lý sự kiện, nên một
   * hàm lưu chỉ nhận `() => void` rồi tự đi tìm giá trị mới sẽ gửi đúng giá trị cũ.
   */
  onSubtitleCommit: (style: Partial<SubtitleStyle>) => void;
  onAssignAsset: (assetId: string) => void;
  onUploadAsset: (file: File) => void;
  onDeleteAsset: (assetId: string) => void;
  onVoiceChange: (voiceId: string | null) => void;
  onSpeedChange: (speed: number) => void;
  onSpeedCommit: (speed: number) => void;
  quota: TtsQuota | null;
  /** Số cảnh đã có tiếng, để nút nói đúng việc nó sắp làm. */
  voicedLines: number;
  synthesizing: boolean;
  onSynthesize: (force: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-line bg-surface">
      <div
        data-tour="studio.panel-tabs"
        className="flex h-11 shrink-0 items-center gap-0.5 border-b border-line px-2"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            aria-pressed={tab === item.id}
            className={`flex-1 rounded-btn px-3 py-1.5 text-xs font-bold transition-colors ${
              tab === item.id
                ? "bg-subtle text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "content" ? (
          <ContentTab
            project={project}
            line={line}
            assets={assets}
            templates={templates}
            duration={duration}
            busy={busy}
            fileRef={fileRef}
            onDurationChange={onDurationChange}
            onApplyTemplate={onApplyTemplate}
            onLineTextChange={onLineTextChange}
            onLineTextCommit={onLineTextCommit}
            onEmphasisChange={onEmphasisChange}
            onAssignAsset={onAssignAsset}
            onUploadAsset={onUploadAsset}
            onDeleteAsset={onDeleteAsset}
          />
        ) : null}

        {tab === "subtitle" ? (
          <SubtitleTab
            subtitle={subtitle}
            onChange={onSubtitleChange}
            onCommit={onSubtitleCommit}
            speed={project.voiceSpeed}
            onSpeedChange={onSpeedChange}
            onSpeedCommit={onSpeedCommit}
          />
        ) : null}

        {tab === "voice" ? (
          <VoiceTab
            voices={voices}
            voiceId={project.voiceId}
            speed={project.voiceSpeed}
            onVoiceChange={onVoiceChange}
            quota={quota}
            totalLines={project.lines.length}
            voicedLines={voicedLines}
            synthesizing={synthesizing}
            onSynthesize={onSynthesize}
          />
        ) : null}
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
        {title}
      </p>
      {children}
    </section>
  );
}

/** Ghi chú trung thực về thứ chưa có, thay vì để giao diện gợi ý là đã chạy. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-btn border border-line bg-canvas px-2.5 py-2 text-[11px] leading-relaxed text-muted">
      <Info size={12} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function ContentTab({
  project,
  line,
  assets,
  templates,
  duration,
  busy,
  fileRef,
  onDurationChange,
  onApplyTemplate,
  onLineTextChange,
  onLineTextCommit,
  onEmphasisChange,
  onAssignAsset,
  onUploadAsset,
  onDeleteAsset,
}: {
  project: Project;
  line: ProjectLine | undefined;
  assets: MediaAssetView[];
  templates: ScriptTemplateOption[];
  duration: number;
  busy: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onDurationChange: (value: number) => void;
  onApplyTemplate: (code: string) => void;
  onLineTextChange: (value: string) => void;
  onLineTextCommit: (value: string) => void;
  onEmphasisChange: (emphasis: string[]) => void;
  onAssignAsset: (assetId: string) => void;
  onUploadAsset: (file: File) => void;
  onDeleteAsset: (assetId: string) => void;
}) {
  const addSticker = (sticker: string) => {
    if (!line) return;

    const text = `${line.text.trim()} ${sticker}`.trim();
    onLineTextChange(text);
    onLineTextCommit(text);

    if (!line.emphasis.includes(sticker)) {
      onEmphasisChange([...line.emphasis, sticker]);
    }
  };

  return (
    <>
      <Section title="Mẫu kịch bản">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {DURATION_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onDurationChange(option)}
              className={`rounded-btn border px-3 py-1.5 text-xs font-semibold transition-colors ${
                duration === option
                  ? "border-brand bg-brand/15 text-ink"
                  : "border-line bg-canvas text-muted hover:border-brand/40"
              }`}
            >
              {option}s
            </button>
          ))}
        </div>

        <ul data-tour="studio.templates" className="flex flex-col gap-1.5">
          {templates.map((template) => (
            <li key={template.code}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onApplyTemplate(template.code)}
                className={`w-full rounded-btn border p-2.5 text-left transition-colors disabled:opacity-45 ${
                  project.scriptTemplate === template.code
                    ? "border-brand bg-brand/10"
                    : "border-line bg-canvas hover:border-brand/40"
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
                  <Sparkles size={12} className="text-brand" />
                  {template.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                  {template.description}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-2">
          <Note>
            <Wand2 size={11} className="mr-1 inline align-[-1px]" />
            Kịch bản đang dùng bộ mẫu có sẵn, chọn xong sửa tay được. Đường viết bằng AI sẽ
            thêm sau và không thay đổi gì ở đây.
          </Note>
        </div>
      </Section>

      {line ? (
        <>
          <Section title={`Lời thoại cảnh ${line.index + 1}`}>
            <textarea
              data-tour="studio.script"
              rows={5}
              value={line.text}
              maxLength={500}
              onChange={(event) => onLineTextChange(event.target.value)}
              onBlur={(event) => onLineTextCommit(event.target.value)}
              className="w-full resize-none rounded-btn border border-line bg-canvas px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-brand/50"
            />
            <p className="mt-1 text-right font-mono text-[10px] tabular-nums text-muted">
              {line.text.length}/500
            </p>
          </Section>

          <Section title="Cụm nhấn mạnh">
            {line.emphasis.length === 0 ? (
              <p className="mb-2 text-[11px] text-muted">
                Chưa có cụm nào được tô màu.
              </p>
            ) : (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {line.emphasis.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() =>
                      onEmphasisChange(line.emphasis.filter((item) => item !== phrase))
                    }
                    className="inline-flex items-center gap-1 rounded-btn bg-amber/15 px-2 py-1 text-[11px] font-semibold text-amber transition-colors hover:bg-danger/15 hover:text-danger"
                  >
                    {phrase}
                    <Trash2 size={10} />
                  </button>
                ))}
              </div>
            )}

            <p className="mb-1.5 text-[11px] text-muted">Nhãn khuyến mãi</p>
            <div className="flex flex-wrap gap-1.5">
              {PROMO_STICKERS.map((sticker) => (
                <button
                  key={sticker}
                  type="button"
                  disabled={busy}
                  onClick={() => addSticker(sticker)}
                  className="rounded-btn border border-line bg-canvas px-2 py-1 text-[11px] font-bold text-ink transition-colors hover:border-amber/60 disabled:opacity-45"
                >
                  {sticker}
                </button>
              ))}
            </div>
          </Section>
        </>
      ) : null}

      <Section title="Ảnh và video">
        <div data-tour="studio.assets" className="grid grid-cols-3 gap-1.5">
          {assets.map((asset) => (
            <div key={asset.id} className="group relative">
              <button
                type="button"
                disabled={busy || !line}
                onClick={() => onAssignAsset(asset.id)}
                aria-label="Gán vào cảnh đang chọn"
                className={`block w-full overflow-hidden rounded-btn border transition-colors disabled:opacity-45 ${
                  line?.assetId === asset.id
                    ? "border-brand"
                    : "border-line hover:border-brand/45"
                }`}
              >
                {/*
                  `crossOrigin` phải khớp với cách canvas tải ảnh. Thiếu nó, trình duyệt
                  cache bản "không CORS" từ thẻ này, rồi canvas xin lại đúng URL kèm CORS
                  lại nhận bản cache cũ không có header — ảnh hỏng và video không xuất
                  được, mà lỗi chỉ lộ ra ở bước cuối.
                */}
                {asset.kind === "video" ? (
                  // Thẻ `video` không tự chạy: chỉ cần một khung tĩnh làm hình đại diện,
                  // `preload="metadata"` đủ để trình duyệt vẽ khung đầu.
                  <video
                    src={asset.url}
                    crossOrigin="anonymous"
                    preload="metadata"
                    muted
                    className="aspect-square w-full bg-canvas object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.url}
                    alt=""
                    crossOrigin="anonymous"
                    className="aspect-square w-full object-cover"
                  />
                )}
              </button>

              {/* Nhãn loại: video và GIF cư xử khác ảnh nên người dùng phải phân biệt được. */}
              {asset.kind !== "image" ? (
                <span className="pointer-events-none absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded-[4px] bg-[#10151e]/80 px-1 py-0.5 text-[9px] font-bold text-white">
                  {asset.kind === "video" ? (
                    <>
                      <Film size={9} />
                      {asset.durationMs ? `${(asset.durationMs / 1000).toFixed(1)}s` : "MP4"}
                    </>
                  ) : (
                    "GIF"
                  )}
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => onDeleteAsset(asset.id)}
                aria-label="Xoá ảnh"
                className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-[#10151e]/80 text-white group-hover:flex"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            aria-label="Tải ảnh lên"
            className="flex aspect-square items-center justify-center rounded-btn border border-dashed border-line text-muted transition-colors hover:border-brand/45 hover:text-ink disabled:opacity-45"
          >
            <ImagePlus size={18} />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUploadAsset(file);
            event.target.value = "";
          }}
        />

        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Ảnh JPG, PNG, WebP hoặc GIF · tối đa 20MB. Video MP4 · tối đa 200MB và 2 phút.
          Khung hình tối thiểu 400×400.
        </p>
      </Section>
    </>
  );
}

function SubtitleTab({
  subtitle,
  onChange,
  onCommit,
  speed,
  onSpeedChange,
  onSpeedCommit,
}: {
  subtitle: Partial<SubtitleStyle>;
  onChange: (patch: Partial<SubtitleStyle>) => void;
  onCommit: (style: Partial<SubtitleStyle>) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  onSpeedCommit: (speed: number) => void;
}) {
  /** Nút bấm và ô màu là thao tác rời rạc: đổi xong lưu luôn. */
  const apply = (patch: Partial<SubtitleStyle>) => {
    onChange(patch);
    onCommit({ ...subtitle, ...patch });
  };

  // Thanh trượt lưu lúc thả tay, khi `subtitle` đã mang giá trị mới nhất.
  const commitCurrent = () => onCommit(subtitle);

  return (
    <>
      <Section title="Kiểu có sẵn">
        <div data-tour="studio.subtitle-presets" className="grid grid-cols-2 gap-1.5">
          {SUBTITLE_PRESETS.map((preset) => (
            <button
              key={preset.code}
              type="button"
              onClick={() => apply(preset.style)}
              title={preset.hint}
              className="rounded-btn border border-line bg-canvas p-2 text-left transition-colors hover:border-brand/45"
            >
              <span
                className="block truncate text-xs font-black"
                style={{
                  color: preset.style.activeColor,
                  WebkitTextStroke: `0.6px ${preset.style.strokeColor ?? "#0B0F17"}`,
                }}
              >
                {preset.label}
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug text-muted">
                {preset.hint}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Màu chữ">
        <div data-tour="studio.subtitle-colors" className="flex flex-col gap-2">
          <ColorRow
            label="Chữ thường"
            value={toHex(subtitle.color, "#FFFFFF")}
            onChange={(color) => apply({ color })}
          />
          <ColorRow
            label="Từ đang đọc"
            value={toHex(subtitle.activeColor, "#FF6B35")}
            onChange={(activeColor) => apply({ activeColor })}
          />
          <ColorRow
            label="Cụm nhấn"
            value={toHex(subtitle.emphasisColor, "#F2B237")}
            onChange={(emphasisColor) => apply({ emphasisColor })}
          />
        </div>
      </Section>

      <Section title="Cỡ chữ và độ đậm">
        <SliderRow
          label="Cỡ chữ"
          value={subtitle.fontScale ?? 0.045}
          min={0.02}
          max={0.12}
          step={0.002}
          display={`${Math.round((subtitle.fontScale ?? 0.045) * 1000) / 10}% chiều cao`}
          onChange={(fontScale) => onChange({ fontScale })}
          onCommit={commitCurrent}
        />

        <div className="mt-2 flex gap-1">
          {([600, 700, 800, 900] as const).map((weight) => (
            <button
              key={weight}
              type="button"
              onClick={() => apply({ fontWeight: weight })}
              aria-pressed={(subtitle.fontWeight ?? 700) === weight}
              className={`flex-1 rounded-btn border py-1.5 text-xs transition-colors ${
                (subtitle.fontWeight ?? 700) === weight
                  ? "border-brand bg-brand/15 text-ink"
                  : "border-line bg-canvas text-muted hover:border-brand/40"
              }`}
              style={{ fontWeight: weight }}
            >
              {weight}
            </button>
          ))}
        </div>

        <label className="mt-2 flex items-center gap-2 text-xs text-ink">
          <input
            type="checkbox"
            checked={subtitle.uppercase ?? false}
            onChange={(event) => apply({ uppercase: event.target.checked })}
            className="h-4 w-4 accent-[#ff6b35]"
          />
          VIẾT HOA TOÀN BỘ
        </label>
      </Section>

      <Section title="Viền và bóng">
        <SliderRow
          label="Độ dày viền"
          value={subtitle.strokeScale ?? 0.12}
          min={0}
          max={0.3}
          step={0.01}
          display={(subtitle.strokeScale ?? 0.12).toFixed(2)}
          onChange={(strokeScale) => onChange({ strokeScale })}
          onCommit={commitCurrent}
        />
        <SliderRow
          label="Bóng đổ"
          value={subtitle.shadowBlur ?? 0}
          min={0}
          max={40}
          step={1}
          display={`${subtitle.shadowBlur ?? 0}px`}
          onChange={(shadowBlur) => onChange({ shadowBlur })}
          onCommit={commitCurrent}
        />
      </Section>

      <Section title="Hiệu ứng">
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ["karaoke_glow", "Karaoke phát sáng"],
              ["pop_scale", "Bật to"],
              ["fade_slide", "Trượt mờ"],
              ["color_fill", "Đổ màu"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => apply({ animation: value })}
              aria-pressed={(subtitle.animation ?? "karaoke_glow") === value}
              className={`rounded-btn border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                (subtitle.animation ?? "karaoke_glow") === value
                  ? "border-brand bg-brand/15 text-ink"
                  : "border-line bg-canvas text-muted hover:border-brand/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      {/*
        Tốc độ đọc nằm ở đây chứ không ở tab Giọng đọc, vì nó quyết định **nhịp chữ chạy
        trên màn hình**: đọc nhanh thì mỗi từ sáng lên trong thời gian ngắn hơn, và cả cảnh
        cũng ngắn lại theo. Đó là thứ người dùng đang canh khi họ mở tab này.
      */}
      <Section title="Tốc độ đọc">
        <SliderRow
          label="Tốc độ"
          value={speed}
          min={MIN_VOICE_SPEED}
          max={MAX_VOICE_SPEED}
          step={0.05}
          display={`${speed.toFixed(2)}x`}
          onChange={onSpeedChange}
          onCommit={() => onSpeedCommit(speed)}
        />

        <div className="mt-2">
          <Note>
            Đổi tốc độ chỉ có tác dụng ở lần lồng tiếng sau. Các cảnh đã có tiếng vẫn giữ
            nhịp cũ cho tới khi bạn đọc lại.
          </Note>
        </div>
      </Section>
    </>
  );
}

/**
 * Bảng màu gợi ý.
 *
 * Chọn theo tình huống dùng thật của phụ đề bán hàng: trắng và đen là hai màu chữ nền
 * tảng, cam thương hiệu cho từ đang đọc, vàng cho cụm nhấn, còn lại là các màu tương phản
 * cao vẫn đọc được khi đặt lên ảnh sản phẩm.
 */
const SWATCHES = [
  "#FFFFFF",
  "#0B0F17",
  "#FF6B35",
  "#F2B237",
  "#F2545B",
  "#35C48F",
  "#60A5FA",
  "#A855F7",
  "#FF8F50",
  "#94A3B8",
];

/** Kích thước bảng, cần biết trước để tính toạ độ `fixed` mà không phải đo sau khi vẽ. */
const PANEL_WIDTH = 208;
const PANEL_HEIGHT = 160;

/** Chuẩn hoá thứ người dùng gõ về `#RRGGBB`; trả `null` khi chưa thành một mã màu hợp lệ. */
const normalizeHex = (input: string): string | null => {
  const raw = input.trim().replace(/^#/, "").toUpperCase();

  // Dạng rút gọn `F0A` là cách viết tắt hợp lệ của `FF00AA`.
  if (/^[0-9A-F]{3}$/.test(raw)) {
    return `#${raw[0]!}${raw[0]!}${raw[1]!}${raw[1]!}${raw[2]!}${raw[2]!}`;
  }

  return /^[0-9A-F]{6}$/.test(raw) ? `#${raw}` : null;
};

/**
 * Ô chọn màu.
 *
 * Bảng màu **mở sang trái** chứ không phải xuống dưới hay sang phải: panel này nằm sát mép
 * phải cửa sổ, mọi thứ bung ra bên phải đều bị cắt mất một phần.
 *
 * Không dùng `input[type=color]` làm lối vào chính vì bảng chọn màu của trình duyệt tự
 * quyết định vị trí — cũng chính là thứ đang bị cắt. Nó vẫn có mặt bên trong bảng cho ai
 * muốn dò màu tự do, còn đường chính là ô gõ mã màu và dãy màu gợi ý.
 */
function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  /**
   * Bảng dùng `position: fixed` với toạ độ đo từ nút, **không phải `absolute`**.
   *
   * Cột này có `overflow-y-auto`; một khối `absolute` tràn ra ngoài biên sẽ bị vùng cuộn
   * cắt mất — nó vẫn tồn tại trong DOM, vẫn đúng z-index, nhưng không nhìn thấy gì. Đó
   * chính là cái bẫy đã làm bảng màu biến mất.
   */
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [draft, setDraft] = useState(value);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const open = anchor !== null;

  // Mở bảng thì lấy lại màu hiện tại: người dùng có thể đã đổi nó bằng preset ở trên.
  const openPanel = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDraft(value);
    setAnchor({
      // Canh giữa theo hàng, và kẹp lại để bảng không tràn khỏi mép trên/dưới màn hình.
      top: Math.min(
        Math.max(8, rect.top + rect.height / 2 - PANEL_HEIGHT / 2),
        window.innerHeight - PANEL_HEIGHT - 8,
      ),
      // Mở sang **trái**: cột này nằm sát mép phải, mọi thứ bung sang phải đều bị cắt.
      left: Math.max(8, rect.left - PANEL_WIDTH - 8),
    });
  };

  const close = () => setAnchor(null);

  const valid = normalizeHex(draft);

  const commitDraft = () => {
    if (valid) onChange(valid);
    else setDraft(value);
  };

  // Cuộn cột đi thì bảng sẽ trôi khỏi nút vì toạ độ đã chốt lúc mở; đóng lại là đúng nhất.
  useEffect(() => {
    if (!open) return;

    const onScroll = () => close();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-ink">
      <span>{label}</span>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : openPanel())}
        aria-expanded={open}
        aria-label={`${label}: ${value}`}
        className="flex items-center gap-2 rounded-btn px-1 py-0.5 transition-colors hover:bg-subtle"
      >
        <span className="font-mono text-[10px] uppercase text-muted">{value}</span>
        <span
          className="h-7 w-9 rounded-btn border border-line"
          style={{ backgroundColor: value }}
        />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Đóng bảng màu"
            onClick={close}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div
            style={{ top: anchor.top, left: anchor.left, width: PANEL_WIDTH }}
            className="fixed z-50 rounded-card border border-line bg-surface p-2.5 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.6)]"
          >
            <p className="mb-1.5 text-[11px] font-semibold text-muted">{label}</p>

            <div className="grid grid-cols-5 gap-1.5">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => {
                    onChange(swatch);
                    setDraft(swatch);
                  }}
                  title={swatch}
                  aria-label={swatch}
                  className={`h-7 w-full rounded-[4px] border transition-transform hover:scale-105 ${
                    value.toUpperCase() === swatch
                      ? "border-brand ring-1 ring-brand"
                      : "border-line"
                  }`}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>

            <div className="mt-2.5 flex items-center gap-1.5">
              <span className="font-mono text-xs text-muted">#</span>
              <input
                value={draft.replace(/^#/, "")}
                maxLength={7}
                spellCheck={false}
                placeholder="FF6B35"
                aria-label={`Mã màu cho ${label}`}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitDraft();
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setDraft(value);
                    close();
                  }
                }}
                className={`h-8 min-w-0 flex-1 rounded-btn border bg-canvas px-2 font-mono text-xs uppercase text-ink outline-none ${
                  valid ? "border-line focus:border-brand/50" : "border-danger/60"
                }`}
              />

              {/* Đường phụ cho ai muốn dò màu tự do; bảng của trình duyệt tự đặt vị trí. */}
              <input
                type="color"
                value={valid ?? value}
                onChange={(event) => {
                  const next = event.target.value.toUpperCase();
                  setDraft(next);
                  onChange(next);
                }}
                aria-label={`Chọn màu tự do cho ${label}`}
                className="h-8 w-8 shrink-0 cursor-pointer rounded-btn border border-line bg-canvas p-0.5"
              />
            </div>

            {valid ? null : (
              <p className="mt-1 text-[10px] text-danger">
                Mã màu cần 3 hoặc 6 ký tự từ 0–9 và A–F.
              </p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Thanh trượt "xem ngay, lưu khi thả".
 *
 * `input[type=range]` bắn `change` theo từng pixel kéo; gọi máy chủ ở đó sẽ thành hàng
 * trăm request cho một lần chỉnh. `onChange` chỉ đổi trạng thái tại chỗ, `onCommit` mới là
 * lúc ghi xuống.
 */
function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  return (
    <label className="mt-2 block first:mt-0">
      <span className="flex items-center justify-between text-xs text-ink">
        {label}
        <span className="font-mono text-[10px] tabular-nums text-muted">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
        className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-[#ff6b35]"
      />
    </label>
  );
}

function VoiceTab({
  voices,
  voiceId,
  speed,
  onVoiceChange,
  quota,
  totalLines,
  voicedLines,
  synthesizing,
  onSynthesize,
}: {
  voices: StudioVoice[];
  voiceId: string | null;
  /** Chỉ để nghe thử đúng nhịp; thanh trượt đã chuyển sang tab Phụ đề. */
  speed: number;
  onVoiceChange: (voiceId: string | null) => void;
  quota: TtsQuota | null;
  totalLines: number;
  voicedLines: number;
  synthesizing: boolean;
  onSynthesize: (force: boolean) => void;
}) {
  const [gender, setGender] = useState<"all" | "female" | "male">("all");

  const counts = useMemo(
    () => ({
      all: voices.length,
      female: voices.filter((voice) => voice.gender === "female").length,
      male: voices.filter((voice) => voice.gender === "male").length,
    }),
    [voices],
  );

  const filtered = useMemo(
    () => (gender === "all" ? voices : voices.filter((voice) => voice.gender === gender)),
    [gender, voices],
  );

  // Gom theo vùng miền: người dùng chọn giọng theo "Bắc / Trung / Nam" trước, rồi mới tới tên.
  const byRegion = filtered.reduce<Record<string, StudioVoice[]>>((groups, voice) => {
    (groups[voice.region] ??= []).push(voice);
    return groups;
  }, {});

  // Chỉ có một vùng thì tiêu đề vùng chỉ tổ chiếm chỗ mà không phân biệt được gì.
  const showRegionHeadings = Object.keys(byRegion).length > 1;

  // Nghe thử lấy bản đã lưu sẵn, tốc độ áp bằng `playbackRate` nên nghe đúng tốc độ dự án.
  const audioRef = useRef<HTMLAudioElement>(null);
  const preview = useVoicePreview(audioRef, speed);

  return (
    <>
      {/* React sở hữu phần tử này nên rời trang là tiếng tắt theo, không cần dọn tay. */}
      <audio ref={audioRef} onEnded={preview.handleEnded} hidden />

      <Section title={`Giọng đọc (${voices.length})`}>
        {voices.length === 0 ? (
          <Note>
            Chưa có giọng nào được bật. Quản trị viên cần bật giọng ở mục Quản lý giọng đọc
            trước khi trang này chọn được.
          </Note>
        ) : (
          <div data-tour="studio.voice-list" className="flex flex-col gap-3">
            {/* Lọc theo giới tính: tiêu chí đầu tiên người dùng dùng để loại bớt danh sách. */}
            <div className="flex gap-1">
              {(
                [
                  ["all", "Tất cả"],
                  ["female", "Giọng nữ"],
                  ["male", "Giọng nam"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGender(value)}
                  aria-pressed={gender === value}
                  className={`flex-1 rounded-btn border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                    gender === value
                      ? "border-brand bg-brand/15 text-ink"
                      : "border-line bg-canvas text-muted hover:border-brand/40"
                  }`}
                >
                  {label}
                  <span className="ml-1 font-mono tabular-nums opacity-60">
                    {counts[value]}
                  </span>
                </button>
              ))}
            </div>

            {Object.entries(byRegion).map(([region, items]) => (
              <div key={region}>
                {showRegionHeadings ? (
                  <p className="mb-1.5 text-[11px] font-semibold text-muted">{region}</p>
                ) : null}
                <ul className="flex flex-col gap-1">
                  {items.map((voice) => (
                    <li key={voice.id}>
                      <span
                        className={`flex w-full items-center gap-1 rounded-btn border pr-1 transition-colors ${
                          voice.id === voiceId
                            ? "border-brand bg-brand/10"
                            : "border-line bg-canvas hover:border-brand/40"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onVoiceChange(voice.id === voiceId ? null : voice.id)
                          }
                          aria-pressed={voice.id === voiceId}
                          className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
                        >
                          <Volume2
                            size={13}
                            className={voice.id === voiceId ? "text-brand" : "text-muted"}
                          />
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
                            {voice.personaName}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              voice.gender === "female"
                                ? "bg-voice/15 text-voice"
                                : "bg-info/15 text-info"
                            }`}
                          >
                            {voice.gender === "female" ? "Nữ" : "Nam"}
                          </span>
                        </button>

                        {/*
                          Nút nghe thử tách khỏi nút chọn: người dùng cần nghe vài giọng rồi
                          mới quyết định, gộp làm một thì mỗi lần nghe lại đổi luôn giọng của
                          cả dự án.
                        */}
                        {voice.hasPreview ? (
                          <button
                            type="button"
                            onClick={() => void preview.toggle(voice.id)}
                            aria-label={`Nghe thử giọng ${voice.personaName}`}
                            title="Nghe thử — không tốn phí"
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-muted transition-colors hover:bg-subtle hover:text-ink"
                          >
                            {preview.loadingId === voice.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : preview.playingId === voice.id ? (
                              <Pause size={12} className="text-brand" />
                            ) : (
                              <Play size={12} />
                            )}
                          </button>
                        ) : (
                          <span
                            title="Giọng này chưa có bản nghe thử"
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-muted/30"
                          >
                            <Play size={12} />
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Lồng tiếng">
        <button
          type="button"
          data-tour="studio.synthesize"
          disabled={synthesizing || !voiceId || totalLines === 0}
          onClick={() => onSynthesize(false)}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-btn bg-brand text-sm font-bold text-[#10151e] transition-colors hover:bg-brand-hover disabled:opacity-45"
        >
          {synthesizing ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Mic size={15} />
          )}
          {voicedLines >= totalLines && totalLines > 0
            ? "Đã lồng tiếng đủ cảnh"
            : `Lồng tiếng ${totalLines - voicedLines}/${totalLines} cảnh còn lại`}
        </button>

        {voicedLines > 0 ? (
          <button
            type="button"
            disabled={synthesizing}
            onClick={() => onSynthesize(true)}
            className="mt-1.5 w-full rounded-btn border border-line bg-subtle py-2 text-xs font-semibold text-muted transition-colors hover:text-ink disabled:opacity-45"
          >
            Đọc lại toàn bộ
          </button>
        ) : null}

        {quota ? (
          <p className="mt-2 text-center text-[11px] text-muted">
            {quota.limit === 0
              ? `Hôm nay đã lồng tiếng ${quota.used} câu · gói của bạn không giới hạn`
              : `Hạn mức hôm nay: ${quota.used}/${quota.limit} câu`}
          </p>
        ) : null}

        <div className="mt-2">
          <Note>
            Câu đã lồng tiếng sẽ được bỏ qua ở lần bấm sau, và câu trùng nội dung với người
            khác lấy lại từ bộ nhớ đệm — cả hai đều không tính vào hạn mức. Sửa lời thoại
            thì câu đó cần đọc lại.
          </Note>
        </div>
      </Section>

      <Note>
        Cảnh đã có tiếng thì thời lượng do file audio quyết định, không kéo tay trên thước
        thời gian được nữa — kéo được thì chữ sẽ lệch tiếng.
      </Note>
    </>
  );
}
