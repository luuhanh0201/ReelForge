import type { CookieOptions, Response } from 'express';
import type { AuthConfig } from '../config/configuration.js';

export const ACCESS_COOKIE = 'rf_at';
export const REFRESH_COOKIE = 'rf_rt';

/**
 * Refresh token chỉ được gửi kèm khi gọi đúng nhóm `/auth/*`. Mọi request thường không
 * mang nó theo, nên bề mặt phơi nhiễm của bí mật sống lâu nhất hẹp hơn hẳn.
 */
const REFRESH_COOKIE_PATH = '/auth';

/**
 * `reelforge.vn` và `api.reelforge.vn` cùng registrable domain nên cookie là *same-site*:
 * dùng được `SameSite=Lax` thay vì `None`, tránh hẳn chuyện Safari/Firefox chặn cookie
 * bên thứ ba. `Domain=.reelforge.vn` để Next chạy ở `reelforge.vn` cũng đọc được cookie
 * khi render phía server. Ở local để trống domain — `localhost:3000` và `localhost:3001`
 * vốn đã dùng chung kho cookie vì cookie không phân biệt cổng.
 */
const baseOptions = (auth: AuthConfig): CookieOptions => ({
  httpOnly: true,
  secure: auth.cookieSecure,
  sameSite: 'lax',
  domain: auth.cookieDomain,
});

export const setSessionCookies = (
  response: Response,
  auth: AuthConfig,
  tokens: { accessToken: string; refreshToken: string; refreshTtlSec: number },
): void => {
  response.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(auth),
    path: '/',
    maxAge: auth.accessTtlSec * 1000,
  });

  response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(auth),
    path: REFRESH_COOKIE_PATH,
    maxAge: tokens.refreshTtlSec * 1000,
  });
};

/**
 * Xoá cookie phải khai báo lại **đúng** domain và path đã dùng lúc đặt, nếu không trình
 * duyệt coi là cookie khác và giữ nguyên cookie cũ.
 */
export const clearSessionCookies = (
  response: Response,
  auth: AuthConfig,
): void => {
  response.clearCookie(ACCESS_COOKIE, { ...baseOptions(auth), path: '/' });
  response.clearCookie(REFRESH_COOKIE, {
    ...baseOptions(auth),
    path: REFRESH_COOKIE_PATH,
  });
};
