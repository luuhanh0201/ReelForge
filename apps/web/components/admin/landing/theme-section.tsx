"use client";

import { Check } from "lucide-react";
import { BRAND_PRESETS } from "@/config/admin/landing.config";
import type { LandingConfig } from "@/lib/admin/landing-cms-api";
import { AdminCard, AdminInput, ToggleSwitch } from "@/components/admin/primitives";

const FX: { id: keyof Omit<LandingConfig["theme"], "brandHex">; label: string; hint: string }[] =
  [
    {
      id: "neonGlow",
      label: "Vầng sáng cho nút CTA",
      hint: "Đổ bóng phát quang màu chủ đạo quanh nút chính.",
    },
    {
      id: "spotlightCursor",
      label: "Con trỏ spotlight",
      hint: "Vệt sáng đi theo con trỏ; tự tắt trên thiết bị cảm ứng và khi bật giảm chuyển động.",
    },
    {
      id: "particleGrid",
      label: "Lưới hạt nền Hero",
      hint: "Mạng lưới chấm mờ phía sau khu vực Hero.",
    },
  ];

/** Sáu preset là **màu phẳng**, không gradient — giữ rule số 1 của design system. */
export function ThemeSection({
  config,
  onChange,
}: {
  config: LandingConfig;
  onChange: (patch: (current: LandingConfig) => LandingConfig) => void;
}) {
  const setTheme = (patch: Partial<LandingConfig["theme"]>) =>
    onChange((current) => ({ ...current, theme: { ...current.theme, ...patch } }));

  const current = config.theme.brandHex.toLowerCase();

  return (
    <AdminCard>
      <h2 className="font-display text-base font-bold text-ink">Màu sắc & hiệu ứng</h2>
      <p className="mt-0.5 text-xs text-muted">
        Preset chỉ đổi màu chủ đạo. Chiều sâu vẫn dựng bằng khối màu phẳng và blur, không
        dùng gradient.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {BRAND_PRESETS.map((preset) => {
          const active = preset.hex.toLowerCase() === current;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setTheme({ brandHex: preset.hex })}
              className={`flex items-center gap-3 rounded-card border p-3 text-left transition-colors ${
                active ? "border-brand bg-brand/[0.06]" : "border-line bg-canvas hover:border-brand/40"
              }`}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn"
                style={{ backgroundColor: preset.hex }}
              >
                {active ? <Check size={16} className="text-[#10151e]" /> : null}
              </span>

              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  {preset.label}
                </span>
                <span className="block font-mono text-[11px] text-muted">{preset.hex}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Mã màu tùy chỉnh</span>
          <AdminInput
            ariaLabel="Mã màu tùy chỉnh"
            value={config.theme.brandHex}
            onChange={(value) => setTheme({ brandHex: value })}
            className="w-40"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Bảng chọn màu</span>
          <input
            type="color"
            aria-label="Bảng chọn màu"
            value={/^#[0-9a-fA-F]{6}$/.test(config.theme.brandHex) ? config.theme.brandHex : "#ff6b35"}
            onChange={(event) => setTheme({ brandHex: event.target.value })}
            className="h-9 w-16 cursor-pointer rounded-btn border border-line bg-subtle p-1"
          />
        </label>

        {!/^#[0-9a-fA-F]{6}$/.test(config.theme.brandHex) ? (
          <p role="alert" className="text-xs font-semibold text-danger">
            Mã màu phải có dạng #RRGGBB
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5">
        {FX.map((effect) => (
          <div key={effect.id} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{effect.label}</p>
              <p className="mt-0.5 text-xs text-muted">{effect.hint}</p>
            </div>

            <ToggleSwitch
              checked={config.theme[effect.id]}
              label={effect.label}
              onChange={(next) => setTheme({ [effect.id]: next })}
            />
          </div>
        ))}
      </div>
    </AdminCard>
  );
}
