"use client";

import { Database, RefreshCw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  SLA_LEVEL,
  SLA_MATRIX,
  resolveClusterLevel,
  type DatabaseSnapshot,
} from "@/config/admin/database.config";
import {
  REFRESH_OPTIONS,
  resolveRefreshMs,
  type RefreshOptionId,
} from "@/config/admin/monitoring.config";
import { ACCENT } from "@/lib/accent";
import { recordAudit } from "@/lib/admin/audit-store";
import { formatUptime } from "@/lib/admin/api-client";
import {
  fetchDatabaseActivity,
  fetchDatabaseOverview,
  fetchDatabaseTables,
  terminateBackend,
  vacuumTable,
  type DatabaseActivityItem,
  type DatabaseTableItem,
} from "@/lib/admin/database-api";
import {
  AdminButton,
  AdminCard,
  AdminPageHeader,
  AdminSelect,
  Pill,
} from "@/components/admin/primitives";
import { AdminModal } from "@/components/admin/admin-modal";
import { ActivityInspector } from "@/components/admin/database/activity-inspector";
import { SlaMatrix } from "@/components/admin/database/sla-matrix";
import { TableAnalyzer } from "@/components/admin/database/table-analyzer";
import { useToast } from "@/components/ui/toast";

const clockLabel = () => {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

export default function DatabasePage() {
  const toast = useToast();
  const [snapshot, setSnapshot] = useState<DatabaseSnapshot | null>(null);
  const [activity, setActivity] = useState<DatabaseActivityItem[]>([]);
  const [tables, setTables] = useState<DatabaseTableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineReason, setOfflineReason] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState("—");
  const [refreshId, setRefreshId] = useState<RefreshOptionId>("15s");
  const [vacuuming, setVacuuming] = useState<string | null>(null);
  const [killTarget, setKillTarget] = useState<DatabaseActivityItem | null>(null);

  // Deadlock chỉ được coi là nguy cấp khi tăng thêm so với lần đọc trước.
  const previousDeadlocks = useRef<number | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);

    try {
      const [overview, activityResult, tablesResult] = await Promise.all([
        fetchDatabaseOverview(),
        fetchDatabaseActivity(),
        fetchDatabaseTables(),
      ]);

      const previous = previousDeadlocks.current;
      previousDeadlocks.current = overview.deadlocks;

      setSnapshot({
        ...overview,
        deadlockRising: previous !== null && overview.deadlocks > previous,
      });
      setActivity(activityResult.items);
      setTables(tablesResult.items);
      setOfflineReason(null);
    } catch (error) {
      setSnapshot(null);
      setOfflineReason(error instanceof Error ? error.message : "Không gọi được API");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastCheck(clockLabel());
    }
  }, []);

  const refreshMs = resolveRefreshMs(refreshId);

  useEffect(() => {
    // Gọi qua timer để không setState đồng bộ ngay trong thân effect.
    const first = window.setTimeout(() => void load(), 0);
    if (refreshMs === 0) return () => window.clearTimeout(first);

    const timer = window.setInterval(() => void load(), refreshMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load, refreshMs]);

  const view = snapshot;

  const online = view !== null;
  const clusterLevel = view ? resolveClusterLevel(view) : "critical";
  const clusterAccent = ACCENT[SLA_LEVEL[clusterLevel].accent];

  const clusterLabel = !online
    ? "OFFLINE (MẤT KẾT NỐI)"
    : clusterLevel === "normal"
      ? "ONLINE (BÌNH THƯỜNG)"
      : clusterLevel === "critical"
        ? "CRITICAL (NGUY CẤP)"
        : "DEGRADED (HIỆU NĂNG GIẢM)";

  const refresh = async () => {
    await load();
    toast(`Đã đồng bộ lại số liệu lúc ${clockLabel()}`);
  };

  const confirmKill = async () => {
    if (!killTarget) return;

    const target = killTarget;
    setKillTarget(null);

    try {
      await terminateBackend(target.pid);
      setActivity((current) => current.filter((item) => item.pid !== target.pid));
      toast(`Đã ngắt tiến trình ${target.pid} (${target.application})`, "warning");
      recordAudit({
        action: "Ngắt tiến trình PostgreSQL",
        target: `PID ${target.pid} · ${target.application}`,
        level: "critical",
      });
      await load();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : `Không ngắt được PID ${target.pid}`,
        "danger",
      );
      recordAudit({
        action: "Ngắt tiến trình PostgreSQL",
        target: `PID ${target.pid}`,
        level: "critical",
        success: false,
      });
    }
  };

  const runVacuum = async (table: DatabaseTableItem) => {
    setVacuuming(table.name);

    try {
      const result = await vacuumTable(table.name);
      toast(`VACUUM ANALYZE ${result.table} xong trong ${result.durationMs}ms`);
      recordAudit({
        action: "Chạy VACUUM ANALYZE",
        target: `${result.table} · ${result.durationMs}ms`,
        level: "warning",
      });
      await load();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : `Không chạy được VACUUM ${table.name}`,
        "danger",
      );
    } finally {
      setVacuuming(null);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Cơ sở dữ liệu PostgreSQL"
        description="Số liệu đọc trực tiếp từ database đang chạy."
      />

      {/* Phân vùng 1 — thanh trạng thái & nhịp tim */}
      <AdminCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-card ${clusterAccent.softBg} ${clusterAccent.text}`}
            >
              <Database size={24} />
            </span>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-bold text-ink">
                  PostgreSQL Database Health &amp; Metrics
                </h2>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${clusterAccent.softBg} ${clusterAccent.text}`}
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${clusterAccent.bg}`}
                    />
                    <span
                      className={`relative inline-flex h-2 w-2 rounded-full ${clusterAccent.bg}`}
                    />
                  </span>
                  {clusterLabel}
                </span>

                {view ? (
                  <code className="rounded-btn bg-subtle px-2 py-0.5 font-mono text-[11px] text-muted">
                    PostgreSQL {view.version}
                  </code>
                ) : null}
              </div>

              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
                <span>Node: {view?.host ?? "—"}</span>
                <span>Uptime: {view ? formatUptime(view.uptimeSeconds) : "—"}</span>
                <span>Cache hit: {view ? `${view.cacheHitRate}%` : "—"}</span>
                <span>Kiểm tra lần cuối: {lastCheck}</span>
              </p>

              {offlineReason ? (
                <p className="mt-2 text-xs text-danger">{offlineReason}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AdminSelect
              ariaLabel="Chu kỳ tự động làm mới"
              value={refreshId}
              onChange={setRefreshId}
              options={REFRESH_OPTIONS.map((option) => ({
                id: option.id,
                label: `Tự làm mới: ${option.label}`,
              }))}
            />

            <AdminButton onClick={() => void refresh()} disabled={refreshing}>
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Làm mới ngay
            </AdminButton>
          </div>
        </div>
      </AdminCard>

      {/* Phân vùng 2 — ma trận ngưỡng SLA */}
      <SlaMatrix snapshot={view} />

      {/* Phân vùng 3 — 6 thẻ KPI trọng tâm */}
      {loading ? (
        <AdminCard>
          <p className="py-8 text-center text-sm text-muted">Đang đọc số liệu PostgreSQL...</p>
        </AdminCard>
      ) : !view ? (
        <AdminCard className="border-danger/40 bg-danger/5">
          <p className="flex items-start gap-2.5 text-sm text-ink">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-danger" />
            <span>
              <strong className="font-bold">Không đọc được số liệu PostgreSQL.</strong> Kiểm
              tra API có đang chạy ở <code className="font-mono">localhost:3001</code> và
              biến <code className="font-mono">DATABASE_URL</code> trong{" "}
              <code className="font-mono">apps/api/.env</code>.
            </span>
          </p>
        </AdminCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {SLA_MATRIX.map((metric) => {
            const reading = metric.read(view);
            const accent = ACCENT[SLA_LEVEL[reading.level].accent];
            const Icon = metric.icon;

            return (
              <AdminCard key={metric.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-muted">{metric.label}</p>
                  <Icon size={16} className="shrink-0 text-muted" />
                </div>

                <p className={`mt-3 font-mono text-xl font-bold ${accent.text}`}>
                  {reading.display}
                </p>

                <Pill accent={SLA_LEVEL[reading.level].accent} className="mt-3 self-start">
                  {SLA_LEVEL[reading.level].label}
                </Pill>

                {reading.detail ? (
                  <p
                    className="mt-2 truncate font-mono text-[11px] text-muted"
                    title={reading.detail}
                  >
                    {reading.detail}
                  </p>
                ) : null}

              </AdminCard>
            );
          })}
        </div>
      )}

      {/* Phân vùng 4 — thanh tra tiến trình */}
      <ActivityInspector items={activity} loading={loading} onTerminate={setKillTarget} />

      {/* Phân vùng 5 — dung lượng bảng & auto-vacuum */}
      <TableAnalyzer
        items={tables}
        loading={loading}
        vacuuming={vacuuming}
        onVacuum={(table) => void runVacuum(table)}
      />

      <AdminModal
        open={killTarget !== null}
        onClose={() => setKillTarget(null)}
        title="Ngắt tiến trình database?"
        description="Lệnh pg_terminate_backend sẽ hủy giao dịch đang mở của tiến trình này. Thao tác được ghi vào nhật ký kiểm toán."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setKillTarget(null)}>
              Hủy
            </AdminButton>
            <AdminButton variant="danger" onClick={() => void confirmKill()}>
              Ngắt tiến trình
            </AdminButton>
          </>
        }
      >
        {killTarget ? (
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-muted">PID</dt>
              <dd className="font-mono font-bold text-ink">{killTarget.pid}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-muted">Ứng dụng</dt>
              <dd className="font-semibold text-brand">{killTarget.application}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-muted">Thời gian</dt>
              <dd className="font-mono text-ink">{killTarget.durationSec.toFixed(2)}s</dd>
            </div>
            <div>
              <dt className="mb-1 text-muted">Câu lệnh</dt>
              <dd>
                <code className="block max-h-40 overflow-auto rounded-btn bg-[#10151e]/30 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-ink">
                  {killTarget.query}
                </code>
              </dd>
            </div>
          </dl>
        ) : null}
      </AdminModal>
    </>
  );
}
