"use client";

import { RefreshCw, Search, Trash2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import {
  BULL_QUEUES,
  type JobStatus,
  type QueueJobItem,
} from "@/config/admin/redis.config";
import { usePagination } from "@/lib/admin/pagination";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminSelect,
  DataTable,
  Pill,
  TableCell,
  TablePagination,
  TableRow,
} from "@/components/admin/primitives";

type StatusFilter = JobStatus | "all";

const STATUS_META = {
  active: { label: "ĐANG CHẠY", accent: "info" as const },
  waiting: { label: "WAITING", accent: "amber" as const },
  failed: { label: "FAILED", accent: "danger" as const },
};

/** Tầng 5 — bảng thanh tra jobs với bộ lọc và thao tác từng dòng. */
export function JobsInspector({
  jobs,
  onRetry,
  onDelete,
  onRetryAllFailed,
}: {
  jobs: QueueJobItem[];
  onRetry: (job: QueueJobItem) => void;
  onDelete: (job: QueueJobItem) => void;
  onRetryAllFailed: () => void;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [queueId, setQueueId] = useState("all");

  const counts = useMemo(
    () => ({
      all: jobs.length,
      active: jobs.filter((job) => job.status === "active").length,
      waiting: jobs.filter((job) => job.status === "waiting").length,
      failed: jobs.filter((job) => job.status === "failed").length,
    }),
    [jobs],
  );

  const filtered = useMemo(
    () =>
      jobs.filter((job) => {
        const keyword = query.trim().toLowerCase();
        const matchQuery =
          keyword === "" ||
          job.id.toLowerCase().includes(keyword) ||
          job.title.toLowerCase().includes(keyword) ||
          job.detail.toLowerCase().includes(keyword);

        return (
          matchQuery &&
          (status === "all" || job.status === status) &&
          (queueId === "all" || job.queueId === queueId)
        );
      }),
    [jobs, query, status, queueId],
  );

  const pagination = usePagination(filtered);

  const TABS: { id: StatusFilter; label: string }[] = [
    { id: "all", label: `Tất cả (${counts.all})` },
    { id: "active", label: `Đang chạy (${counts.active})` },
    { id: "waiting", label: `Đang chờ (${counts.waiting})` },
    { id: "failed", label: `Thất bại (${counts.failed})` },
  ];

  return (
    <AdminCard padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        <div
          role="tablist"
          aria-label="Lọc theo trạng thái job"
          className="inline-flex items-center gap-1 rounded-btn border border-line bg-subtle p-1"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={status === tab.id}
              onClick={() => setStatus(tab.id)}
              className={`h-7 whitespace-nowrap rounded-[4px] px-2.5 text-xs font-semibold transition-colors ${
                status === tab.id
                  ? "bg-brand text-[#10151e]"
                  : "text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <AdminInput
          ariaLabel="Tìm job"
          value={query}
          onChange={setQuery}
          placeholder="Tìm Job ID, tên sản phẩm..."
          icon={<Search size={15} className="shrink-0 text-muted" />}
          className="w-full sm:w-60"
        />

        <AdminSelect
          ariaLabel="Lọc theo hàng đợi"
          value={queueId}
          onChange={setQueueId}
          options={[
            { id: "all", label: "Mọi hàng đợi" },
            ...BULL_QUEUES.map((queue) => ({ id: queue.id, label: queue.name })),
          ]}
        />

        <AdminButton
          variant="primary"
          className="ml-auto"
          disabled={counts.failed === 0}
          onClick={onRetryAllFailed}
        >
          <RefreshCw size={14} />
          Thử lại tất cả job lỗi
        </AdminButton>
      </div>

      <DataTable
        headers={["Job", "Hàng đợi", "Trạng thái", "Thời gian", "Thao tác"]}
        isEmpty={filtered.length === 0}
        emptyMessage="Không có job nào khớp bộ lọc."
      >
        {pagination.items.map((job) => {
          const meta = STATUS_META[job.status];

          return (
            <TableRow key={job.id}>
              <TableCell>
                <code className="block font-mono text-[11px] font-bold text-brand">
                  {job.id}
                </code>
                <p className="mt-0.5 text-sm font-semibold text-ink">{job.title}</p>
                <p className="text-xs text-muted">{job.detail}</p>

                {job.error ? (
                  <p className="mt-2 flex items-start gap-1.5 rounded-btn border border-danger/35 bg-danger/10 px-2 py-1 text-[11px] font-semibold text-danger">
                    <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                    {job.error}
                  </p>
                ) : null}
              </TableCell>

              <TableCell>
                <code className="whitespace-nowrap rounded-btn bg-subtle px-2 py-1 font-mono text-[11px] text-muted">
                  {job.queueId}
                </code>
              </TableCell>

              <TableCell className="w-56">
                <Pill accent={meta.accent}>{meta.label}</Pill>

                {job.status === "active" && job.progress !== undefined ? (
                  <div className="mt-2">
                    <div className="h-1.5 w-40 overflow-hidden rounded-full bg-subtle">
                      <div
                        className="h-full rounded-full bg-info transition-[width] duration-500 ease-out"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <span className="mt-1 block font-mono text-[11px] text-muted">
                      {job.progress}%
                    </span>
                  </div>
                ) : null}

                {job.status === "failed" && job.attempt ? (
                  <span className="mt-1.5 block font-mono text-[11px] text-muted">
                    Thử lần {job.attempt}/{job.maxAttempts}
                  </span>
                ) : null}

                {job.status === "waiting" ? (
                  <span className="mt-1.5 block text-[11px] text-muted">
                    Chờ worker slot
                  </span>
                ) : null}
              </TableCell>

              <TableCell className="whitespace-nowrap font-mono text-xs text-muted">
                {job.elapsed}
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-1">
                  <AdminButton
                    variant="ghost"
                    className="h-9 w-9 px-0"
                    title="Thử lại job"
                    onClick={() => onRetry(job)}
                  >
                    <RefreshCw size={17} />
                  </AdminButton>
                  <AdminButton
                    variant="ghost"
                    className="h-9 w-9 px-0"
                    title="Xóa job khỏi hàng đợi"
                    onClick={() => onDelete(job)}
                  >
                    <Trash2 size={17} />
                  </AdminButton>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </DataTable>

      <TablePagination pagination={pagination} unit="job" />
    </AdminCard>
  );
}
