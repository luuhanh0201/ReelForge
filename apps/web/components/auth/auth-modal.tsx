"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Coins,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  ShieldCheck,
  User as UserIcon,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import { AUTH_MODAL, type AuthMode } from "@/config/content.config";
import { AUTH_CONFIG, SITE } from "@/config/site.config";
import { useApp } from "@/lib/app-provider";
import { requestPasswordReset, resendVerification } from "@/lib/auth-api";
import { L } from "@/lib/i18n";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

const FIELD =
  "flex items-center gap-2 rounded-btn border border-line bg-surface px-3 focus-within:border-brand/50";
const INPUT =
  "h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted";

/**
 * Modal có bốn bước, không phải bốn màn hình riêng: đăng nhập, đăng ký, "kiểm tra hộp
 * thư" sau khi đăng ký, và quên mật khẩu. Gom vào một chỗ để người dùng không bị đẩy ra
 * khỏi trang đang xem chỉ vì bấm nhầm tab.
 */
type Step = "form" | "check-inbox" | "forgot";

/**
 * Vỏ modal: lo phần hiện/ẩn, khoá cuộn nền và phím Esc.
 *
 * Thân modal nằm ở component riêng bên dưới và **unmount khi đóng** — nhờ vậy mật khẩu
 * đang gõ dở, thông báo lỗi và bước đang đứng tự biến mất, không cần dọn tay.
 */
