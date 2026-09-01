"use client";

import { Loader2, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TESTIMONIAL_SPEED, VOICE_SLOTS } from "@/config/admin/landing.config";
import { MAX_SAMPLE_CHARS } from "@/config/admin/models.config";
import type { LandingConfig } from "@/lib/admin/landing-cms-api";
import { fetchVoices, previewVoice, type VoiceEntry } from "@/lib/admin/voices-api";
import { AdminButton, AdminCard, AdminSelect, Pill } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toast";

/**
 * Cấu hình giọng cho ba điểm chạm âm thanh trên landing.
 *
 * Nghe thử dùng lại đúng luồng Google TTS + bộ nhớ đệm của danh mục giọng, **không**
 * dùng Web Speech của trình duyệt — nếu không admin sẽ nghe một giọng còn khách nhận
 * một giọng khác hẳn.
 */
export function VoiceSection({
  config,
  onChange,
}: {
  config: LandingConfig;
  onChange: (patch: (current: LandingConfig) => LandingConfig) => void;
}) {
  const toast = useToast();
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchVoices()
        .then((items) => setVoices(items.filter((voice) => voice.enabled)))
        .catch((cause: unknown) =>
          setError(cause instanceof Error ? cause.message : "Không đọc được danh mục giọng"),
        );
    }, 0);

    return () => {
      window.clearTimeout(timer);
      audioRef.current?.pause();
    };
  }, []);

  const preview = async (slotId: string, voiceId: string, speed: number) => {
    audioRef.current?.pause();

    if (playing === slotId) {
      setPlaying(null);
      return;
    }

    const voice = voices.find((item) => item.id === voiceId);
    if (!voice) {
      toast("Chọn một giọng đã bật trước khi nghe thử", "warning");
      return;
    }

    setPlaying(slotId);

    try {
      const result = await previewVoice(voice.id);
      const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
      audioRef.current = audio;
      audio.preservesPitch = true;
      audio.playbackRate = speed;
      audio.onended = () => setPlaying(null);

      await audio.play();
      toast(
        result.cached
          ? `${voice.personaName}: phát từ bộ nhớ đệm · không tốn ký tự`
          : `${voice.personaName}: đã tổng hợp ${result.charCount} ký tự`,
        result.cached ? "success" : "warning",
      );
    } catch (cause) {
      setPlaying(null);
      toast(cause instanceof Error ? cause.message : "Không nghe thử được", "danger");
    }
  };

  return (
    <AdminCard>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-display text-base font-bold text-ink">
          Cấu hình giọng đọc theo vị trí
        </h2>
        <Pill accent="mint">{voices.length} giọng đang bật</Pill>
      </div>

      {error ? (
        <p className="mt-4 rounded-card border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-ink">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {VOICE_SLOTS.map((slot) => {
          const value = config.voice[slot.id];
          const speed = slot.id === "testimonial" ? config.voice.testimonial.speed : 1;

          return (
            <div
              key={slot.id}
              className="flex flex-col rounded-card border border-line bg-canvas p-4"
            >
              <h3 className="text-sm font-bold text-ink">{slot.title}</h3>
              <p className="mt-0.5 text-xs text-muted">{slot.where}</p>

              <label className="mt-4 flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">Giọng AI</span>
                <AdminSelect
                  ariaLabel={`Giọng cho ${slot.title}`}
                  value={value.voiceId}
                  onChange={(voiceId) =>
                    onChange((current) => ({
                      ...current,
                      voice: {
                        ...current.voice,
                        [slot.id]: { ...current.voice[slot.id], voiceId },
                      },
                    }))
                  }
                  options={[
                    { id: "", label: "— Dùng giọng mặc định —" },
                    ...voices.map((voice) => ({
                      id: voice.id,
                      label: `${voice.personaName} · ${voice.gender === "male" ? "Nam" : "Nữ"} · ${voice.region}`,
                    })),
                  ]}
                  className="w-full"
                />
              </label>

              <label className="mt-3 flex flex-col gap-1.5">
                <span className="flex items-center justify-between text-xs font-semibold text-muted">
                  <span>Câu thoại phát thử</span>
                  <span className="font-mono">
                    {value.sampleText.length}/{MAX_SAMPLE_CHARS}
                  </span>
                </span>
                <textarea
                  aria-label={`Câu thoại cho ${slot.title}`}
                  rows={3}
                  value={value.sampleText}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      voice: {
                        ...current.voice,
                        [slot.id]: {
                          ...current.voice[slot.id],
                          sampleText: event.target.value,
                        },
                      },
                    }))
                  }
                  className="w-full resize-none rounded-btn border border-line bg-subtle px-3.5 py-2 text-sm text-ink outline-none focus:border-brand/50"
                />
                <span className="text-[11px] text-muted">{slot.hint}</span>
              </label>

              {slot.id === "testimonial" ? (
                <label className="mt-3 flex flex-col gap-1.5">
                  <span className="flex items-center justify-between text-xs font-semibold text-muted">
                    <span>Tốc độ đọc</span>
                    <span className="font-mono font-bold text-amber">
                      {config.voice.testimonial.speed.toFixed(2)}x
                    </span>
                  </span>
                  <input
                    type="range"
                    min={TESTIMONIAL_SPEED.min}
                    max={TESTIMONIAL_SPEED.max}
                    step={TESTIMONIAL_SPEED.step}
                    value={config.voice.testimonial.speed}
                    aria-label="Tốc độ đọc phần đánh giá"
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        voice: {
                          ...current.voice,
                          testimonial: {
                            ...current.voice.testimonial,
                            speed: Number(event.target.value),
                          },
                        },
                      }))
                    }
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-[#ff6b35]"
                  />
                </label>
              ) : null}

              <AdminButton
                className="mt-4"
                onClick={() => void preview(slot.id, value.voiceId, speed)}
                disabled={voices.length === 0}
              >
                {playing === slot.id ? (
                  <Pause size={14} />
                ) : voices.length === 0 ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
                {playing === slot.id ? "Dừng" : "Nghe thử"}
              </AdminButton>
            </div>
          );
        })}
      </div>
    </AdminCard>
  );
}
