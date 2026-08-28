"use client";

import { Pause, Play, Quote } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { VOICE_ACTORS, VOICE_SECTION } from "@/config/content.config";
import { ACCENT } from "@/lib/accent";
import { useApp } from "@/lib/app-provider";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { SpotlightCard } from "@/components/ui/spotlight-card";

const EQUALIZER_BARS = [0.4, 0.9, 0.6, 1, 0.5, 0.8, 0.35];
const TICK_MS = 100;

export function VoicesSection() {
  const { t } = useApp();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const playing = VOICE_ACTORS.find((voice) => voice.id === playingId);

  // Mô phỏng tiến trình phát: file âm thanh thật được phát trong Studio.
  useEffect(() => {
    if (!playing) return;

    const timer = window.setInterval(() => {
      setElapsed((current) => {
        const next = current + TICK_MS / 1000;
        if (next >= playing.durationSec) {
          setPlayingId(null);
          return 0;
        }
        return next;
      });
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [playing]);

  const toggle = (id: string) => {
    setElapsed(0);
    setPlayingId((current) => (current === id ? null : id));
  };

  const formatTime = (seconds: number) =>
    `0:${Math.floor(seconds).toString().padStart(2, "0")}`;

  return (
    <section id="giong-doc" className="scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow={VOICE_SECTION.eyebrow}
          title={VOICE_SECTION.title}
          description={VOICE_SECTION.description}
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VOICE_ACTORS.map((voice, index) => {
            const isPlaying = playingId === voice.id;
            const progress = isPlaying ? (elapsed / voice.durationSec) * 100 : 0;

            return (
              <Reveal key={voice.id} delay={0.05 * index}>
                <SpotlightCard accent={voice.accent} className="flex h-full flex-col p-5">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold ${ACCENT[voice.accent].bg} text-[#10151e]`}
                    >
                      {voice.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-base font-bold text-ink">
                        {voice.name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {t(voice.gender)} · {t(voice.region)}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`mt-4 inline-flex w-fit items-center rounded-btn px-2 py-1 text-[11px] font-semibold ${ACCENT[voice.accent].softBg} ${ACCENT[voice.accent].text}`}
                  >
                    {t(voice.specialty)}
                  </span>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggle(voice.id)}
                      aria-label={`${isPlaying ? t(VOICE_SECTION.pause) : t(VOICE_SECTION.play)} — ${voice.name}`}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 ${ACCENT[voice.accent].bg} text-[#10151e]`}
                    >
                      {isPlaying ? (
                        <Pause size={16} fill="currentColor" />
                      ) : (
                        <Play size={16} fill="currentColor" />
                      )}
                    </button>

                    <div className="flex h-8 flex-1 items-end gap-1">
                      {EQUALIZER_BARS.map((peak, barIndex) => (
                        <motion.span
                          key={barIndex}
                          animate={
                            isPlaying
                              ? { scaleY: [0.25, peak, 0.35, peak * 0.8, 0.25] }
                              : { scaleY: 0.22 }
                          }
                          transition={
                            isPlaying
                              ? {
                                  duration: 0.9 + barIndex * 0.08,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }
                              : { duration: 0.25 }
                          }
                          style={{ transformOrigin: "bottom" }}
                          className={`h-full w-1 rounded-full ${ACCENT[voice.accent].bg}`}
                        />
                      ))}
                    </div>

                    <span className="w-[76px] shrink-0 whitespace-nowrap text-right font-mono text-[11px] text-muted">
                      {formatTime(isPlaying ? elapsed : 0)} / {formatTime(voice.durationSec)}
                    </span>
                  </div>

                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-subtle">
                    <div
                      className={`h-full rounded-full transition-[width] duration-100 ease-linear ${ACCENT[voice.accent].bg}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <p className="mt-4 flex flex-1 gap-2 text-sm leading-relaxed text-muted">
                    <Quote size={14} className={`mt-1 shrink-0 ${ACCENT[voice.accent].text}`} />
                    <span className="italic">{t(voice.sampleScript)}</span>
                  </p>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          {t(VOICE_SECTION.simulatedNote)}
        </p>
      </div>
    </section>
  );
}
