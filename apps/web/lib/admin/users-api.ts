import { request } from "@/lib/admin/api-client";
import type { SessionEntry, UserPlan, UserRole } from "@/lib/auth-api";

/** Cách tài khoản đăng nhập được — máy chủ suy từ `google_sub` và `password_hash`. */
export type AuthProvider = "google" | "password" | "both" | "none";

export interface AdminUserEntry {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  status: "active" | "suspended";
  plan: UserPlan;
  credits: number;
  /** Chưa xác minh thì tài khoản không đăng nhập bằng mật khẩu được. */
  emailVerified: boolean;
  provider: AuthProvider;
  /** Số thiết bị đang đăng nhập của tài khoản này. */
  activeSessions: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminUserStats {
  total: number;
  unverified: number;
  suspended: number;
}

/** Vài con số nhẹ cho huy hiệu trên sidebar. */
export const fetchAdminUserStats = (): Promise<AdminUserStats> =>
  request<AdminUserStats>("/admin/users/stats");

export interface UpdateUserPayload {
  role?: UserRole;
  status?: "active" | "suspended";
  credits?: number;
}

export const fetchAdminUsers = async (): Promise<AdminUserEntry[]> => {
  const { items } = await request<{ items: AdminUserEntry[] }>("/admin/users");
  return items;
};

export const updateAdminUser = (
  id: string,
  payload: UpdateUserPayload,
): Promise<AdminUserEntry> =>
  request<AdminUserEntry>(`/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const fetchUserSessions = async (
  id: string,
): Promise<SessionEntry[]> => {
  const { items } = await request<{ items: SessionEntry[] }>(
    `/admin/users/${id}/sessions`,
  );
  return items;
};

/** Đóng toàn bộ thiết bị của một tài khoản — dùng khi nghi ngờ bị chiếm quyền. */
export const revokeUserSessions = (id: string): Promise<{ revoked: number }> =>
  request<{ revoked: number }>(`/admin/users/${id}/sessions`, {
    method: "DELETE",
  });
