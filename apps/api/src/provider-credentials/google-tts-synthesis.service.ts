import { Injectable, Logger } from '@nestjs/common';
import { TextToSpeechClient, v1beta1 } from '@google-cloud/text-to-speech';
import { BusinessException } from '../common/exceptions/business.exception.js';
import type { GoogleServiceAccount } from './google-service-account.validator.js';

/** Tham số lấy từ `config` của model voice — xem `model-config.schema.ts`. */
export interface SynthesisOptions {
  /** Rỗng = endpoint toàn cầu; đặt để gọi endpoint theo vùng. */
  apiEndpoint: string;
  /** `v1beta1` là bản duy nhất hỗ trợ timepoints cho karaoke. */
  apiVersion: 'v1' | 'v1beta1';
  audioEncoding: 'MP3' | 'LINEAR16' | 'OGG_OPUS';
  /** Trần ký tự mỗi request của nhà cung cấp. */
  maxCharsPerRequest: number;
  pitch: number;
}

/** Thân request gửi sang Google, dùng chung cho cả v1 lẫn v1beta1. */
interface SynthesisBody {
  input: { text: string };
  voice: { languageCode: string; name: string };
  audioConfig: {
    audioEncoding: SynthesisOptions['audioEncoding'];
    pitch?: number;
    speakingRate?: number;
  };
}

export interface SynthesisRequest {
  /** Tên giọng bên nhà cung cấp, ví dụ "vi-VN-Chirp3-HD-Achernar". */
  voiceName: string;
  text: string;
  speakingRate: number;
  options: SynthesisOptions;
}

export interface SynthesisResult {
  audioBase64: string;
  mimeType: string;
  /** Phiên bản API đã dùng — để giao diện biết có lấy được timepoints hay không. */
  apiVersion: 'v1' | 'v1beta1';
  /** Số ký tự bị Google tính tiền — tính cả dấu cách và xuống dòng. */
  charCount: number;
  latencyMs: number;
}

const TIMEOUT_MS = 15_000;

const MIME_BY_ENCODING: Record<SynthesisOptions['audioEncoding'], string> = {
  MP3: 'audio/mpeg',
  LINEAR16: 'audio/wav',
  OGG_OPUS: 'audio/ogg',
};

/** Nghe thử chỉ để kiểm tra chất giọng, không cần dài. */
export const MAX_SAMPLE_CHARS = 300;

/** apiEndpoint khai báo dạng URL nhưng SDK chỉ nhận hostname. */
const hostOf = (endpoint: string): string => {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint.replace(/^https?:\/\//, '').split('/')[0] ?? endpoint;
  }
};

@Injectable()
export class GoogleTtsSynthesisService {
  private readonly logger = new Logger(GoogleTtsSynthesisService.name);

