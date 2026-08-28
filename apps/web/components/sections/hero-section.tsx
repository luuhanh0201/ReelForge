"use client";

import { ArrowRight, CheckCircle2, Link2, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { HERO, HERO_TICKER, HERO_VALUE_CARDS } from "@/config/content.config";
import { SITE } from "@/config/site.config";
import { ACCENT } from "@/lib/accent";
import { useApp } from "@/lib/app-provider";
import { L } from "@/lib/i18n";
import { HeroVideoWall } from "@/components/effects/hero-video-wall";
import { Reveal } from "@/components/ui/reveal";
import { SpotlightCard } from "@/components/ui/spotlight-card";

function WordCycler() {
  const { t } = useApp();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % HERO.cyclerWords.length),
      HERO.cyclerIntervalMs,
    );
    return () => window.clearInterval(timer);
  }, []);

  const word = HERO.cyclerWords[index];
  if (!word) return null;

  return (
    <span className="relative flex min-h-[1.2em] items-center justify-center py-1 [perspective:800px]">
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block rounded-btn bg-brand px-3 py-1 text-[#10151e] [transform-style:preserve-3d]"
        >
          {t(word)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

interface LinkActionBoxProps {
  value: string;
  onValueChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

function LinkActionBox({ value, onValueChange, inputRef }: LinkActionBoxProps) {
  const { t } = useApp();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    setSubmitted(true);
  };

  const updateValue = (next: string) => {
    onValueChange(next);
    setSubmitted(false);
  };

  return (
    <div className="mx-auto mt-8 w-full max-w-2xl">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 rounded-card border border-line bg-surface p-2 sm:flex-row sm:items-center"
      >
        <div className="flex flex-1 items-center gap-2 px-2">
          <Link2 size={18} className="shrink-0 text-brand" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(event) => updateValue(event.target.value)}
            placeholder={t(HERO.inputPlaceholder)}
            aria-label={t(HERO.inputPlaceholder)}
            className="h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-btn bg-brand px-5 text-sm font-bold text-[#10151e] transition-transform hover:-translate-y-0.5"
        >
          <Zap size={16} />
          {t(HERO.cta)}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
        <span>{t(HERO.sampleLabel)}</span>
        {HERO.samples.map((sample) => (
          <button
            key={sample.en}
            type="button"
            onClick={() => updateValue(t(sample))}
            className="rounded-btn border border-line bg-surface px-2.5 py-1 font-medium transition-colors hover:border-brand/40 hover:text-brand"
          >
            {t(sample)}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {submitted ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-mint"
          >
            <CheckCircle2 size={16} />
            {t(
              L(
                "Đã nhận link! Đăng nhập để ReelForge dựng video trong Studio.",
                "Link received! Sign in and ReelForge will build the video in Studio.",
              ),
            )}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function HeroSection() {
  const { t, user, openAuth } = useApp();
  const [link, setLink] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Bấm chọn một thẻ video ở nền -> tự điền link sản phẩm mẫu vào ô dán link.
  const handlePickVideo = useCallback((sampleLink: string) => {
    setLink(sampleLink);
    inputRef.current?.focus();
  }, []);

  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:px-8">
      {/* Vùng sáng mờ khuếch tán (Solid Glow, không dùng gradient) */}
      <motion.div
        aria-hidden
        animate={{ scale: [1, 1.12, 1], opacity: [0.55, 0.75, 0.55] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[520px] -translate-x-1/2 rounded-full bg-brand/25 blur-[140px]"
      />
      <motion.div
        aria-hidden
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute bottom-0 right-8 h-[360px] w-[360px] rounded-full bg-mint/20 blur-[140px]"
      />

      <HeroVideoWall onPick={handlePickVideo} />

      <div className="relative z-10 mx-auto max-w-5xl">
        <Reveal className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-[11px] font-bold tracking-[0.16em] text-brand">
            ✨ {t(HERO.badge)}
          </span>

          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.15] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {t(HERO.titleStart)}
            <WordCycler />
            {t(HERO.titleEnd)}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            {t(HERO.description)}
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <LinkActionBox
            value={link}
            onValueChange={setLink}
            inputRef={inputRef}
          />
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-card border border-line bg-surface px-5 py-3">
            {HERO_TICKER.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label.en} className="flex items-center gap-2 text-sm">
                  {stat.pulse ? (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
                    </span>
                  ) : (
                    <Icon size={15} className={ACCENT[stat.accent].text} />
                  )}
                  <span className="font-bold text-ink">{t(stat.value)}</span>
                  <span className="text-muted">{t(stat.label)}</span>
                </div>
              );
            })}
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HERO_VALUE_CARDS.map((card, index) => {
            const Icon = card.icon;
            return (
              <Reveal key={card.title.en} delay={0.05 * index}>
                <SpotlightCard accent={card.accent} className="h-full p-5">
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-btn ${ACCENT[card.accent].softBg} ${ACCENT[card.accent].text}`}
                  >
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-4 font-display text-base font-bold text-ink">
                    {t(card.title)}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    {t(card.description)}
                  </p>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.1} className="mt-10 text-center">
          {/* Studio là private route: chưa đăng nhập thì mở modal xác thực trước. */}
          {user ? (
            <a
              href={SITE.studioUrl}
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition-transform hover:translate-x-0.5"
            >
              {t(L("Xem toàn bộ tính năng trong Studio", "Explore every Studio feature"))}
              <ArrowRight size={16} />
            </a>
          ) : (
            <button
              type="button"
              onClick={openAuth}
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition-transform hover:translate-x-0.5"
            >
              {t(L("Đăng nhập để mở Studio", "Sign in to open Studio"))}
              <ArrowRight size={16} />
            </button>
          )}
        </Reveal>
      </div>
    </section>
  );
}
