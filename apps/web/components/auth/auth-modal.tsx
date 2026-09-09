"use client";

import { AlertTriangle, Coins, ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { AUTH_MODAL, type AuthMode } from "@/config/content.config";
import { AUTH_CONFIG, SITE } from "@/config/site.config";
import { useApp } from "@/lib/app-provider";
import { L } from "@/lib/i18n";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export function AuthModal() {
  const { t, authOpen, authMode, setAuthMode, closeAuth, authError } = useApp();
  const dialogRef = useRef<HTMLDivElement>(null);
  const copy = AUTH_MODAL.modes[authMode];
  const isSignUp = authMode === "signup";

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
            aria-label={t(copy.title)}
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

            {/* Chuyển giữa Đăng nhập và Đăng ký */}
            <div
              role="tablist"
              className="mt-5 inline-flex w-full items-center gap-1 rounded-btn border border-line bg-surface p-1"
            >
              {(Object.keys(AUTH_MODAL.modes) as AuthMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={authMode === mode}
                  onClick={() => setAuthMode(mode)}
                  className={`h-9 flex-1 rounded-[4px] text-sm font-semibold transition-colors ${
                    authMode === mode
                      ? "bg-brand text-[#10151e]"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {t(AUTH_MODAL.modes[mode].tab)}
                </button>
              ))}
            </div>

            <h2 className="mt-5 font-display text-xl font-bold text-ink">{t(copy.title)}</h2>
            <p className="mt-1.5 text-sm text-muted">{t(copy.description)}</p>

            {/*
              Google là cách đăng nhập duy nhất ở giai đoạn này. Form email/mật khẩu cũ đã
              được gỡ: để lại một đường đăng nhập không hoạt động trong giao diện thật chỉ
              làm người dùng thử rồi thất vọng.
            */}
            <div className="mt-5">
              <GoogleSignInButton />
            </div>

            {authError ? (
              <p
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-btn border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-ink"
              >
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-danger" />
                {authError}
              </p>
            ) : null}

            {isSignUp ? (
              <ul className="mt-4 flex flex-col gap-2">
                {AUTH_MODAL.perks.map((perk) => (
                  <li key={perk.en} className="flex items-center gap-2 text-xs text-muted">
                    <ShieldCheck size={14} className="shrink-0 text-mint" />
                    {t(perk)}
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted">
              <Coins size={13} className="text-mint" />
              {t(
                L(
                  `Tài khoản mới được tặng ${AUTH_CONFIG.googleBonusCredits} credits dùng thử.`,
                  `New accounts get ${AUTH_CONFIG.googleBonusCredits} trial credits.`,
                ),
              )}
            </p>

            <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
              {t(
                L(
                  "Chúng tôi chỉ nhận tên, email và ảnh đại diện từ Google.",
                  "We only receive your name, email and avatar from Google.",
                ),
              )}
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
