"use client";

import { Disc3, Eye, Heart, ShoppingCart } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  HERO_VIDEO_CARDS,
  HERO_VIDEO_LOOP_MS,
  type HeroVideoCard,
} from "@/config/content.config";
import { ACCENT } from "@/lib/accent";
import { useApp } from "@/lib/app-provider";
import { formatPrice } from "@/lib/format";

const TICK_MS = 90;
const EQUALIZER_BARS = [0.45, 0.9, 0.6, 1, 0.5];

interface BurstHeart {
  id: number;
  x: number;
  y: number;
  angle: number;
}

interface VideoCardProps {
  card: HeroVideoCard;
  /** Đồng hồ chung của cả wall, tính bằng ms. */
  clock: number;
  reducedMotion: boolean;
  onPick: (link: string) => void;
}

function VideoCard({ card, clock, reducedMotion, onPick }: VideoCardProps) {
  const { t, locale } = useApp();
  const [hearts, setHearts] = useState<BurstHeart[]>([]);
  const heartId = useRef(0);
  const accent = ACCENT[card.accent];
  const { layout } = card;

  const words = useMemo(() => t(card.caption).split(" "), [card.caption, t]);

  const keywordSet = useMemo(
    () => card.keywords.map((keyword) => keyword.toLowerCase()),
    [card.keywords],
  );

  // Pha 1: chữ hiện dần theo nhịp loop. Pha 2: từ đang đọc được nhảy sáng.
  const cycle = (clock + layout.phaseOffsetMs) % HERO_VIDEO_LOOP_MS;
  const activeWord = Math.floor((cycle / HERO_VIDEO_LOOP_MS) * words.length);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const originX = event.clientX - rect.left;
    const originY = event.clientY - rect.top;

    const burst = Array.from({ length: 6 }, (_, index) => ({
      id: heartId.current++,
      x: originX,
      y: originY,
      angle: (index / 6) * Math.PI * 2,
    }));

    setHearts((current) => [...current, ...burst]);
    window.setTimeout(() => {
      const ids = new Set(burst.map((heart) => heart.id));
      setHearts((current) => current.filter((heart) => !ids.has(heart.id)));
    }, 900);

    onPick(card.sampleLink);
  };

  return (
    <motion.div
      className={`pointer-events-auto absolute ${layout.position} ${layout.width}`}
      animate={
        reducedMotion
          ? undefined
          : { y: [0, -layout.floatDistance, 0] }
      }
      transition={{
        duration: layout.floatDuration,
        delay: layout.floatDelay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      style={{ perspective: 900 }}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-label={`${t(card.product)} — ${t(card.caption)}`}
        style={
          {
            "--card-opacity": layout.opacity,
            transform: `rotateX(${layout.rotateX}deg) rotateY(${layout.rotateY}deg) rotate(${layout.tilt}deg) scale(${layout.scale})`,
          } as React.CSSProperties
        }
        className="group relative block w-full origin-center cursor-pointer opacity-[var(--card-opacity)] transition-[opacity,filter] duration-300 hover:opacity-100 hover:drop-shadow-[0_18px_40px_rgba(16,21,30,0.45)] focus-visible:opacity-100"
      >
        <span className="relative block aspect-[9/16] w-full overflow-hidden rounded-card border border-line bg-[#10151e] shadow-2xl">
          {/* Ảnh sản phẩm 9:16 */}
          <span
            className="absolute inset-0 block"
            style={{ backgroundColor: card.thumbnailColor }}
          >
            <Image
              src={card.image}
              alt=""
              fill
              sizes="140px"
              className="object-cover"
            />
          </span>
          {/* Lớp phủ phẳng: nhẹ toàn khung, đậm hơn ở đáy để tôn phụ đề */}
          <span className="absolute inset-0 bg-[#10151e]/25" />
          <span className="absolute inset-x-0 bottom-0 h-1/3 bg-[#10151e]/55" />

          {/* Huy hiệu Hook 3s + nhãn giảm giá */}
          <span className="absolute left-1 top-1 rounded-[3px] bg-brand px-1 py-[1px] text-[6px] font-bold leading-tight text-[#10151e]">
            🔥 {t(card.hookBadge)}
          </span>
          <span className="absolute right-1 top-1 rounded-[3px] bg-amber px-1 py-[1px] text-[6px] font-bold leading-tight text-[#10151e]">
            {card.discount}
          </span>

          {/* Cột tương tác bên phải: view, tim, đĩa nhạc quay */}
          <span className="absolute bottom-8 right-1 flex flex-col items-center gap-1.5">
            <span className="flex flex-col items-center text-[6px] font-semibold text-white">
              <Eye size={9} />
              {card.views}
            </span>
            <span className="flex flex-col items-center text-[6px] font-semibold text-white">
              <Heart size={9} className="text-brand" fill="currentColor" />
              {card.likes}
            </span>
            <motion.span
              animate={reducedMotion ? undefined : { rotate: 360 }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
              className="text-white/80"
            >
              <Disc3 size={12} />
            </motion.span>
          </span>

          {/* Phụ đề karaoke 2 pha */}
          <span className="absolute inset-x-1.5 bottom-7 block text-center text-[7px] font-bold leading-tight">
            {words.map((word, index) => {
              const isKeyword = keywordSet.some((keyword) =>
                word.toLowerCase().includes(keyword),
              );
              const revealed = index <= activeWord;

              return (
                <span
                  key={`${word}-${index}`}
                  className={
                    !revealed
                      ? "text-white/25"
                      : index === activeWord
                        ? accent.text
                        : isKeyword
                          ? "text-amber"
                          : "text-white"
                  }
                >
                  {word}{" "}
                </span>
              );
            })}
          </span>

          {/* Tag giỏ hàng vàng kiểu TikTok Shop + sóng âm */}
          <span className="absolute inset-x-1 bottom-2.5 flex items-center gap-1">
            <span className="flex min-w-0 flex-1 items-center gap-1 rounded-[3px] bg-amber px-1 py-[2px] text-[6px] font-bold text-[#10151e]">
              <ShoppingCart size={8} className="shrink-0" />
              <span className="truncate">{formatPrice(card.price, locale)}</span>
            </span>
            <span className="flex h-3 items-end gap-[1px]">
              {EQUALIZER_BARS.map((peak, index) => (
                <motion.span
                  key={index}
                  animate={
                    reducedMotion ? { scaleY: 0.3 } : { scaleY: [0.25, peak, 0.3] }
                  }
                  transition={{
                    duration: 0.7 + index * 0.09,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{ transformOrigin: "bottom" }}
                  className={`h-full w-[2px] rounded-full ${accent.bg}`}
                />
              ))}
            </span>
          </span>

          {/* Thanh tiến trình loop 3.5s */}
          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
            <motion.span
              animate={reducedMotion ? { width: "45%" } : { width: ["0%", "100%"] }}
              transition={{
                duration: HERO_VIDEO_LOOP_MS / 1000,
                repeat: Infinity,
                ease: "linear",
                delay: -(layout.phaseOffsetMs / 1000),
              }}
              className={`block h-full ${accent.bg}`}
            />
          </span>

          {/* Bung tỏa tim khi click */}
          <AnimatePresence>
            {hearts.map((heart) => (
              <motion.span
                key={heart.id}
                initial={{ opacity: 1, scale: 0.4, x: 0, y: 0 }}
                animate={{
                  opacity: 0,
                  scale: 1.3,
                  x: Math.cos(heart.angle) * 34,
                  y: Math.sin(heart.angle) * 34 - 14,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                style={{ left: heart.x, top: heart.y }}
                className="pointer-events-none absolute text-brand"
              >
                <Heart size={12} fill="currentColor" />
              </motion.span>
            ))}
          </AnimatePresence>
        </span>

        {/* Tên sản phẩm hiện khi rê chuột */}
        <span className="pointer-events-none absolute inset-x-0 -bottom-5 block truncate text-center text-[8px] font-semibold text-muted opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {t(card.product)}
        </span>
      </button>
    </motion.div>
  );
}

/**
 * Lớp nền Hero: các thẻ video thành phẩm 9:16 trôi lơ lửng, bố cục bất đối xứng.
 * Nằm dưới khối nội dung chính và luôn ở trong lề nên không che tiêu đề/CTA.
 */
export function HeroVideoWall({ onPick }: { onPick: (link: string) => void }) {
  const reducedMotion = useReducedMotion() ?? false;
  const [clock, setClock] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setClock((current) => (current + TICK_MS) % (HERO_VIDEO_LOOP_MS * 12)),
      TICK_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {HERO_VIDEO_CARDS.map((card) => (
        <VideoCard
          key={card.id}
          card={card}
          clock={clock}
          reducedMotion={reducedMotion}
          onPick={onPick}
        />
      ))}
    </div>
  );
}
