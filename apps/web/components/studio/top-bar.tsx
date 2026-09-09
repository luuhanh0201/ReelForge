"use client";

import { ArrowLeft, Check, Cloud, Download, Redo2, TriangleAlert, Undo2 } from "lucide-react";
import Link from "next/link";
import { ASPECT_OPTIONS, type AspectRatio } from "@/lib/studio/projects-api";

/** Trạng thái của đèn báo tự lưu. */
export type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "Chưa có thay đổi",
  saving: "Đang lưu…",
  saved: "Đã lưu",
  error: "Lưu thất bại",
};

/**
 * Phân vùng trên cùng — cao 56px, luôn nhìn thấy.
 *
 * Tên dự án sửa tại chỗ: `value` là state của trang, chỉ gọi lên máy chủ khi rời ô, vì gõ
 * đến đâu gọi đến đó sẽ bắn hàng chục request cho một cái tên.
 */
export function TopBar({
  title,
  aspectRatio,
  saveState,
  canUndo,
  canRedo,
  onTitleChange,
  onTitleCommit,
  onAspectChange,
  onUndo,
  onRedo,
  onExport,
}: {
  title: string;
  aspectRatio: AspectRatio;
  saveState: SaveState;
  canUndo: boolean;
  canRedo: boolean;
  onTitleChange: (value: string) => void;
  onTitleCommit: (value: string) => void;
  onAspectChange: (value: AspectRatio) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
      <Link
        href="/studio"
        aria-label="Về danh sách dự án"
        className="inline-flex h-9 w-9 items-center justify-center rounded-btn border border-line bg-subtle text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={16} />
      </Link>

      <input
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        onBlur={(event) => onTitleCommit(event.target.value)}
        aria-label="Tên dự án"
        className="min-w-0 max-w-[280px] flex-1 rounded-btn border border-transparent bg-transparent px-2 py-1.5 font-display text-sm font-bold text-ink outline-none hover:border-line focus:border-brand/50"
      />

      <div className="flex items-center gap-1 rounded-btn border border-line bg-subtle p-0.5">
        {ASPECT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onAspectChange(option.id)}
            title={option.hint}
            aria-pressed={aspectRatio === option.id}
            className={`rounded-[4px] px-3 py-1.5 font-mono text-xs font-bold transition-colors ${
              aspectRatio === option.id
                ? "bg-brand text-[#10151e]"
                : "text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <SaveLight state={saveState} />

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Hoàn tác (Ctrl+Z)"
          className="inline-flex h-9 w-9 items-center justify-center rounded-btn border border-line bg-subtle text-muted transition-colors hover:text-ink disabled:opacity-40 disabled:hover:text-muted"
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Làm lại (Ctrl+Shift+Z)"
          className="inline-flex h-9 w-9 items-center justify-center rounded-btn border border-line bg-subtle text-muted transition-colors hover:text-ink disabled:opacity-40 disabled:hover:text-muted"
        >
          <Redo2 size={15} />
        </button>

        {/*
          Nền phẳng + quầng sáng, không dùng gradient: quy tắc #1 của design system. Quầng
          làm bằng `shadow` màu brand nên vẫn đọc ra là một khối màu duy nhất.
        */}
        <button
          type="button"
          onClick={onExport}
          className="ml-1 inline-flex items-center gap-2 rounded-btn bg-brand px-4 py-2 text-sm font-bold text-[#10151e] shadow-[0_0_24px_-4px_rgba(255,107,53,0.75)] transition-colors hover:bg-brand-hover"
        >
          <Download size={15} />
          Xuất MP4
        </button>
      </div>
    </header>
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
    state === "error"
      ? "text-danger"
      : state === "saved"
        ? "text-mint"
        : "text-muted";

  const Icon = state === "error" ? TriangleAlert : state === "saved" ? Check : Cloud;

  return (
    <span
      role="status"
      className={`hidden items-center gap-1.5 text-xs font-semibold sm:inline-flex ${tone}`}
    >
      <Icon size={14} className={state === "saving" ? "animate-pulse" : undefined} />
      {SAVE_LABEL[state]}
    </span>
  );
}
