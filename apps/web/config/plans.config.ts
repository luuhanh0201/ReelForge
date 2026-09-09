import { L, type Localized } from "@/lib/i18n";

/**
 * Bốn gói cước — khớp enum `plan` của bảng `users` ở API.
 *
 * Thứ tự khai báo chính là thứ bậc từ thấp lên cao; mọi chỗ liệt kê gói đều đi theo
 * `PLAN_ORDER` để bảng giá, bộ lọc admin và huy hiệu trên header không bao giờ lệch nhau.
 */
export type UserPlan = "free" | "advanced" | "plus" | "premium";

export const PLAN_ORDER: readonly UserPlan[] = [
  "free",
  "advanced",
  "plus",
  "premium",
];

/** Gói của tài khoản mới. */
export const DEFAULT_PLAN: UserPlan = "free";

export const PLAN_LABEL: Record<UserPlan, Localized> = {
  free: L("Free", "Free"),
  advanced: L("Nâng cao", "Advanced"),
  plus: L("Plus", "Plus"),
  premium: L("Premium", "Premium"),
};

/**
 * Tông màu của từng gói, dùng chung cho huy hiệu ở khu quản trị lẫn thẻ trên bảng giá.
 * Gói càng cao màu càng "đắt": trung tính → xanh ngọc → cam thương hiệu → tím.
 */
export const PLAN_ACCENT: Record<UserPlan, "neutral" | "mint" | "brand" | "voice"> = {
  free: "neutral",
  advanced: "mint",
  plus: "brand",
  premium: "voice",
};
