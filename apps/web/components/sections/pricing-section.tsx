"use client";

import { Check, Coins } from "lucide-react";
import { useState } from "react";
import {
  PRICING_PLANS,
  PRICING_SECTION,
  type PlanEmphasis,
} from "@/config/content.config";
import { ACCENT } from "@/lib/accent";
import { useApp } from "@/lib/app-provider";
import { formatPrice } from "@/lib/format";
import { L } from "@/lib/i18n";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { SpotlightCard } from "@/components/ui/spotlight-card";

type BillingCycle = "monthly" | "yearly";

/**
 * Bốn mức nhấn thị giác, tăng dần theo bậc gói: gói càng cao thẻ càng nổi.
 * Chiều sâu chỉ đến từ **màu phẳng, viền và quầng blur** — không gradient.
 */
const EMPHASIS: Record<
  PlanEmphasis,
  { card: (accent: typeof ACCENT.brand) => string; badge: "none" | "soft" | "solid"; cta: "outline" | "solid" }
> = {
  plain: {
    card: () => "",
    badge: "none",
    cta: "outline",
  },
  soft: {
    card: (accent) => accent.border,
    badge: "soft",
    cta: "outline",
  },
  strong: {
    card: (accent) => `${accent.border} ${accent.shadow}`,
    badge: "solid",
    cta: "solid",
  },
  elite: {
    // Vòng sáng viền trong cộng thêm quầng blur — mức nổi cao nhất của bảng giá.
    card: (accent) => `${accent.border} ${accent.shadow} ${accent.ring}`,
    badge: "solid",
    cta: "solid",
  },
};

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

        {/*
          Bốn gói: 1 cột trên điện thoại → 2 cột từ md (hai hàng cân nhau, không để một
          ô lẻ loi) → 4 cột từ xl. Cố ý không dùng 3 cột ở lg vì sẽ thừa ra một ô đứng
          một mình ở hàng dưới.
        */}
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PRICING_PLANS.map((plan, index) => {
            const price = priceFor(plan.monthlyPrice);
            const accent = ACCENT[plan.accent];
            const style = EMPHASIS[plan.emphasis];
            const BadgeIcon = plan.badge?.icon;

            return (
              <Reveal key={plan.id} delay={0.06 * index} className="h-full">
                <SpotlightCard
                  accent={plan.accent}
                  className={`flex h-full flex-col p-5 ${style.card(accent)}`}
                >
                  {/*
                    Gói thấp nhất không có huy hiệu nhưng vẫn giữ chỗ (`invisible`) để tên
                    gói, giá và danh sách tính năng của bốn thẻ luôn thẳng hàng nhau.
                  */}
                  <span
                    aria-hidden={style.badge === "none"}
                    className={`mb-4 inline-flex w-fit items-center gap-1.5 rounded-btn px-2.5 py-1 text-[11px] font-bold ${
                      style.badge === "none"
                        ? "invisible bg-subtle text-muted"
                        : style.badge === "soft"
                          ? `border ${accent.border} ${accent.softBg} ${accent.text}`
                          : `${accent.bg} text-[#10151e] ${accent.shadow}`
                    }`}
                  >
                    {BadgeIcon ? <BadgeIcon size={12} /> : null}
                    {/* Ký tự trắng giữ đúng chiều cao dòng cho thẻ không có huy hiệu. */}
                    {plan.badge ? t(plan.badge.label) : "\u00A0"}
                  </span>

                  <h3 className="font-display text-xl font-bold text-ink">{t(plan.name)}</h3>
                  <p className="mt-1.5 min-h-10 text-sm text-muted">{t(plan.description)}</p>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-display text-2xl font-bold text-ink lg:text-3xl">
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

                  <p
                    className={`mt-4 inline-flex w-fit items-center gap-1.5 rounded-btn px-2.5 py-1.5 text-xs font-bold ${accent.softBg} ${accent.text}`}
                  >
                    <Coins size={14} />
                    {plan.credits} {t(PRICING_SECTION.creditsLabel)}
                  </p>

                  <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature.en} className="flex gap-2 text-sm text-muted">
                        <Check size={16} className={`mt-0.5 shrink-0 ${accent.text}`} />
                        {t(feature)}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => openAuth("signup")}
                    className={`mt-6 w-full shrink-0 rounded-btn px-4 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 ${
                      style.cta === "solid"
                        ? `${accent.bg} text-[#10151e]`
                        : `border border-line bg-subtle text-ink ${accent.hoverBorder}`
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
