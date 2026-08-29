import {
  Activity,
  Clapperboard,
  Cpu,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ServiceStatus = "up" | "degraded" | "down";

export interface AdminKpi {
  id: string;
  label: string;
  deltaTone: "up" | "down" | "flat";
  hint: string;
  icon: LucideIcon;
  accent: "brand" | "mint" | "amber" | "info";
}

export const ADMIN_KPIS: AdminKpi[] = [
  {
    id: "videos",
    label: "Tổng video đã render",
    deltaTone: "up",
    hint: "so với kỳ trước",
    icon: Clapperboard,
    accent: "brand",
  },
  {
    id: "creators",
    label: "KOC hoạt động",
    deltaTone: "up",
    hint: "user mới trong kỳ",
    icon: Users,
    accent: "mint",
  },
  {
    id: "gpu",
    label: "Tải trọng cụm AI",
    deltaTone: "flat",
    hint: "không nghẽn hàng đợi",
    icon: Cpu,
    accent: "amber",
  },
  {
    id: "success",
    label: "Tỷ lệ render thành công",
    deltaTone: "flat",
    hint: "trung bình trong kỳ",
    icon: Activity,
    accent: "info",
  },
];

export type RangeId = "today" | "7d" | "30d" | "90d";

export const RANGE_OPTIONS: { id: RangeId; label: string }[] = [
  { id: "today", label: "Hôm nay" },
  { id: "7d", label: "7 ngày" },
  { id: "30d", label: "30 ngày" },
  { id: "90d", label: "90 ngày" },
];

export interface TrafficPoint {
  /** Nhãn ngắn hiển thị dưới trục. */
  label: string;
  /** Nhãn đầy đủ dùng trong tooltip. */
  fullLabel: string;
  videos: number;
  /** Nằm trong khung giờ cao điểm bán hàng (chỉ dùng cho khoảng "Hôm nay"). */
  peak?: boolean;
}

/** Khung giờ cao điểm bán hàng, tô nền nhấn trên biểu đồ theo giờ. */
export const PEAK_WINDOWS: { from: number; to: number; label: string }[] = [
  { from: 11, to: 13, label: "Cao điểm trưa" },
  { from: 19, to: 23, label: "Cao điểm tối" },
];

const HOURLY_VIDEOS = [
  62, 41, 28, 19, 17, 24, 58, 96, 143, 178, 214, 352, 418, 336, 205, 187, 196, 231, 288,
  402, 476, 512, 445, 268,
];

const pad = (value: number) => value.toString().padStart(2, "0");

const TODAY: TrafficPoint[] = HOURLY_VIDEOS.map((videos, hour) => ({
  label: `${pad(hour)}h`,
  fullLabel: `${pad(hour)}:00 – ${pad(hour)}:59`,
  videos,
  peak: PEAK_WINDOWS.some((window) => hour >= window.from && hour <= window.to),
}));

/**
 * Dữ liệu ngày được sinh bằng hàm tất định (không random) để server và client
 * render ra cùng kết quả, tránh lệch khi hydrate.
 */
const ANCHOR_DATE = new Date("2026-08-29T00:00:00Z");
const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const dailySeries = (days: number, base: number, amplitude: number): TrafficPoint[] =>
  Array.from({ length: days }, (_, index) => {
    const offset = days - 1 - index;
    const date = new Date(ANCHOR_DATE.getTime() - offset * 86_400_000);
    const wave =
      Math.sin(index * 0.8) * amplitude + Math.cos(index * 0.27) * amplitude * 0.55;
    const weekendBoost = date.getUTCDay() === 0 || date.getUTCDay() === 6 ? 1.18 : 1;

    return {
      label: `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}`,
      fullLabel: `${WEEKDAY[date.getUTCDay()]}, ${pad(date.getUTCDate())}/${pad(
        date.getUTCMonth() + 1,
      )}/${date.getUTCFullYear()}`,
      videos: Math.max(120, Math.round((base + wave) * weekendBoost)),
    };
  });

export const TRAFFIC_BY_RANGE: Record<RangeId, TrafficPoint[]> = {
  today: TODAY,
  "7d": dailySeries(7, 4180, 620),
  "30d": dailySeries(30, 3960, 780),
  "90d": dailySeries(90, 3640, 940),
};

export const RANGE_UNIT: Record<RangeId, string> = {
  today: "24 giờ qua",
  "7d": "7 ngày qua",
  "30d": "30 ngày qua",
  "90d": "90 ngày qua",
};

const formatVn = new Intl.NumberFormat("vi-VN").format;

/** Tổng video của từng khoảng — lấy thẳng từ series để KPI và biểu đồ không lệch nhau. */
const totalVideos = (range: RangeId) =>
  formatVn(TRAFFIC_BY_RANGE[range].reduce((sum, point) => sum + point.videos, 0));

/** Giá trị KPI đổi theo khoảng thời gian đang lọc. */
export const KPI_VALUES: Record<RangeId, Record<string, { value: string; delta: string }>> = {
  today: {
    videos: { value: totalVideos("today"), delta: "+8,4%" },
    creators: { value: "1.840", delta: "+125" },
    gpu: { value: "68%", delta: "Tối ưu" },
    success: { value: "99,4%", delta: "SLA đảm bảo" },
  },
  "7d": {
    videos: { value: totalVideos("7d"), delta: "+18,2%" },
    creators: { value: "1.792", delta: "+412" },
    gpu: { value: "71%", delta: "Tối ưu" },
    success: { value: "99,2%", delta: "SLA đảm bảo" },
  },
  "30d": {
    videos: { value: totalVideos("30d"), delta: "+24,7%" },
    creators: { value: "1.615", delta: "+1.104" },
    gpu: { value: "64%", delta: "Tối ưu" },
    success: { value: "98,9%", delta: "Dưới SLA 0,1%" },
  },
  "90d": {
    videos: { value: totalVideos("90d"), delta: "+61,5%" },
    creators: { value: "1.240", delta: "+2.870" },
    gpu: { value: "59%", delta: "Tối ưu" },
    success: { value: "98,6%", delta: "Dưới SLA 0,4%" },
  },
};

export interface ServiceHealth {
  id: string;
  name: string;
  status: ServiceStatus;
  latencyMs: number;
  uptime: string;
}

export const SERVICE_HEALTH: ServiceHealth[] = [
  { id: "gcp", name: "Google Cloud", status: "up", latencyMs: 84, uptime: "99,99%" },
  { id: "aws", name: "AWS Video Pipeline", status: "up", latencyMs: 132, uptime: "99,95%" },
  { id: "elevenlabs", name: "ElevenLabs", status: "degraded", latencyMs: 640, uptime: "98,20%" },
  { id: "tiktok", name: "TikTok Shop API", status: "up", latencyMs: 210, uptime: "99,80%" },
  { id: "shopee", name: "Shopee Open API", status: "down", latencyMs: 0, uptime: "94,10%" },
];
