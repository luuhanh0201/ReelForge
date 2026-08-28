"use client";

import { Mail } from "lucide-react";
import { FOOTER, FOOTER_GROUPS } from "@/config/content.config";
import { SITE } from "@/config/site.config";
import { useApp } from "@/lib/app-provider";
import { L } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useApp();
  const BadgeIcon = FOOTER.badge.icon;

  return (
    <footer className="border-t border-line bg-surface px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <a href="#" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-brand font-display text-lg font-bold text-[#10151e]">
                {SITE.logoLetter}
              </span>
              <span className="font-display text-lg font-bold text-brand">{SITE.brand}</span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              {t(FOOTER.description)}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-btn bg-amber/10 px-2.5 py-1.5 text-xs font-semibold text-amber">
              <BadgeIcon size={14} />
              {t(FOOTER.badge.label)}
            </span>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <div key={group.title.en}>
              <p className="font-display text-sm font-bold text-ink">{t(group.title)}</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.label.en}>
                    <a
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-brand"
                    >
                      {t(link.label)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 sm:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-mint">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
              </span>
              {t(FOOTER.statusLabel)}
            </span>
            <a
              href={`mailto:${SITE.contactEmail}`}
              className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-brand"
            >
              <Mail size={13} />
              {t(FOOTER.contactLabel)}: {SITE.contactEmail}
            </a>
          </div>

          <p className="text-xs text-muted">
            © {SITE.copyrightYear} {SITE.brand}. {t(L("Bảo lưu mọi quyền.", "All rights reserved."))}
          </p>
        </div>
      </div>
    </footer>
  );
}
