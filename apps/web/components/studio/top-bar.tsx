"use client";

import {
  ArrowLeft,
  Check,
  Cloud,
  Coins,
  Compass,
  Download,
  Hammer,
  Keyboard,
  Loader2,
  Mic,
  Music,
  Pencil,
  Plus,
  Redo2,
  Sparkles,
  Subtitles,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ASPECT_OPTIONS, type AspectRatio, type Resolution } from "@/lib/studio/projects-api";
import { formatTimecode } from "@/lib/studio/timecode";
import { usePlayhead, type Playback } from "@/lib/studio/use-playback";
import { useTourController } from "@/components/tour/tour-provider";

/** Trạng thái của đèn báo tự lưu. */
export type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "Chưa có thay đổi",
  saving: "Đang lưu…",
  saved: "Đã lưu",
  error: "Lưu thất bại",
};

/**
 * Tiện ích một chạm trong menu AI.
 *
 * `ready: false` là những thứ **chưa có hạ tầng phía sau** — chưa cắm mô hình ngôn ngữ,
 * chưa có thư viện nhạc. Hiện chúng ra mà khoá lại thì người dùng biết sản phẩm đang đi
 * tới đâu; để bấm được rồi báo lỗi thì tệ hơn hẳn là không có.
 */
const AI_TOOLS: {
  icon: LucideIcon;
  label: string;
  hint: string;
  ready: boolean;
  action?: "voice" | "subtitle";
}[] = [
  {
    icon: Mic,
    label: "Lồng tiếng toàn bộ video",
    hint: "Tạo tiếng cho mọi cảnh còn thiếu",
    ready: true,
    action: "voice",
  },
  {
    icon: Subtitles,
    label: "Chỉnh kiểu phụ đề",
    hint: "Phụ đề karaoke đã tự khớp theo lời thoại",
    ready: true,
    action: "subtitle",
  },
  {
    icon: Sparkles,
    label: "Viết lại hook giật gân",
    hint: "Cần mô hình ngôn ngữ, chưa cắm",
    ready: false,
  },
  {
    icon: Music,
    label: "Tự chọn nhạc nền hot trend",
    hint: "Chưa có thư viện nhạc",
    ready: false,
  },
];

/** Phím tắt thật của phòng dựng — khớp `use-hotkeys.ts`, không phải danh sách trang trí. */
const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Space", action: "Phát / Tạm dừng" },
  { keys: "[  ]", action: "Chuyển cảnh trước / sau" },
  { keys: "←  →", action: "Tua lùi / tới 0,5 giây" },
  { keys: "Ctrl + ↵", action: "Thêm cảnh mới" },
  { keys: "Ctrl + Z", action: "Hoàn tác" },
  { keys: "Ctrl + Shift + Z", action: "Làm lại" },
  { keys: "Ctrl + E", action: "Xuất video MP4" },
  { keys: "Esc", action: "Huỷ đang sửa tên dự án" },
];

/**
 * Thanh đỉnh của phòng dựng — cao 56px, chia ba cụm cân đối.
 *
 * Trái: điều hướng, tên dự án, trạng thái lưu, khổ video.
 * Giữa: lịch sử thao tác và đồng hồ.
 * Phải: công cụ AI, số dư, phím tắt, nút xuất.
 */
