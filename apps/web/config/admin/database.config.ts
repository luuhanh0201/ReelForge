import {
  Activity,
  Clock,
  HardDrive,
  Lock,
  PauseCircle,
  Server,
  type LucideIcon,
} from "lucide-react";
import type { Accent } from "@/lib/accent";
import type { DatabaseOverview } from "@/lib/admin/database-api";

/* ------------------------------------------------------------------ */
/* Thang 4 mức SLA                                                      */
/* ------------------------------------------------------------------ */

export type SlaLevelId = "normal" | "warning" | "high" | "critical";

export interface SlaLevel {
  id: SlaLevelId;
  label: string;
  accent: Accent;
}

/** Bốn mức sức khỏe dùng chung cho ma trận, thẻ KPI và huy hiệu trạng thái. */
export const SLA_LEVELS: SlaLevel[] = [
  { id: "normal", label: "Bình thường", accent: "mint" },
  { id: "warning", label: "Cảnh báo", accent: "amber" },
  { id: "high", label: "Cao", accent: "brand" },
  { id: "critical", label: "Nguy cấp", accent: "danger" },
];

export const SLA_LEVEL: Record<SlaLevelId, SlaLevel> = {
  normal: SLA_LEVELS[0]!,
  warning: SLA_LEVELS[1]!,
  high: SLA_LEVELS[2]!,
  critical: SLA_LEVELS[3]!,
};

/** Ngưỡng dạng "≤ a là bình thường" (dùng cho độ trễ). */
const atMost = (value: number, normal: number, warning: number, high: number): SlaLevelId =>
  value <= normal ? "normal" : value <= warning ? "warning" : value <= high ? "high" : "critical";

/** Ngưỡng dạng "< a là bình thường" (dùng cho các chỉ số phần trăm và thời gian). */
const below = (value: number, normal: number, warning: number, high: number): SlaLevelId =>
  value < normal ? "normal" : value < warning ? "warning" : value < high ? "high" : "critical";

/* ------------------------------------------------------------------ */
/* Ảnh chụp số liệu                                                     */
/* ------------------------------------------------------------------ */

export interface DatabaseSnapshot extends DatabaseOverview {
  /** Deadlock tăng so với lần đọc trước — theo ma trận SLA là mức nguy cấp. */
  deadlockRising: boolean;
}

export const connectionPercent = (snapshot: DatabaseSnapshot): number =>
  snapshot.maxConnections > 0
    ? (snapshot.connections / snapshot.maxConnections) * 100
    : 0;

export const storagePercent = (snapshot: DatabaseSnapshot): number =>
  snapshot.storageTotalGb > 0
    ? (snapshot.storageUsedGb / snapshot.storageTotalGb) * 100
    : 0;

/** Database nhỏ hơn 1GB hiển thị theo MB cho khỏi thành 0.00 GB. */
export const formatStorage = (snapshot: DatabaseSnapshot): string =>
  snapshot.storageUsedGb >= 1
    ? `${snapshot.storageUsedGb.toFixed(2)} / ${snapshot.storageTotalGb} GB`
    : `${snapshot.storageUsedMb.toFixed(1)} MB / ${snapshot.storageTotalGb} GB`;

export const formatDuration = (seconds: number): string =>
  seconds >= 60 ? `${(seconds / 60).toFixed(1)} phút` : `${seconds.toFixed(2)} giây`;

/* ------------------------------------------------------------------ */
/* Ma trận ngưỡng SLA                                                   */
/* ------------------------------------------------------------------ */

export interface SlaReading {
  /** Số liệu realtime in đậm ở cột 6 và trên thẻ KPI. */
  display: string;
  level: SlaLevelId;
  /** Dòng phụ trên thẻ KPI (ví dụ tỷ lệ chi tiết). */
  detail?: string;
}

export interface SlaMetric {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Bốn ô ngưỡng của ma trận. */
  ranges: Record<SlaLevelId, string>;
  read: (snapshot: DatabaseSnapshot) => SlaReading;
}

/** Trạng thái tổng hiển thị trên huy hiệu đầu trang, suy ra từ 6 chỉ số đo được. */
export const resolveClusterLevel = (snapshot: DatabaseSnapshot): SlaLevelId => {
  const levels = SLA_MATRIX.map((metric) => metric.read(snapshot).level);

  if (levels.includes("critical")) return "critical";
  if (levels.includes("high") || levels.includes("warning")) return "warning";
  return "normal";
};

