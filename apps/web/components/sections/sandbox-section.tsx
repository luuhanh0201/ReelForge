"use client";

import { ArrowRight, Heart, Play, Sparkles, Wind } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  ASPECT_RATIOS,
  SANDBOX,
  VOICE_ACTORS,
  type AspectRatioId,
} from "@/config/content.config";
import { SITE } from "@/config/site.config";
import { ACCENT } from "@/lib/accent";
import { useApp } from "@/lib/app-provider";
import { formatPrice } from "@/lib/format";
import { L } from "@/lib/i18n";
import { LandingVoiceButton } from "@/components/effects/landing-voice-button";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
}

export function SandboxSection() {
  const { t, locale, user, openAuth } = useApp();
  const [ratio, setRatio] = useState<AspectRatioId>("9:16");
  const [subtitle, setSubtitle] = useState(t(SANDBOX.defaultSubtitle));
  const [rendering, setRendering] = useState(false);
  const [voiceId, setVoiceId] = useState(VOICE_ACTORS[0]?.id ?? "");
  const [activeWord, setActiveWord] = useState(0);
  const [likes, setLikes] = useState<number>(SANDBOX.initialLikes);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const heartId = useRef(0);
  const touchedSubtitle = useRef(false);

  // Chưa chỉnh sửa thì phụ đề mẫu đi theo ngôn ngữ đang chọn.
  useEffect(() => {
    if (!touchedSubtitle.current) setSubtitle(t(SANDBOX.defaultSubtitle));
  }, [locale, t]);

  const words = useMemo(
    () => subtitle.trim().split(/\s+/).filter(Boolean),
    [subtitle],
  );

  // Phụ đề karaoke: sáng dần từng từ theo nhịp.
  useEffect(() => {
    if (words.length === 0) return;

    const timer = window.setInterval(
      () => setActiveWord((current) => (current + 1) % words.length),
      SANDBOX.karaokeStepMs,
    );
    return () => window.clearInterval(timer);
  }, [words.length]);

  // Pha 2: lồng tiếng chạy ngầm sau khi người dùng ngừng gõ.
  useEffect(() => {
    if (!rendering) return;

    const timer = window.setTimeout(() => setRendering(false), SANDBOX.voiceRenderMs);
    return () => window.clearTimeout(timer);
  }, [rendering, subtitle, voiceId]);

  const handleFrameClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const heart: FloatingHeart = {
      id: heartId.current++,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    setHearts((current) => [...current, heart].slice(-12));
    setLikes((current) => current + 1);
    window.setTimeout(
      () => setHearts((current) => current.filter((item) => item.id !== heart.id)),
      1200,
    );
  };

  const activeRatio =
    ASPECT_RATIOS.find((item) => item.id === ratio) ?? ASPECT_RATIOS[0];
  const activeVoice =
    VOICE_ACTORS.find((voice) => voice.id === voiceId) ?? VOICE_ACTORS[0];

  return (
    <section id="demo" className="scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow={SANDBOX.eyebrow}
          title={SANDBOX.title}
          description={SANDBOX.description}
        />

        <Reveal delay={0.1} className="mt-12">
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {/* Thanh công cụ demo */}
            <div className="flex flex-col gap-3 border-b border-line bg-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span className="flex h-6 w-6 items-center justify-center rounded-btn bg-brand text-[11px] font-bold text-[#10151e]">
                  {SITE.logoLetter}
                </span>
                {t(SANDBOX.projectName)}
              </div>

              <div className="flex items-center gap-1 rounded-btn border border-line bg-surface p-1">
                {ASPECT_RATIOS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRatio(item.id)}
                    aria-pressed={ratio === item.id}
                    className={`rounded-[4px] px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      ratio === item.id
                        ? "bg-brand text-[#10151e]"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {item.label}
                    <span className="ml-1.5 hidden text-[10px] font-medium opacity-70 sm:inline">
                      {t(item.platform)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
              {/* Cột trái: bảng điều khiển */}
              <div className="flex flex-col gap-6 lg:self-center">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="sandbox-subtitle"
                      className="text-sm font-semibold text-ink"
                    >
                      {t(SANDBOX.subtitleLabel)}
                    </label>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-btn px-2 py-1 text-[11px] font-semibold ${
                        rendering
                          ? "bg-amber/10 text-amber"
                          : "bg-mint/10 text-mint"
                      }`}
                    >
                      <motion.span
                        animate={rendering ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
                        transition={{ duration: 0.9, repeat: rendering ? Infinity : 0 }}
                        className={`h-2 w-2 rounded-full ${rendering ? "bg-amber" : "bg-mint"}`}
                      />
                      {rendering ? t(SANDBOX.statusRendering) : t(SANDBOX.statusSynced)}
                    </span>
                  </div>

                  <textarea
                    id="sandbox-subtitle"
                    value={subtitle}
                    maxLength={SANDBOX.maxSubtitleLength}
                    onChange={(event) => {
                      touchedSubtitle.current = true;
                      setSubtitle(event.target.value);
                      setRendering(true);
                    }}
                    rows={3}
                    className="mt-2 w-full resize-none rounded-btn border border-line bg-canvas px-3 py-2.5 text-sm leading-relaxed text-ink outline-none transition-colors focus:border-brand/50"
                  />
                  <p className="mt-1.5 text-xs text-muted">
                    {subtitle.length}/{SANDBOX.maxSubtitleLength} ·{" "}
                    {t(
                      L(
                        "Chữ hiện trên video ngay khi bạn gõ",
                        "Text lands on the video as you type",
                      ),
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-ink">{t(SANDBOX.voiceLabel)}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {VOICE_ACTORS.map((voice) => {
                      const selected = voice.id === voiceId;
                      return (
                        <button
                          key={voice.id}
                          type="button"
                          onClick={() => {
                            setVoiceId(voice.id);
                            setRendering(true);
                          }}
                          aria-pressed={selected}
                          className={`flex items-center gap-3 rounded-btn border px-3 py-2.5 text-left transition-colors ${
                            selected
                              ? `${ACCENT[voice.accent].border} ${ACCENT[voice.accent].softBg}`
                              : "border-line bg-canvas hover:border-brand/30"
                          }`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ACCENT[voice.accent].bg} text-[#10151e]`}
                          >
                            {voice.name.charAt(0)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {voice.name}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {t(voice.gender)} · {t(voice.region)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/*
                    Phát bản audio đã cache của giọng cấu hình cho vị trí Mini Studio.
                    Không gọi nhà cung cấp từ trang công khai nên khách bấm bao nhiêu
                    lần cũng không phát sinh chi phí.
                  */}
                  <div className="mt-3">
                    <LandingVoiceButton
                      slot="studio"
                      label={t(L("Nghe thử giọng demo", "Preview demo voice"))}
                    />
                  </div>
                </div>

                {user ? (
                  <a
                    href={SITE.studioUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-btn bg-brand px-5 py-3 text-sm font-bold text-[#10151e] transition-transform hover:-translate-y-0.5"
                  >
                    <Sparkles size={16} />
                    {t(SANDBOX.cta)}
                    <ArrowRight size={16} />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => openAuth("signin")}
                    className="inline-flex items-center justify-center gap-2 rounded-btn bg-brand px-5 py-3 text-sm font-bold text-[#10151e] transition-transform hover:-translate-y-0.5"
                  >
                    <Sparkles size={16} />
                    {t(L("Đăng nhập để mở Studio", "Sign in to open Studio"))}
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>

              {/* Cột phải: khung xem trước */}
              <div className="flex flex-col gap-3">
                <motion.div
                  layout
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  onClick={handleFrameClick}
                  className={`relative mx-auto w-full cursor-pointer select-none overflow-hidden rounded-card border border-line bg-[#10151e] ${activeRatio?.className ?? ""}`}
                >
                  {/* Ảnh sản phẩm mô phỏng (khối màu phẳng + icon lucide) */}
                  <div className="absolute inset-0 flex items-center justify-center bg-[#222b39]">
                    <Wind size={96} className="text-[#8a95a8]" strokeWidth={1.2} />
                  </div>

                  {/* Lớp phủ tối phẳng để tôn chữ phụ đề */}
                  <div className="absolute inset-0 bg-[#10151e]/55" />

                  <span className="absolute left-3 top-3 max-w-[50%] rounded-btn bg-brand px-2 py-1 text-[10px] font-bold leading-tight text-[#10151e]">
                    🔥 {t(SANDBOX.hookBadge)}
                  </span>

                  <div className="absolute right-3 top-3 max-w-[38%] rounded-btn bg-[#10151e]/70 px-2 py-1 text-right">
                    <p className="text-[10px] font-medium text-[#8a95a8] line-through">
                      {formatPrice(SANDBOX.product.originalPrice, locale)}
                    </p>
                    <p className="text-xs font-bold text-amber">
                      {formatPrice(SANDBOX.product.price, locale)}{" "}
                      <span className="text-mint">{t(SANDBOX.product.discountLabel)}</span>
                    </p>
                  </div>

                  {/* Phụ đề karaoke */}
                  <div className="absolute inset-x-3 bottom-14 text-center">
                    <p className="font-display text-lg font-bold leading-snug text-white drop-shadow-[0_2px_8px_rgba(16,21,30,0.9)] sm:text-xl">
                      {words.map((word, index) => (
                        <span
                          key={`${word}-${index}`}
                          className={
                            index === activeWord ? "text-brand" : "text-white"
                          }
                        >
                          {word}{" "}
                        </span>
                      ))}
                    </p>
                  </div>

                  <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 rounded-btn bg-[#10151e]/70 px-2 py-1 text-[11px] font-semibold text-[#e7ecf4]">
                      <Play size={12} className="text-mint" />
                      {activeVoice?.name}
                    </span>
                    <span className="flex items-center gap-1.5 rounded-btn bg-[#10151e]/70 px-2 py-1 text-[11px] font-semibold text-[#e7ecf4]">
                      <Heart size={12} className="text-brand" fill="currentColor" />
                      {likes.toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}
                    </span>
                  </div>

                  {/* Hiệu ứng thả tim */}
                  <AnimatePresence>
                    {hearts.map((heart) => (
                      <motion.span
                        key={heart.id}
                        initial={{ opacity: 1, scale: 0.6, y: 0 }}
                        animate={{ opacity: 0, scale: 1.4, y: -120 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        style={{ left: heart.x, top: heart.y }}
                        className="pointer-events-none absolute -translate-x-1/2 text-brand"
                      >
                        <Heart size={26} fill="currentColor" />
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </motion.div>

                <p className="text-center text-xs text-muted">{t(SANDBOX.likeHint)}</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
