"use client";

import { Loader2, Pause, Play, Quote } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { VOICE_ACTORS, VOICE_SECTION } from "@/config/content.config";
import { ACCENT } from "@/lib/accent";
import { useApp } from "@/lib/app-provider";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { SpotlightCard } from "@/components/ui/spotlight-card";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const EQUALIZER_BARS = [0.4, 0.9, 0.6, 1, 0.5, 0.8, 0.35];

/** Màu thẻ xoay vòng, vì giọng trong database không mang màu nào cả. */
const ACCENTS = ["brand", "mint", "amber"] as const;

interface ShowcaseVoice {
  id: string;
  personaName: string;
  gender: string;
  region: string;
  /** Đúng câu mà file audio đọc — lấy từ bản ghi giọng, không phải chữ trang trí. */
  sampleText: string;
}

const GENDER_LABEL: Record<string, string> = { female: "Nữ", male: "Nam" };

const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60)
    .toString()
    .padStart(2, "0")}`;
};

/**
 * Mục "Giọng đọc AI" trên landing.
 *
 * Phát **đúng những giọng hệ thống đang chạy**, bằng chính bản audio đã cache trong
 * `voice_previews` — khách bấm bao nhiêu lần cũng không gọi sang nhà cung cấp, không phát
 * sinh chi phí. Trước đây mục này là 4 nhân vật bịa trong config với thanh tiến trình chạy
 * bằng `setInterval`, nghe thử không ra tiếng gì.
 *
 * Câu trích trên thẻ lấy từ `sampleText` của chính giọng đó, nên chữ và tiếng luôn khớp.
 * Muốn đổi câu thì sửa câu thoại mẫu trong trang quản trị rồi tạo lại bản nghe thử.
 *
 * API hỏng thì lùi về danh sách tĩnh và **nói rõ đó là bản mô phỏng** — landing không bao
 * giờ được trống chỉ vì backend chưa sẵn sàng.
 */
export function VoicesSection() {
  const { t } = useApp();
  const reduceMotion = useReducedMotion();
  const [voices, setVoices] = useState<ShowcaseVoice[] | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/landing-config/voices`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("không đọc được danh sách giọng");

        const data = (await response.json()) as { items: ShowcaseVoice[] };
        if (!cancelled) setVoices(data.items);
      } catch {
        // Giữ `null` = dùng danh sách tĩnh, kèm ghi chú đây là bản mô phỏng.
        if (!cancelled) setVoices(null);
      }
    };

    const timer = window.setTimeout(() => void load(), 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      audioRef.current?.pause();
    };
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
    setElapsed(0);
    setDuration(0);
  }, []);

  const toggle = useCallback(
    async (voiceId: string) => {
      if (playingId === voiceId) {
        stop();
        return;
      }

      stop();
      setLoadingId(voiceId);

      try {
        const response = await fetch(
          `${API_BASE_URL}/landing-config/voices/${voiceId}/preview`,
          { cache: "no-store" },
        );
        if (!response.ok) return;

        const data = (await response.json()) as { audioBase64: string; mimeType: string };
        const audio = new Audio(`data:${data.mimeType};base64,${data.audioBase64}`);
        audioRef.current = audio;

        audio.onloadedmetadata = () => setDuration(audio.duration);
        // `timeupdate` chỉ bắn khoảng 4 lần mỗi giây. Dùng nó để vẽ thanh tiến trình thì
        // thanh nhảy từng nấc; ở đây nó chỉ cập nhật **đồng hồ**, và chỉ khi số giây đổi
        // nên cả mục không render lại 4 lần mỗi giây. Thanh tiến trình do CSS nội suy.
        audio.ontimeupdate = () => {
          setElapsed((current) =>
            Math.floor(current) === Math.floor(audio.currentTime) ? current : audio.currentTime,
          );
        };
        audio.onended = () => stop();

        setPlayingId(voiceId);
        await audio.play();
      } catch {
        stop();
      } finally {
        setLoadingId(null);
      }
    },
    [playingId, stop],
  );

  const live = voices !== null && voices.length > 0;

  const cards = live
    ? voices.map((voice, index) => ({
        id: voice.id,
        name: voice.personaName,
        accent: ACCENTS[index % ACCENTS.length]!,
        meta: [GENDER_LABEL[voice.gender] ?? voice.gender, voice.region]
          .filter((item) => item && item !== "Chưa phân loại")
          .join(" · "),
        script: voice.sampleText,
      }))
    : VOICE_ACTORS.map((voice) => ({
        id: voice.id,
        name: voice.name,
        accent: voice.accent,
        meta: `${t(voice.gender)} · ${t(voice.region)}`,
        script: t(voice.sampleScript),
      }));

  return (
    <section id="giong-doc" className="scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow={VOICE_SECTION.eyebrow}
          title={VOICE_SECTION.title}
          description={VOICE_SECTION.description}
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((voice, index) => {
            const isPlaying = playingId === voice.id;
            const isLoading = loadingId === voice.id;
            /** Đã biết thời lượng thì mới chạy được thanh tiến trình. */
            const running = isPlaying && duration > 0;
            const accent = ACCENT[voice.accent];

            return (
              <Reveal key={voice.id} delay={0.05 * index}>
                <SpotlightCard accent={voice.accent} className="flex h-full flex-col p-5">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold ${accent.bg} text-[#10151e]`}
                    >
                      {voice.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-base font-bold text-ink">
                        {voice.name}
                      </p>
                      <p className="truncate text-xs text-muted">{voice.meta}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void toggle(voice.id)}
                      disabled={!live || isLoading}
                      aria-label={`${
                        isPlaying ? t(VOICE_SECTION.pause) : t(VOICE_SECTION.play)
                      } — ${voice.name}`}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 ${accent.bg} text-[#10151e]`}
                    >
                      {isLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : isPlaying ? (
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
                            isPlaying && !reduceMotion
                              ? { scaleY: [0.25, peak, 0.35, peak * 0.8, 0.25] }
                              : { scaleY: isPlaying ? 0.6 : 0.22 }
                          }
                          transition={
                            isPlaying && !reduceMotion
                              ? {
                                  duration: 0.9 + barIndex * 0.08,
                                  repeat: Infinity,
                                  repeatType: "mirror",
                                  ease: "easeInOut",
                                }
                              : { duration: 0.25 }
                          }
                          style={{ transformOrigin: "bottom" }}
                          className={`h-full w-1 rounded-full ${accent.bg}`}
                        />
                      ))}
                    </div>

                    <span className="w-[76px] shrink-0 whitespace-nowrap text-right font-mono text-[11px] text-muted">
                      {isPlaying ? `${formatTime(elapsed)} / ${formatTime(duration)}` : "—"}
                    </span>
                  </div>

                  {/*
                    Thanh tiến trình chạy bằng **một lần chuyển tiếp CSS dài đúng bằng
                    thời lượng audio**: trình duyệt tự nội suy từng khung hình, mượt hơn
                    hẳn việc React vẽ lại theo sự kiện `timeupdate` thưa thớt.
                  */}
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-subtle">
                    <div
                      className={`h-full rounded-full ${accent.bg}`}
                      style={{
                        width: running ? "100%" : "0%",
                        // Thời lượng lấy theo **tổng độ dài audio, không trừ dần theo
                        // `elapsed`**: đổi thời lượng giữa chừng là trình duyệt khởi động
                        // lại transition, và thanh giật đúng mỗi giây một nhịp.
                        transition: running ? `width ${duration}s linear` : "none",
                      }}
                    />
                  </div>

                  <p className="mt-4 flex flex-1 gap-2 text-sm leading-relaxed text-muted">
                    <Quote size={14} className={`mt-1 shrink-0 ${accent.text}`} />
                    <span className="italic">{voice.script}</span>
                  </p>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>

        {!live ? (
          <p className="mt-6 text-center text-xs text-muted">
            {t(VOICE_SECTION.simulatedNote)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
