"use client";

import { ImagePlus, Info, Sparkles, Trash2, Volume2, Wand2 } from "lucide-react";
import { useRef } from "react";
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
} from "@/lib/studio/projects-api";

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
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-line bg-surface">
      <div className="flex h-11 shrink-0 items-center gap-0.5 border-b border-line px-2">
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
          />
        ) : null}

        {tab === "voice" ? (
          <VoiceTab
            voices={voices}
            voiceId={project.voiceId}
            speed={project.voiceSpeed}
            onVoiceChange={onVoiceChange}
            onSpeedChange={onSpeedChange}
            onSpeedCommit={onSpeedCommit}
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

        <ul className="flex flex-col gap-1.5">
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

      <Section title="Ảnh sản phẩm">
        <div className="grid grid-cols-3 gap-1.5">
          {assets.map((asset) => (
            <div key={asset.id} className="group relative">
              <button
                type="button"
                disabled={busy || !line}
                onClick={() => onAssignAsset(asset.id)}
                aria-label="Gán ảnh cho cảnh đang chọn"
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.url}
                  alt=""
                  crossOrigin="anonymous"
                  className="aspect-square w-full object-cover"
                />
              </button>

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
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUploadAsset(file);
            event.target.value = "";
          }}
        />

        <p className="mt-2 text-[11px] text-muted">
          JPG, PNG hoặc WebP · tối thiểu 400×400 · tối đa 20MB
        </p>
      </Section>
    </>
  );
}

function SubtitleTab({
  subtitle,
  onChange,
  onCommit,
}: {
  subtitle: Partial<SubtitleStyle>;
  onChange: (patch: Partial<SubtitleStyle>) => void;
  onCommit: (style: Partial<SubtitleStyle>) => void;
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
        <div className="grid grid-cols-2 gap-1.5">
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
        <div className="flex flex-col gap-2">
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
    </>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-ink">
      {label}
      <span className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase text-muted">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          aria-label={label}
          className="h-7 w-9 cursor-pointer rounded-btn border border-line bg-canvas p-0.5"
        />
      </span>
    </label>
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
  onSpeedChange,
  onSpeedCommit,
}: {
  voices: StudioVoice[];
  voiceId: string | null;
  speed: number;
  onVoiceChange: (voiceId: string | null) => void;
  onSpeedChange: (speed: number) => void;
  onSpeedCommit: (speed: number) => void;
}) {
  // Gom theo vùng miền: người dùng chọn giọng theo "Bắc / Trung / Nam" trước, rồi mới tới tên.
  const byRegion = voices.reduce<Record<string, StudioVoice[]>>((groups, voice) => {
    (groups[voice.region] ??= []).push(voice);
    return groups;
  }, {});

  return (
    <>
      <Section title={`Giọng đọc (${voices.length})`}>
        {voices.length === 0 ? (
          <Note>
            Chưa có giọng nào được bật. Quản trị viên cần bật giọng ở mục Quản lý giọng đọc
            trước khi trang này chọn được.
          </Note>
        ) : (
          <div className="flex flex-col gap-3">
            {Object.entries(byRegion).map(([region, items]) => (
              <div key={region}>
                <p className="mb-1.5 text-[11px] font-semibold text-muted">{region}</p>
                <ul className="flex flex-col gap-1">
                  {items.map((voice) => (
                    <li key={voice.id}>
                      <button
                        type="button"
                        onClick={() =>
                          onVoiceChange(voice.id === voiceId ? null : voice.id)
                        }
                        aria-pressed={voice.id === voiceId}
                        className={`flex w-full items-center gap-2 rounded-btn border px-2.5 py-2 text-left transition-colors ${
                          voice.id === voiceId
                            ? "border-brand bg-brand/10"
                            : "border-line bg-canvas hover:border-brand/40"
                        }`}
                      >
                        <Volume2
                          size={13}
                          className={voice.id === voiceId ? "text-brand" : "text-muted"}
                        />
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
                          {voice.personaName}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted">
                          {voice.gender === "female" ? "Nữ" : "Nam"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>

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
      </Section>

      <Note>
        Lựa chọn giọng và tốc độ đã được lưu vào dự án. Việc tạo file tiếng và ghép vào
        video nằm ở bước tiếp theo của hệ thống — hiện thời lượng mỗi cảnh vẫn do bạn tự
        đặt trên thước thời gian.
      </Note>
    </>
  );
}