export function TopBar({
  title,
  aspectRatio,
  resolution,
  credits,
  saveState,
  canUndo,
  canRedo,
  playback,
  onTitleCommit,
  onAspectChange,
  onResolutionChange,
  onUndo,
  onRedo,
  onExport,
  onRunVoice,
  onOpenSubtitle,
  exporting,
  exportPercent,
  exportStage,
}: {
  title: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  credits: number;
  saveState: SaveState;
  canUndo: boolean;
  canRedo: boolean;
  playback: Playback;
  onTitleCommit: (value: string) => void;
  onAspectChange: (value: AspectRatio) => void;
  onResolutionChange: (value: Resolution) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onRunVoice: () => void;
  onOpenSubtitle: () => void;
  exporting: boolean;
  exportPercent: number;
  exportStage: string | null;
}) {
  const [menu, setMenu] = useState<"ai" | "shortcuts" | "export" | null>(null);

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur-md">
      {/* ── Cụm trái: điều hướng, tên dự án, trạng thái lưu, khổ video ── */}
      <Link
        href="/studio"
        title="Quay lại danh sách dự án"
        aria-label="Quay lại danh sách dự án"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-btn text-muted transition-colors hover:bg-subtle hover:text-ink"
      >
        <ArrowLeft size={16} />
      </Link>

      <span data-tour="studio.title">
        <ProjectTitle title={title} onCommit={onTitleCommit} />
      </span>

      <SaveLight state={saveState} />

      <div
        data-tour="studio.aspect"
        className="hidden items-center gap-0.5 rounded-btn border border-line bg-subtle p-0.5 lg:flex"
      >
        {ASPECT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onAspectChange(option.id)}
            title={option.hint}
            aria-pressed={aspectRatio === option.id}
            className={`rounded-[4px] px-2.5 py-1.5 font-mono text-[11px] font-bold transition-colors ${
              aspectRatio === option.id
                ? "bg-brand text-[#10151e]"
                : "text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* ── Cụm giữa: lịch sử thao tác và đồng hồ ── */}
      <div data-tour="studio.history" className="mx-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Hoàn tác (Ctrl+Z)"
          aria-label="Hoàn tác"
          className="inline-flex h-8 w-8 items-center justify-center rounded-btn text-muted transition-colors hover:bg-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Làm lại (Ctrl+Shift+Z)"
          aria-label="Làm lại"
          className="inline-flex h-8 w-8 items-center justify-center rounded-btn text-muted transition-colors hover:bg-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Redo2 size={15} />
        </button>

        <span className="h-4 w-px bg-line" />

        <Timecode playback={playback} />
      </div>

      {/* ── Cụm phải: công cụ AI, số dư, phím tắt, nút xuất ── */}
      <div className="relative flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          data-tour="studio.ai"
          onClick={() => setMenu(menu === "ai" ? null : "ai")}
          aria-expanded={menu === "ai"}
          className="hidden items-center gap-1.5 rounded-btn border border-voice/30 bg-voice/10 px-2.5 py-1.5 text-xs font-bold text-voice transition-colors hover:bg-voice/15 lg:inline-flex"
        >
          <Sparkles size={14} />
          AI Magic
        </button>

        <span
          data-tour="studio.credits"
          title={`${credits} credit — mỗi lần xuất video trừ 1`}
          className="hidden items-center gap-1.5 rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 text-xs font-bold text-amber sm:inline-flex"
        >
          <Coins size={13} />
          {credits}
          {/*
            Nạp thêm credit cần cổng thanh toán, chưa nối. Để nút bấm được rồi báo lỗi thì
            tệ hơn là để nó mờ và nói thẳng.
          */}
          <span
            title="Nạp credit đang được phát triển"
            aria-disabled="true"
            className="ml-0.5 inline-flex h-4 w-4 cursor-not-allowed items-center justify-center rounded-full bg-amber/20 opacity-50"
          >
            <Plus size={10} />
          </span>
        </span>

        <button
          type="button"
          onClick={() => setMenu(menu === "shortcuts" ? null : "shortcuts")}
          title="Bảng phím tắt"
          aria-label="Bảng phím tắt"
          aria-expanded={menu === "shortcuts"}
          className="inline-flex h-8 w-8 items-center justify-center rounded-btn text-muted transition-colors hover:bg-subtle hover:text-ink"
        >
          <Keyboard size={15} />
        </button>

        {/*
          Nền phẳng + quầng sáng, không gradient: quy tắc #1 của design system. Quầng làm
          bằng `shadow` màu brand nên vẫn đọc ra là một khối màu duy nhất.
        */}
        <button
          type="button"
          data-tour="studio.export"
          onClick={() => setMenu(menu === "export" ? null : "export")}
          disabled={exporting}
          aria-expanded={menu === "export"}
          className="relative ml-1 inline-flex items-center gap-2 overflow-hidden rounded-btn bg-brand px-4 py-2 text-[13px] font-black uppercase text-[#10151e] shadow-[0_4px_16px_-2px_rgba(255,107,53,0.45)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-progress disabled:hover:scale-100"
        >
          {exporting ? (
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-[#10151e]/20 transition-[width] duration-200"
              style={{ width: `${exportPercent}%` }}
            />
          ) : null}

          <span className="relative inline-flex items-center gap-2">
            {exporting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            {exporting ? `${exportStage ?? "đang xuất"} ${exportPercent}%` : "Xuất MP4"}
          </span>
        </button>

        {menu ? (
          <Popover onClose={() => setMenu(null)}>
            {menu === "ai" ? (
              <AiMenu
                onRunVoice={() => {
                  setMenu(null);
                  onRunVoice();
                }}
                onOpenSubtitle={() => {
                  setMenu(null);
                  onOpenSubtitle();
                }}
              />
            ) : null}

            {menu === "shortcuts" ? (
              <ShortcutSheet onClose={() => setMenu(null)} />
            ) : null}

            {menu === "export" ? (
              <ExportMenu
                aspectRatio={aspectRatio}
                resolution={resolution}
                credits={credits}
                onResolutionChange={onResolutionChange}
                onConfirm={() => {
                  setMenu(null);
                  onExport();
                }}
              />
            ) : null}
          </Popover>
        ) : null}
      </div>
    </header>
  );
}

/**
 * Tên dự án sửa tại chỗ.
 *
 * Chỉ vào chế độ sửa khi người dùng chủ động bấm — một ô nhập luôn mở ngay cạnh nút Xuất
 * rất dễ bị gõ nhầm vào. `Esc` trả lại tên cũ, `Enter` hoặc rời ô thì lưu.
 */
function ProjectTitle({
  title,
  onCommit,
}: {
  title: string;
  onCommit: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(title);
          setEditing(true);
        }}
        title="Bấm để đổi tên dự án"
        className="group inline-flex min-w-0 max-w-[220px] items-center gap-1.5 rounded-btn px-2 py-1.5 text-left transition-colors hover:bg-subtle xl:max-w-[320px]"
      >
        <span className="truncate font-display text-sm font-bold text-ink">{title}</span>
        <Pencil
          size={12}
          className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
        />
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== title) onCommit(next);
  };

  return (
    <input
      ref={inputRef}
      value={draft}
      maxLength={200}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") {
          event.stopPropagation();
          setDraft(title);
          setEditing(false);
        }
      }}
      aria-label="Tên dự án"
      className="min-w-0 max-w-[220px] flex-1 rounded-btn border border-brand/50 bg-canvas px-2 py-1.5 font-display text-sm font-bold text-ink outline-none xl:max-w-[320px]"
    />
  );
}

/**
 * Đồng hồ.
 *
 * Đây là component **duy nhất trong thanh đỉnh đăng ký playhead**, nên 60 lần render mỗi
 * giây chỉ chạm tới đúng vài ký tự chứ không kéo theo cả thanh công cụ.
 */
function Timecode({ playback }: { playback: Playback }) {
  const timeMs = usePlayhead(playback);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        inputMode="decimal"
        aria-label="Nhảy tới giây"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setEditing(false);
          if (event.key !== "Enter") return;

          const seconds = Number(draft.replace(",", "."));
          if (Number.isFinite(seconds)) playback.seek(seconds * 1000);
          setEditing(false);
        }}
        placeholder="giây"
        className="w-24 rounded-btn border border-brand/50 bg-canvas px-2 py-1 text-center font-mono text-[13px] font-bold tabular-nums text-ink outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft((timeMs / 1000).toFixed(1));
        setEditing(true);
      }}
      data-tour="studio.timecode"
      title="Bấm để nhảy tới một mốc giây"
      className="rounded-btn border border-line bg-canvas px-3 py-1 font-mono text-[13px] font-bold tabular-nums"
    >
      <span className="text-brand">{formatTimecode(timeMs)}</span>
      <span className="mx-1 text-muted">/</span>
      <span className="text-muted">{formatTimecode(playback.totalMs)}</span>
    </button>
  );
}

/** Lớp phủ bắt cú bấm ra ngoài và phím Esc để đóng menu. */
function Popover({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default"
      />
      <div className="absolute right-0 top-11 z-50 w-[320px] rounded-card border border-line bg-surface p-2 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.6)]">
        {children}
      </div>
    </>
  );
}

function AiMenu({
  onRunVoice,
  onOpenSubtitle,
}: {
  onRunVoice: () => void;
  onOpenSubtitle: () => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {AI_TOOLS.map((tool) => {
        const Icon = tool.icon;

        const body = (
          <>
            <Icon size={15} className={tool.ready ? "text-voice" : "text-muted"} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-ink">{tool.label}</span>
              <span className="block text-[11px] leading-snug text-muted">
                {tool.hint}
              </span>
            </span>
          </>
        );

        return (
          <li key={tool.label}>
            {tool.ready ? (
              <button
                type="button"
                onClick={tool.action === "voice" ? onRunVoice : onOpenSubtitle}
                className="flex w-full items-center gap-2.5 rounded-btn px-2.5 py-2 text-left transition-colors hover:bg-subtle"
              >
                {body}
              </button>
            ) : (
              <span
                aria-disabled="true"
                className="flex cursor-not-allowed items-center gap-2.5 rounded-btn px-2.5 py-2 opacity-55"
              >
                {body}
                <span className="inline-flex shrink-0 items-center gap-1 rounded-btn bg-amber/15 px-1.5 py-0.5 text-[9px] font-bold text-amber">
                  <Hammer size={9} />
                  Sắp có
                </span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const tour = useTourController();

  return (
    <div className="p-1">
      <p className="mb-2 px-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
        Phím tắt
      </p>
      <ul className="flex flex-col gap-0.5">
        {SHORTCUTS.map((item) => (
          <li
            key={item.keys}
            className="flex items-center justify-between gap-3 rounded-btn px-1.5 py-1.5"
          >
            <span className="text-xs text-ink">{item.action}</span>
            <kbd className="shrink-0 rounded-[4px] border border-line bg-canvas px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted">
              {item.keys}
            </kbd>
          </li>
        ))}
      </ul>
      <p className="mt-2 px-1.5 text-[10px] leading-relaxed text-muted">
        Phím tắt tạm ngưng khi con trỏ đang ở trong một ô nhập.
      </p>

      {/*
        Lối quay lại phần hướng dẫn. Người đã bấm bỏ qua sẽ không bao giờ thấy tour tự mở
        nữa, nên phải có đúng một chỗ cố định để họ tìm lại được.
      */}
      {tour.available ? (
        <button
          type="button"
          onClick={() => {
            onClose();
            tour.start();
          }}
          className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-btn border border-line bg-subtle text-xs font-semibold text-ink transition-colors hover:border-brand/45"
        >
          <Compass size={13} />
          Xem lại hướng dẫn
        </button>
      ) : null}
    </div>
  );
}

/** Chỉ liệt kê những gì `OUTPUT_PRESETS` thật sự dựng được — không có 4K, không có 60fps. */
const RESOLUTIONS: { id: Resolution; label: string; hint: string }[] = [
  { id: "720p", label: "720p", hint: "Nhẹ, xuất nhanh nhất" },
  { id: "1080p", label: "1080p", hint: "Đủ nét cho TikTok, Reels" },
  { id: "2k", label: "2K", hint: "Nặng hơn, máy yếu nên tránh" },
];

function ExportMenu({
  aspectRatio,
  resolution,
  credits,
  onResolutionChange,
  onConfirm,
}: {
  aspectRatio: AspectRatio;
  resolution: Resolution;
  credits: number;
  onResolutionChange: (value: Resolution) => void;
  onConfirm: () => void;
}) {
  const enough = credits >= 1;

  return (
    <div className="p-1">
      <p className="mb-2 px-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
        Xuất video
      </p>

      <p className="mb-1.5 px-1.5 text-[11px] text-muted">Độ phân giải</p>
      <div className="flex flex-col gap-1">
        {RESOLUTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onResolutionChange(option.id)}
            aria-pressed={resolution === option.id}
            className={`flex items-center gap-2 rounded-btn border px-2.5 py-2 text-left transition-colors ${
              resolution === option.id
                ? "border-brand bg-brand/10"
                : "border-line bg-canvas hover:border-brand/40"
            }`}
          >
            <span className="font-mono text-xs font-bold text-ink">{option.label}</span>
            <span className="text-[11px] text-muted">{option.hint}</span>
          </button>
        ))}
      </div>

      <dl className="mt-3 flex flex-col gap-1 rounded-btn bg-subtle px-2.5 py-2 text-[11px]">
        <div className="flex justify-between">
          <dt className="text-muted">Khổ video</dt>
          <dd className="font-mono font-bold text-ink">{aspectRatio}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Tốc độ khung hình</dt>
          <dd className="font-mono font-bold text-ink">30 fps</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Chi phí</dt>
          <dd className="font-bold text-amber">1 credit</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onConfirm}
        disabled={!enough}
        className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-btn bg-brand text-sm font-bold text-[#10151e] transition-colors hover:bg-brand-hover disabled:opacity-45"
      >
        <Download size={15} />
        {enough ? "Bắt đầu xuất" : "Không đủ credit"}
      </button>

      <p className="mt-2 px-1.5 text-[10px] leading-relaxed text-muted">
        Video dựng ngay trên máy bạn. Credit được hoàn lại nếu quá trình xuất thất bại.
      </p>
    </div>
  );
}

/**
 * Đèn tự lưu.
 *
 * Trạng thái hiện theo đúng lần lưu gần nhất và **không tự mờ đi**: người dùng liếc lên là
 * biết công việc của mình đã nằm trên máy chủ hay chưa. Một đèn tự tắt sau vài giây thì
 * đúng lúc họ nhìn lên lại chẳng có gì để đọc.
 */
function SaveLight({ state }: { state: SaveState }) {
  if (state === "idle") return null;

  const tone =
    state === "error" ? "text-danger" : state === "saved" ? "text-mint" : "text-muted";

  const Icon = state === "error" ? TriangleAlert : state === "saved" ? Check : Cloud;

  return (
    <span
      role="status"
      className={`hidden shrink-0 items-center gap-1.5 text-xs font-semibold xl:inline-flex ${tone}`}
    >
      <Icon size={14} className={state === "saving" ? "animate-pulse" : undefined} />
      {SAVE_LABEL[state]}
    </span>
  );
}
