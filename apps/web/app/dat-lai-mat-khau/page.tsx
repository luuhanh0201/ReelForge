"use client";

import { CheckCircle2, Loader2, Lock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AUTH_MODAL } from "@/config/content.config";
import { useApp } from "@/lib/app-provider";
import { resetPassword } from "@/lib/auth-api";
import { L } from "@/lib/i18n";

const FIELD =
  "flex items-center gap-2 rounded-btn border border-line bg-surface px-3 focus-within:border-brand/50";
const INPUT =
  "h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted";

/**
 * Đích đến của liên kết trong mail đặt lại mật khẩu.
 *
 * Đặt lại thành công sẽ **đóng mọi phiên đang mở** của tài khoản (kể cả phiên của kẻ đang
 * chiếm tài khoản, nếu có), nên sau đó bắt buộc đăng nhập lại bằng mật khẩu mới.
 */
function ResetPasswordContent() {
  const params = useSearchParams();
  const { t, openAuth } = useApp();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Hai lần nhập mật khẩu chưa khớp nhau");
      return;
    }

    setBusy(true);
    try {
      await resetPassword(token ?? "", password);
      setDone(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không đặt lại được mật khẩu",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-8">
        {!token ? (
          <div className="text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-card bg-amber/10 text-amber">
              <TriangleAlert size={26} />
            </span>
            <h1 className="mt-4 font-display text-2xl font-bold text-ink">
              {t(L("Liên kết không hợp lệ", "Invalid link"))}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {t(
                L(
                  "Liên kết thiếu mã đặt lại. Hãy yêu cầu liên kết mới từ màn hình đăng nhập.",
                  "This link has no reset code. Request a new one from the sign-in screen.",
                ),
              )}
            </p>
          </div>
        ) : done ? (
          <div className="text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-card bg-mint/10 text-mint">
              <CheckCircle2 size={26} />
            </span>
            <h1 className="mt-4 font-display text-2xl font-bold text-ink">
              {t(L("Đã đổi mật khẩu", "Password updated"))}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t(
                L(
                  "Mọi thiết bị đang đăng nhập đã bị đăng xuất. Hãy đăng nhập lại bằng mật khẩu mới.",
                  "Every signed-in device has been logged out. Sign in again with your new password.",
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
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold text-ink">
              {t(AUTH_MODAL.forgot.title)}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {t(L("Chọn mật khẩu mới cho tài khoản của bạn.", "Choose a new password."))}
            </p>

            <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 flex flex-col gap-3">
              <div>
                <label className={FIELD}>
                  <Lock size={16} className="shrink-0 text-muted" />
                  <input
                    type="password"
                    required
                    minLength={AUTH_MODAL.passwordMinLength}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t(AUTH_MODAL.fields.password)}
                    aria-label={t(AUTH_MODAL.fields.password)}
                    className={INPUT}
                  />
                </label>
                <p className="mt-1 pl-1 text-[11px] text-muted">
                  {t(AUTH_MODAL.passwordHint)}
                </p>
              </div>

              <label className={FIELD}>
                <Lock size={16} className="shrink-0 text-muted" />
                <input
                  type="password"
                  required
                  minLength={AUTH_MODAL.passwordMinLength}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={t(AUTH_MODAL.fields.confirmPassword)}
                  aria-label={t(AUTH_MODAL.fields.confirmPassword)}
                  className={INPUT}
                />
              </label>

              {error ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-btn border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-ink"
                >
                  <TriangleAlert size={14} className="mt-0.5 shrink-0 text-danger" />
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-btn bg-brand text-sm font-bold text-[#10151e] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                {t(L("Đổi mật khẩu", "Update password"))}
              </button>
            </form>
          </>
        )}

        <Link
          href="/"
          className="mt-4 block text-center text-xs font-semibold text-muted transition-colors hover:text-ink"
        >
          {t(L("Về trang chủ", "Back home"))}
        </Link>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    // useSearchParams cần ranh giới Suspense trong App Router.
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
