"use client";

import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useApp } from "@/lib/app-provider";
import { verifyEmail } from "@/lib/auth-api";
import { L } from "@/lib/i18n";

type State = "verifying" | "done" | "failed";

/**
 * Đích đến của liên kết trong mail xác minh.
 *
 * Người dùng tới đây từ hộp thư, có thể trên thiết bị khác với lúc đăng ký — nên trang
 * không giả định gì về phiên đang có, chỉ đổi token lấy kết quả rồi mời đăng nhập.
 */
function VerifyEmailContent() {
  const params = useSearchParams();
  const { t, openAuth } = useApp();
  const token = params.get("token");

  // Thiếu token là biết ngay từ lần render đầu, không cần chờ effect chạy rồi mới đổi.
  const [state, setState] = useState<State>(token ? "verifying" : "failed");
  const [message, setMessage] = useState(
    token ? "" : "Liên kết không hợp lệ — thiếu mã xác minh.",
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    verifyEmail(token)
      .then(() => {
        if (!cancelled) setState("done");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;

        setState("failed");
        setMessage(
          cause instanceof Error ? cause.message : "Không xác minh được email",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-8 text-center">
        {state === "verifying" ? (
          <>
            <Loader2 size={28} className="mx-auto animate-spin text-brand" />
            <p className="mt-4 text-sm text-muted">
              {t(L("Đang xác minh email...", "Verifying your email..."))}
            </p>
          </>
        ) : state === "done" ? (
          <>
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-card bg-mint/10 text-mint">
              <CheckCircle2 size={26} />
            </span>
            <h1 className="mt-4 font-display text-2xl font-bold text-ink">
              {t(L("Email đã được xác minh", "Email verified"))}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t(
                L(
                  "Tài khoản của bạn đã sẵn sàng. Đăng nhập để bắt đầu dựng video.",
                  "Your account is ready. Sign in to start creating.",
                ),
              )}
            </p>
            <button
              type="button"
              onClick={() => openAuth("signin")}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-btn bg-brand text-sm font-bold text-[#10151e] transition-transform hover:-translate-y-0.5"
            >
              {t(L("Đăng nhập ngay", "Sign in now"))}
            </button>
          </>
        ) : (
          <>
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-card bg-amber/10 text-amber">
              <TriangleAlert size={26} />
            </span>
            <h1 className="mt-4 font-display text-2xl font-bold text-ink">
              {t(L("Không xác minh được", "Verification failed"))}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{message}</p>
            <p className="mt-2 text-xs text-muted">
              {t(
                L(
                  "Liên kết chỉ dùng được một lần và hết hạn sau 24 giờ. Hãy đăng nhập để nhận liên kết mới.",
                  "The link works once and expires after 24 hours. Sign in to get a new one.",
                ),
              )}
            </p>
            <button
              type="button"
              onClick={() => openAuth("signin")}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-btn border border-line bg-subtle text-sm font-bold text-ink transition-colors hover:border-brand/45"
            >
              {t(L("Về màn hình đăng nhập", "Back to sign in"))}
            </button>
          </>
        )}

        <Link
          href="/"
          className="mt-4 inline-block text-xs font-semibold text-muted transition-colors hover:text-ink"
        >
          {t(L("Về trang chủ", "Back home"))}
        </Link>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    // useSearchParams cần ranh giới Suspense trong App Router.
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
