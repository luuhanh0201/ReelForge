"use client";

import { Coins, Lock, Mail, ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AUTH_CONFIG, SITE } from "@/config/site.config";
import { useApp } from "@/lib/app-provider";
import { L } from "@/lib/i18n";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

const PERKS = [
  L("Xuất video 1080p không watermark", "1080p export with no watermark"),
  L("Toàn bộ giọng đọc AI cao cấp", "Every premium AI voice"),
  L("Ưu tiên hàng đợi render", "Priority render queue"),
];

export function AuthModal() {
  const { t, authOpen, closeAuth, signInWithEmail, googleStatus } = useApp();
  const [email, setEmail] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  // Khoá cuộn nền + đóng bằng phím Esc khi modal đang mở.
  useEffect(() => {
    if (!authOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAuth();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.querySelector("button")?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [authOpen, closeAuth]);

  const handleEmailSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!email.includes("@")) return;
    signInWithEmail(email.trim());
  };

  return (
    <AnimatePresence>
      {authOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#10151e]/70 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeAuth();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t(L("Đăng nhập ReelForge", "Sign in to ReelForge"))}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-card border border-line bg-canvas p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={closeAuth}
              aria-label={t(L("Đóng", "Close"))}
              className="absolute right-4 top-4 rounded-btn p-1 text-muted transition-colors hover:bg-subtle hover:text-ink"
            >
              <X size={18} />
            </button>

            <span className="flex h-11 w-11 items-center justify-center rounded-btn bg-brand font-display text-xl font-bold text-[#10151e]">
              {SITE.logoLetter}
            </span>

            <h2 className="mt-4 font-display text-xl font-bold text-ink">
              {t(L("Bắt đầu với ReelForge", "Get started with ReelForge"))}
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              {t(
                L(
                  `Đăng nhập bằng Google để nhận ngay ${AUTH_CONFIG.googleBonusCredits} Credits và huy hiệu Pro.`,
                  `Sign in with Google to instantly get ${AUTH_CONFIG.googleBonusCredits} credits and a Pro badge.`,
                ),
              )}
            </p>

            {/* Vị trí ưu tiên cao nhất: Google Sign-In nằm trên form truyền thống */}
            <div className="mt-5">
              <GoogleSignInButton />
            </div>

            <ul className="mt-4 flex flex-col gap-2">
              {PERKS.map((perk) => (
                <li key={perk.en} className="flex items-center gap-2 text-xs text-muted">
                  <ShieldCheck size={14} className="shrink-0 text-mint" />
                  {t(perk)}
                </li>
              ))}
            </ul>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {t(L("hoặc dùng email", "or use email"))}
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
              <label className="flex items-center gap-2 rounded-btn border border-line bg-surface px-3">
                <Mail size={16} className="shrink-0 text-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t(L("Email của bạn", "Your email"))}
                  aria-label={t(L("Email của bạn", "Your email"))}
                  className="h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                />
              </label>

              <label className="flex items-center gap-2 rounded-btn border border-line bg-surface px-3">
                <Lock size={16} className="shrink-0 text-muted" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder={t(L("Mật khẩu", "Password"))}
                  aria-label={t(L("Mật khẩu", "Password"))}
                  className="h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                />
              </label>

              <button
                type="submit"
                disabled={googleStatus === "connecting"}
                className="h-11 rounded-btn border border-line bg-subtle text-sm font-bold text-ink transition-colors hover:border-brand/45 disabled:opacity-60"
              >
                {t(L("Tạo tài khoản bằng email", "Create account with email"))}
              </button>
            </form>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
              <Coins size={13} className="text-mint" />
              {t(
                L(
                  `Đăng ký bằng email nhận ${AUTH_CONFIG.emailSignupCredits} Credits`,
                  `Email signup gets ${AUTH_CONFIG.emailSignupCredits} credits`,
                ),
              )}
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
