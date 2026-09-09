/** Khớp enum `role` của bảng `users` ở API: `user` là khách, ba vai còn lại là nội bộ. */
export type UserRole = "user" | "viewer" | "editor" | "admin";
export type UserStatus = "active" | "suspended";

export const ROLE_LABEL: Record<UserRole, string> = {
  user: "Người dùng",
  viewer: "Viewer",
  editor: "Editor",
  admin: "Admin",
};

export type TransactionMethod = "qr" | "bank" | "card" | "affiliate";
export type TransactionStatus = "success" | "pending" | "failed";

export interface AdminTransaction {
  id: string;
  createdAt: string;
  user: string;
  method: TransactionMethod;
  description: string;
  amountVnd: number;
  status: TransactionStatus;
}

export const METHOD_LABEL: Record<TransactionMethod, string> = {
  qr: "QR ngân hàng",
  bank: "Chuyển khoản",
  card: "Thẻ tín dụng",
  affiliate: "Hoa hồng affiliate",
};

export const ADMIN_TRANSACTIONS: AdminTransaction[] = [
  { id: "TX-24081", createdAt: "2026-08-29 09:12", user: "Nguyễn Minh Quang", method: "qr", description: "Gia hạn Agency 1 tháng", amountVnd: 499000, status: "success" },
  { id: "TX-24080", createdAt: "2026-08-29 08:47", user: "Trần Ban Mai", method: "card", description: "Nâng cấp Creator Pro", amountVnd: 199000, status: "success" },
  { id: "TX-24079", createdAt: "2026-08-29 07:55", user: "TikTok Shop Partner", method: "affiliate", description: "Đối soát hoa hồng TSP ngày 28/08", amountVnd: 2841000, status: "pending" },
  { id: "TX-24078", createdAt: "2026-08-28 22:31", user: "Vũ Gia Bảo", method: "bank", description: "Nạp thêm 50 credits", amountVnd: 165000, status: "success" },
  { id: "TX-24077", createdAt: "2026-08-28 20:04", user: "Shopee Affiliate", method: "affiliate", description: "Đối soát hoa hồng Shopee ngày 28/08", amountVnd: 1264000, status: "failed" },
  { id: "TX-24076", createdAt: "2026-08-28 18:19", user: "Lê Mỹ An", method: "qr", description: "Gia hạn Creator Pro", amountVnd: 199000, status: "success" },
  { id: "TX-24075", createdAt: "2026-08-28 15:02", user: "Bùi Đức Anh", method: "card", description: "Gia hạn Agency 12 tháng", amountVnd: 4788000, status: "success" },
  { id: "TX-24074", createdAt: "2026-08-28 11:38", user: "Ngô Khánh Linh", method: "bank", description: "Nạp thêm 20 credits", amountVnd: 66000, status: "pending" },
];

export const RECONCILIATION = {
  tiktokPendingVnd: 2841000,
  shopeePendingVnd: 1264000,
  settledThisMonthVnd: 38420000,
  lastSyncAt: "2026-08-29 09:00",
};
