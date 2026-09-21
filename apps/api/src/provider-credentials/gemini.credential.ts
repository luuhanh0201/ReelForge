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
 * Hình dạng khoá — **cố ý không kiểm tiền tố**.
 *
 * Google vừa đổi định dạng: khoá cũ (*standard key*) bắt đầu bằng `AIza`, khoá mới
 * (*auth key*) bắt đầu bằng `AQ.Ab`. Từ 28/05/2026 mọi khoá tạo mới trong AI Studio đều là
 * auth key, và từ tháng 9/2026 API từ chối khoá `AIza` cũ. Google **không công bố** định
 * dạng khoá ở tài liệu, nên khoá chặt theo tiền tố là tự chuốc lấy việc chặn nhầm khoá hợp
 * lệ mỗi lần họ đổi — đúng cái vừa xảy ra.
 *
 * Ở đây chỉ chặn những thứ chắc chắn sai: chuỗi rỗng, dính khoảng trắng hoặc xuống dòng
 * (dán nhầm cả câu), ký tự lạ (dán nhầm JSON service account), quá ngắn hoặc quá dài.
 * Khoá có đúng hình dạng mà sai thật thì **bước gọi thử sẽ loại** — đó mới là chốt chặn.
 */
const API_KEY_SHAPE = /^[A-Za-z0-9._-]{20,200}$/;

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
        message:
          'API key không hợp lệ: chỉ gồm chữ, số, dấu chấm, gạch ngang và không chứa khoảng trắng',
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
      // Bốn ký tự đầu là tiền tố chung của cả lớp khoá (`AIza`, `AQ.A`...) nên không tiết
      // lộ gì, và cho admin biết mình đang cầm khoá đời nào; bốn ký tự cuối vừa đủ để phân
      // biệt hai khoá mà không dựng lại được khoá thật.
      displayHint: `${key.slice(0, 4)}…${key.slice(-4)}`,
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
