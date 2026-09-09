import { L, type Localized } from "@/lib/i18n";

export const SITE = {
  brand: "ReelForge",
  /** Chữ cái hiển thị trong ô logo vuông. */
  logoLetter: "R",
  tagline: L(
    "Nền tảng tự động tạo video affiliate bằng AI",
    "AI-powered affiliate video automation platform",
  ),
  studioUrl: "/studio",
  contactEmail: "hello@reelforge.vn",
  copyrightYear: 2026,
} as const;

/** Cấu hình xác thực. Chưa có backend nên đây là luồng mô phỏng phía client. */
export const AUTH_CONFIG = {
  /**
   * Credits tặng cho tài khoản mới, hiện trên huy hiệu nút Google và trong AuthModal.
   *
   * Đây chỉ là con số **hiển thị**; nơi thật sự cấp credits là `GOOGLE_SIGNUP_CREDITS`
   * trong `apps/api/src/auth/auth.service.ts`. Hai chỗ phải luôn khớp nhau, và cùng khớp
   * với dòng "10 Credits tặng kèm khi đăng ký" của gói Free trong bảng giá.
   */
  googleBonusCredits: 10,
} as const;

export const STORAGE_KEYS = {
  theme: "reelforge.theme",
  locale: "reelforge.locale",
} as const;

export interface NavLink {
  href: string;
  label: Localized;
}

export const NAV_LINKS: NavLink[] = [
  { href: "#tinh-nang", label: L("Tính năng", "Features") },
  { href: "#demo", label: L("Trải nghiệm", "Live demo") },
  { href: "#giong-doc", label: L("Giọng đọc AI", "AI voices") },
  { href: "#bang-gia", label: L("Bảng giá", "Pricing") },
  { href: "#faq", label: L("Hỏi đáp", "FAQ") },
];

/** Cấu hình hiệu ứng con trỏ Gemini (spring physics + star trail). */
export const CURSOR_CONFIG = {
  spring: { damping: 28, stiffness: 220, mass: 0.6 },
  auraSize: 56,
  auraBlur: 6,
  coreSize: 26,
  coreBlur: 4,
  starLifetimeMs: 500,
  starSpawnDistance: 34,
  burstCount: 6,
  burstRadius: 46,
  maxStars: 18,
} as const;

/** Preset chuyển động dùng lại cho scroll reveal toàn trang. */
export const REVEAL = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
} as const;
