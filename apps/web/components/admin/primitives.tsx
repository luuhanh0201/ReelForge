"use client";

import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { ACCENT, type Accent } from "@/lib/accent";
import { PAGE_SIZES, type PaginationState } from "@/lib/admin/pagination";

/* ------------------------------------------------------------------ */
/* Khung thẻ chuẩn của admin (rounded-12, p-5)                          */
/* ------------------------------------------------------------------ */

export function AdminCard({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-card border border-line bg-surface ${padded ? "p-5" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Trạng thái — luôn đi kèm icon + nhãn, không dùng mỗi màu             */
/* ------------------------------------------------------------------ */

export type StatusTone = "up" | "degraded" | "down" | "unknown";

const STATUS: Record<StatusTone, { label: string; accent: Accent; icon: typeof ShieldCheck }> = {
  up: { label: "Hoạt động", accent: "mint", icon: ShieldCheck },
  degraded: { label: "Quá tải", accent: "amber", icon: AlertTriangle },
  down: { label: "Mất kết nối", accent: "danger", icon: XCircle },
  unknown: { label: "Chưa kiểm tra", accent: "info", icon: CircleHelp },
};

export function StatusBadge({
  status,
  label,
  className = "",
}: {
  status: StatusTone;
  label?: string;
  className?: string;
}) {
  const config = STATUS[status];
  const accent = ACCENT[config.accent];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-btn border px-2 py-1 text-[11px] font-bold ${accent.border} ${accent.softBg} ${accent.text} ${className}`}
    >
      <Icon size={12} />
      {label ?? config.label}
    </span>
  );
}

export function Pill({
  children,
  accent = "brand",
  className = "",
}: {
  children: ReactNode;
  /** "neutral" dùng cho trạng thái không mang sắc thái tốt/xấu (ví dụ: không có tải). */
  accent?: Accent | "neutral";
  className?: string;
}) {
  const tone =
    accent === "neutral"
      ? { border: "border-line", softBg: "bg-subtle", text: "text-muted" }
      : ACCENT[accent];

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-btn border px-2 py-0.5 text-[11px] font-bold ${tone.border} ${tone.softBg} ${tone.text} ${className}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Điều khiển                                                           */
/* ------------------------------------------------------------------ */

export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "border-brand bg-brand" : "border-line bg-subtle"
      }`}
    >
      <span
        className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all ${
          checked ? "left-6 bg-[#10151e]" : "left-1 bg-muted"
        }`}
      />
    </button>
  );
}

export function AdminButton({
  children,
  onClick,
  variant = "secondary",
  type = "button",
  disabled = false,
  className = "",
  title,
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  /** Nút chỉ có icon thì bắt buộc đặt để hover hiện tên và trình đọc màn hình đọc được. */
  title?: string;
  ariaLabel?: string;
}) {
  const variants = {
    primary: "bg-brand text-[#10151e] hover:bg-brand-hover",
    secondary: "border border-line bg-subtle text-ink hover:border-brand/45",
    ghost: "text-muted hover:bg-subtle hover:text-ink",
    danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
  } as const;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? title}
      className={`inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-btn px-4 text-sm font-semibold leading-none transition-colors [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function AdminInput({
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon?: ReactNode;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <label
      className={`flex h-9 items-center gap-2 rounded-btn border border-line bg-subtle px-3.5 focus-within:border-brand/50 ${className}`}
    >
      {icon}
      <input
        type={type}
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
      />
    </label>
  );
}

export function AdminSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <select
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-9 w-full appearance-none rounded-btn border border-line bg-subtle pl-3.5 pr-10 text-sm font-medium text-ink outline-none focus:border-brand/50"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Bảng dữ liệu                                                         */
/* ------------------------------------------------------------------ */

export function DataTable({
  headers,
  children,
  emptyMessage = "Không có dữ liệu khớp bộ lọc.",
  isEmpty = false,
}: {
  headers: string[];
  children: ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            {headers.map((header) => (
              <th
                key={header}
                className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-10 text-center text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TableRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-line/70 transition-colors last:border-0 hover:bg-subtle/60">
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-middle text-ink ${className}`}>{children}</td>;
}

/**
 * Thanh phân trang đặt ngay dưới `DataTable`, trong cùng thẻ với bảng.
 * Trạng thái do `usePagination` giữ; component này chỉ hiển thị và phát sự kiện.
 */
export function TablePagination({
  pagination,
  unit = "dòng",
  sizes = PAGE_SIZES,
}: {
  pagination: PaginationState;
  unit?: string;
  /** Mặc định là mức dùng chung cho bảng; lưới thẻ truyền bội số của số cột. */
  sizes?: readonly number[];
}) {
  const { page, pageCount, pageSize, total, from, to, setPage, setPageSize } = pagination;
  const number = (value: number) => value.toLocaleString("vi-VN");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-3">
      <div className="flex items-center gap-2">
        <AdminSelect
          ariaLabel="Số dòng mỗi trang"
          value={String(pageSize)}
          onChange={(value) => setPageSize(Number(value))}
          options={sizes.map((size) => ({
            id: String(size),
            label: `${size} ${unit}/trang`,
          }))}
        />

        <p className="font-mono text-[11px] text-muted">
          {total === 0
            ? `0 ${unit}`
            : `${number(from)}–${number(to)} / ${number(total)} ${unit}`}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <AdminButton
          variant="ghost"
          className="h-9 w-9 px-0"
          disabled={page <= 1}
          title="Trang trước"
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft size={17} />
        </AdminButton>

        <span className="whitespace-nowrap px-1 font-mono text-xs font-semibold text-ink">
          Trang {number(page)} / {number(pageCount)}
        </span>

        <AdminButton
          variant="ghost"
          className="h-9 w-9 px-0"
          disabled={page >= pageCount}
          title="Trang sau"
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight size={17} />
        </AdminButton>
      </div>
    </div>
  );
}
