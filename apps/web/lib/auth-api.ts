import type { UserPlan } from "@/config/plans.config";
import { request } from "@/lib/admin/api-client";

export type UserRole = "user" | "viewer" | "editor" | "admin";
export type { UserPlan };

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  plan: UserPlan;
  credits: number;
  status: "active" | "suspended";
}

export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export interface SessionEntry {
  id: string;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  deviceType: DeviceType;
  /** Tên thiết bị đã dựng sẵn ở máy chủ, ví dụ "Chrome trên Windows". */
  deviceLabel: string;
  /** Phiên mở từ tổ hợp trình duyệt + hệ điều hành chưa từng thấy ở tài khoản. */
  isNewDevice: boolean;
  ip: string | null;
  /** IP của lần refresh gần nhất; khác `ip` nghĩa là phiên đã đổi mạng giữa chừng. */
  lastIp: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  /** Chính thiết bị đang mở trang này. */
  current: boolean;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  acceptedTerms: boolean;
}

/**
 * Đăng ký bằng email và mật khẩu.
 *
 * **Không trả về phiên đăng nhập**: tài khoản phải xác minh email trước, nên nơi gọi chỉ
 * việc chuyển sang màn hình "hãy kiểm tra hộp thư".
 */
export const registerWithPassword = (payload: RegisterPayload): Promise<{ email: string }> =>
  request<{ email: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const loginWithPassword = async (
  email: string,
  password: string,
): Promise<AuthUser> => {
  const { user } = await request<{ user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  return user;
};

export const verifyEmail = (token: string): Promise<{ verified: true }> =>
  request<{ verified: true }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

export const resendVerification = (email: string): Promise<void> =>
  request<void>("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const requestPasswordReset = (email: string): Promise<void> =>
  request<void>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const resetPassword = (
  token: string,
  password: string,
): Promise<{ reset: true }> =>
  request<{ reset: true }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });

/** Đổi authorization code của Google lấy phiên. Token đi bằng cookie, không qua JS. */
export const signInWithGoogleCode = async (code: string): Promise<AuthUser> => {
  const { user } = await request<{ user: AuthUser }>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

  return user;
};

export const fetchCurrentUser = async (): Promise<AuthUser> => {
  const { user } = await request<{ user: AuthUser }>("/auth/me");
  return user;
};

export const signOut = (): Promise<void> =>
  request<void>("/auth/logout", { method: "POST" });

export const signOutEverywhere = (): Promise<{ revoked: number }> =>
  request<{ revoked: number }>("/auth/logout-all", { method: "POST" });

export const fetchSessions = async (): Promise<SessionEntry[]> => {
  const { items } = await request<{ items: SessionEntry[] }>("/auth/sessions");
  return items;
};

export const revokeSession = (id: string): Promise<void> =>
  request<void>(`/auth/sessions/${id}`, { method: "DELETE" });

/** Vai được vào khu quản trị. */
export const isStaff = (user: AuthUser | null): boolean =>
  user !== null && user.role !== "user";

/** Khu vực riêng của khách hàng; `/admin` tự chuyển tiếp sang `/admin/overview`. */
export const STAFF_HOME = "/admin";
export const USER_HOME = "/studio";

/** Nơi đưa người dùng tới ngay sau khi đăng nhập, theo vai của họ. */
export const homePathFor = (user: AuthUser): string =>
  isStaff(user) ? STAFF_HOME : USER_HOME;

/**
 * Đích sau đăng nhập.
 *
 * Ưu tiên nơi người dùng thực sự muốn tới — `middleware.ts` ghi lại đường dẫn đó vào
 * `?signin=` khi chặn họ ở cửa. Chỉ bỏ qua khi đường dẫn ấy thuộc khu quản trị mà vai của
 * họ không vào được: đưa vào đó chỉ để nhận màn hình 403 thì thà về thẳng khu vực của họ.
 */
export const resolveRedirect = (
  user: AuthUser,
  requestedPath: string | null,
): string => {
  const fallback = homePathFor(user);

  // Chỉ nhận đường dẫn nội bộ: chuỗi bắt đầu bằng "//" là URL tuyệt đối trá hình và sẽ
  // đẩy người dùng sang tên miền khác.
  if (!requestedPath?.startsWith("/") || requestedPath.startsWith("//")) {
    return fallback;
  }

  const wantsAdmin = requestedPath === "/admin" || requestedPath.startsWith("/admin/");

  return wantsAdmin && !isStaff(user) ? fallback : requestedPath;
};
