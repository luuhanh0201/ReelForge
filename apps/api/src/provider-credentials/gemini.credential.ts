import { Injectable, Logger } from '@nestjs/common';
import { BusinessException } from '../common/exceptions/business.exception.js';
import type {
  CredentialDescription,
  CredentialProviderSpec,
  CredentialVerification,
} from './credential-registry.js';

export const GEMINI_PROVIDER = 'google-gemini';

/** Đủ rộng cho một lần gọi xuyên vùng, đủ ngắn để admin không phải chờ lâu. */
const TIMEOUT_MS = 8000;

const MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Hình dạng khoá của Google AI Studio: `AIza` + 35 ký tự an toàn cho URL.
 *
 * Kiểm ở đây để **chặn sớm những lỗi rõ ràng** — dán nhầm cả câu, dính khoảng trắng, dán
 * nhầm service account. Khoá đúng hình dạng mà sai thật thì bước gọi thử sẽ loại.
 */
const API_KEY_SHAPE = /^AIza[A-Za-z0-9_-]{30,50}$/;

/** Google Gemini — credential là một chuỗi API key. */
@Injectable()
export class GeminiCredentialSpec implements CredentialProviderSpec {
  private readonly logger = new Logger(GeminiCredentialSpec.name);

  readonly id = GEMINI_PROVIDER;
  readonly label = 'Google Gemini';
  readonly type = 'api_key' as const;
  readonly docsUrl = 'https://aistudio.google.com/apikey';

  parse(input: { file?: Buffer; value?: string }): string {
    const key = (input.value ?? '').trim();

    if (!key) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Thiếu API key trong trường "value"',
      });
    }

    if (!API_KEY_SHAPE.test(key)) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'API key của Gemini bắt đầu bằng "AIza" và không chứa khoảng trắng',
      });
    }

    return key;
  }

  describe(payload: unknown): CredentialDescription {
    const key = payload as string;

    return {
      projectId: null,
      clientEmailMasked: null,
      privateKeyIdSuffix: key.slice(-4),
      // Đầu khoá là tiền tố chung của mọi khoá Google nên không tiết lộ gì; bốn ký tự cuối
      // vừa đủ để admin phân biệt hai khoá mà không dựng lại được khoá thật.
      displayHint: `AIza…${key.slice(-4)}`,
      fingerprintSource: key,
    };
  }

  /**
   * Gọi thật `listModels`: xác nhận khoá có thật, còn hiệu lực và project đã bật API.
   *
   * Lỗi nguyên bản của Google **không đi ra client** — chỉ map sang mã ổn định, chi tiết
   * nằm trong log server. Khoá cũng không bao giờ xuất hiện trong log.
   */
  async verify(payload: unknown): Promise<CredentialVerification> {
    const key = payload as string;
    const startedAt = Date.now();

    let response: Response;
    try {
      response = await fetch(`${MODELS_ENDPOINT}?key=${encodeURIComponent(key)}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      this.logger.warn(
        `Không gọi được Gemini: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw new BusinessException(timedOut ? 'CREDENTIAL_TIMEOUT' : 'CREDENTIAL_UNAVAILABLE');
    }

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      this.logger.warn(`Gemini từ chối khoá: HTTP ${response.status}`);

      throw new BusinessException(
        response.status >= 500 ? 'CREDENTIAL_UNAVAILABLE' : 'CREDENTIAL_REJECTED',
        response.status === 429
          ? { message: 'Khoá đúng nhưng đang bị giới hạn tần suất, thử lại sau ít phút' }
          : {},
      );
    }

    const body = (await response.json()) as { models?: unknown[] };

    return {
      latencyMs,
      metadata: { modelCount: Array.isArray(body.models) ? body.models.length : 0 },
    };
  }
}
