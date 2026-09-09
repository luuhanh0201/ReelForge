import { describe, expect, it } from 'vitest';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { normalizeEmail } from './email.util.js';
import { PasswordService } from './password.service.js';

describe('normalizeEmail', () => {
  it('thêm @gmail.com khi người dùng chỉ gõ phần trước dấu @', () => {
    expect(normalizeEmail('banmai')).toBe('banmai@gmail.com');
  });

  it('giữ nguyên địa chỉ đã đầy đủ, kể cả nhà cung cấp khác', () => {
    expect(normalizeEmail('koc@reelforge.vn')).toBe('koc@reelforge.vn');
  });

  it('bỏ khoảng trắng thừa và hạ về chữ thường', () => {
    expect(normalizeEmail('  BanMai@Gmail.COM  ')).toBe('banmai@gmail.com');
  });

  /**
   * Gmail coi `a.b@` và `ab@` như nhau, nhưng ta cố ý **không** chuẩn hoá dấu chấm:
   * người dùng gõ gì lưu đúng thế, tránh chuyện đăng ký một địa chỉ rồi đăng nhập lại
   * thấy "không tồn tại" vì hệ thống âm thầm viết khác đi.
   */
  it('không đụng tới dấu chấm hay phần +alias', () => {
    expect(normalizeEmail('ban.mai+shopee')).toBe('ban.mai+shopee@gmail.com');
  });

  it('từ chối chuỗi rỗng và địa chỉ sai định dạng', () => {
    expect(() => normalizeEmail('   ')).toThrow(BusinessException);
    expect(() => normalizeEmail('ban mai@gmail.com')).toThrow(BusinessException);
    expect(() => normalizeEmail('banmai@gmail')).toThrow(BusinessException);
    expect(() => normalizeEmail('@gmail.com')).toThrow(BusinessException);
  });
});

describe('PasswordService', () => {
  const service = new PasswordService();

  it('băm rồi kiểm tra lại đúng mật khẩu', async () => {
    const hash = await service.hash('mat-khau-du-dai');

    expect(hash.startsWith('scrypt$')).toBe(true);
    // Bản rõ không được xuất hiện ở bất kỳ đâu trong chuỗi lưu xuống database.
    expect(hash).not.toContain('mat-khau-du-dai');
    await expect(service.verify('mat-khau-du-dai', hash)).resolves.toBe(true);
  });

  it('từ chối mật khẩu sai', async () => {
    const hash = await service.hash('mat-khau-du-dai');

    await expect(service.verify('mat-khau-du-dai ', hash)).resolves.toBe(false);
    await expect(service.verify('mat-khau-khac', hash)).resolves.toBe(false);
  });

  it('mỗi lần băm cùng một mật khẩu cho ra chuỗi khác nhau', async () => {
    const first = await service.hash('mat-khau-du-dai');
    const second = await service.hash('mat-khau-du-dai');

    expect(first).not.toBe(second);
    await expect(service.verify('mat-khau-du-dai', second)).resolves.toBe(true);
  });

  it('tài khoản chưa có mật khẩu (chỉ đăng nhập Google) luôn trả về false', async () => {
    await expect(service.verify('bat-ky-mat-khau-nao', null)).resolves.toBe(false);
  });

  it('chuỗi lưu hỏng thì trả về false chứ không ném lỗi', async () => {
    await expect(service.verify('mat-khau-du-dai', 'rac')).resolves.toBe(false);
    await expect(service.verify('mat-khau-du-dai', 'bcrypt$abc$def')).resolves.toBe(
      false,
    );
  });

  it('chặn mật khẩu ngắn và mật khẩu dài bất thường', () => {
    expect(() => service.assertStrongEnough('ngan')).toThrow(BusinessException);
    expect(() => service.assertStrongEnough('a'.repeat(201))).toThrow(
      BusinessException,
    );
    expect(() => service.assertStrongEnough('dumatkhau')).not.toThrow();
  });
});
