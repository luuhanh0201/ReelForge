import { request } from "./api-client";

export interface Localized {
  vi: string;
  en: string;
}

export interface VoiceSlotConfig {
  voiceId: string;
  sampleText: string;
}

export interface LandingConfig {
  voice: {
    hero: VoiceSlotConfig;
    studio: VoiceSlotConfig;
    testimonial: VoiceSlotConfig & { speed: number };
  };
  theme: {
    brandHex: string;
    neonGlow: boolean;
    spotlightCursor: boolean;
    particleGrid: boolean;
  };
  content: {
    heroBadge: Localized;
    heroTitlePrefix: Localized;
    heroSubtitle: Localized;
    primaryCta: Localized;
    secondaryCta: Localized;
    keywords: Localized[];
  };
  showcase: {
    sampleLinks: string[];
    featuredVideoCount: 3 | 6 | 9;
    creatorCount: string;
    videoCount: string;
  };
}

export interface LandingSettingView {
  config: LandingConfig;
  publishedAt: string | null;
  publishedBy: string | null;
  note: string | null;
  /** false = chưa xuất bản lần nào, landing đang chạy cấu hình gốc. */
  published: boolean;
}

export const fetchLandingSettings = () =>
  request<LandingSettingView>("/admin/landing-settings");

export const publishLandingSettings = (config: LandingConfig, note?: string) =>
  request<LandingSettingView>("/admin/landing-settings", {
    method: "PUT",
    body: JSON.stringify({ config, note }),
  });

export const resetLandingSettings = () =>
  request<LandingSettingView>("/admin/landing-settings/reset", { method: "POST" });
