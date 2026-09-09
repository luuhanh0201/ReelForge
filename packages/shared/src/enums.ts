/**
 * Giá trị enum dùng chung giữa API và web.
 *
 * Đặt ở đây thay vì khai lại hai lần: enum lệch nhau giữa hai đầu là loại lỗi chỉ lộ ra ở
 * runtime, khi người dùng đã bấm nút rồi.
 */

/** `link` — tạo từ link sản phẩm. `manual` — người dùng tự viết nội dung. */
export const PROJECT_MODES = ["link", "manual"] as const;
export type ProjectMode = (typeof PROJECT_MODES)[number];

export const PROJECT_STATUSES = ["draft", "ready", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PLATFORMS = ["shopee", "tiktok_shop", "lazada", "manual"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const CRAWL_STATUSES = ["pending", "success", "failed", "manual"] as const;
export type CrawlStatus = (typeof CRAWL_STATUSES)[number];

export const SCRIPT_TONES = [
  "review",
  "listicle",
  "problem_solution",
  "warning",
  "storytelling",
] as const;
export type ScriptTone = (typeof SCRIPT_TONES)[number];

export const MEDIA_ORIGINS = ["crawled", "uploaded"] as const;
export type MediaOrigin = (typeof MEDIA_ORIGINS)[number];

export const RENDER_PATHS = ["client", "server"] as const;
export type RenderPath = (typeof RENDER_PATHS)[number];

export const RENDER_STATUSES = [
  "draft",
  "exporting",
  "uploading",
  "completed",
  "failed",
  "canceled",
] as const;
export type RenderStatus = (typeof RENDER_STATUSES)[number];

/**
 * Lý do một giao dịch credit phát sinh. Bảng giao dịch chỉ thêm, không sửa, nên đây cũng
 * là toàn bộ danh sách cách số dư có thể thay đổi.
 */
export const CREDIT_TX_TYPES = [
  "signup_bonus",
  "purchase",
  "render_charge",
  "tts_extra",
  "refund",
  "admin_grant",
  "admin_deduct",
] as const;
export type CreditTxType = (typeof CREDIT_TX_TYPES)[number];
