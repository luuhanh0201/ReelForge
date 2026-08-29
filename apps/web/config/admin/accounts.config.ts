export type UserPlan = "starter" | "creator-pro" | "agency";
export type UserRole = "admin" | "editor" | "viewer";
export type UserStatus = "active" | "suspended";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: UserPlan;
  role: UserRole;
  status: UserStatus;
  credits: number;
  creditQuota: number;
  projects: number;
  joinedAt: string;
}

/** Nhãn gói khớp với bảng giá trên landing page — một nguồn sự thật. */
export const PLAN_LABEL: Record<UserPlan, string> = {
  starter: "Starter",
  "creator-pro": "Creator Pro",
  agency: "Agency",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export const ADMIN_USERS: AdminUser[] = [
  { id: "u-1041", name: "Trần Ban Mai", email: "banmai.koc@gmail.com", plan: "creator-pro", role: "editor", status: "active", credits: 42, creditQuota: 60, projects: 128, joinedAt: "2026-03-14" },
  { id: "u-1042", name: "Nguyễn Minh Quang", email: "quang.review@gmail.com", plan: "agency", role: "admin", status: "active", credits: 164, creditQuota: 200, projects: 512, joinedAt: "2025-11-02" },
  { id: "u-1043", name: "Lê Mỹ An", email: "myan.beauty@gmail.com", plan: "creator-pro", role: "editor", status: "active", credits: 7, creditQuota: 60, projects: 96, joinedAt: "2026-01-27" },
  { id: "u-1044", name: "Phạm Quốc Tuấn", email: "tuan.fashion@gmail.com", plan: "starter", role: "viewer", status: "suspended", credits: 0, creditQuota: 10, projects: 8, joinedAt: "2026-08-01" },
  { id: "u-1045", name: "Đỗ Thanh Hà", email: "ha.homeliving@gmail.com", plan: "creator-pro", role: "editor", status: "active", credits: 58, creditQuota: 60, projects: 43, joinedAt: "2026-05-19" },
  { id: "u-1046", name: "Vũ Gia Bảo", email: "baovu.tech@gmail.com", plan: "agency", role: "editor", status: "active", credits: 92, creditQuota: 200, projects: 287, joinedAt: "2025-12-08" },
  { id: "u-1047", name: "Hoàng Thu Trang", email: "trang.momshop@gmail.com", plan: "starter", role: "viewer", status: "active", credits: 4, creditQuota: 10, projects: 3, joinedAt: "2026-08-21" },
  { id: "u-1048", name: "Bùi Đức Anh", email: "ducanh.agency@gmail.com", plan: "agency", role: "admin", status: "active", credits: 188, creditQuota: 200, projects: 401, joinedAt: "2025-10-30" },
  { id: "u-1049", name: "Ngô Khánh Linh", email: "linh.skincare@gmail.com", plan: "creator-pro", role: "editor", status: "suspended", credits: 21, creditQuota: 60, projects: 67, joinedAt: "2026-02-11" },
  { id: "u-1050", name: "Đặng Hải Nam", email: "namdang.food@gmail.com", plan: "starter", role: "viewer", status: "active", credits: 9, creditQuota: 10, projects: 5, joinedAt: "2026-08-26" },
  { id: "u-1051", name: "Trịnh Bảo Ngọc", email: "ngoc.fashionista@gmail.com", plan: "creator-pro", role: "editor", status: "active", credits: 33, creditQuota: 60, projects: 74, joinedAt: "2026-04-06" },
  { id: "u-1052", name: "Lý Trung Kiên", email: "kien.giadung@gmail.com", plan: "starter", role: "viewer", status: "active", credits: 2, creditQuota: 10, projects: 2, joinedAt: "2026-08-28" },
];

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
