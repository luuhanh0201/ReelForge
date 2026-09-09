import { Injectable } from '@nestjs/common';
import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';
import { BusinessException } from '../common/exceptions/business.exception.js';

/**
 * `promisify` chỉ suy ra được overload 3 tham số của `scrypt`, trong khi ta cần truyền
 * cả tham số chi phí — nên khai báo kiểu tường minh ở đây.
 */
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Tham số scrypt. `N=2^15` mất khoảng 100ms mỗi lần băm trên máy chủ thường — đủ chậm để
 * dò mật khẩu hàng loạt trở nên vô nghĩa, đủ nhanh để người dùng không thấy trễ.
 */
const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * scrypt cần `128 * N * r` byte bộ nhớ; với tham số trên là đúng 32MB — chạm sát trần
 * mặc định của Node và ném `memory limit exceeded`. Phải khai báo `maxmem` tường minh,
 * nếu không mọi lần băm đều hỏng ngay từ tài khoản đầu tiên.
 */
const MAX_MEMORY = 128 * COST * BLOCK_SIZE * 2;

/** Độ dài tối thiểu. Dài quan trọng hơn phức tạp — không ép ký tự đặc biệt. */
export const MIN_PASSWORD_LENGTH = 8;

/** Chặn mật khẩu quá dài: scrypt phải băm cả chuỗi, gửi vài MB là một kiểu tấn công DoS. */
const MAX_PASSWORD_LENGTH = 200;

/**
 * Băm và kiểm tra mật khẩu bằng **scrypt có sẵn trong Node**.
 *
 * Không thêm argon2 hay bcrypt vì cả hai là native addon phải biên dịch lúc cài, còn
 * scrypt là hàm dẫn xuất khoá chống phần cứng chuyên dụng, nằm sẵn trong `node:crypto`.
 */
@Injectable()
export class PasswordService {
  /** Kiểm tra trước khi băm để báo lỗi rõ ràng thay vì im lặng chấp nhận mật khẩu yếu. */
  assertStrongEnough(password: string): void {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`,
      });
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: `Mật khẩu không được dài quá ${MAX_PASSWORD_LENGTH} ký tự`,
      });
    }
  }

  /** Kết quả tự mô tả tham số của chính nó, để đổi COST sau này không làm hỏng hash cũ. */
  async hash(password: string): Promise<string> {
    this.assertStrongEnough(password);

    const salt = randomBytes(SALT_LENGTH);
    const derived = await scryptAsync(password, salt, KEY_LENGTH, {
      N: COST,
      r: BLOCK_SIZE,
      p: PARALLELIZATION,
      maxmem: MAX_MEMORY,
    });

    return [
      'scrypt',
      COST,
      BLOCK_SIZE,
      PARALLELIZATION,
      salt.toString('base64'),
      derived.toString('base64'),
    ].join('$');
  }

  /**
   * So khớp mật khẩu. Trả về `false` thay vì ném lỗi cho mọi trường hợp hỏng — nơi gọi
   * chỉ cần biết đúng hay sai, và mọi nhánh sai phải trả về cùng một thông báo.
   */
  async verify(password: string, stored: string | null): Promise<boolean> {
    if (!stored || typeof password !== 'string') return false;

    const [scheme, cost, blockSize, parallelization, salt, hash] =
      stored.split('$');

    if (scheme !== 'scrypt' || !salt || !hash) return false;

    try {
      const expected = Buffer.from(hash, 'base64');
      const derived = await scryptAsync(
        password,
        Buffer.from(salt, 'base64'),
        expected.length,
        {
          N: Number(cost),
          r: Number(blockSize),
          p: Number(parallelization),
          // Tính theo tham số đọc từ chuỗi đã lưu, để hash cũ vẫn kiểm tra được sau khi
          // đổi COST mặc định.
          maxmem: 128 * Number(cost) * Number(blockSize) * 2,
        },
      );

      return derived.length === expected.length && timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }
}
