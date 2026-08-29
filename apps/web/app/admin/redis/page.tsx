"use client";

import {
  Activity,
  CheckCircle2,
  Database,
  Gauge,
  KeyRound,
  MemoryStick,
  Plug,
  RefreshCw,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BULL_QUEUES,
  MEMORY_THRESHOLDS,
  QUEUE_JOBS,
  RECLAIMABLE_CACHE_MB,
  REFRESH_OPTIONS,
  resolveLatencyLevel,
  type LatencyAccent,
  type QueueJobItem,
  type RefreshOptionId,
} from "@/config/admin/redis.config";
import { recordAudit } from "@/lib/admin/audit-store";
import {
  fetchKeyspace,
  fetchRedisOverview,
  formatUptime,
  pingRedis,
  type KeyspaceSlice,
  type RedisOverview,
} from "@/lib/admin/redis-api";
import {
  AdminButton,
  AdminCard,
  AdminPageHeader,
  AdminSelect,
  Pill,
} from "@/components/admin/primitives";
import { JobsInspector } from "@/components/admin/redis/jobs-inspector";
import { KeyspaceBreakdown } from "@/components/admin/redis/keyspace-breakdown";
import { QueueCards } from "@/components/admin/redis/queue-cards";
import { useToast } from "@/components/admin/toast";

const formatNumber = (value: number) => value.toLocaleString("vi-VN");

