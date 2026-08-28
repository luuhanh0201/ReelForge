"use client";

import { FEATURES, FEATURES_SECTION } from "@/config/content.config";
import { ACCENT } from "@/lib/accent";
import { useApp } from "@/lib/app-provider";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { SpotlightCard } from "@/components/ui/spotlight-card";

export function FeaturesSection() {
  const { t } = useApp();

  return (
    <section id="tinh-nang" className="scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow={FEATURES_SECTION.eyebrow}
          title={FEATURES_SECTION.title}
          description={FEATURES_SECTION.description}
        />

        <div className="mt-12 grid gap-4 md:grid-cols-6">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.id} delay={0.05 * index} className={feature.span}>
                <SpotlightCard
                  as="article"
                  accent={feature.accent}
                  className="h-full p-6"
                >
                  <span
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-btn ${ACCENT[feature.accent].softBg} ${ACCENT[feature.accent].text}`}
                  >
                    <Icon size={22} />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold text-ink">
                    {t(feature.title)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {t(feature.description)}
                  </p>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
