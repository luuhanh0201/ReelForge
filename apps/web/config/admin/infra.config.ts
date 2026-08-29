export type KeyStatus = "up" | "degraded" | "down" | "unknown";

export interface ApiKeyEntry {
  id: string;
  provider: string;
  scope: string;
  /** Chỉ lưu phần che sẵn — hệ thống không bao giờ trả key gốc về trình duyệt. */
  maskedKey: string;
  lastRotatedAt: string;
  status: KeyStatus;
  latencyMs: number | null;
}

export const API_KEYS: ApiKeyEntry[] = [
  { id: "k-gemini", provider: "Google Gemini API", scope: "Sinh kịch bản & hook", maskedKey: "AIzaSyB9X••••••••••••••v9X8a", lastRotatedAt: "2026-07-12", status: "up", latencyMs: 120 },
  { id: "k-gtts", provider: "Google Cloud TTS", scope: "Tổng hợp giọng đọc", maskedKey: "AIzaSyD2M••••••••••••••k4Lp1", lastRotatedAt: "2026-08-02", status: "up", latencyMs: 96 },
  { id: "k-runway", provider: "Runway API", scope: "Sinh video (chưa dùng)", maskedKey: "rw_live_7Qa••••••••••••dP2", lastRotatedAt: "2026-05-30", status: "unknown", latencyMs: null },
  { id: "k-elevenlabs", provider: "ElevenLabs API", scope: "Giọng đọc cao cấp", maskedKey: "sk_11l_4Tz••••••••••••Xm9", lastRotatedAt: "2026-06-18", status: "degraded", latencyMs: 640 },
  { id: "k-tiktok", provider: "TikTok Shop TSP Secret", scope: "Đối soát hoa hồng", maskedKey: "tsp_sec_9Kd••••••••••••Uy4", lastRotatedAt: "2026-08-15", status: "up", latencyMs: 210 },
  { id: "k-shopee", provider: "Shopee Open API Partner Key", scope: "Đối soát hoa hồng", maskedKey: "shp_ptn_3Vb••••••••••••Qz7", lastRotatedAt: "2026-04-09", status: "down", latencyMs: null },
];

export interface WebhookEntry {
  id: string;
  event: string;
  url: string;
  active: boolean;
  lastDeliveryAt: string;
}

export const WEBHOOKS: WebhookEntry[] = [
  { id: "w-tiktok-order", event: "TikTok Shop · đơn hàng affiliate mới", url: "https://api.reelforge.vn/webhooks/tiktok/orders", active: true, lastDeliveryAt: "2026-08-29 09:04" },
  { id: "w-shopee-order", event: "Shopee · đơn hàng affiliate mới", url: "https://api.reelforge.vn/webhooks/shopee/orders", active: true, lastDeliveryAt: "2026-08-29 08:58" },
  { id: "w-payment", event: "Cổng thanh toán · nạp tiền thành công", url: "https://api.reelforge.vn/webhooks/payment", active: false, lastDeliveryAt: "2026-08-27 16:22" },
];

export type LogLevel = "info" | "warning" | "critical";

export interface AuditLog {
  id: string;
  timestamp: string;
  admin: string;
  action: string;
  target: string;
  ip: string;
  level: LogLevel;
  success: boolean;
}

export const LOG_LEVEL_LABEL: Record<LogLevel, string> = {
  info: "INFO",
  warning: "WARNING",
  critical: "CRITICAL",
};

export const AUDIT_LOGS: AuditLog[] = [
  { id: "log-9012", timestamp: "2026-08-29 09:14:02", admin: "Minh Anh", action: "Bật chế độ bảo trì", target: "settings.maintenance", ip: "203.113.44.18", level: "critical", success: true },
  { id: "log-9011", timestamp: "2026-08-29 09:02:47", admin: "Minh Anh", action: "Xoay vòng API key", target: "Google Cloud TTS", ip: "203.113.44.18", level: "critical", success: true },
  { id: "log-9010", timestamp: "2026-08-29 08:41:19", admin: "Đức Anh", action: "Khóa tài khoản vi phạm", target: "u-1044 · Phạm Quốc Tuấn", ip: "118.70.22.9", level: "critical", success: true },
  { id: "log-9009", timestamp: "2026-08-29 08:12:55", admin: "Đức Anh", action: "Cộng 50 credits", target: "u-1046 · Vũ Gia Bảo", ip: "118.70.22.9", level: "warning", success: true },
  { id: "log-9008", timestamp: "2026-08-29 07:58:03", admin: "Hệ thống", action: "Chuyển fallback do quá tải", target: "gemini-flash → deepseek-v3", ip: "10.0.0.4", level: "warning", success: true },
  { id: "log-9007", timestamp: "2026-08-29 07:30:41", admin: "Minh Anh", action: "Đổi tham số model", target: "Chirp 3 HD · temperature", ip: "203.113.44.18", level: "warning", success: true },
  { id: "log-9006", timestamp: "2026-08-29 07:02:10", admin: "Minh Anh", action: "Đăng nhập quản trị", target: "admin portal", ip: "203.113.44.18", level: "info", success: true },
  { id: "log-9005", timestamp: "2026-08-28 23:47:36", admin: "Đức Anh", action: "Xuất báo cáo doanh thu", target: "transactions.csv", ip: "118.70.22.9", level: "info", success: true },
  { id: "log-9004", timestamp: "2026-08-28 22:19:08", admin: "Hệ thống", action: "Kiểm tra kết nối Shopee", target: "Shopee Open API", ip: "10.0.0.4", level: "critical", success: false },
  { id: "log-9003", timestamp: "2026-08-28 21:55:24", admin: "Minh Anh", action: "Tắt model", target: "ElevenLabs Turbo v2.5", ip: "203.113.44.18", level: "warning", success: true },
];

export const SYSTEM_SETTINGS = {
  maxVideoSizeMb: 200,
  maxVideoDurationSec: 60,
  freeWatermark: true,
  cdnProvider: "cloudflare",
  paymentGateway: "vnpay",
  maintenanceMode: false,
  autoRefundOnRenderFail: true,
} as const;

export const CDN_OPTIONS = [
  { id: "cloudflare", label: "Cloudflare R2 + CDN" },
  { id: "bunny", label: "Bunny.net" },
  { id: "aws", label: "AWS CloudFront" },
];

export const PAYMENT_OPTIONS = [
  { id: "vnpay", label: "VNPAY" },
  { id: "momo", label: "MoMo" },
  { id: "stripe", label: "Stripe" },
];
