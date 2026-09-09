import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:public';

/**
 * Mở endpoint cho người chưa đăng nhập.
 *
 * Guard được đăng ký toàn cục nên **mặc định mọi route đều đóng** — quên đánh dấu thì
 * endpoint bị khoá, chứ không phải lộ ra ngoài. Đó là chiều sai an toàn hơn.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