  /**
   * Tổng hợp một đoạn tiếng.
   *
   * **Thao tác này tốn tiền thật** theo số ký tự gửi đi, khác hẳn `listVoices` dùng cho
   * xác minh. Ở đây chỉ áp trần của **nhà cung cấp** (`maxCharsPerRequest`); trần theo
   * nghiệp vụ do tầng gọi đặt, vì nghe thử một giọng và lồng tiếng cho một video là hai
   * việc có giới hạn khác nhau — xem `MAX_SAMPLE_CHARS` ở `VoicesService`.
   */
  async synthesize(
    account: GoogleServiceAccount,
    request: SynthesisRequest,
  ): Promise<SynthesisResult> {
    const text = request.text.trim();

    if (text === '') {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Chưa có câu thoại để nghe thử',
      });
    }

    // Trần của nhà cung cấp, lấy từ cấu hình model chứ không hardcode.
    const { options } = request;
    if (text.length > options.maxCharsPerRequest) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: `Model này giới hạn ${options.maxCharsPerRequest} ký tự mỗi request`,
      });
    }

    const clientOptions = {
      projectId: account.project_id,
      credentials: {
        client_email: account.client_email,
        private_key: account.private_key,
      },
      // Rỗng thì để SDK tự chọn endpoint mặc định.
      ...(options.apiEndpoint ? { apiEndpoint: hostOf(options.apiEndpoint) } : {}),
    };

    // v1beta1 dùng client riêng — đây là bản duy nhất trả timepoints cho karaoke.
    // Hai client có kiểu request khác nhau nên gói lại thành một hàm gọi duy nhất.
    const client =
      options.apiVersion === 'v1beta1'
        ? new v1beta1.TextToSpeechClient(clientOptions)
        : new TextToSpeechClient(clientOptions);

    const languageCode = request.voiceName.split('-').slice(0, 2).join('-');
    const start = process.hrtime.bigint();

    const call = async (body: SynthesisBody): Promise<Uint8Array> => {
      const [response] =
        client instanceof v1beta1.TextToSpeechClient
          ? await client.synthesizeSpeech(body, { timeout: TIMEOUT_MS })
          : await client.synthesizeSpeech(body, { timeout: TIMEOUT_MS });

      const audio = response.audioContent;
      if (!audio) {
        throw new BusinessException('GOOGLE_TTS_UNAVAILABLE', {
          message: 'Google không trả về dữ liệu âm thanh',
        });
      }

      return typeof audio === 'string' ? Buffer.from(audio, 'base64') : audio;
    };

    try {
      const audioContent = await this.callGoogle(call, {
        languageCode,
        text,
        request,
      });

      return {
        audioBase64: Buffer.from(audioContent).toString('base64'),
        mimeType: MIME_BY_ENCODING[options.audioEncoding],
        apiVersion: options.apiVersion,
        charCount: text.length,
        latencyMs: Math.round(Number(process.hrtime.bigint() - start) / 1_000_000),
      };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  private async callGoogle(
    call: (body: SynthesisBody) => Promise<Uint8Array>,
    context: { languageCode: string; text: string; request: SynthesisRequest },
  ): Promise<Uint8Array> {
    const { languageCode, text, request } = context;
    const { options } = request;

    const send = (withSpeakingRate: boolean): Promise<Uint8Array> =>
      call({
        input: { text },
        voice: { languageCode, name: request.voiceName },
        audioConfig: {
          audioEncoding: options.audioEncoding,
          ...(options.pitch !== 0 ? { pitch: options.pitch } : {}),
          ...(withSpeakingRate ? { speakingRate: request.speakingRate } : {}),
        },
      });

    try {
      return await send(request.speakingRate !== 1);
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);

      // Một số dòng giọng (Chirp/Studio) không nhận speakingRate — thử lại không kèm
      // tham số đó thay vì báo hỏng cả lần nghe thử.
      if (request.speakingRate !== 1 && /speaking_rate|speakingRate/i.test(raw)) {
        this.logger.warn(
          `${request.voiceName} không nhận speakingRate, thử lại với tốc độ mặc định`,
        );
        return send(false);
      }

      throw this.toBusinessException(error);
    }
  }

  /** Lỗi Google chỉ vào log server, client nhận mã ổn định. */
  private toBusinessException(error: unknown): BusinessException {
    const raw = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Google TTS từ chối tổng hợp giọng: ${raw}`);

    if (/deadline|timeout/i.test(raw)) {
      return new BusinessException('GOOGLE_TTS_TIMEOUT');
    }
    if (/has not been used in project|SERVICE_DISABLED|is disabled/i.test(raw)) {
      return new BusinessException('GOOGLE_TTS_API_DISABLED');
    }
    if (/permission|denied/i.test(raw)) {
      return new BusinessException('GOOGLE_TTS_PERMISSION_DENIED');
    }
    if (/invalid_grant|unauthenticated|invalid signature/i.test(raw)) {
      return new BusinessException('GOOGLE_TTS_AUTH_FAILED');
    }

    return new BusinessException('GOOGLE_TTS_UNAVAILABLE');
  }
}
