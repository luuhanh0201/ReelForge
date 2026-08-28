"use client";

import Link from "next/link";
import {
  STATUS_PAGES,
  STATUS_PAGE_UI,
  type StatusPageKey,
} from "@/config/content.config";
import { ACCENT } from "@/lib/accent";
import { useApp } from "@/lib/app-provider";
import type { Localized } from "@/lib/i18n";
import { StatusFooter } from "@/components/layout/status-footer";
import { StatusHeader } from "@/components/layout/status-header";

interface StatusScreenProps {
  /** Truyền key thay vì object vì config chứa component icon, không serialize
   *  được khi Server Component render StatusScreen. */
  status: StatusPageKey;
  /** Ghi đè nhãn nút chính (ví dụ đổi theo trạng thái đăng nhập). */
  primaryLabel?: Localized;
  /** Có onPrimary thì nút chính là button, không thì là link về trang chủ. */
  onPrimary?: () => void;
}

/**
 * Màn hình trạng thái dùng chung (hiện dùng cho 403 — không đủ quyền vào route).
 * Trang 404 có đặc tả riêng nên dùng `NotFoundScreen`.
 */
export function StatusScreen({
  status: statusKey,
  primaryLabel,
  onPrimary,
}: StatusScreenProps) {
  const { t } = useApp();
  const status = STATUS_PAGES[statusKey];
  const Icon = status.icon;
  const BackIcon = STATUS_PAGE_UI.backIcon;
  const accent = ACCENT[status.accent];

  return (
    <div className="flex min-h-screen flex-col">
      <StatusHeader badge={status.code} />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-14 sm:px-6">
        <div
          aria-hidden
          className={`pointer-events-none absolute -top-32 left-1/2 h-80 w-[420px] -translate-x-1/2 rounded-full ${accent.softBg} blur-[140px]`}
        />

        <div className="relative w-full max-w-lg text-center">
          <span
            className={`inline-flex h-14 w-14 items-center justify-center rounded-card ${accent.softBg} ${accent.text}`}
          >
            <Icon size={26} />
          </span>

          <span
            className={`mt-6 inline-flex items-center rounded-btn border ${accent.border} ${accent.softBg} px-3 py-1 text-[11px] font-semibold tracking-[0.16em] ${accent.text}`}
          >
            {status.code} · {t(status.eyebrow)}
          </span>

          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {t(status.title)}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted">
            {t(status.description)}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {onPrimary ? (
              <button
                type="button"
                onClick={onPrimary}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-btn bg-brand px-6 text-sm font-bold text-[#10151e] transition-transform hover:-translate-y-0.5 sm:w-auto"
              >
                {t(primaryLabel ?? status.primaryLabel)}
              </button>
            ) : (
              <Link
                href="/"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-btn bg-brand px-6 text-sm font-bold text-[#10151e] transition-transform hover:-translate-y-0.5 sm:w-auto"
              >
                <BackIcon size={16} />
                {t(primaryLabel ?? status.primaryLabel)}
              </Link>
            )}

            <Link
              href="/"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-btn border border-line bg-surface px-6 text-sm font-bold text-ink transition-colors hover:border-brand/45 hover:bg-subtle sm:w-auto"
            >
              {t(status.secondaryLabel)}
            </Link>
          </div>
        </div>
      </main>

      <StatusFooter />
    </div>
  );
}
