"use client";

import { CalendarRange } from "lucide-react";
import { RANGE_OPTIONS, type RangeId } from "@/config/admin/overview.config";

/**
 * Bộ lọc khoảng thời gian — đặt thành một hàng phía trên nội dung và scope
 * toàn bộ số liệu bên dưới (KPI + biểu đồ), để các con số luôn khớp nhau.
 */
export function RangeFilter({
  value,
  onChange,
}: {
  value: RangeId;
  onChange: (next: RangeId) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <CalendarRange size={14} />
        Khoảng thời gian
      </span>

      <div
        role="group"
        aria-label="Chọn khoảng thời gian"
        className="inline-flex items-center gap-1 rounded-btn border border-line bg-surface p-1"
      >
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={`h-7 rounded-[4px] px-4 text-xs font-semibold transition-colors ${
              value === option.id
                ? "bg-brand text-[#10151e]"
                : "text-muted hover:bg-subtle hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
