"use client";

import { Sparkle } from "lucide-react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CURSOR_CONFIG } from "@/config/site.config";

interface StarParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  rotate: number;
}

/**
 * Hào quang chuột dạng lò xo + chùm sao 4 cánh kiểu Gemini.
 * Tự tắt trên thiết bị cảm ứng hoặc khi người dùng bật giảm chuyển động.
 */
export function GeminiCursor() {
  const [enabled, setEnabled] = useState(false);
  const [stars, setStars] = useState<StarParticle[]>([]);

  const rawX = useMotionValue(-500);
  const rawY = useMotionValue(-500);
  const x = useSpring(rawX, CURSOR_CONFIG.spring);
  const y = useSpring(rawY, CURSOR_CONFIG.spring);

  const lastSpawn = useRef({ x: 0, y: 0 });
  const starId = useRef(0);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const sync = () => setEnabled(finePointer.matches && !reducedMotion.matches);

    sync();
    finePointer.addEventListener("change", sync);
    reducedMotion.addEventListener("change", sync);

    return () => {
      finePointer.removeEventListener("change", sync);
      reducedMotion.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const spawnStars = (particles: Omit<StarParticle, "id">[]) => {
      const created = particles.map((particle) => ({
        ...particle,
        id: starId.current++,
      }));

      setStars((current) => [...current, ...created].slice(-CURSOR_CONFIG.maxStars));

      window.setTimeout(() => {
        const ids = new Set(created.map((star) => star.id));
        setStars((current) => current.filter((star) => !ids.has(star.id)));
      }, CURSOR_CONFIG.starLifetimeMs);
    };

    const handleMove = (event: PointerEvent) => {
      rawX.set(event.clientX);
      rawY.set(event.clientY);

      const distance = Math.hypot(
        event.clientX - lastSpawn.current.x,
        event.clientY - lastSpawn.current.y,
      );

      if (distance < CURSOR_CONFIG.starSpawnDistance) return;

      lastSpawn.current = { x: event.clientX, y: event.clientY };
      spawnStars([
        {
          x: event.clientX,
          y: event.clientY,
          size: 10 + Math.random() * 8,
          rotate: Math.random() * 90,
        },
      ]);
    };

    const handleDown = (event: PointerEvent) => {
      const burst = Array.from({ length: CURSOR_CONFIG.burstCount }, (_, index) => {
        const angle = (index / CURSOR_CONFIG.burstCount) * Math.PI * 2;
        return {
          x: event.clientX + Math.cos(angle) * CURSOR_CONFIG.burstRadius,
          y: event.clientY + Math.sin(angle) * CURSOR_CONFIG.burstRadius,
          size: 8 + Math.random() * 6,
          rotate: (angle * 180) / Math.PI,
        };
      });

      spawnStars(burst);
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerdown", handleDown, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerdown", handleDown);
    };
  }, [enabled, rawX, rawY]);

  if (!enabled) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      <motion.div
        style={{
          x,
          y,
          width: CURSOR_CONFIG.auraSize,
          height: CURSOR_CONFIG.auraSize,
          filter: `blur(${CURSOR_CONFIG.auraBlur}px)`,
        }}
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/16"
      />
      <motion.div
        style={{
          x,
          y,
          width: CURSOR_CONFIG.coreSize,
          height: CURSOR_CONFIG.coreSize,
          filter: `blur(${CURSOR_CONFIG.coreBlur}px)`,
        }}
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/22"
      />

      <AnimatePresence>
        {stars.map((star) => (
          <motion.span
            key={star.id}
            initial={{ opacity: 0.9, scale: 0.4, rotate: star.rotate }}
            animate={{ opacity: 0, scale: 1.1, rotate: star.rotate + 60 }}
            exit={{ opacity: 0 }}
            transition={{ duration: CURSOR_CONFIG.starLifetimeMs / 1000, ease: "easeOut" }}
            style={{ left: star.x, top: star.y }}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-brand"
          >
            <Sparkle size={star.size} strokeWidth={1.5} fill="currentColor" />
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
