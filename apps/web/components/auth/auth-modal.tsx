"use client";

import { Coins, Lock, Mail, ShieldCheck, User, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AUTH_MODAL, type AuthMode } from "@/config/content.config";
import { AUTH_CONFIG, SITE } from "@/config/site.config";
import { useApp } from "@/lib/app-provider";
import { L } from "@/lib/i18n";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

const FIELD =
  "flex items-center gap-2 rounded-btn border border-line bg-surface px-3 focus-within:border-brand/50";
const INPUT =
  "h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted";

export function AuthModal() {
  const { t, authOpen, authMode, setAuthMode, closeAuth, signInWithEmail, googleStatus } =
    useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!email.includes("@")) return;
    signInWithEmail(email.trim(), isSignUp ? name : undefined);
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

            {/* Vị trí ưu tiên cao nhất: Google Sign-In nằm trên form truyền thống */}
            <div className="mt-5">
              <GoogleSignInButton />
            </div>

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

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {t(AUTH_MODAL.divider)}
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {isSignUp ? (
                <label className={FIELD}>
                  <User size={16} className="shrink-0 text-muted" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t(AUTH_MODAL.fields.name)}
                    aria-label={t(AUTH_MODAL.fields.name)}
                    className={INPUT}
                  />
                </label>
              ) : null}

              <label className={FIELD}>
                <Mail size={16} className="shrink-0 text-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t(AUTH_MODAL.fields.email)}
                  aria-label={t(AUTH_MODAL.fields.email)}
                  className={INPUT}
                />
              </label>

              <label className={FIELD}>
                <Lock size={16} className="shrink-0 text-muted" />
                <input
                  type="password"
                  required
                  minLength={AUTH_MODAL.passwordMinLength}
                  placeholder={t(AUTH_MODAL.fields.password)}
                  aria-label={t(AUTH_MODAL.fields.password)}
                  className={INPUT}
                />
              </label>

              {isSignUp ? null : (
                <button
                  type="button"
                  className="-mt-1 self-end text-xs font-medium text-muted transition-colors hover:text-brand"
                >
                  {t(AUTH_MODAL.forgotPassword)}
                </button>
              )}

              <button
                type="submit"
                disabled={googleStatus === "connecting"}
                className="h-11 rounded-btn border border-line bg-subtle text-sm font-bold text-ink transition-colors hover:border-brand/45 disabled:opacity-60"
              >
                {t(copy.submit)}
              </button>
            </form>

            {isSignUp ? (
              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
                <Coins size={13} className="text-mint" />
                {t(
                  L(
                    `Đăng ký bằng email nhận ${AUTH_CONFIG.emailSignupCredits} Credits`,
                    `Email signup gets ${AUTH_CONFIG.emailSignupCredits} credits`,
                  ),
                )}
              </p>
            ) : null}

            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
              {t(copy.switchHint)}
              <button
                type="button"
                onClick={() => setAuthMode(isSignUp ? "signin" : "signup")}
                className="font-semibold text-brand transition-opacity hover:opacity-80"
              >
                {t(copy.switchAction)}
              </button>
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
