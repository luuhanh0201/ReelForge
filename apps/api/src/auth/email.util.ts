import { BusinessException } from '../common/exceptions/business.exception.js';

/** Nhà cung cấp mặc định khi người dùng chỉ gõ phần trước dấu @. */
const DEFAULT_DOMAIN = 'gmail.com';

/** Đủ chặt để loại rác, đủ lỏng để không từ chối email hợp lệ hiếm gặp. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * Chuẩn hoá email người dùng nhập.
 *
 * Gõ `banmai` được hiểu là `banmai@gmail.com` — phần lớn khách hàng dùng Gmail nên đây là
 * phím tắt tự nhiên. Muốn nhà cung cấp khác thì gõ đầy đủ địa chỉ.
 *
 * **Không** đụng tới dấu chấm hay phần `+alias` dù Gmail coi chúng như nhau: người dùng gõ
 * gì thì lưu đúng thế, tránh chuyện đăng ký một địa chỉ rồi đăng nhập lại thấy "không tồn
 * tại" vì hệ thống âm thầm viết khác đi.
 */
export const normalizeEmail = (raw: string): string => {
  const trimmed = raw.trim().toLowerCase();

  if (trimmed === '') {
    throw new BusinessException('VALIDATION_FAILED', {
      message: 'Vui lòng nhập email',
    });
  }

  const email = trimmed.includes('@') ? trimmed : `${trimmed}@${DEFAULT_DOMAIN}`;

  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    throw new BusinessException('VALIDATION_FAILED', {
      message: 'Email không hợp lệ',
    });
  }

  return email;
};
