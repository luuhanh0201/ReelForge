import { BusinessException } from '../common/exceptions/business.exception.js';

/** Mọi chuỗi hiển thị trên landing đều song ngữ — xem rule số 4 của design system. */
export interface Localized {
  vi: string;
  en: string;
}

export interface VoiceSlotConfig {
  /** UUID của giọng trong bảng `voices`; rỗng = dùng giọng mặc định. */
  voiceId: string;
  sampleText: string;
}

export interface LandingVoiceConfig {
  hero: VoiceSlotConfig;
  studio: VoiceSlotConfig;
  /** Khu vực đánh giá có thêm tốc độ đọc riêng. */
  testimonial: VoiceSlotConfig & { speed: number };
}

export interface LandingThemeConfig {
  brandHex: string;
  neonGlow: boolean;
  spotlightCursor: boolean;
  particleGrid: boolean;
}

export interface LandingContentConfig {
  heroBadge: Localized;
  heroTitlePrefix: Localized;
  heroSubtitle: Localized;
  primaryCta: Localized;
  secondaryCta: Localized;
  /** Từ khoá chạy chữ trong tiêu đề H1. */
  keywords: Localized[];
}

export interface LandingShowcaseConfig {
  sampleLinks: string[];
  featuredVideoCount: 3 | 6 | 9;
  creatorCount: string;
  videoCount: string;
}

export interface LandingConfig {
  voice: LandingVoiceConfig;
  theme: LandingThemeConfig;
  content: LandingContentConfig;
  showcase: LandingShowcaseConfig;
}

const invalid = (message: string): BusinessException =>
  new BusinessException('VALIDATION_FAILED', { message });

const HEX = /^#[0-9a-fA-F]{6}$/;

const asRecord = (input: unknown, field: string): Record<string, unknown> => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw invalid(`Trường "${field}" phải là một object`);
  }
  return input as Record<string, unknown>;
};

const text = (value: unknown, field: string, max: number, fallback = ''): string => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') throw invalid(`Trường "${field}" phải là chuỗi`);
  if (value.length > max) throw invalid(`Trường "${field}" vượt quá ${max} ký tự`);
  return value.trim();
};

/** Chưa bật Cloud Translation thì bản tiếng Anh tạm dùng chính chuỗi tiếng Việt. */
const localized = (value: unknown, field: string, max = 300): Localized => {
  const source = asRecord(value ?? {}, field);
  const vi = text(source.vi, `${field}.vi`, max);

  return { vi, en: text(source.en, `${field}.en`, max) || vi };
};

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const voiceSlot = (value: unknown, field: string): VoiceSlotConfig => {
  const source = asRecord(value ?? {}, field);

  return {
    voiceId: text(source.voiceId, `${field}.voiceId`, 40),
    sampleText: text(source.sampleText, `${field}.sampleText`, 300),
  };
};

/**
 * Kiểm tra và chuẩn hoá cấu hình gửi lên.
 * Thiếu trường thì lấy mặc định thay vì báo lỗi — admin có thể lưu từng phần.
 */
export const parseLandingConfig = (
  input: unknown,
  fallback: LandingConfig,
): LandingConfig => {
  const source = asRecord(input ?? {}, 'config');
  const voice = asRecord(source.voice ?? {}, 'voice');
  const theme = asRecord(source.theme ?? {}, 'theme');
  const content = asRecord(source.content ?? {}, 'content');
  const showcase = asRecord(source.showcase ?? {}, 'showcase');

  const brandHex = text(theme.brandHex, 'theme.brandHex', 7) || fallback.theme.brandHex;
  if (!HEX.test(brandHex)) {
    throw invalid('Mã màu phải có dạng #RRGGBB');
  }

  const speedRaw = (voice.testimonial as Record<string, unknown> | undefined)?.speed;
  const speed = speedRaw === undefined ? fallback.voice.testimonial.speed : Number(speedRaw);
  if (!Number.isFinite(speed) || speed < 0.8 || speed > 1.4) {
    throw invalid('Tốc độ đọc phần đánh giá phải nằm trong khoảng 0.8 – 1.4');
  }

  const count = Number(showcase.featuredVideoCount ?? fallback.showcase.featuredVideoCount);
  if (![3, 6, 9].includes(count)) {
    throw invalid('Số video nổi bật chỉ nhận 3, 6 hoặc 9');
  }

  const links = Array.isArray(showcase.sampleLinks)
    ? showcase.sampleLinks.map((link, index) => text(link, `sampleLinks[${index}]`, 500))
    : fallback.showcase.sampleLinks;

  const keywords = Array.isArray(content.keywords)
    ? content.keywords.map((keyword, index) => localized(keyword, `keywords[${index}]`, 60))
    : fallback.content.keywords;

  if (keywords.length === 0) {
    throw invalid('Cần ít nhất một từ khoá chạy chữ');
  }

  return {
    voice: {
      hero: voiceSlot(voice.hero, 'voice.hero'),
      studio: voiceSlot(voice.studio, 'voice.studio'),
      testimonial: { ...voiceSlot(voice.testimonial, 'voice.testimonial'), speed },
    },
    theme: {
      brandHex,
      neonGlow: bool(theme.neonGlow, fallback.theme.neonGlow),
      spotlightCursor: bool(theme.spotlightCursor, fallback.theme.spotlightCursor),
      particleGrid: bool(theme.particleGrid, fallback.theme.particleGrid),
    },
    content: {
      heroBadge: localized(content.heroBadge ?? fallback.content.heroBadge, 'heroBadge', 80),
      heroTitlePrefix: localized(
        content.heroTitlePrefix ?? fallback.content.heroTitlePrefix,
        'heroTitlePrefix',
        120,
      ),
      heroSubtitle: localized(
        content.heroSubtitle ?? fallback.content.heroSubtitle,
        'heroSubtitle',
        400,
      ),
      primaryCta: localized(content.primaryCta ?? fallback.content.primaryCta, 'primaryCta', 60),
      secondaryCta: localized(
        content.secondaryCta ?? fallback.content.secondaryCta,
        'secondaryCta',
        60,
      ),
      keywords,
    },
    showcase: {
      sampleLinks: links.slice(0, 3),
      featuredVideoCount: count as 3 | 6 | 9,
      creatorCount: text(showcase.creatorCount, 'creatorCount', 20) || fallback.showcase.creatorCount,
      videoCount: text(showcase.videoCount, 'videoCount', 20) || fallback.showcase.videoCount,
    },
  };
};
