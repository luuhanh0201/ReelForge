"use client";

import Link from "next/link";
import { NAV_LINKS, SITE } from "@/config/site.config";
import { STATUS_PAGE_UI } from "@/config/content.config";
import { useApp } from "@/lib/app-provider";
import { L } from "@/lib/i18n";

/**
 * Footer rút gọn cho trang trạng thái: bản quyền + liên kết quay lại nhanh.
 * Theo .agent/ui/not-found.md mục 2.5.
 */
export function StatusFooter() {
  const { t } = useApp();

  return (
    <footer className="border-t border-line px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-xs text-muted">
          © {SITE.copyrightYear} {SITE.brand}.{" "}
          {t(L("Bảo lưu mọi quyền.", "All rights reserved."))}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span className="text-xs text-muted">{t(STATUS_PAGE_UI.quickLinksLabel)}</span>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={`/${link.href}`}
              className="inline-flex min-h-11 items-center px-1.5 text-xs font-medium text-muted transition-colors hover:text-brand"
            >
              {t(link.label)}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
