"use client";

import { ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { LandingConfig } from "@/lib/admin/landing-cms-api";
import { AdminCard, Pill } from "@/components/admin/primitives";

/**
 * Khung mô phỏng Hero của Landing Page, phản chiếu **ngay** bản nháp mà không cần bấm lưu.
 *
 * Chiều sâu tạo bằng khối màu phẳng + blur đúng như hero thật — không dùng gradient
 * (rule số 1 của design system).
 */
export function LiveSimulator({ config }: { config: LandingConfig }) {
  const { theme, content } = config;
  const [keywordIndex, setKeywordIndex] = useState(0);

  // Từ khoá chạy vòng như trên landing thật để admin thấy đúng nhịp.
  useEffect(() => {
    if (content.keywords.length <= 1) return;

    const timer = window.setInterval(
      () => setKeywordIndex((current) => (current + 1) % content.keywords.length),
      2800,
    );

    return () => window.clearInterval(timer);
  }, [content.keywords.length]);

  const keyword =
    content.keywords[keywordIndex % Math.max(1, content.keywords.length)]?.vi ?? "";

  return (
    <AdminCard padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        <h2 className="font-display text-base font-bold text-ink">
          Xem trước trực tiếp
        </h2>
        <Pill accent="info">Cập nhật ngay khi sửa, chưa xuất bản</Pill>
      </div>

      <div className="relative overflow-hidden bg-canvas px-6 py-12">
        {/* Khối glow phẳng, cùng cách làm với hero thật */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 top-0 h-56 w-56 rounded-full blur-[110px]"
          style={{ backgroundColor: `${theme.brandHex}33` }}
        />
        {theme.particleGrid ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: `radial-gradient(${theme.brandHex} 1px, transparent 1px)`,
              backgroundSize: "22px 22px",
            }}
          />
        ) : null}

        <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
            style={{
              borderColor: `${theme.brandHex}59`,
              color: theme.brandHex,
              backgroundColor: `${theme.brandHex}14`,
            }}
          >
            <Sparkles size={12} />
            {content.heroBadge.vi}
          </span>

          <h1 className="mt-4 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
            {content.heroTitlePrefix.vi}{" "}
            {keyword ? (
              <span
                className="inline-block rounded-btn px-2 py-0.5"
                style={{ backgroundColor: `${theme.brandHex}24`, color: theme.brandHex }}
              >
                {keyword}
              </span>
            ) : null}
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            {content.heroSubtitle.vi}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <span
              className="inline-flex h-11 items-center rounded-btn px-5 text-sm font-bold text-[#10151e]"
              style={{
                backgroundColor: theme.brandHex,
                boxShadow: theme.neonGlow ? `0 0 32px -6px ${theme.brandHex}` : "none",
              }}
            >
              {content.primaryCta.vi}
            </span>

            <span className="inline-flex h-11 items-center rounded-btn border border-line bg-surface px-5 text-sm font-semibold text-ink">
              {content.secondaryCta.vi}
            </span>
          </div>

          <p className="mt-5 flex items-center gap-1.5 text-[11px] text-muted">
            <ShieldCheck size={13} className="text-mint" />
            Không cần lộ mặt · Không cần kỹ năng dựng · Xuất video 1080p
          </p>

          {theme.spotlightCursor ? (
            <p className="mt-3 font-mono text-[11px] text-muted">
              Con trỏ spotlight: đang bật
            </p>
          ) : null}
        </div>
      </div>
    </AdminCard>
  );
}
