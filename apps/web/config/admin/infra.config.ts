export type KeyStatus = "up" | "degraded" | "down" | "unknown";

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
