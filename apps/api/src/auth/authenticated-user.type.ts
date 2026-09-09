import type { UserRole } from './user.entity.js';

/** User đã xác thực, gắn vào request bởi JwtAuthGuard. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  /** Phiên đang dùng — cần cho đăng xuất và cho việc đánh dấu "thiết bị này". */
  sessionId: string;
}

declare module 'express' {
  interface Request {
    authUser?: AuthenticatedUser;
  }
}
