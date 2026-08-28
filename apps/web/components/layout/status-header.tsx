"use client";

import { ArrowRight, Globe, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { SITE } from "@/config/site.config";
import { useApp } from "@/lib/app-provider";
import { L } from "@/lib/i18n";

const control =
  "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-btn border border-line bg-surface px-3 text-xs font-semibold text-muted transition-colors hover:border-brand/40 hover:text-ink";

/**
 * Header rút gọn cho các trang trạng thái (404/403).
 * Theo .agent/ui/not-found.md mục 2.1: logo + huy hiệu mã lỗi + VI/EN + sáng/tối
 * + nút đăng nhập hoặc vào Studio. Chiều cao nút 44px cho vùng chạm mobile.
 */
export function StatusHeader({ badge }: { badge?: string }) {
  const { t, locale, setLocale, theme, toggleTheme, user, openAuth } = useApp();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-brand font-display text-lg font-bold text-[#10151e]">
              {SITE.logoLetter}
            </span>
            <span className="font-display text-lg font-bold text-brand">{SITE.brand}</span>
          </Link>

          {badge ? (
            <span className="rounded-btn border border-brand/30 bg-brand/10 px-2 py-1 font-display text-xs font-bold tracking-wider text-brand">
              {badge}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLocale(locale === "vi" ? "en" : "vi")}
            className={control}
            aria-label={t(L("Đổi ngôn ngữ", "Switch language"))}
          >
            <Globe size={14} />
            {locale.toUpperCase()}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className={`${control} px-3`}
            aria-label={t(L("Đổi giao diện sáng tối", "Toggle light and dark mode"))}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {user ? (
            <Link
              href={SITE.studioUrl}
              className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-btn bg-brand px-4 text-sm font-bold text-[#10151e] transition-transform hover:-translate-y-0.5"
            >
              {t(L("Vào Studio", "Open Studio"))}
              <ArrowRight size={15} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => openAuth("signin")}
              className="inline-flex h-11 items-center whitespace-nowrap rounded-btn border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-brand/45 hover:bg-subtle"
            >
              {t(L("Đăng nhập", "Sign in"))}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
