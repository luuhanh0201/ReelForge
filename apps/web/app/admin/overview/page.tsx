"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useState } from "react";
import {
  ADMIN_KPIS,
  KPI_VALUES,
  RANGE_UNIT,
  SERVICE_HEALTH,
  type RangeId,
  type ServiceStatus,
} from "@/config/admin/overview.config";
import { ACCENT } from "@/lib/accent";
import {
  AdminCard,
  AdminPageHeader,
  StatusBadge,
} from "@/components/admin/primitives";
import { RangeFilter } from "@/components/admin/range-filter";
import { RenderTrafficChart } from "@/components/admin/render-traffic-chart";

const TONE_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;
const TONE_CLASS = { up: "text-mint", down: "text-danger", flat: "text-muted" } as const;

const statusToTone = (status: ServiceStatus) => status;

export default function OverviewPage() {
  const [range, setRange] = useState<RangeId>("today");
  const values = KPI_VALUES[range];

  return (
    <>
      <AdminPageHeader
        title="Bảng điều khiển tổng quan"
        description="Sức khỏe cụm máy chủ, lưu lượng render và tình trạng các nhà cung cấp dịch vụ."
      />

      {/* Bộ lọc đứng một hàng phía trên và scope mọi số liệu bên dưới */}
      <RangeFilter value={range} onChange={setRange} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ADMIN_KPIS.map((kpi) => {
          const Icon = kpi.icon;
          const metric = values[kpi.id];
          const ToneIcon = TONE_ICON[kpi.deltaTone];
          const accent = ACCENT[kpi.accent];

          return (
            <AdminCard key={kpi.id}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold text-muted">{kpi.label}</p>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-btn ${accent.softBg} ${accent.text}`}
                >
                  <Icon size={18} />
                </span>
              </div>

              <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-ink">
                {metric?.value ?? "—"}
              </p>

              <p className="mt-2 flex items-center gap-1.5 text-xs">
                <span
                  className={`inline-flex items-center gap-0.5 font-bold ${TONE_CLASS[kpi.deltaTone]}`}
                >
                  <ToneIcon size={13} />
                  {metric?.delta ?? "—"}
                </span>
                <span className="text-muted">{kpi.hint}</span>
              </p>
            </AdminCard>
          );
        })}
      </div>

      <AdminCard>
        <RenderTrafficChart range={range} />
      </AdminCard>

      <AdminCard>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-base font-bold text-ink">
            Trạng thái nhà cung cấp
          </h2>
          <p className="text-xs text-muted">
            Cập nhật mỗi 60 giây · số liệu {RANGE_UNIT[range]}
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {SERVICE_HEALTH.map((service) => (
            <div
              key={service.id}
              className="rounded-card border border-line bg-canvas p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{service.name}</p>
                <StatusBadge status={statusToTone(service.status)} />
              </div>

              <dl className="mt-3 flex items-center justify-between font-mono text-xs">
                <div>
                  <dt className="text-muted">Latency</dt>
                  <dd className="font-bold text-ink">
                    {service.latencyMs > 0 ? `${service.latencyMs}ms` : "—"}
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-muted">Uptime</dt>
                  <dd className="font-bold text-ink">{service.uptime}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </AdminCard>
    </>
  );
}
