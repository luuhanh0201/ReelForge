import type { ShopPlatform } from '@repo/shared';

/**
 * Cấu hình đọc link sản phẩm.
 *
 * Các con số và chuỗi đoán mò theo từng sàn đều nằm ở đây: sàn đổi giao diện là việc thường
 * xuyên, và khi đó chỉ nên phải sửa đúng một file.
 */
export const CRAWLER_CONFIG = {
  page: {
    timeoutMs: 10_000,
    /** Trang TikTok nặng khoảng 250KB; trần này dư sức mà vẫn chặn được trang vô tận. */
    maxBytes: 3 * 1024 * 1024,
    maxRedirects: 5,
  },
  image: {
    timeoutMs: 8_000,
    /** Ảnh sản phẩm hiếm khi nhiều hơn chừng này mà vẫn dùng làm cảnh được. */
    maxCount: 6,
  },
  /** Kết quả đọc được giữ lại để người dùng bấm "Đọc lại" không gọi sàn liên tục. */
  cacheTtlSec: 60 * 60,
  rateLimit: {
    windowSec: 60,
    maxPerWindow: 10,
  },
} as const;

/**
 * Tên miền CDN ảnh của các sàn. Ảnh chỉ được tải từ đây — trang sàn có thể nhúng link ảnh
 * trỏ đi bất cứ đâu, và server không được phép đi theo.
 */
export const IMAGE_DOMAINS: readonly string[] = [
  'susercontent.com',
  'ibyteimg.com',
  'tiktokcdn.com',
  'lazcdn.com',
  'slatic.net',
  'alicdn.com',
];

const CHROME_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

export interface PlatformRule {
  /**
   * User-agent gửi đi. Chọn theo kết quả thử thật (2026-09-16): Shopee chỉ trả meta sản
   * phẩm cho bot xem trước link, TikTok thì ngược lại chỉ trả dữ liệu cho trình duyệt.
   */
  userAgent: string;
  /** Hậu tố sàn tự gắn vào tiêu đề trang. */
  titleSuffix: RegExp;
  /**
   * Tiêu đề trang khi sàn **không** trả dữ liệu sản phẩm (trang chủ, trang chặn bot, khung
   * SPA chưa điền). Gặp những tiêu đề này thì coi như không đọc được tên.
   */
  junkTitles: readonly RegExp[];
  /** Mô tả khuôn mẫu sàn tự sinh — không có thông tin gì về sản phẩm. */
  boilerplateDescription: RegExp | null;
}

export const PLATFORM_RULES: Record<ShopPlatform, PlatformRule> = {
  shopee: {
    userAgent: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    titleSuffix: /\s*\|\s*Shopee Việt Nam\s*$/i,
    junkTitles: [/^Shopee Việt Nam\b/i, /^Shopee$/i],
    boilerplateDescription: /giá tốt\.\s*Mua hàng qua mạng/i,
  },
  tiktok_shop: {
    userAgent: CHROME_UA,
    titleSuffix: /\s*\|\s*TikTok Shop.*$/i,
    junkTitles: [/^TikTok Shop( Vietnam)?$/i, /^TikTok\b/i],
    boilerplateDescription: /trên TikTok Shop\.\s*Săn giá/i,
  },
  lazada: {
    userAgent: CHROME_UA,
    titleSuffix: /\s*\|\s*Lazada(\.vn| Việt Nam)?\s*$/i,
    junkTitles: [/^Lazada\b/i],
    boilerplateDescription: null,
  },
};

/** Chỗ giữ chỗ chưa được điền, ví dụ `{product_name}` — dấu hiệu trang trả về khung rỗng. */
export const UNFILLED_PLACEHOLDER = /\{[a-z_]+\}/i;
