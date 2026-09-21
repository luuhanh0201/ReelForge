import { Injectable, Logger } from '@nestjs/common';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { GEMINI_PROVIDER } from './gemini.credential.js';
import { ProviderCredentialsService } from './provider-credentials.service.js';

/** Cache ngắn để không phải giải mã lại mỗi lần gọi Gemini. */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Nơi **duy nhất** lấy API key Gemini lúc chạy.
 *
 * Cùng khuôn với `GoogleTtsCredentialProvider`: ưu tiên bản ghi trong database, chưa có thì
 * lùi về biến môi trường `GEMINI_API_KEY` cho môi trường dev. Khoá chỉ tồn tại trong bộ nhớ
 * tiến trình, không ghi ra đĩa và không vào log.
 *
 * Trả `null` thay vì ném lỗi khi chưa cấu hình: bên gọi (bộ sinh kịch bản) phải **lùi về
 * mẫu có sẵn**, chứ không được làm hỏng cả luồng dựng video chỉ vì admin chưa dán khoá.
 */
@Injectable()
export class GeminiCredentialProvider {
  private readonly logger = new Logger(GeminiCredentialProvider.name);
  private cache: { key: string; expiresAt: number } | null = null;

  constructor(private readonly credentials: ProviderCredentialsService) {}

  /** Gọi sau mọi thao tác ghi để lần dùng kế tiếp đọc lại từ database. */
  invalidate(): void {
    this.cache = null;
  }

  async getApiKey(): Promise<string | null> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.key;
    }

    try {
      const { record, payload } = await this.credentials.loadPayload(GEMINI_PROVIDER);

      if (record.status !== 'connected') {
        this.logger.warn(
          `Credential Gemini đang ở trạng thái "${record.status}" nên không được dùng`,
        );
        return this.fromEnv();
      }

      const key = String(payload);
      this.cache = { key, expiresAt: Date.now() + CACHE_TTL_MS };

      return key;
    } catch (error) {
      if (error instanceof BusinessException && error.code === 'CREDENTIAL_NOT_CONFIGURED') {
        return this.fromEnv();
      }
      throw error;
    }
  }

  private fromEnv(): string | null {
    const key = process.env.GEMINI_API_KEY?.trim();

    if (key) {
      this.logger.warn('Đang dùng GEMINI_API_KEY làm fallback vì database chưa có credential');
      return key;
    }

    return null;
  }
}
