import { Injectable, Logger } from '@nestjs/common';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { BusinessException } from '../common/exceptions/business.exception.js';
import type { GoogleServiceAccount } from './google-service-account.validator.js';
import { ProviderCredentialsService } from './provider-credentials.service.js';

/** SDK chỉ nhận hostname, cấu hình lại lưu URL đầy đủ cho người đọc dễ hiểu. */
const hostOf = (endpoint: string): string => {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint.replace(/^https?:\/\//, '').split('/')[0] ?? endpoint;
  }
};

/** Cache ngắn để không phải giải mã lại mỗi lần gọi TTS. */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  account: GoogleServiceAccount;
  expiresAt: number;
}

/**
 * Nơi **duy nhất** lấy credential Google TTS lúc chạy.
 *
 * Ưu tiên bản ghi trong database (nguồn chính); chưa có thì lùi về biến môi trường
 * GOOGLE_APPLICATION_CREDENTIALS để môi trường cũ không gãy. Bản rõ chỉ tồn tại trong
 * bộ nhớ tiến trình, không bao giờ ghi ra đĩa.
 */
@Injectable()
export class GoogleTtsCredentialProvider {
  private readonly logger = new Logger(GoogleTtsCredentialProvider.name);
  private cache: CacheEntry | null = null;

  constructor(private readonly credentials: ProviderCredentialsService) {}

  /** Gọi sau mọi thao tác ghi để lần dùng kế tiếp đọc lại từ database. */
  invalidate(): void {
    this.cache = null;
  }

  private async resolveAccount(): Promise<GoogleServiceAccount | null> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.account;
    }

    try {
      const { record, account } = await this.credentials.loadAccount();

      if (record.status !== 'connected') {
        this.logger.warn(
          `Credential Google TTS đang ở trạng thái "${record.status}" nên không được dùng`,
        );
        return null;
      }

      this.cache = { account, expiresAt: Date.now() + CACHE_TTL_MS };
      return account;
    } catch (error) {
      if (error instanceof BusinessException && error.code === 'CREDENTIAL_NOT_CONFIGURED') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Dựng client Google TTS đã gắn credential.
   *
   * `apiEndpoint` lấy từ cấu hình model (rỗng = endpoint toàn cầu). SDK chỉ nhận
   * hostname nên URL đầy đủ được cắt lại.
   * Không có bản ghi hợp lệ thì rơi về GOOGLE_APPLICATION_CREDENTIALS (SDK tự đọc).
   */
  async createClient(apiEndpoint = ''): Promise<TextToSpeechClient> {
    const account = await this.resolveAccount();
    const endpoint = apiEndpoint.trim();
    const host = endpoint === '' ? undefined : hostOf(endpoint);

    if (!account) {
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new BusinessException('CREDENTIAL_NOT_CONFIGURED', {
          message:
            'Chưa có credential Google TTS: tải service account lên trang admin hoặc đặt GOOGLE_APPLICATION_CREDENTIALS',
        });
      }

      this.logger.warn(
        'Đang dùng GOOGLE_APPLICATION_CREDENTIALS làm fallback vì database chưa có credential',
      );
      return new TextToSpeechClient(host ? { apiEndpoint: host } : {});
    }

    return new TextToSpeechClient({
      projectId: account.project_id,
      credentials: {
        client_email: account.client_email,
        private_key: account.private_key,
      },
      ...(host ? { apiEndpoint: host } : {}),
    });
  }
}
