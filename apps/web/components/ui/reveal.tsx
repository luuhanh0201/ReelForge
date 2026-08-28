"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { REVEAL } from "@/config/site.config";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Độ trễ để tạo hiệu ứng xuất hiện lần lượt trong một nhóm. */
  delay?: number;
}

/** Bọc nội dung để xuất hiện mượt khi cuộn tới (scroll reveal dùng chung). */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={REVEAL.initial}
      whileInView={REVEAL.animate}
      viewport={REVEAL.viewport}
      transition={{ ...REVEAL.transition, delay }}
    >
      {children}
    </motion.div>
  );
}
