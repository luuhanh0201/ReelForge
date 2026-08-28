"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  NOT_FOUND_FRAME,
  STATUS_PAGES,
  STATUS_PAGE_UI,
} from "@/config/content.config";
import { SITE } from "@/config/site.config";
import { useApp } from "@/lib/app-provider";
import { StatusFooter } from "@/components/layout/status-footer";
import { StatusHeader } from "@/components/layout/status-header";

const ACTION_BASE =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-btn px-5 text-sm font-bold transition-colors sm:w-auto";

/** Khung cuộn phim: lỗ răng cưa hai bên + cảnh báo nhấp nháy + số 404. */
function FilmReelFrame() {
  const { t } = useApp();
  const reducedMotion = useReducedMotion() ?? false;
  const WarningIcon = STATUS_PAGES.notFound.icon;
  const holes = Array.from({ length: NOT_FOUND_FRAME.perforationCount });

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-card border border-line bg-surface">
      {(["left-0", "right-0"] as const).map((side) => (
        <span
          key={side}
          aria-hidden
          className={`absolute inset-y-0 ${side} flex w-7 flex-col items-center justify-around bg-canvas`}
        >
          {holes.map((_, index) => (
            <span key={index} className="h-3.5 w-3 rounded-[3px] bg-line" />
          ))}
        </span>
      ))}

      <div className="px-12 py-10 text-center">
        <motion.span
          animate={reducedMotion ? undefined : { opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          className="inline-flex text-amber"
        >
          <WarningIcon size={30} />
        </motion.span>

        <p className="mt-3 font-display text-6xl font-bold leading-none tracking-tight text-ink sm:text-7xl">
          {STATUS_PAGES.notFound.code}
        </p>

        <p className="mt-4 font-display text-[10px] font-bold tracking-[0.3em] text-muted">
          {NOT_FOUND_FRAME.primaryTag} · {NOT_FOUND_FRAME.secondaryTag}
        </p>
        <p className="mt-1 text-xs text-muted">{t(NOT_FOUND_FRAME.caption)}</p>
      </div>
    </div>
  );
}

/**
 * Màn hình 404 dựng theo .agent/ui/not-found.md:
 * header rút gọn → khung cuộn phim → huy hiệu mã lỗi → cụm 3 nút khôi phục → footer.
 */
export function NotFoundScreen() {
  const { t, user, openAuth } = useApp();
  const router = useRouter();
  const status = STATUS_PAGES.notFound;
  const BackIcon = STATUS_PAGE_UI.backIcon;
  const HomeIcon = STATUS_PAGE_UI.homeIcon;
  const StudioIcon = STATUS_PAGE_UI.studioIcon;

  // Fallback an toàn: không có lịch sử để lùi thì đưa về trang chủ.
  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <StatusHeader badge={status.code} />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-14 sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[420px] -translate-x-1/2 rounded-full bg-brand/10 blur-[140px]"
        />

        <div className="relative w-full max-w-lg text-center">
          <FilmReelFrame />

          <span className="mt-8 inline-flex items-center rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-brand">
            {t(status.eyebrow)}
          </span>

          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {t(status.title)}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted">
            {t(status.description)}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleGoBack}
              className={`${ACTION_BASE} bg-brand text-[#10151e] hover:-translate-y-0.5`}
            >
              <BackIcon size={16} />
              {t(status.primaryLabel)}
            </button>

            <Link
              href="/"
              className={`${ACTION_BASE} border border-line bg-surface text-ink hover:border-brand/45 hover:bg-subtle`}
            >
              <HomeIcon size={16} />
              {t(status.secondaryLabel)}
            </Link>

            {user ? (
              <Link
                href={SITE.studioUrl}
                className={`${ACTION_BASE} text-muted hover:text-brand`}
              >
                <StudioIcon size={16} />
                {t(STATUS_PAGE_UI.studioLabel)}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => openAuth("signin")}
                className={`${ACTION_BASE} text-muted hover:text-brand`}
              >
                <StudioIcon size={16} />
                {t(STATUS_PAGE_UI.studioLabel)}
              </button>
            )}
          </div>
        </div>
      </main>

      <StatusFooter />
    </div>
  );
}
