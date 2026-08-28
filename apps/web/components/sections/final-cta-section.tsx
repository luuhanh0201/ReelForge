"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import { FINAL_CTA } from "@/config/content.config";
import { useApp } from "@/lib/app-provider";
import { Reveal } from "@/components/ui/reveal";

export function FinalCtaSection() {
  const { t, openAuth } = useApp();
  const Icon = FINAL_CTA.icon;

  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <Reveal className="mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-card border border-brand/30 bg-surface px-6 py-12 text-center sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]"
          />

          <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-btn bg-brand/10 text-brand">
            <Icon size={24} />
          </span>

          <h2 className="relative mt-5 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {t(FINAL_CTA.title)}
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
            {t(FINAL_CTA.description)}
          </p>

          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={openAuth}
              className="inline-flex w-full items-center justify-center gap-2 rounded-btn bg-brand px-6 py-3 text-sm font-bold text-[#10151e] transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              {t(FINAL_CTA.primaryCta)}
              <ArrowRight size={16} />
            </button>
            <a
              href="#bang-gia"
              className="inline-flex w-full items-center justify-center rounded-btn border border-line bg-subtle px-6 py-3 text-sm font-bold text-ink transition-colors hover:border-brand/40 sm:w-auto"
            >
              {t(FINAL_CTA.secondaryCta)}
            </a>
          </div>

          <p className="relative mt-4 inline-flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck size={14} className="text-mint" />
            {t(FINAL_CTA.note)}
          </p>
        </div>
      </Reveal>
    </section>
  );
}
