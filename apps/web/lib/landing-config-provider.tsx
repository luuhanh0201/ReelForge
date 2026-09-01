"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LandingConfig } from "@/lib/admin/landing-cms-api";
import type { Locale, Localized } from "@/lib/i18n";

const LandingConfigContext = createContext<LandingConfig | null>(null);

export function LandingConfigProvider({
  config,
  children,
}: {
  config: LandingConfig | null;
  children: ReactNode;
}) {
  return (
    <LandingConfigContext.Provider value={config}>{children}</LandingConfigContext.Provider>
  );
}

/** `null` nghĩa là chưa có cấu hình CMS — dùng nội dung tĩnh. */
export const useLandingConfig = (): LandingConfig | null =>
  useContext(LandingConfigContext);

/**
 * Chuỗi từ CMS đè lên chuỗi tĩnh; CMS chưa có hoặc để trống thì giữ nguyên bản tĩnh.
 * Nhờ vậy admin chỉ cần sửa những gì muốn đổi.
 */
export const overrideText = (
  cms: { vi: string; en: string } | undefined,
  fallback: Localized,
  locale: Locale,
): string => {
  const value = cms?.[locale]?.trim();
  return value && value !== "" ? value : fallback[locale];
};
