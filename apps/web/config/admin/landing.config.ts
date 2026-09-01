import type { LandingConfig } from "@/lib/admin/landing-cms-api";

/** Khóa lưu bản nháp chưa xuất bản, theo đúng đặc tả. */
export const LANDING_DRAFT_KEY = "reelforge_landing_cms_config";

/**
 * Sáu preset màu chủ đạo.
 *
 * Cố ý **chỉ là màu phẳng, không gradient** — rule số 1 của design system. Chiều sâu
 * trên landing tạo bằng khối màu + blur như hero đang làm.
 */
export const BRAND_PRESETS: { id: string; label: string; hex: string }[] = [
  { id: "reelforge", label: "Cam ReelForge", hex: "#ff6b35" },
  { id: "cyberpunk", label: "Tím Cyberpunk", hex: "#8b5cf6" },
  { id: "emerald", label: "Xanh ngọc lục bảo", hex: "#10b981" },
  { id: "viral", label: "Hồng viral Shorts", hex: "#ec4899" },
  { id: "electric", label: "Xanh điện tử", hex: "#0284c7" },
  { id: "gold", label: "Vàng hoàng gia", hex: "#f59e0b" },
];

/** Ba vị trí phát giọng trên landing, đúng ba điểm chạm âm thanh của khách. */
export const VOICE_SLOTS: {
  id: keyof LandingConfig["voice"];
  title: string;
  where: string;
  hint: string;
}[] = [
  {
    id: "hero",
    title: "Trang A — Giọng Hero",
    where: "Nút nghe thử ở đầu trang chủ",
    hint: "Câu chào mở đầu, nên ngắn và rõ ràng.",
  },
  {
    id: "studio",
    title: "Trang B — Giọng Mini Studio",
    where: "Trình tạo video 1 chạm giữa trang",
    hint: "Câu thoại khớp với phụ đề karaoke trên khung 9:16.",
  },
  {
    id: "testimonial",
    title: "Trang C — Giọng Đánh giá",
    where: "Khu vực câu chuyện KOC / Affiliate",
    hint: "Giọng chân thực, có thanh chỉnh tốc độ riêng.",
  },
];

export const FEATURED_VIDEO_OPTIONS = [3, 6, 9] as const;

/** Tốc độ đọc riêng cho phần đánh giá: 0.8 – 1.4, bước 0.05. */
export const TESTIMONIAL_SPEED = { min: 0.8, max: 1.4, step: 0.05 } as const;
