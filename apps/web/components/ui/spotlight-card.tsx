"use client";

import { useCallback, type MouseEvent, type ReactNode } from "react";
import { ACCENT, type Accent } from "@/lib/accent";

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  accent?: Accent;
  as?: "div" | "article" | "li";
}

/**
 * Thẻ có bề mặt sáng lên theo vị trí con trỏ (--mouse-x / --mouse-y).
 * Dùng chung cho Bento Grid, thẻ giá và thẻ giọng đọc.
 */
export function SpotlightCard({
  children,
  className = "",
  accent = "brand",
  as: Tag = "div",
}: SpotlightCardProps) {
  const handleMouseMove = useCallback((event: MouseEvent<HTMLElement>) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
    target.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
  }, []);

  return (
    <Tag
      onMouseMove={handleMouseMove}
      style={{ "--spotlight-color": ACCENT[accent].hex } as React.CSSProperties}
      className={`spotlight-surface relative overflow-hidden rounded-card border border-line bg-surface transition-colors duration-300 hover:border-[color-mix(in_srgb,var(--spotlight-color)_45%,transparent)] ${className}`}
    >
      {children}
    </Tag>
  );
}
