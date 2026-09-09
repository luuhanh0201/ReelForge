"use client";

import {
  ArrowRight,
  ChevronDown,
  Coins,
  Globe,
  LogOut,
  Menu,
  Moon,
  Sun,
  Wand2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { PLAN_LABEL } from "@/config/plans.config";
import { NAV_LINKS, SITE } from "@/config/site.config";
import { useApp } from "@/lib/app-provider";
import { L } from "@/lib/i18n";
import { GoogleGlyph } from "@/components/auth/google-glyph";

const iconButton =
  "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-btn border border-line bg-surface px-2.5 text-xs font-semibold text-muted transition-colors hover:border-brand/40 hover:text-ink";

export function SiteHeader() {
  const {
    t,
    locale,
    setLocale,
    theme,
    toggleTheme,
    user,
    openAuth,
    signOut,
  } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-brand font-display text-lg font-bold text-[#10151e]">
            {SITE.logoLetter}
          </span>
          <span className="font-display text-lg font-bold text-brand">{SITE.brand}</span>
        </a>

        <nav className="hidden items-center gap-1 xl:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-btn px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
            >
              {t(link.label)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLocale(locale === "vi" ? "en" : "vi")}
            className={`${iconButton} hidden sm:inline-flex`}
            aria-label={t(L("Đổi ngôn ngữ", "Switch language"))}
          >
            <Globe size={14} />
            {locale.toUpperCase()}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className={`${iconButton} justify-center px-2`}
            aria-label={t(L("Đổi giao diện sáng tối", "Toggle light and dark mode"))}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              {/* Gói Free không có huy hiệu — chỉ gói trả phí mới cần khoe. */}
              {user.plan === "free" ? null : (
                <span className="hidden rounded-btn bg-brand px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#10151e] xl:inline-flex">
                  {t(PLAN_LABEL[user.plan])}
                </span>
              )}

              <span className="hidden items-center gap-1.5 rounded-btn border border-mint/30 bg-mint/10 px-2.5 py-1.5 text-xs font-semibold text-mint sm:inline-flex">
                <Coins size={14} />
                {user.credits} CR
              </span>

              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-expanded={menuOpen}
                  className={`${iconButton} pl-1.5`}
                >
                  <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-[#10151e]">
                    {user.name.charAt(0).toUpperCase()}
                    <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-line bg-surface">
                      <GoogleGlyph size={8} />
                    </span>
                  </span>
                  <span className="hidden text-ink xl:inline">{user.name}</span>
                  <ChevronDown size={14} />
                </button>

                <AnimatePresence>
                  {menuOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="absolute right-0 top-11 w-56 overflow-hidden rounded-card border border-line bg-surface p-1.5 shadow-xl"
                    >
                      <div className="rounded-btn px-3 py-2">
                        <p className="text-sm font-semibold text-ink">{user.name}</p>
                        <p className="truncate text-xs text-muted">{user.email}</p>
                        <p className="mt-1 text-xs font-semibold text-mint">
                          {t(PLAN_LABEL[user.plan])} · {user.credits} CR
                        </p>
                      </div>
                      <a
                        href={SITE.studioUrl}
                        className="flex items-center gap-2 rounded-btn px-3 py-2 text-sm text-muted transition-colors hover:bg-subtle hover:text-ink"
                      >
                        <Wand2 size={15} />
                        {t(L("Vào Studio", "Open Studio"))}
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          signOut();
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-btn px-3 py-2 text-sm text-muted transition-colors hover:bg-subtle hover:text-ink"
                      >
                        <LogOut size={15} />
                        {t(L("Đăng xuất", "Sign out"))}
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuth("signin")}
              className="hidden whitespace-nowrap rounded-btn border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-brand/45 hover:bg-subtle sm:inline-flex"
            >
              {t(L("Đăng nhập", "Sign in"))}
            </button>
          )}

          {user ? (
            <a
              href={SITE.studioUrl}
              className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-btn bg-brand px-4 py-2 text-sm font-bold text-[#10151e] transition-transform hover:-translate-y-0.5 md:inline-flex"
            >
              {t(L("Vào Studio", "Open Studio"))}
              <ArrowRight size={15} />
            </a>
          ) : null}

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className={`${iconButton} justify-center px-2 xl:hidden`}
            aria-label={t(L("Mở menu", "Open menu"))}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-line bg-surface xl:hidden"
          >
            <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-btn px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
                >
                  {t(link.label)}
                </a>
              ))}

              <div className="mt-2 flex items-center gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setLocale(locale === "vi" ? "en" : "vi")}
                  className={`${iconButton} flex-1 justify-center`}
                >
                  <Globe size={14} />
                  {locale.toUpperCase()}
                </button>
              </div>

              {user ? null : (
                <button
                  type="button"
                  onClick={() => {
                    openAuth();
                    setMobileOpen(false);
                  }}
                  className="mt-2 rounded-btn border border-line px-3 py-2.5 text-sm font-semibold text-ink"
                >
                  {t(L("Đăng nhập", "Sign in"))}
                </button>
              )}

              {user ? (
                <a
                  href={SITE.studioUrl}
                  className="mt-1 flex items-center justify-center gap-1.5 rounded-btn bg-brand px-4 py-2.5 text-sm font-bold text-[#10151e]"
                >
                  {t(L("Vào Studio", "Open Studio"))}
                  <ArrowRight size={15} />
                </a>
              ) : null}
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
