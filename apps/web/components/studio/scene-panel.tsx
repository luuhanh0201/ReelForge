"use client";

import { Copy, GripVertical, ImageOff, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ProjectLine } from "@/lib/studio/projects-api";
import { formatSeconds } from "@/lib/studio/timecode";

/** Nhãn marketing của từng vai trò trong kịch bản. */
const ROLE: Record<ProjectLine["role"], { label: string; className: string }> = {
  hook: { label: "Hook", className: "bg-brand/15 text-brand" },
  usp: { label: "USP", className: "bg-info/15 text-info" },
  cta: { label: "CTA", className: "bg-mint/15 text-mint" },
};

/**
 * Phân vùng 1 — danh sách phân cảnh, rộng 260px.
 *
 * Kéo thả dùng HTML5 drag-and-drop thay vì thư viện: danh sách tối đa 6 phần tử, một cột,
 * không cần tới bộ va chạm của dnd-kit.
 */
export function ScenePanel({
  lines,
  activeIndex,
  busy,
  maxLines,
  onSelect,
  onAdd,
  onDuplicate,
  onRemove,
  onReorder,
}: {
  lines: ProjectLine[];
  activeIndex: number;
  busy: boolean;
  maxLines: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const finishDrag = () => {
    if (dragging !== null && over !== null && dragging !== over) {
      onReorder(dragging, over);
    }
    setDragging(null);
    setOver(null);
  };

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          Phân cảnh
        </span>
        <span className="font-mono text-[11px] font-bold tabular-nums text-muted">
          {lines.length}/{maxLines}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {lines.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs leading-relaxed text-muted">
            Chưa có cảnh nào. Chọn một mẫu kịch bản ở cột phải để bắt đầu.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {lines.map((line) => {
              const role = ROLE[line.role];
              const active = line.index === activeIndex;

              return (
                <li
                  key={line.index}
                  draggable
                  onDragStart={() => setDragging(line.index)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setOver(line.index);
                  }}
                  onDragEnd={finishDrag}
                  onDrop={(event) => {
                    event.preventDefault();
                    finishDrag();
                  }}
                  className={
                    over === line.index && dragging !== null && dragging !== line.index
                      ? "rounded-btn ring-2 ring-brand/60"
                      : undefined
                  }
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(line.index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(line.index);
                      }
                    }}
                    className={`group cursor-pointer rounded-btn border p-2 transition-colors ${
                      active
                        ? "border-brand bg-brand/10"
                        : "border-line bg-canvas hover:border-brand/40"
                    } ${dragging === line.index ? "opacity-40" : ""}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <GripVertical
                        size={13}
                        className="shrink-0 cursor-grab text-muted"
                        aria-hidden
                      />
                      <span className="font-mono text-[11px] font-bold tabular-nums text-muted">
                        {String(line.index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${role.className}`}
                      >
                        {role.label}
                      </span>

                      {line.assetId ? null : (
                        <ImageOff size={12} className="text-amber" aria-label="Chưa có ảnh" />
                      )}

                      <span className="ml-auto font-mono text-[11px] tabular-nums text-muted">
                        {formatSeconds(line.durationMs)}
                      </span>
                    </div>

                    <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-ink">
                      {line.text}
                    </p>

                    <div className="mt-1.5 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        disabled={busy || lines.length >= maxLines}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDuplicate(line.index);
                        }}
                        aria-label={`Nhân bản cảnh ${line.index + 1}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] border border-line bg-subtle text-muted transition-colors hover:text-ink disabled:opacity-40"
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemove(line.index);
                        }}
                        aria-label={`Xoá cảnh ${line.index + 1}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] border border-line bg-subtle text-muted transition-colors hover:border-danger/50 hover:text-danger disabled:opacity-40"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-line p-2">
        <button
          type="button"
          disabled={busy || lines.length >= maxLines}
          onClick={onAdd}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-btn border border-line bg-subtle text-xs font-semibold text-ink transition-colors hover:border-brand/45 disabled:opacity-45"
        >
          <Plus size={14} />
          Thêm cảnh
          <span className="font-mono text-[10px] text-muted">Ctrl+↵</span>
        </button>
      </div>
    </aside>
  );
}
