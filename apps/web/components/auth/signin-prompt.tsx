"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useApp } from "@/lib/app-provider";

/**
 * Mở hộp đăng nhập khi người dùng bị `middleware.ts` đưa về trang chủ.
 *
 * Middleware gắn `?signin=<đường dẫn muốn vào>` để trang chủ biết đây không phải một
 * lượt ghé thăm bình thường mà là một người đang muốn vào khu vực cần đăng nhập.
 */
export function SignInPrompt() {
  const params = useSearchParams();
  const { openAuth, user, authLoading } = useApp();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current || authLoading || user) return;

    const requested = params.get("signin");
    if (!requested) return;

    opened.current = true;
    // Đăng nhập xong thì trả họ về đúng trang đã bị chặn, không bỏ họ lại ở trang chủ.
    openAuth("signin", requested);
  }, [params, openAuth, user, authLoading]);

  return null;
}
