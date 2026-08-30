import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type { CredentialsConfig } from '../../config/configuration.js';

export const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
export const IV_BYTES = 12;
export const AUTH_TAG_BYTES = 16;

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  algorithm: string;
  keyVersion: number;
}

/**
 * Mã hoá đối xứng cho dữ liệu nhạy cảm lưu trong PostgreSQL.
 *
 * Khoá lấy từ environment theo từng version, nhờ đó xoay khoá được: bản ghi cũ vẫn
 * giải mã bằng khoá cũ trong khi bản ghi mới đã dùng khoá mới.
 */
@Injectable()
export class AesGcmEncryptionService {
  private readonly logger = new Logger(AesGcmEncryptionService.name);
  private readonly keys = new Map<number, Buffer>();
  private readonly activeVersion: number;

  constructor(config: ConfigService) {
    const credentials = config.getOrThrow<CredentialsConfig>('credentials');

    for (const [version, encoded] of Object.entries(credentials.keys)) {
      const key = Buffer.from(encoded, 'base64');

      if (key.length !== KEY_BYTES) {
        throw new Error(
          `CREDENTIAL_ENCRYPTION_KEYS: khoá version ${version} phải dài đúng ${KEY_BYTES} byte sau khi decode base64`,
        );
      }

      this.keys.set(Number(version), key);
    }

    if (this.keys.size === 0) {
      throw new Error(
        'Thiếu CREDENTIAL_ENCRYPTION_KEYS. Sinh khoá bằng: openssl rand -base64 32',
      );
    }

    if (!this.keys.has(credentials.activeVersion)) {
      throw new Error(
        `CREDENTIAL_ENCRYPTION_KEY_VERSION=${credentials.activeVersion} không có trong CREDENTIAL_ENCRYPTION_KEYS`,
      );
    }

    this.activeVersion = credentials.activeVersion;
    this.logger.log(
      `Đã nạp ${this.keys.size} khoá mã hoá, version đang dùng: ${this.activeVersion}`,
    );
  }

  getActiveVersion(): number {
    return this.activeVersion;
  }

  hasKey(version: number): boolean {
    return this.keys.has(version);
  }

  private requireKey(version: number): Buffer {
    const key = this.keys.get(version);
    if (!key) {
      throw new Error(
        `Không có khoá mã hoá version ${version}. Thêm lại khoá này vào CREDENTIAL_ENCRYPTION_KEYS trước khi truy cập bản ghi.`,
      );
    }
    return key;
  }

  /** IV luôn được sinh mới cho mỗi lần mã hoá — dùng lại IV với GCM là mất an toàn. */
  encrypt(plaintext: string, aad: string): EncryptedPayload {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(
      ENCRYPTION_ALGORITHM,
      this.requireKey(this.activeVersion),
      iv,
      { authTagLength: AUTH_TAG_BYTES },
    );
    cipher.setAAD(Buffer.from(aad, 'utf8'));

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return {
      ciphertext,
      iv,
      authTag: cipher.getAuthTag(),
      algorithm: ENCRYPTION_ALGORITHM,
      keyVersion: this.activeVersion,
    };
  }

  decrypt(payload: EncryptedPayload, aad: string): string {
    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      this.requireKey(payload.keyVersion),
      payload.iv,
      { authTagLength: AUTH_TAG_BYTES },
    );
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(payload.authTag);

    return Buffer.concat([
      decipher.update(payload.ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }

  /**
   * Dấu vân tay để so sánh hai credential mà không lưu bản rõ.
   * Dùng HMAC thay vì hash trần: người có database nhưng không có khoá thì không thể
   * đối chiếu offline với một service account đã biết.
   */
  fingerprint(value: string): string {
    return createHmac('sha256', this.requireKey(this.activeVersion))
      .update(value)
      .digest('hex');
  }

  /** So sánh fingerprint theo thời gian hằng định để không rò rỉ qua kênh thời gian. */
  fingerprintEquals(left: string, right: string): boolean {
    const a = Buffer.from(left, 'utf8');
    const b = Buffer.from(right, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
