import { z } from "zod";
import { ASPECT_RATIOS, type AspectRatio } from "./render-config.js";

/**
 * Những gì người dùng tự chỉnh trên khung xem trước, **tách riêng cho từng khổ video**.
 *
 * Lý do tách theo khổ: cùng một bố cục không thể đúng cho cả ba khổ. Phụ đề đặt ở 78%
 * chiều cao thì hợp khung dọc, nhưng ở khung ngang là nằm ngay trên thanh nút của nền
 * tảng. Cỡ chữ tính theo chiều cao khung nên 0.045 ở 1080x1920 cho chữ 86px trên nền rộng
 * 1080, còn ở 1920x1080 chỉ còn 48px trên nền rộng 1920 — nhìn bé hẳn đi. Ảnh cũng vậy:
 * cắt cho khung dọc là lấy phần giữa theo chiều ngang, cắt cho khung ngang thì ngược lại.
 *
 * Vì thế người dùng chỉnh ở khổ nào thì giá trị lưu riêng cho khổ đó; đổi khổ là quay về
 * mặc định của khổ mới chứ không kéo theo con số của khổ cũ.
 */

/**
 * Khung ảnh người dùng tự đặt cho một cảnh.
 *
 * Cùng hệ toạ độ với `kenBurns` trong `RenderConfig`: `x`/`y` là **tâm ảnh nằm ở đâu trong
 * khung hình** theo tỉ lệ, `zoom` là mức phóng so với cỡ vừa khung. Mặc định `0.5, 0.5, 1`
 * — đúng hành vi cũ, nên cảnh chưa ai đụng vào vẫn ra y hệt trước đây.
 */
export const CropSchema = z.object({
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5),
  /** Trần 3x: quá mức này ảnh vỡ ở mọi độ phân giải, phóng thêm chỉ làm hỏng video. */
  zoom: z.number().min(1).max(3).default(1),
});

export type Crop = z.infer<typeof CropSchema>;

export const DEFAULT_CROP: Crop = { x: 0.5, y: 0.5, zoom: 1 };

/** Khung ảnh của một cảnh, lưu riêng cho từng khổ. */
export const SceneCropsSchema = z.partialRecord(z.enum(ASPECT_RATIOS), CropSchema);

export type SceneCrops = Partial<Record<AspectRatio, Crop>>;

/**
 * Bố cục phụ đề người dùng tự kéo ở một khổ.
 *
 * `null` nghĩa là **chưa đụng tới** và dùng mặc định của khổ — khác hẳn với một con số
 * trùng mặc định, vì mặc định có thể được chỉnh lại sau này và người chưa kéo thì nên đi
 * theo giá trị mới.
 */
export const FrameLayoutSchema = z.object({
  subtitleY: z.number().min(0.05).max(0.98).nullable().default(null),
  fontScale: z.number().min(0.02).max(0.14).nullable().default(null),
});

export type FrameLayout = z.infer<typeof FrameLayoutSchema>;

export const FrameLayoutsSchema = z.partialRecord(
  z.enum(ASPECT_RATIOS),
  FrameLayoutSchema,
);

export type FrameLayouts = Partial<Record<AspectRatio, FrameLayout>>;

/**
 * Lề trên của vùng an toàn, theo tỉ lệ chiều cao.
 *
 * Vùng dưới đã có `safeBottom` riêng cho từng khổ vì thanh nút của nền tảng cao khác nhau;
 * lề trên thì chỉ là khoảng thở cho tên tài khoản và nút quay lại, giống nhau ở mọi khổ.
 */
export const SAFE_TOP = 0.04;
