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

/**
 * Khóa nhà cung cấp — **không còn dữ liệu mẫu**.
 * Credential Google Cloud TTS đã có luồng thật riêng (thẻ "Thông tin xác thực dịch vụ"
 * ở đầu trang, đọc `/admin/provider-credentials/google-tts`). Các nhà cung cấp khác sẽ
 * được thêm vào đây khi backend có endpoint tương ứng.
 */
export const API_KEYS: ApiKeyEntry[] = [];

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

/**
 * Nhật ký kiểm toán — **không còn dữ liệu mẫu**.
 * Trang `/admin/logs` nạp bản ghi thật từ `GET /admin/audit-logs`; danh sách này chỉ còn
 * là điểm khởi đầu rỗng cho `audit-store`.
 */
export const AUDIT_LOGS: AuditLog[] = [];

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
