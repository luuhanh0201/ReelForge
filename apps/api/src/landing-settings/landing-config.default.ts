import type { LandingConfig } from './landing-config.schema.js';

/**
 * Cấu hình gốc của Landing Page — trích từ `apps/web/config/content.config.ts`.
 *
 * Dùng cho hai việc: nút "Khôi phục mặc định", và làm nền khi database chưa có bản
 * xuất bản nào. Sửa nội dung mặc định của landing thì cập nhật cả hai nơi.
 */
export const DEFAULT_LANDING_CONFIG: LandingConfig = {
  voice: {
    hero: {
      voiceId: '',
      sampleText:
        'Chào bạn, chỉ cần dán link sản phẩm là ReelForge dựng xong video bán hàng.',
    },
    studio: {
      voiceId: '',
      sampleText: 'Máy lọc không khí này đang giảm năm mươi phần trăm, số lượng có hạn.',
    },
    testimonial: {
      voiceId: '',
      sampleText: 'Mình tăng gấp ba đơn hàng affiliate chỉ sau hai tuần dùng ReelForge.',
      speed: 1.05,
    },
  },
  theme: {
    brandHex: '#ff6b35',
    neonGlow: true,
    spotlightCursor: true,
    particleGrid: false,
  },
  content: {
    heroBadge: {
      vi: 'AI Reel & Video Generator 2026',
      en: 'AI Reel & Video Generator 2026',
    },
    heroTitlePrefix: {
      vi: 'Biến link sản phẩm thành video affiliate',
      en: 'Turn product links into affiliate videos',
    },
    heroSubtitle: {
      vi: 'Dán link Shopee hoặc TikTok Shop, AI tự viết kịch bản, lồng giọng và dựng video dọc 1080p trong vài phút.',
      en: 'Paste a Shopee or TikTok Shop link and AI writes the script, adds a voice-over and renders a 1080p vertical video in minutes.',
    },
    primaryCta: { vi: 'Tạo video ngay — miễn phí', en: 'Create a video — free' },
    secondaryCta: { vi: 'Dán link sản phẩm', en: 'Paste a product link' },
    keywords: [
      { vi: 'Shopee Top 1', en: 'Shopee Top 1' },
      { vi: 'TikTok Shop Viral', en: 'TikTok Shop Viral' },
      { vi: 'Lazada Flash Deal', en: 'Lazada Flash Deal' },
      { vi: 'Reels Affiliate', en: 'Reels Affiliate' },
    ],
  },
  showcase: {
    sampleLinks: [
      'https://shopee.vn/product/máy-lọc-không-khí-gen4-pro',
      'https://www.tiktok.com/shop/product/tai-nghe-bluetooth-air-5',
      'https://shopee.vn/product/nồi-chiên-không-dầu-6l',
    ],
    featuredVideoCount: 6,
    creatorCount: '10.000+',
    videoCount: '1.250.000+',
  },
};
