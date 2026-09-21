import { MAX_DURATION_SEC, MIN_DURATION_SEC, SECONDS_PER_LINE } from '../projects/script-templates.js';

/**
 * Cấu hình luồng dựng tự động.
 *
 * Những lựa chọn "máy quyết hộ người dùng" gom hết vào đây: đổi ý về mẫu mặc định hay cách
 * tính độ dài thì chỉ sửa một chỗ, không phải đi dò trong logic.
 */
export const AUTOBUILD_CONFIG = {
  /**
   * Mẫu dùng khi người dùng không chọn. "Review thật" hợp với nhiều ngành hàng nhất, và
   * giọng kể trải nghiệm ít gây phản cảm hơn giọng cảnh báo hay giật tít.
   */
  defaultTemplateCode: 'review_that',
} as const;

/**
 * Độ dài video suy từ số ảnh có được: mỗi ảnh một cảnh, mỗi cảnh khoảng 10 giây.
 *
 * Ít ảnh mà làm video dài thì một ảnh phải gánh nhiều cảnh, xem rất lặp; nên số ảnh là
 * thước đo hợp lý nhất khi máy phải tự quyết.
 */
export const durationForAssets = (assetCount: number): number => {
  const wanted = Math.max(assetCount, 1) * SECONDS_PER_LINE;

  return Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, wanted));
};
