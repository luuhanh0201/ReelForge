"use client";

import { Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { BLOAT_WARNING_PERCENT } from "@/config/admin/database.config";
import type { DatabaseTableItem } from "@/lib/admin/database-api";
import { usePagination } from "@/lib/admin/pagination";
import {
  AdminButton,
  AdminCard,
  DataTable,
  Pill,
  TableCell,
  TablePagination,
  TableRow,
} from "@/components/admin/primitives";

const number = (value: number) => value.toLocaleString("vi-VN");

/** Dưới 1GB thì hiện MB cho dễ đọc — database mới còn rất nhỏ. */
const size = (gb: number) =>
  gb >= 1 ? `${gb.toFixed(2)} GB` : `${(gb * 1024).toFixed(1)} MB`;

const vacuumLabel = (iso: string | null) => {
  if (!iso) return "Chưa chạy";

  const date = new Date(iso);
  const pad = (value: number) => value.toString().padStart(2, "0");
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  return sameDay
    ? `Hôm nay, ${clock}`
    : `${pad(date.getDate())}/${pad(date.getMonth() + 1)}, ${clock}`;
};

/** Phân vùng 5 — dung lượng bảng, index và sức khỏe auto-vacuum. */
export function TableAnalyzer({
  items,
  loading,
  vacuuming,
  onVacuum,
}: {
  items: DatabaseTableItem[];
  loading: boolean;
  vacuuming: string | null;
  onVacuum: (table: DatabaseTableItem) => void;
}) {
  const pagination = usePagination(items);

  return (
    <AdminCard padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        <h2 className="font-display text-base font-bold text-ink">
          Phân bổ dung lượng bảng &amp; auto-vacuum
        </h2>
        <Pill accent="info">Cảnh báo bloat &gt; {BLOAT_WARNING_PERCENT}%</Pill>
      </div>

      <DataTable
        headers={["Bảng", "Số dòng", "Data", "Index", "Tổng", "Bloat", "Vacuum gần nhất", ""]}
        isEmpty={items.length === 0}
        emptyMessage={
          loading ? "Đang đọc pg_stat_user_tables..." : "Database chưa có bảng nghiệp vụ nào."
        }
      >
        {pagination.items.map((table) => {
          const bloated = table.bloatPercent > BLOAT_WARNING_PERCENT;
          const running = vacuuming === table.name;

          return (
            <TableRow key={table.name}>
              <TableCell className="whitespace-nowrap">
                <code className="font-mono text-sm font-bold text-brand">{table.name}</code>
              </TableCell>

              <TableCell className="whitespace-nowrap font-mono text-xs text-ink">
                {number(table.liveRows)}
                <span className="ml-1 text-muted">dòng</span>
              </TableCell>

              <TableCell className="whitespace-nowrap font-mono text-xs text-muted">
                {size(table.dataGb)}
              </TableCell>

              <TableCell className="whitespace-nowrap font-mono text-xs text-muted">
                {size(table.indexGb)}
              </TableCell>

              <TableCell className="whitespace-nowrap font-mono text-xs font-bold text-ink">
                {size(table.totalGb)}
              </TableCell>

              <TableCell className="whitespace-nowrap">
                <span
                  className={`flex items-center gap-1.5 font-mono text-xs font-bold ${
                    bloated ? "text-amber" : "text-muted"
                  }`}
                >
                  {bloated ? <TriangleAlert size={13} className="shrink-0" /> : null}
                  {table.bloatPercent.toFixed(1)}%
                </span>
                <span className="mt-0.5 block font-mono text-[11px] text-muted">
                  {number(table.deadRows)} dòng chết
                </span>
              </TableCell>

              <TableCell className="whitespace-nowrap font-mono text-xs text-muted">
                {vacuumLabel(table.lastVacuum)}
              </TableCell>

              <TableCell>
                <AdminButton
                  variant={bloated ? "primary" : "secondary"}
                  disabled={running}
                  onClick={() => onVacuum(table)}
                >
                  {running ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {running ? "Đang chạy..." : "VACUUM"}
                </AdminButton>
              </TableCell>
            </TableRow>
          );
        })}
      </DataTable>

      <TablePagination pagination={pagination} unit="bảng" />
    </AdminCard>
  );
}
