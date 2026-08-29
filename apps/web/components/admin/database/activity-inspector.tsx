"use client";

import { Search, Square } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ACTIVITY_STATE_META,
  SLOW_QUERY_SEC,
} from "@/config/admin/database.config";
import type { DatabaseActivityItem } from "@/lib/admin/database-api";
import { usePagination } from "@/lib/admin/pagination";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  DataTable,
  Pill,
  TableCell,
  TablePagination,
  TableRow,
} from "@/components/admin/primitives";

type StateFilter = "all" | "active" | "idle-tx";

const isIdleTx = (state: string) => state.startsWith("idle in transaction");

/** Phân vùng 4 — thanh tra tiến trình và truy vấn đang chạy (`pg_stat_activity`). */
export function ActivityInspector({
  items,
  loading,
  onTerminate,
}: {
  items: DatabaseActivityItem[];
  loading: boolean;
  onTerminate: (item: DatabaseActivityItem) => void;
}) {
  const [filter, setFilter] = useState<StateFilter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      all: items.length,
      active: items.filter((item) => item.state === "active").length,
      "idle-tx": items.filter((item) => isIdleTx(item.state)).length,
    }),
    [items],
  );

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const keyword = query.trim().toLowerCase();
        const matchQuery =
          keyword === "" ||
          String(item.pid).includes(keyword) ||
          item.application.toLowerCase().includes(keyword) ||
          item.username.toLowerCase().includes(keyword) ||
          item.query.toLowerCase().includes(keyword);

        const matchState =
          filter === "all" ||
          (filter === "active" && item.state === "active") ||
          (filter === "idle-tx" && isIdleTx(item.state));

        return matchQuery && matchState;
      }),
    [items, query, filter],
  );

  const pagination = usePagination(filtered);

  const TABS: { id: StateFilter; label: string }[] = [
    { id: "all", label: `Tất cả (${counts.all})` },
    { id: "active", label: `Active (${counts.active})` },
    { id: "idle-tx", label: `Idle in Tx (${counts["idle-tx"]})` },
  ];

  return (
    <AdminCard padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        <h2 className="mr-1 font-display text-base font-bold text-ink">
          Tiến trình &amp; truy vấn đang chạy
        </h2>

        <div
          role="tablist"
          aria-label="Lọc theo trạng thái tiến trình"
          className="inline-flex items-center gap-1 rounded-btn border border-line bg-subtle p-1"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              onClick={() => setFilter(tab.id)}
              className={`h-7 whitespace-nowrap rounded-[4px] px-2.5 text-xs font-semibold transition-colors ${
                filter === tab.id ? "bg-brand text-[#10151e]" : "text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <AdminInput
          ariaLabel="Tìm tiến trình"
          value={query}
          onChange={setQuery}
          placeholder="Tìm PID, ứng dụng, nội dung SQL..."
          icon={<Search size={15} className="shrink-0 text-muted" />}
          className="w-full sm:w-64"
        />
      </div>

      <DataTable
        headers={["PID & ứng dụng", "Trạng thái", "Thời gian", "Câu lệnh SQL", "Thao tác"]}
        isEmpty={filtered.length === 0}
        emptyMessage={
          loading ? "Đang đọc pg_stat_activity..." : "Không có tiến trình nào khớp bộ lọc."
        }
      >
        {pagination.items.map((item) => {
          const meta = ACTIVITY_STATE_META[item.state] ?? {
            label: item.state,
            accent: "info" as const,
          };
          const slow = item.durationSec >= SLOW_QUERY_SEC;

          return (
            <TableRow key={item.pid}>
              <TableCell className="whitespace-nowrap">
                <code className="block font-mono text-[11px] font-bold text-muted">
                  PID: {item.pid}
                </code>
                <p className="mt-0.5 text-sm font-semibold text-brand">{item.application}</p>
                <p className="font-mono text-[11px] text-muted">{item.username}</p>
              </TableCell>

              <TableCell className="whitespace-nowrap">
                <Pill accent={meta.accent}>{meta.label}</Pill>
                {item.waitEvent ? (
                  <span className="mt-1.5 block font-mono text-[11px] text-muted">
                    chờ: {item.waitEvent}
                  </span>
                ) : null}
              </TableCell>

              <TableCell
                className={`whitespace-nowrap font-mono text-xs font-bold ${
                  slow ? "text-brand" : "text-muted"
                }`}
              >
                {item.durationSec.toFixed(2)}s
              </TableCell>

              <TableCell className="min-w-[280px] max-w-[420px]">
                <code
                  title={item.query}
                  className="block max-h-10 overflow-hidden rounded-btn bg-[#10151e]/30 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-ink transition-[max-height] duration-200 hover:max-h-48 hover:overflow-auto"
                >
                  {item.query}
                </code>
              </TableCell>

              <TableCell>
                <AdminButton variant="danger" onClick={() => onTerminate(item)}>
                  <Square size={14} />
                  Ngắt lệnh
                </AdminButton>
              </TableCell>
            </TableRow>
          );
        })}
      </DataTable>

      <TablePagination pagination={pagination} unit="tiến trình" />
    </AdminCard>
  );
}
