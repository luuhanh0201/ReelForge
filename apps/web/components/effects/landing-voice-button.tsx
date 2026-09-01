"use client";

import { Loader2, Pause, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface VoicePreviewResponse {
  audioBase64: string;
  mimeType: string;
  speed: number;
}

/**
 * Nút nghe thử giọng trên landing.
 *
 * Chỉ phát **bản audio đã cache sẵn** từ `/landing-config/voice/:slot` — khách bấm bao
 * nhiêu lần cũng không gọi sang nhà cung cấp, không phát sinh chi phí. Chưa có bản lưu
 * thì nút **tự ẩn** thay vì hiện lỗi cho khách.
 */
export function LandingVoiceButton({
  slot,
  label,
  className = "",
}: {
  slot: "hero" | "studio" | "testimonial";
  label: string;
  className?: string;
}) {
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const toggle = async () => {
    audioRef.current?.pause();

    if (playing) {
      setPlaying(false);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/landing-config/voice/${slot}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        setAvailable(false);
        return;
      }

      const data = (await response.json()) as VoicePreviewResponse;
      const audio = new Audio(`data:${data.mimeType};base64,${data.audioBase64}`);
      audioRef.current = audio;
      audio.preservesPitch = true;
      audio.playbackRate = data.speed;
      audio.onended = () => setPlaying(false);

      setPlaying(true);
      await audio.play();
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  if (!available) return null;

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={loading}
      className={`inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-4 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-60 ${className}`}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : playing ? (
        <Pause size={14} />
      ) : (
        <Volume2 size={14} />
      )}
      {playing ? "Dừng" : label}
    </button>
  );
}
