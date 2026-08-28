"use client";

import { useApp } from "@/lib/app-provider";
import type { Localized } from "@/lib/i18n";
import { Reveal } from "@/components/ui/reveal";

interface SectionHeadingProps {
  eyebrow: Localized;
  title: Localized;
  description?: Localized;
  align?: "center" | "left";
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: SectionHeadingProps) {
  const { t } = useApp();
  const alignment =
    align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl";

  return (
    <Reveal className={alignment}>
      <span className="inline-flex items-center rounded-btn border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-brand">
        {t(eyebrow)}
      </span>
      <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {t(title)}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-muted">
          {t(description)}
        </p>
      ) : null}
    </Reveal>
  );
}
