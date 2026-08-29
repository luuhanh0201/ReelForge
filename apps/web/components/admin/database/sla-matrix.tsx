"use client";

import { ShieldCheck } from "lucide-react";
import {
  SLA_LEVELS,
  SLA_MATRIX,
  type DatabaseSnapshot,
  type SlaLevelId,
} from "@/config/admin/database.config";
import { ACCENT } from "@/lib/accent";
import { AdminCard } from "@/components/admin/primitives";

/** Mất kết nối thì mọi dòng đều hiện "—", riêng trạng thái cluster là Offline. */
const OFFLINE_LEVEL: SlaLevelId = "critical";

export function SlaMatrix({ snapshot }: { snapshot: DatabaseSnapshot | null }) {
  return (
    <AdminCard padded={false}>
      <div className="flex items-center gap-2 border-b border-line p-5">
        <ShieldCheck size={18} className="shrink-0 text-brand" />
        <h2 className="font-display text-base font-bold text-ink">
          Đánh giá trạng thái Database (SLA &amp; Health Thresholds)
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                Chỉ số giám sát
              </th>

              {SLA_LEVELS.map((level) => (
                <th
                  key={level.id}
                  className={`whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider ${ACCENT[level.accent].text}`}
                >
                  {level.label}
                </th>
              ))}

              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                Giá trị realtime
              </th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                Trạng thái
              </th>
            </tr>
          </thead>

          <tbody>
            {SLA_MATRIX.map((metric) => {
              const Icon = metric.icon;
              const reading = snapshot ? metric.read(snapshot) : null;
              const levelId = reading?.level ?? OFFLINE_LEVEL;
              const level = SLA_LEVELS.find((item) => item.id === levelId)!;
              const accent = ACCENT[level.accent];

              return (
                <tr
                  key={metric.id}
                  className="border-b border-line/70 transition-colors last:border-0 hover:bg-subtle/60"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      <Icon size={15} className="shrink-0 text-muted" />
                      {metric.label}
                    </span>
                  </td>

                  {SLA_LEVELS.map((column) => (
                    <td
                      key={column.id}
                      className={`whitespace-nowrap px-4 py-3 font-mono text-xs ${
                        column.id === levelId ? `${accent.text} font-bold` : "text-muted"
                      }`}
                    >
                      {metric.ranges[column.id]}
                    </td>
                  ))}

                  <td className="whitespace-nowrap px-4 py-3 font-mono text-sm font-bold text-ink">
                    {reading?.display ?? "—"}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-btn border px-2 py-1 text-[11px] font-bold ${accent.border} ${accent.softBg} ${accent.text}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${accent.bg}`} />
                      {snapshot ? level.label : "Mất kết nối"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}
