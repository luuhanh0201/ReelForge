import { NextResponse, type NextRequest } from "next/server";

/**
 * Chặn sớm các route riêng tư.
 *
 * Đây **chỉ là lớp trải nghiệm**: middleware chỉ nhìn xem cookie phiên có tồn tại hay
 * không, nó không xác minh chữ ký và không biết vai của người dùng. Chốt chặn thật nằm
 * ở guard của API — mọi dữ liệu đều phải đi qua đó. Cố gắng xác thực ở đây sẽ phải chia
 * sẻ khoá ký sang apps/web, đổi lấy rủi ro lớn hơn giá trị nhận được.
 */
const PRIVATE_PREFIXES = ["/studio", "/admin"];

const ACCESS_COOKIE = "rf_at";
const REFRESH_COOKIE = "rf_rt";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPrivate = PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isPrivate) return NextResponse.next();

  // Access token có thể vừa hết hạn trong khi refresh token vẫn còn: trường hợp đó cứ
  // cho vào, phía client sẽ tự gọi /auth/refresh.
  const hasSession =
    request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);
  if (hasSession) return NextResponse.next();

  const target = request.nextUrl.clone();
  target.pathname = "/";
  target.searchParams.set("signin", pathname);

  return NextResponse.redirect(target);
}

export const config = {
  matcher: ["/studio/:path*", "/admin/:path*"],
};
