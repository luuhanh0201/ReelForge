import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { AesGcmEncryptionService } from './aes-gcm-encryption.service.js';

const key = (seed: number) => Buffer.alloc(32, seed).toString('base64');

const build = (keys: Record<number, string>, activeVersion: number) =>
  new AesGcmEncryptionService({
    getOrThrow: () => ({ keys, activeVersion }),
  } as unknown as ConfigService);

describe('AesGcmEncryptionService', () => {
  const service = build({ 1: key(1) }, 1);
  const AAD = 'google-tts|record-1|1';

  it('mã hoá rồi giải mã ra đúng bản gốc', () => {
    const secret = JSON.stringify({ private_key: 'super-secret' });
    const payload = service.encrypt(secret, AAD);

    expect(payload.iv).toHaveLength(12);
    expect(payload.authTag).toHaveLength(16);
    expect(payload.ciphertext.toString('utf8')).not.toContain('super-secret');
    expect(service.decrypt(payload, AAD)).toBe(secret);
  });

  it('mỗi lần mã hoá dùng IV khác nhau', () => {
    const first = service.encrypt('same input', AAD);
    const second = service.encrypt('same input', AAD);

    expect(first.iv.equals(second.iv)).toBe(false);
    expect(first.ciphertext.equals(second.ciphertext)).toBe(false);
  });

  it('sai AAD thì giải mã thất bại', () => {
    const payload = service.encrypt('secret', AAD);
    expect(() => service.decrypt(payload, 'google-tts|record-2|1')).toThrow();
  });

  it('sai auth tag thì giải mã thất bại', () => {
    const payload = service.encrypt('secret', AAD);
    expect(() =>
      service.decrypt({ ...payload, authTag: randomBytes(16) }, AAD),
    ).toThrow();
  });

  it('ciphertext bị sửa thì giải mã thất bại', () => {
    const payload = service.encrypt('secret', AAD);
    const tampered = Buffer.from(payload.ciphertext);
    tampered[0] ^= 0xff;

    expect(() => service.decrypt({ ...payload, ciphertext: tampered }, AAD)).toThrow();
  });

  it('sai khoá thì giải mã thất bại', () => {
    const payload = service.encrypt('secret', AAD);
    const other = build({ 1: key(2) }, 1);

    expect(() => other.decrypt(payload, AAD)).toThrow();
  });

  it('giữ được nhiều version khoá để xoay', () => {
    const rotated = build({ 1: key(1), 2: key(9) }, 2);
    const legacy = service.encrypt('secret', AAD);

    // Bản ghi cũ (version 1) vẫn giải mã được sau khi version active đổi sang 2.
    expect(rotated.decrypt(legacy, AAD)).toBe('secret');
    expect(rotated.getActiveVersion()).toBe(2);
    expect(rotated.encrypt('secret', 'google-tts|record-1|2').keyVersion).toBe(2);
  });

  it('thiếu khoá của version cần dùng thì báo lỗi rõ ràng', () => {
    const payload = service.encrypt('secret', AAD);
    const other = build({ 2: key(9) }, 2);

    expect(() => other.decrypt({ ...payload, keyVersion: 1 }, AAD)).toThrow(
      /Không có khoá mã hoá version 1/,
    );
  });

  it('từ chối khoá không đủ 32 byte', () => {
    expect(() => build({ 1: Buffer.alloc(16, 1).toString('base64') }, 1)).toThrow(
      /32 byte/,
    );
  });

  it('từ chối khi version active không có khoá', () => {
    expect(() => build({ 1: key(1) }, 3)).toThrow(/không có trong/);
  });

  it('fingerprint ổn định và khác nhau giữa các credential', () => {
    const a = service.fingerprint('bot@project.iam.gserviceaccount.com:abc123');
    const b = service.fingerprint('bot@project.iam.gserviceaccount.com:abc123');
    const c = service.fingerprint('other@project.iam.gserviceaccount.com:abc123');

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
    expect(service.fingerprintEquals(a, b)).toBe(true);
    expect(service.fingerprintEquals(a, c)).toBe(false);
  });
});
