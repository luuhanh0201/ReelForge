"use client";

import { Users } from "lucide-react";
import type { BullQueueData } from "@/config/admin/redis.config";
import { AdminCard } from "@/components/admin/primitives";

const STAT_TONE = {
  waiting: "text-amber",
  active: "text-info",
  done: "text-mint",
  failed: "text-danger",
} as const;

const STAT_LABEL = {
  waiting: "Chờ",
  active: "Đang chạy",
  done: "Xong",
  failed: "Lỗi",
} as const;

/** Tầng 4 — sức khỏe 4 hàng đợi BullMQ. */
export function QueueCards({ queues }: { queues: BullQueueData[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {queues.map((queue) => {
        const Icon = queue.icon;

        return (
          <AdminCard key={queue.id} className="flex flex-col">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn bg-brand/12 text-brand">
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{queue.name}</p>
                <code className="block truncate font-mono text-[11px] text-muted">
                  {queue.id}
                </code>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted">{queue.purpose}</p>

            <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-line pt-3">
              {(["waiting", "active", "done", "failed"] as const).map((key) => (
                <div key={key}>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {STAT_LABEL[key]}
                  </dt>
                  <dd className={`font-mono text-lg font-bold ${STAT_TONE[key]}`}>
                    {queue[key].toLocaleString("vi-VN")}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 font-mono text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <Users size={12} className="text-brand" />
                {queue.workers} worker
              </span>
              <span>TB {queue.avgDuration}</span>
            </p>
          </AdminCard>
        );
      })}
    </div>
  );
}
