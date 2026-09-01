"use client";

import { FEATURED_VIDEO_OPTIONS } from "@/config/admin/landing.config";
import type { LandingConfig } from "@/lib/admin/landing-cms-api";
import { AdminCard, AdminInput } from "@/components/admin/primitives";

const LINK_LABELS = ["Link mẫu Shopee", "Link mẫu TikTok Shop", "Link mẫu Flash Deal"];

/** Sản phẩm mẫu và số liệu xã hội hiển thị trên landing. */
export function ShowcaseSection({
  config,
  onChange,
}: {
  config: LandingConfig;
  onChange: (patch: (current: LandingConfig) => LandingConfig) => void;
}) {
  const setShowcase = (patch: Partial<LandingConfig["showcase"]>) =>
    onChange((current) => ({ ...current, showcase: { ...current.showcase, ...patch } }));

  return (
    <AdminCard>
      <h2 className="font-display text-base font-bold text-ink">
        Video mẫu & sản phẩm showcase
      </h2>

      <div className="mt-4 flex flex-col gap-3">
        {LINK_LABELS.map((label, index) => (
          <label key={label} className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">{label}</span>
            <AdminInput
              ariaLabel={label}
              value={config.showcase.sampleLinks[index] ?? ""}
              onChange={(value) =>
                setShowcase({
                  sampleLinks: LINK_LABELS.map((_, i) =>
                    i === index ? value : (config.showcase.sampleLinks[i] ?? ""),
                  ),
                })
              }
            />
          </label>
        ))}
      </div>

      <div className="mt-5 border-t border-line pt-5">
        <span className="text-xs font-semibold text-muted">Số video nổi bật</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {FEATURED_VIDEO_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setShowcase({ featuredVideoCount: count })}
              className={`h-9 rounded-btn border px-4 text-xs font-semibold transition-colors ${
                config.showcase.featuredVideoCount === count
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-line bg-subtle text-muted hover:text-ink"
              }`}
            >
              {count} video
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Số nhà sáng tạo</span>
          <AdminInput
            ariaLabel="Số nhà sáng tạo"
            value={config.showcase.creatorCount}
            onChange={(creatorCount) => setShowcase({ creatorCount })}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Số video đã tạo</span>
          <AdminInput
            ariaLabel="Số video đã tạo"
            value={config.showcase.videoCount}
            onChange={(videoCount) => setShowcase({ videoCount })}
          />
        </label>
      </div>

      <p className="mt-3 text-[11px] text-muted">
        Hai số liệu này chỉ là chữ hiển thị, không lấy từ database — sửa cho khớp thực tế
        trước khi chạy quảng cáo.
      </p>
    </AdminCard>
  );
}
