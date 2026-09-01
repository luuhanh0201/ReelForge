import { Injectable, Logger } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ProviderCredentialsService } from '../provider-credentials/provider-credentials.service.js';
import { GOOGLE_TTS_PROVIDER } from '../provider-credentials/provider-credential.entity.js';

const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';
const TIMEOUT_MS = 8000;

/**
 * Dịch nội dung CMS từ tiếng Việt sang tiếng Anh.
 *
 * Dùng lại **chính service account đã lưu cho Google TTS** (cùng project), nên không phải
 * quản lý thêm credential. Cloud Translation là API riêng nên phải bật trong project —
 * chưa bật thì trả về mã lỗi rõ ràng để giao diện hướng dẫn người dùng.
 */
@Injectable()
export class GoogleTranslateService {
  private readonly logger = new Logger(GoogleTranslateService.name);

  constructor(private readonly credentials: ProviderCredentialsService) {}

  async translate(texts: string[], target = 'en', source = 'vi'): Promise<string[]> {
    const cleaned = texts.map((text) => text.trim()).filter((text) => text !== '');

    if (cleaned.length === 0) return [];

    const { account } = await this.credentials.loadAccount(GOOGLE_TTS_PROVIDER);

    const auth = new GoogleAuth({
      credentials: {
        client_email: account.client_email,
        private_key: account.private_key,
      },
      projectId: account.project_id,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const token = await (await auth.getClient()).getAccessToken();

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.token ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: cleaned, source, target, format: 'text' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const body = (await response.json()) as {
      data?: { translations?: { translatedText?: string }[] };
      error?: { status?: string; message?: string };
    };

    if (!response.ok) {
      const reason = body.error?.message ?? `HTTP ${response.status}`;
      this.logger.warn(`Cloud Translation từ chối: ${reason}`);

      // Chưa bật API là trường hợp phổ biến nhất, tách riêng để hướng dẫn được.
      if (/has not been used in project|SERVICE_DISABLED|is disabled/i.test(reason)) {
        throw new BusinessException('SERVICE_UNAVAILABLE', {
          message:
            'Cloud Translation API chưa bật trong project Google Cloud. Bật API rồi thử lại.',
        });
      }

      throw new BusinessException('SERVICE_UNAVAILABLE', {
        message: 'Không dịch được nội dung, thử lại sau',
      });
    }

    return (body.data?.translations ?? []).map(
      (translation) => translation.translatedText ?? '',
    );
  }
}
