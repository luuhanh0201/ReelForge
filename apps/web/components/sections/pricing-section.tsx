"use client";

import { Check, Coins, Sparkles } from "lucide-react";
import { useState } from "react";
import { PRICING_PLANS, PRICING_SECTION } from "@/config/content.config";
import { useApp } from "@/lib/app-provider";
import { formatPrice } from "@/lib/format";
import { L } from "@/lib/i18n";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { SpotlightCard } from "@/components/ui/spotlight-card";

type BillingCycle = "monthly" | "yearly";

export function PricingSection() {
  const { t, locale, openAuth } = useApp();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  const priceFor = (monthlyPrice: number) =>
    cycle === "yearly"
      ? Math.round((monthlyPrice * (1 - PRICING_SECTION.yearlyDiscount)) / 1000) * 1000
      : monthlyPrice;

  return (
    <section id="bang-gia" className="scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow={PRICING_SECTION.eyebrow}
          title={PRICING_SECTION.title}
          description={PRICING_SECTION.description}
        />

        <Reveal delay={0.05} className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1">
            {(["monthly", "yearly"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCycle(option)}
                aria-pressed={cycle === option}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  cycle === option
                    ? "bg-brand text-[#10151e]"
                    : "text-muted hover:text-ink"
                }`}
              >
                {t(PRICING_SECTION[option])}
                {option === "yearly" ? (
                  <span
                    className={`rounded-btn px-1.5 py-0.5 text-[10px] font-bold ${
                      cycle === "yearly" ? "bg-[#10151e] text-mint" : "bg-mint/10 text-mint"
                    }`}
                  >
                    {t(PRICING_SECTION.yearlyBadge)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {PRICING_PLANS.map((plan, index) => {
            const price = priceFor(plan.monthlyPrice);

            return (
              <Reveal key={plan.id} delay={0.06 * index} className="h-full">
                <SpotlightCard
                  accent={plan.highlighted ? "brand" : "mint"}
                  className={`flex h-full flex-col p-6 ${
                    plan.highlighted ? "border-brand shadow-[0_0_60px_-30px_#ff6b35]" : ""
                  }`}
                >
                  <span
                    aria-hidden={!plan.highlighted}
                    className={`mb-4 inline-flex w-fit items-center gap-1.5 rounded-btn bg-brand px-2.5 py-1 text-[11px] font-bold text-[#10151e] ${
                      plan.highlighted ? "" : "invisible"
                    }`}
                  >
                    <Sparkles size={12} />
                    {t(PRICING_SECTION.recommended)}
                  </span>

                  <h3 className="font-display text-xl font-bold text-ink">{t(plan.name)}</h3>
                  <p className="mt-1.5 min-h-10 text-sm text-muted">{t(plan.description)}</p>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-display text-3xl font-bold text-ink">
                      {price === 0 ? t(L("Miễn phí", "Free")) : formatPrice(price, locale)}
                    </span>
                    {price > 0 ? (
                      <span className="text-sm text-muted">{t(PRICING_SECTION.perMonth)}</span>
                    ) : null}
                  </div>
                  <p
                    aria-hidden={!(price > 0 && cycle === "yearly")}
                    className={`mt-1 text-xs text-mint ${
                      price > 0 && cycle === "yearly" ? "" : "invisible"
                    }`}
                  >
                    {t(PRICING_SECTION.billedYearly)} · {formatPrice(price * 12, locale)}
                  </p>

                  <p className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-btn bg-mint/10 px-2.5 py-1.5 text-xs font-bold text-mint">
                    <Coins size={14} />
                    {plan.credits} {t(PRICING_SECTION.creditsLabel)}
                  </p>

                  <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature.en} className="flex gap-2 text-sm text-muted">
                        <Check size={16} className="mt-0.5 shrink-0 text-mint" />
                        {t(feature)}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => openAuth("signup")}
                    className={`mt-6 w-full shrink-0 rounded-btn px-4 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 ${
                      plan.highlighted
                        ? "bg-brand text-[#10151e]"
                        : "border border-line bg-subtle text-ink hover:border-brand/40"
                    }`}
                  >
                    {t(plan.cta)}
                  </button>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
