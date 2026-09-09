import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BusinessException } from '../common/exceptions/business.exception.js';
import type { StorageConfig } from '../config/configuration.js';

/** Đủ cho một phiên chỉnh sửa, đúng như tài liệu thiết kế. */
const PRESIGNED_TTL_SEC = 60 * 60;

/**
 * Bọc Cloudflare R2 (giao thức S3).
 *
 * Ảnh và audio **bắt buộc** đi qua đây thay vì để trình duyệt tải thẳng từ CDN của sàn:
 * ảnh cross-origin không có header CORS sẽ làm canvas "nhiễm bẩn" và không xuất được
 * video — lỗi chỉ lộ ra ở bước cuối cùng, sau khi người dùng đã dựng xong.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly config: StorageConfig;
  private client: S3Client | null = null;

  constructor(config: ConfigService) {
    this.config = config.getOrThrow<StorageConfig>('storage');
  }

  get enabled(): boolean {
    return Boolean(
      this.config.accountId &&
        this.config.accessKeyId &&
        this.config.secretAccessKey &&
        this.config.bucket,
    );
  }

  private getClient(): S3Client {
    if (!this.enabled) {
      throw new BusinessException('SERVICE_UNAVAILABLE', {
        message: 'Chưa cấu hình nơi lưu trữ',
        details: {
          reason:
            'Thiếu R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME trong apps/api/.env',
        },
      });
    }

    this.client ??= new S3Client({
      // R2 không có khái niệm vùng nhưng SDK S3 vẫn đòi một giá trị.
      region: 'auto',
      endpoint: `https://${this.config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.accessKeyId!,
        secretAccessKey: this.config.secretAccessKey!,
      },
    });

    return this.client;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Ảnh đã resize không bao giờ đổi nội dung dưới cùng một key.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  /**
   * URL có chữ ký, sống một giờ.
   *
   * Dùng cho mọi thứ máy khách cần tải về. Bucket không mở công khai nên link rò ra ngoài
   * cũng chỉ dùng được trong đúng khoảng đó.
   */
  async signedUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      { expiresIn: PRESIGNED_TTL_SEC },
    );
  }

  /** Đọc lại một file đã lưu — cần khi resize ảnh sang khổ mới mà không giữ bản gốc trong RAM. */
  async getBuffer(key: string): Promise<Buffer> {
    const response = await this.getClient().send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );

    if (!response.Body) {
      throw new BusinessException('NOT_FOUND', {
        message: 'Không đọc được file đã lưu',
      });
    }

    return Buffer.from(await response.Body.transformToByteArray());
  }

  /** Xoá không được làm hỏng nghiệp vụ đang chạy — file mồ côi có cron dọn sau. */
  async remove(key: string): Promise<void> {
    try {
      await this.getClient().send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
    } catch (error) {
      this.logger.warn(
        `Không xoá được ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