export const SLA_MATRIX: SlaMetric[] = [
  {
    id: "latency",
    label: "Độ trễ truy vấn",
    icon: Activity,
    /**
     * Thang đo cho database ở xa (Supabase ap-southeast-1 truy cập từ Việt Nam).
     * Đo thực tế 30 mẫu `SELECT 1` trên kết nối ấm: min 45ms · p50 53ms · p95 58ms —
     * đúng một vòng RTT, không thể nhanh hơn nếu không đổi vùng đặt máy chủ.
     * Mở kết nối mới tốn thêm bắt tay TCP + TLS (~390ms), nhưng pool đã đặt
     * `idleTimeoutMillis: 60s` nên chuyện đó chỉ xảy ra sau thời gian dài không dùng.
     * Chuyển về database cùng vùng thì phải đo lại và siết xuống mức ms một chữ số.
     */
    ranges: {
      normal: "≤ 100ms",
      warning: "101–200ms",
      high: "201–400ms",
      critical: "> 400ms",
    },
    read: (snapshot) => ({
      display: `${snapshot.latencyMs.toFixed(2)} ms`,
      level: atMost(snapshot.latencyMs, 100, 200, 400),
    }),
  },
  {
    id: "connections",
    label: "Mức sử dụng kết nối",
    icon: Server,
    ranges: {
      normal: "< 60%",
      warning: "60–75%",
      high: "75–90%",
      critical: "≥ 90%",
    },
    read: (snapshot) => {
      const percent = connectionPercent(snapshot);

      return {
        display: `${percent.toFixed(0)}%`,
        detail: `${snapshot.connections} / ${snapshot.maxConnections} kết nối`,
        level: below(percent, 60, 75, 90),
      };
    },
  },
  {
    id: "storage",
    label: "Chiếm dụng lưu trữ",
    icon: HardDrive,
    ranges: {
      normal: "< 70%",
      warning: "70–85%",
      high: "85–95%",
      critical: "≥ 95%",
    },
    read: (snapshot) => {
      const percent = storagePercent(snapshot);

      return {
        display: `${percent.toFixed(1)}%`,
        detail: formatStorage(snapshot),
        level: below(percent, 70, 85, 95),
      };
    },
  },
  {
    id: "long-query",
    label: "Truy vấn dài nhất",
    icon: Clock,
    ranges: {
      normal: "< 1s",
      warning: "1–3s",
      high: "3–10s",
      critical: "> 10s",
    },
    read: (snapshot) => ({
      display: formatDuration(snapshot.longestQuerySec),
      detail: `${snapshot.activeConnections} truy vấn đang chạy`,
      level: below(snapshot.longestQuerySec, 1, 3, 10),
    }),
  },
  {
    id: "idle-tx",
    label: "Giao dịch treo lâu nhất",
    icon: PauseCircle,
    ranges: {
      normal: "< 30s",
      warning: "30–60s",
      high: "1–5 phút",
      critical: "> 5 phút",
    },
    read: (snapshot) => ({
      display: formatDuration(snapshot.longestIdleTxSec),
      detail: `${snapshot.idleInTransaction} phiên idle in transaction`,
      level: below(snapshot.longestIdleTxSec, 30, 60, 300),
    }),
  },
  {
    id: "deadlocks",
    label: "Deadlocks",
    icon: Lock,
    ranges: {
      normal: "0",
      warning: "—",
      high: "> 0",
      critical: "Tăng liên tục",
    },
    read: (snapshot) => ({
      display: `${snapshot.deadlocks.toLocaleString("vi-VN")} khóa`,
      detail: snapshot.deadlockRising ? "Vừa tăng ở lần đọc gần nhất" : undefined,
      level: snapshot.deadlockRising ? "critical" : snapshot.deadlocks > 0 ? "high" : "normal",
    }),
  },
];

/* ------------------------------------------------------------------ */
/* Bảng & tiến trình                                                    */
/* ------------------------------------------------------------------ */

/** Vượt ngưỡng này thì bảng cần VACUUM để giữ tốc độ đọc/ghi. */
export const BLOAT_WARNING_PERCENT = 15;

/** Truy vấn chạy lâu hơn ngưỡng này được tô cảnh báo trong bảng tiến trình. */
export const SLOW_QUERY_SEC = 3;

export const ACTIVITY_STATE_META: Record<
  string,
  { label: string; accent: Accent }
> = {
  active: { label: "active", accent: "info" },
  "idle in transaction": { label: "idle in transaction", accent: "brand" },
  "idle in transaction (aborted)": { label: "idle in tx (aborted)", accent: "danger" },
  idle: { label: "idle", accent: "mint" },
};
