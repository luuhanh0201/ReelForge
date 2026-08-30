import { Injectable, Logger } from '@nestjs/common';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { BusinessException } from '../common/exceptions/business.exception.js';
import type { ErrorCode } from '../common/constants/error-code.constant.js';
import type { GoogleServiceAccount } from './google-service-account.validator.js';

export interface GoogleVoice {
  /** Chính là `provider_voice_id`, ví dụ "vi-VN-Chirp3-HD-Achernar". */
  name: string;
  ssmlGender: string;
  languageCodes: string[];
  sampleRateHertz: number;
}

export interface VerificationResult {
  latencyMs: number;
  voiceCount: number;
  /** Tên giọng do Google trả về — dùng để đối chiếu provider_voice_id. */
  voiceNames: string[];
  /** Danh sách đầy đủ để nhập giọng vào danh mục. */
  voices: GoogleVoice[];
}

/** Đủ rộng cho một lần gọi xuyên vùng, đủ ngắn để admin không phải chờ lâu. */
const TIMEOUT_MS = 8000;

/** Mã lỗi gRPC của Google. */
const GRPC_UNAUTHENTICATED = 16;
const GRPC_PERMISSION_DENIED = 7;
const GRPC_DEADLINE_EXCEEDED = 4;
const GRPC_UNAVAILABLE = 14;

@Injectable()
export class GoogleTtsCredentialVerifierService {
  private readonly logger = new Logger(GoogleTtsCredentialVerifierService.name);

  /**
   * Gọi thử Google bằng credential vừa nhận.
   *
   * Dùng `listVoices` chứ không phải `synthesizeSpeech`: nó xác nhận đủ cả xác thực,
   * quyền IAM lẫn trạng thái API mà không phát sinh quota hay chi phí tổng hợp giọng.
   */
  async verify(
    account: GoogleServiceAccount,
    languageCode = 'vi-VN',
  ): Promise<VerificationResult> {
    const client = new TextToSpeechClient({
      projectId: account.project_id,
      credentials: {
        client_email: account.client_email,
        private_key: account.private_key,
      },
    });

    const start = process.hrtime.bigint();

    try {
      const [response] = await client.listVoices(
        { languageCode },
        { timeout: TIMEOUT_MS },
      );
      const voices = response.voices ?? [];

      const parsed: GoogleVoice[] = voices
        .filter((voice): voice is typeof voice & { name: string } =>
          typeof voice.name === 'string',
        )
        .map((voice) => ({
          name: voice.name,
          ssmlGender: String(voice.ssmlGender ?? 'SSML_VOICE_GENDER_UNSPECIFIED'),
          languageCodes: (voice.languageCodes ?? []).filter(
            (code): code is string => typeof code === 'string',
          ),
          sampleRateHertz: voice.naturalSampleRateHertz ?? 0,
        }));

      return {
        latencyMs: Math.round(Number(process.hrtime.bigint() - start) / 1_000_000),
        voiceCount: parsed.length,
        voiceNames: parsed.map((voice) => voice.name),
        voices: parsed,
      };
    } catch (error) {
      throw this.toBusinessException(error);
    } finally {
      // Luôn đóng client, kể cả khi lỗi — nếu không sẽ rò rỉ kết nối gRPC.
      await client.close().catch(() => undefined);
    }
  }

  /**
   * Map lỗi của Google sang mã ổn định của hệ thống.
   * Nguyên văn lỗi chỉ đi vào log server, không bao giờ ra response.
   */
  private toBusinessException(error: unknown): BusinessException {
    const raw = error instanceof Error ? error.message : String(error);
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? Number((error as { code: unknown }).code)
        : undefined;

    this.logger.warn(`Google TTS từ chối credential (code=${code ?? 'n/a'}): ${raw}`);

    let mapped: ErrorCode = 'GOOGLE_TTS_UNAVAILABLE';

    if (code === GRPC_DEADLINE_EXCEEDED || /deadline|timeout/i.test(raw)) {
      mapped = 'GOOGLE_TTS_TIMEOUT';
    } else if (
      /has not been used in project|SERVICE_DISABLED|is disabled/i.test(raw)
    ) {
      // Google trả PERMISSION_DENIED cho cả trường hợp API chưa bật — tách ra
      // vì hai lỗi này cần hai cách xử lý hoàn toàn khác nhau.
      mapped = 'GOOGLE_TTS_API_DISABLED';
    } else if (code === GRPC_PERMISSION_DENIED) {
      mapped = 'GOOGLE_TTS_PERMISSION_DENIED';
    } else if (
      code === GRPC_UNAUTHENTICATED ||
      /invalid_grant|invalid signature|account not found|unauthorized/i.test(raw)
    ) {
      mapped = 'GOOGLE_TTS_AUTH_FAILED';
    } else if (code === GRPC_UNAVAILABLE) {
      mapped = 'GOOGLE_TTS_UNAVAILABLE';
    }

    return new BusinessException(mapped);
  }
}