const compact = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(2)}M`
    : value >= 1_000
      ? `${(value / 1_000).toFixed(1)}k`
      : formatNumber(value);

/** Mức độ trễ ánh xạ sang tông của toast. */
const TOAST_TONE_BY_ACCENT: Record<LatencyAccent, "success" | "warning" | "danger"> = {
  mint: "success",
  amber: "warning",
  brand: "warning",
  danger: "danger",
};

const LATENCY_TEXT_CLASS: Record<LatencyAccent, string> = {
  mint: "text-mint",
  amber: "text-amber",
  brand: "text-brand",
  danger: "text-danger",
};

const clockLabel = () => {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

export default function RedisPage() {
  const toast = useToast();
  const [overview, setOverview] = useState<RedisOverview | null>(null);
  const [slices, setSlices] = useState<KeyspaceSlice[]>([]);
  const [loading, setLoading] = useState(true);
  const [offlineReason, setOfflineReason] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState("—");
  const [refreshId, setRefreshId] = useState<RefreshOptionId>("15s");
  const [pinging, setPinging] = useState(false);
  const [jobs, setJobs] = useState<QueueJobItem[]>(QUEUE_JOBS);

  const load = useCallback(async () => {
    try {
      const [nextOverview, keyspace] = await Promise.all([
        fetchRedisOverview(),
        fetchKeyspace(),
      ]);

      setOverview(nextOverview);
      setSlices(keyspace.slices);
      setOfflineReason(null);
    } catch (error) {
      setOverview(null);
      setOfflineReason(error instanceof Error ? error.message : "Không gọi được API");
    } finally {
      setLoading(false);
      setLastCheck(clockLabel());
    }
  }, []);

  const refreshMs = REFRESH_OPTIONS.find((option) => option.id === refreshId)?.ms ?? 0;

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

  const stats = overview;

  const online = stats !== null;
  const memoryPercent = stats ? (stats.memoryUsedMb / stats.memoryTotalMb) * 100 : 0;
  const memoryTone =
    memoryPercent > MEMORY_THRESHOLDS.critical
      ? "bg-danger"
      : memoryPercent > MEMORY_THRESHOLDS.warning
        ? "bg-amber"
        : "bg-mint";

  const failedJobs = jobs.filter((job) => job.status === "failed");
  const latencyLevel = resolveLatencyLevel(stats?.latencyMs ?? 0);

  const runPing = async () => {
    setPinging(true);

    try {
      const result = await pingRedis(5);
      const level = resolveLatencyLevel(result.averageMs);
      toast(
        `${result.samples} gói PING · trung bình ${result.averageMs}ms — ${level.label}`,
        TOAST_TONE_BY_ACCENT[level.accent],
      );
      recordAudit({
        action: "Chạy Ping Benchmark",
        target: `${overview?.host ?? "redis"} · ${result.averageMs}ms`,
        level: "info",
      });
    } catch {
      toast("Không ping được Redis — kiểm tra kết nối API", "warning");
    } finally {
      setPinging(false);
      setLastCheck(clockLabel());
    }
  };

  const retryJob = (job: QueueJobItem) => {
    setJobs((current) =>
      current.map((item) =>
        item.id === job.id
          ? { ...item, status: "waiting", progress: undefined, error: undefined, elapsed: "chờ 0s" }
          : item,
      ),
    );
    toast(`Đã đưa ${job.id} trở lại hàng đợi`);
    recordAudit({ action: "Thử lại job", target: `${job.id} · ${job.queueId}`, level: "warning" });
  };

  const deleteJob = (job: QueueJobItem) => {
    setJobs((current) => current.filter((item) => item.id !== job.id));
    toast(`Đã xóa ${job.id} khỏi hàng đợi`, "warning");
    recordAudit({ action: "Xóa job khỏi hàng đợi", target: job.id, level: "critical" });
  };

  const retryAllFailed = () => {
    if (failedJobs.length === 0) return;

    setJobs((current) =>
      current.map((item) =>
        item.status === "failed"
          ? { ...item, status: "waiting", progress: undefined, error: undefined, elapsed: "chờ 0s" }
          : item,
      ),
    );
    toast(`Đã đưa ${failedJobs.length} job lỗi trở lại hàng đợi`);
    recordAudit({
      action: "Thử lại toàn bộ job lỗi",
      target: `${failedJobs.length} job`,
      level: "warning",
    });
  };

  const queues = useMemo(
    () =>
      BULL_QUEUES.map((queue) => ({
        ...queue,
        waiting: jobs.filter((job) => job.queueId === queue.id && job.status === "waiting").length,
        active: jobs.filter((job) => job.queueId === queue.id && job.status === "active").length,
        failed: jobs.filter((job) => job.queueId === queue.id && job.status === "failed").length,
      })),
    [jobs],
  );

  const metrics = stats
    ? ([
        {
          id: "latency",
          icon: Timer,
          label: "Độ trễ Ping",
          value: `${stats.latencyMs.toFixed(2)} ms`,
          tone: LATENCY_TEXT_CLASS[latencyLevel.accent],
          note: `${latencyLevel.label} · ${latencyLevel.range}`,
          noteTone: latencyLevel.accent,
          hint: `Độ trễ `,
        },
        {
          id: "ops",
          icon: Gauge,
          label: "Tốc độ xử lý lệnh",
          value: `${formatNumber(stats.opsPerSec)} cmd/s`,
          tone: "text-amber",
          note: `Uptime ${formatUptime(stats.uptimeSeconds)}`,
          noteTone: "amber",
          hint: `Đã thực thi ${compact(stats.totalCommands)} lệnh`,
        },
        {
          id: "clients",
          icon: Plug,
          label: "Kết nối clients",
          value: `${formatNumber(stats.connectedClients)} / ${formatNumber(stats.maxClients)}`,
          tone: "text-info",
          note: `${stats.blockedClients} blocked`,
          noteTone: stats.blockedClients > 0 ? "danger" : "info",
          hint: `Redis ${stats.version}`,
        },
        {
          id: "keys",
          icon: KeyRound,
          label: "Tổng số keys",
          value: `${formatNumber(stats.totalKeys)} keys`,
          tone: "text-brand",
          note: `${slices.length} nhóm tiền tố`,
          noteTone: "brand",
          hint: `Phân mảnh ${stats.fragmentationRatio}`,
        },
        {
          id: "hit",
          icon: Activity,
          label: "Hiệu quả cache",
          value: `${stats.hitRate}%`,
          tone: stats.hitRate >= 90 ? "text-mint" : "text-amber",
          note: `${compact(stats.hits)} hits · ${compact(stats.misses)} misses`,
          noteTone: stats.hitRate >= 90 ? "mint" : "amber",
          hint: `Evicted ${formatNumber(stats.evictedKeys)} · Expired ${formatNumber(stats.expiredKeys)}`,
        },
      ] as const)
    : [];

  return (
    <>
      <AdminPageHeader
        title="Redis & hàng đợi BullMQ"
        description="Dữ liệu Redis được cập nhật trực tiếp; thông tin hàng đợi hiện là dữ liệu mô phỏng."
      />

      {/* Tầng 1 — thanh tổng quan vận hành */}
      <AdminCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-card ${
                online ? "bg-mint/12 text-mint" : "bg-danger/12 text-danger"
              }`}
            >
              <Database size={24} />
            </span>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-bold text-ink">
                  Redis & Hàng đợi xử lý
                </h2>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    online ? "bg-mint/12 text-mint" : "bg-danger/12 text-danger"
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                        online ? "bg-mint" : "bg-danger"
                      }`}
                    />
                    <span
                      className={`relative inline-flex h-2 w-2 rounded-full ${
                        online ? "bg-mint" : "bg-danger"
                      }`}
                    />
                  </span>
                  {online ? "ONLINE & SẴN SÀNG" : "MẤT KẾT NỐI"}
                </span>

                {stats ? (
                  <code className="rounded-btn bg-subtle px-2 py-0.5 font-mono text-[11px] text-muted">
                    v{stats.version}
                  </code>
                ) : null}
              </div>

              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
                <span>Node: {stats?.host ?? "—"}</span>
                <span>Uptime: {stats ? formatUptime(stats.uptimeSeconds) : "—"}</span>
                <span>Độ trễ: {stats ? `${stats.latencyMs.toFixed(2)} ms` : "—"}</span>
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

            <AdminButton onClick={() => void runPing()} disabled={pinging || !online}>
              <Zap size={14} />
              {pinging ? "Đang ping..." : "Kiểm tra Ping"}
            </AdminButton>

            <AdminButton onClick={() => void load()}>
              <RefreshCw size={14} />
              Làm mới ngay
            </AdminButton>
          </div>
        </div>
      </AdminCard>

      {/* Tầng 2 — bộ 6 chỉ số trọng tâm */}
      {loading ? (
        <AdminCard>
          <p className="py-8 text-center text-sm text-muted">Đang đọc số liệu Redis...</p>
        </AdminCard>
      ) : !stats ? (
        <AdminCard className="border-danger/40 bg-danger/5">
          <p className="flex items-start gap-2.5 text-sm text-ink">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-danger" />
            <span>
              <strong className="font-bold">Không đọc được số liệu Redis.</strong> Kiểm tra
              API có đang chạy ở <code className="font-mono">localhost:3001</code> và biến
              môi trường Redis trong <code className="font-mono">apps/api/.env</code>.
            </span>
          </p>
        </AdminCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-6">
          <AdminCard className="sm:col-span-2 2xl:col-span-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-muted">Chiếm dụng bộ nhớ</p>
              <MemoryStick size={16} className="shrink-0 text-muted" />
            </div>

            <p className="mt-3 font-mono text-xl font-bold text-ink">
              {stats.memoryUsedMb.toFixed(1)}
              <span className="text-sm font-medium text-muted">
                {" "}
                / {formatNumber(stats.memoryTotalMb)} MB
              </span>
            </p>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-subtle">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${memoryTone}`}
                style={{ width: `${Math.min(100, memoryPercent)}%` }}
              />
            </div>

            <p className="mt-2 font-mono text-[11px] text-muted">
              {memoryPercent.toFixed(1)}% dung lượng gói
            </p>
          </AdminCard>

          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <AdminCard key={metric.id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-muted">{metric.label}</p>
                  <Icon size={16} className="shrink-0 text-muted" />
                </div>

                <p className={`mt-3 font-mono text-xl font-bold ${metric.tone}`}>
                  {metric.value}
                </p>

                <Pill accent={metric.noteTone} className="mt-3">
                  {metric.note}
                </Pill>

                <p className="mt-2 truncate font-mono text-[11px] text-muted" title={metric.hint}>
                  {metric.hint}
                </p>
              </AdminCard>
            );
          })}
        </div>
      )}

      {/* Tầng 3 — cảnh báo vận hành */}
      <div className="grid gap-4 lg:grid-cols-3">
        <AdminCard className={failedJobs.length > 0 ? "border-amber/40 bg-amber/5" : ""}>
          <div className="flex items-start gap-2.5">
            {failedJobs.length > 0 ? (
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber" />
            ) : (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-mint" />
            )}

            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">
                {failedJobs.length > 0 ? "Có job đang lỗi" : "Hàng đợi đang khỏe"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {failedJobs.length > 0
                  ? "Job render bị timeout do đối tác ngoài Runway ML và link Shopee bị captcha chặn."
                  : "Không có job thất bại trong hàng đợi."}
              </p>

              {failedJobs.length > 0 ? (
                <AdminButton variant="primary" className="mt-3" onClick={retryAllFailed}>
                  <RefreshCw size={14} />
                  Thử lại ngay ({failedJobs.length})
                </AdminButton>
              ) : null}
            </div>
          </div>
        </AdminCard>

        <AdminCard
          className={stats && stats.evictedKeys > 0 ? "border-danger/40 bg-danger/5" : ""}
        >
          <div className="flex items-start gap-2.5">
            <ShieldCheck
              size={16}
              className={`mt-0.5 shrink-0 ${
                stats && stats.evictedKeys > 0 ? "text-danger" : "text-mint"
              }`}
            />

            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">An toàn bộ nhớ</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {!stats
                  ? "Chưa đọc được số liệu bộ nhớ."
                  : stats.evictedKeys > 0
                    ? `Đã có ${formatNumber(stats.evictedKeys)} key bị đẩy khỏi bộ nhớ — cache đang mất dữ liệu.`
                    : `Evicted Keys = 0, bộ nhớ ở ${memoryPercent.toFixed(1)}% (ngưỡng cảnh báo ${MEMORY_THRESHOLDS.critical}%).`}
              </p>
            </div>
          </div>
        </AdminCard>

        <AdminCard>
          <div className="flex items-start gap-2.5">
            <MemoryStick size={16} className="mt-0.5 shrink-0 text-info" />

            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">Khuyến nghị dọn cache</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Ước tính ~{RECLAIMABLE_CACHE_MB}MB cache link sản phẩm quá 7 ngày có thể dọn.
                Thao tác này xóa key thật nên chỉ bật khi API có endpoint dọn cache riêng.
              </p>

              <AdminButton className="mt-3" disabled>
                Xóa cache cũ (chưa mở)
              </AdminButton>
            </div>
          </div>
        </AdminCard>
      </div>

      {/* Tầng 4 — hàng đợi BullMQ (mô phỏng) */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-base font-bold text-ink">Hàng đợi BullMQ</h2>
        <Pill accent="amber">Dữ liệu mô phỏng · chưa cài BullMQ</Pill>
      </div>

      <QueueCards queues={queues} />

      {/* Tầng 5 — bảng thanh tra jobs */}
      <JobsInspector
        jobs={jobs}
        onRetry={retryJob}
        onDelete={deleteJob}
        onRetryAllFailed={retryAllFailed}
      />

      {/* Tầng phụ — phân bổ bộ nhớ theo tiền tố */}
      <KeyspaceBreakdown slices={slices} loading={loading} />
    </>
  );
}
