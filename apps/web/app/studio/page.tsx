"use client";

import { ArrowLeft, Coins, Sparkles } from "lucide-react";
import Link from "next/link";
import { STUDIO } from "@/config/content.config";
import { useApp } from "@/lib/app-provider";
import { AuthModal } from "@/components/auth/auth-modal";
import { StatusScreen } from "@/components/layout/status-screen";
import { L } from "@/lib/i18n";

/**
 * Private route: chưa đăng nhập thì trả về màn hình 403 kèm nút mở AuthModal.
 * Auth hiện là state phía client nên chốt chặn này mới dừng ở tầng UI —
 * khi có backend phải guard thêm ở server (middleware / session check).
 */
export default function StudioPage() {
  const { t, user, openAuth } = useApp();

  if (!user) {
    return (
      <>
        <StatusScreen status="forbidden" onPrimary={() => openAuth("signin")} />
        <AuthModal />
      </>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[420px] -translate-x-1/2 rounded-full bg-brand/10 blur-[140px]"
      />

      <div className="relative w-full max-w-lg rounded-card border border-line bg-surface p-8 text-center">
        <span className="inline-flex items-center rounded-btn border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-brand">
          {t(STUDIO.eyebrow)}
        </span>

        <h1 className="mt-4 font-display text-2xl font-bold text-ink sm:text-3xl">
          {t(STUDIO.title)}, {user.name}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{t(STUDIO.description)}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-card border border-line bg-canvas p-4">
            <p className="text-xs text-muted">{t(STUDIO.creditsLabel)}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 font-display text-xl font-bold text-mint">
              <Coins size={18} />
              {user.credits} CR
            </p>
          </div>
          <div className="rounded-card border border-line bg-canvas p-4">
            <p className="text-xs text-muted">{t(STUDIO.planLabel)}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 font-display text-xl font-bold text-ink">
              <Sparkles size={18} className="text-brand" />
              {user.plan === "pro"
                ? t(L("Creator Pro", "Creator Pro"))
                : t(L("Starter", "Starter"))}
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-btn border border-line bg-subtle px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-brand/45"
        >
          <ArrowLeft size={16} />
          {t(STUDIO.backLabel)}
        </Link>
      </div>
    </main>
  );
}