export function AuthModal() {
  const { t, authOpen, authMode, closeAuth } = useApp();
  const copy = AUTH_MODAL.modes[authMode];

  useEffect(() => {
    if (!authOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAuth();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

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
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#10151e]/70 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeAuth();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t(copy.title)}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative my-auto w-full max-w-md overflow-hidden rounded-card border border-line bg-canvas p-6 shadow-2xl"
          >
            <AuthModalBody />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function AuthModalBody() {
  const {
    t,
    authMode,
    setAuthMode,
    closeAuth,
    authError,
    signInWithPassword,
    register,
  } = useApp();

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const copy = AUTH_MODAL.modes[authMode];
  const isSignUp = authMode === "signup";

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setStep("form");
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (isSignUp && password !== confirmPassword) {
      setError("Hai lần nhập mật khẩu chưa khớp nhau");
      return;
    }

    setBusy(true);
    try {
      if (isSignUp) {
        await register({ email, password, name, acceptedTerms });
        setStep("check-inbox");
      } else {
        await signInWithPassword(email, password);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thực hiện được, thử lại sau");
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    try {
      await resendVerification(email);
      setNotice(t(AUTH_MODAL.checkInbox.resent));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không gửi lại được");
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await requestPasswordReset(email);
      setNotice(t(AUTH_MODAL.forgot.sent));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không gửi được liên kết");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
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

            {step === "check-inbox" ? (
              <div className="mt-5">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-card bg-mint/10 text-mint">
                  <MailCheck size={22} />
                </span>
                <h2 className="mt-4 font-display text-xl font-bold text-ink">
                  {t(AUTH_MODAL.checkInbox.title)}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {t(AUTH_MODAL.checkInbox.description)}
                </p>
                <p className="mt-3 rounded-btn border border-line bg-surface px-3 py-2 font-mono text-sm text-ink">
                  {email}
                </p>

                {notice ? (
                  <p className="mt-3 text-xs font-semibold text-mint">{notice}</p>
                ) : null}

                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void handleResend()}
                    disabled={busy}
                    className="h-11 rounded-btn border border-line bg-subtle text-sm font-bold text-ink transition-colors hover:border-brand/45 disabled:opacity-60"
                  >
                    {t(AUTH_MODAL.checkInbox.resend)}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="text-xs font-semibold text-muted transition-colors hover:text-ink"
                  >
                    {t(AUTH_MODAL.forgot.back)}
                  </button>
                </div>
              </div>
            ) : step === "forgot" ? (
              <div className="mt-5">
                <h2 className="font-display text-xl font-bold text-ink">
                  {t(AUTH_MODAL.forgot.title)}
                </h2>
                <p className="mt-1.5 text-sm text-muted">
                  {t(AUTH_MODAL.forgot.description)}
                </p>

                <form onSubmit={(event) => void handleForgot(event)} className="mt-5 flex flex-col gap-3">
                  <label className={FIELD}>
                    <Mail size={16} className="shrink-0 text-muted" />
                    <input
                      type="text"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder={t(AUTH_MODAL.fields.email)}
                      aria-label={t(AUTH_MODAL.fields.email)}
                      className={INPUT}
                    />
                  </label>

                  {notice ? (
                    <p className="text-xs font-semibold text-mint">{notice}</p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-btn bg-brand text-sm font-bold text-[#10151e] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                    {t(AUTH_MODAL.forgot.submit)}
                  </button>

                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-ink"
                  >
                    <ArrowLeft size={13} />
                    {t(AUTH_MODAL.forgot.back)}
                  </button>
                </form>
              </div>
            ) : (
              <>
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
                      onClick={() => switchMode(mode)}
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

                <h2 className="mt-5 font-display text-xl font-bold text-ink">
                  {t(copy.title)}
                </h2>
                <p className="mt-1.5 text-sm text-muted">{t(copy.description)}</p>

                {/* Google đứng trên cùng: một chạm, không phải nhớ mật khẩu. */}
                <div className="mt-5">
                  <GoogleSignInButton />
                </div>

                {isSignUp ? (
                  <ul className="mt-4 flex flex-col gap-2">
                    {AUTH_MODAL.perks.map((perk) => (
                      <li
                        key={perk.en}
                        className="flex items-center gap-2 text-xs text-muted"
                      >
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

                <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-3">
                  {isSignUp ? (
                    <label className={FIELD}>
                      <UserIcon size={16} className="shrink-0 text-muted" />
                      <input
                        type="text"
                        required
                        autoComplete="name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder={t(AUTH_MODAL.fields.name)}
                        aria-label={t(AUTH_MODAL.fields.name)}
                        className={INPUT}
                      />
                    </label>
                  ) : null}

                  <div>
                    <label className={FIELD}>
                      <Mail size={16} className="shrink-0 text-muted" />
                      <input
                        // Không dùng type="email": trình duyệt sẽ chặn dạng rút gọn
                        // "banmai" mà máy chủ vẫn hiểu là banmai@gmail.com.
                        type="text"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder={t(AUTH_MODAL.fields.email)}
                        aria-label={t(AUTH_MODAL.fields.email)}
                        className={INPUT}
                      />
                    </label>
                    {isSignUp ? (
                      <p className="mt-1 pl-1 text-[11px] text-muted">
                        {t(AUTH_MODAL.emailHint)}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className={FIELD}>
                      <Lock size={16} className="shrink-0 text-muted" />
                      <input
                        type="password"
                        required
                        minLength={AUTH_MODAL.passwordMinLength}
                        autoComplete={isSignUp ? "new-password" : "current-password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={t(AUTH_MODAL.fields.password)}
                        aria-label={t(AUTH_MODAL.fields.password)}
                        className={INPUT}
                      />
                    </label>
                    {isSignUp ? (
                      <p className="mt-1 pl-1 text-[11px] text-muted">
                        {t(AUTH_MODAL.passwordHint)}
                      </p>
                    ) : null}
                  </div>

                  {isSignUp ? (
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
                  ) : null}

                  {isSignUp ? (
                    <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                      <input
                        type="checkbox"
                        required
                        checked={acceptedTerms}
                        onChange={(event) => setAcceptedTerms(event.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#ff6b35]"
                      />
                      <span>
                        {t(AUTH_MODAL.terms.label)}{" "}
                        <a href="/dieu-khoan" className="font-semibold text-brand hover:underline">
                          {t(AUTH_MODAL.terms.linkTerms)}
                        </a>{" "}
                        {t(AUTH_MODAL.terms.and)}{" "}
                        <a href="/bao-mat" className="font-semibold text-brand hover:underline">
                          {t(AUTH_MODAL.terms.linkPrivacy)}
                        </a>
                      </span>
                    </label>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setStep("forgot");
                        setError(null);
                        setNotice(null);
                      }}
                      className="-mt-1 self-end text-xs font-medium text-muted transition-colors hover:text-brand"
                    >
                      {t(AUTH_MODAL.forgotPassword)}
                    </button>
                  )}

                  {error ?? authError ? (
                    <p
                      role="alert"
                      className="flex items-start gap-2 rounded-btn border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-ink"
                    >
                      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-danger" />
                      {error ?? authError}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-btn border border-line bg-subtle text-sm font-bold text-ink transition-colors hover:border-brand/45 disabled:opacity-60"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                    {t(copy.submit)}
                  </button>
                </form>

                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
                  <Coins size={13} className="text-mint" />
                  {t(
                    L(
                      `Tài khoản mới được tặng ${AUTH_CONFIG.googleBonusCredits} credits dùng thử.`,
                      `New accounts get ${AUTH_CONFIG.googleBonusCredits} trial credits.`,
                    ),
                  )}
                </p>
              </>
            )}
    </>
  );
}
