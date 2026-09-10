import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { AiModel } from '../ai-models/ai-model.entity.js';
import { readModelConfig, type VoiceModelConfig } from '../ai-models/model-config.schema.js';
import { User, type UserPlan } from '../auth/user.entity.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { GoogleTtsSynthesisService } from '../provider-credentials/google-tts-synthesis.service.js';
import { GOOGLE_TTS_PROVIDER } from '../provider-credentials/provider-credential.entity.js';
import { ProviderCredentialsService } from '../provider-credentials/provider-credentials.service.js';
import { StorageService } from '../storage/storage.service.js';
import { TtsUsageService } from '../tts-usage/tts-usage.service.js';
import { Voice } from '../voices/voice.entity.js';
import { TtsClip } from './tts-clip.entity.js';
import { UserTtsQuota } from './user-tts-quota.entity.js';
import { readWavInfo } from './wav.js';

/**
 * Số dòng thoại được tổng hợp mới mỗi ngày, theo gói.
 *
 * Đếm **dòng** chứ không đếm ký tự vì đó là thứ người dùng cảm nhận được ("hôm nay tôi
 * lồng tiếng được mấy video"), và vì lấy lại từ cache không tính nên con số này phản ánh
 * đúng phần tốn tiền. `0` là không giới hạn.
 */
export const DAILY_TTS_LINES: Record<UserPlan, number> = {
  free: 30,
  advanced: 120,
  plus: 300,
  premium: 0,
};

/**
 * Khoảng lặng chèn sau mỗi câu.
 *
 * Cắt đúng mép sóng âm thì hai cảnh dính vào nhau nghe như nói hụt hơi; 150ms là mức đủ
 * để tai nhận ra hết câu mà không thành ngắt quãng.
 */
export const SCENE_PADDING_MS = 150;

/** Trần một câu thoại — khớp giới hạn `text` của ProjectsService. */
const MAX_LINE_CHARS = 500;

export interface SynthesizedLine {
  index: number;
  clipId: string;
  /** Đã gồm khoảng lặng, đây chính là `durationMs` của cảnh. */
  durationMs: number;
  cached: boolean;
}

/**
 * Tổng hợp tiếng cho từng dòng thoại.
 *
 * Ba khác biệt có chủ ý so với luồng nghe thử ở `VoicesService`:
 *
 * 1. **Luôn dùng `LINEAR16`**, bỏ qua `audioEncoding` của model. Cần WAV để đo thời lượng
 *    chính xác từ chính dữ liệu PCM, và bộ xuất MP4 cũng cần PCM chứ không cần giải mã
 *    MP3 trong Web Worker.
 * 2. **Gửi tốc độ thật sang Google** thay vì để trình duyệt áp `playbackRate`. Audio này
 *    sẽ đi vào file MP4, mà `playbackRate` thì không đi theo file được.
 * 3. **Cache toàn hệ thống** trong `tts_clips`, không phải một bản nghe thử cho mỗi giọng.
 */
@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  constructor(
    @InjectRepository(TtsClip) private readonly clips: Repository<TtsClip>,
    @InjectRepository(UserTtsQuota) private readonly quotas: Repository<UserTtsQuota>,
    @InjectRepository(Voice) private readonly voices: Repository<Voice>,
    @InjectRepository(AiModel) private readonly models: Repository<AiModel>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly credentials: ProviderCredentialsService,
    private readonly synthesis: GoogleTtsSynthesisService,
    private readonly usage: TtsUsageService,
    private readonly storage: StorageService,
  ) {}

  /** URL đã ký để trình duyệt tải đoạn tiếng về phát và để bộ xuất ghép vào MP4. */
  async signedUrl(clipId: string): Promise<string | null> {
    const clip = await this.clips.findOne({ where: { id: clipId } });
    return clip ? this.storage.signedUrl(clip.storageKey) : null;
  }

  async findClips(ids: string[]): Promise<Map<string, TtsClip>> {
    const unique = [...new Set(ids)].filter(Boolean);
    if (unique.length === 0) return new Map();

    const rows = await this.clips.find({ where: unique.map((id) => ({ id })) });
    return new Map(rows.map((clip) => [clip.id, clip]));
  }

  /**
   * Tổng hợp tiếng cho một loạt dòng thoại.
   *
   * Chạy **tuần tự** chứ không song song: Google giới hạn số request đồng thời, và một
   * video chỉ có tối đa 6 dòng nên chạy song song cũng chỉ tiết kiệm được vài giây trong
   * khi làm khó phần đếm hạn mức.
   */
  async synthesizeLines(
    userId: string,
    voiceId: string,
    speed: number,
    lines: { index: number; text: string }[],
  ): Promise<SynthesizedLine[]> {
    if (lines.length === 0) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Chưa có lời thoại nào để lồng tiếng',
      });
    }

    const voice = await this.voices.findOne({ where: { id: voiceId, enabled: true } });
    if (!voice) {
      throw new BusinessException('NOT_FOUND', {
        message: 'Giọng đọc này không còn khả dụng, hãy chọn lại',
      });
    }

    const model = await this.models.findOne({ where: { id: voice.modelId } });
    if (!model) {
      throw new BusinessException('NOT_FOUND', {
        message: `Giọng này trỏ tới model "${voice.modelId}" không còn tồn tại`,
      });
    }

    const config = readModelConfig('voice', model.config) as VoiceModelConfig;
    const rate = this.assertSpeed(speed);
    const results: SynthesizedLine[] = [];

    for (const line of lines) {
      const text = line.text.trim();

      if (text.length < 1 || text.length > MAX_LINE_CHARS) {
        throw new BusinessException('VALIDATION_FAILED', {
          message: `Lời thoại cảnh ${line.index + 1} cần từ 1 đến ${MAX_LINE_CHARS} ký tự`,
        });
      }

      const hash = this.hash(voice.providerVoiceId, text, rate, config);
      const cached = await this.clips.findOne({ where: { contentHash: hash } });

      if (cached) {
        cached.lastUsedAt = new Date();
        await this.clips.save(cached);

        results.push({
          index: line.index,
          clipId: cached.id,
          durationMs: cached.durationMs + SCENE_PADDING_MS,
          cached: true,
        });
        continue;
      }

      // Từ đây mới thật sự tốn tiền: chặn hạn mức ngay trước khi gửi đi, không phải sau.
      await this.assertQuota(userId, text.length);
      await this.usage.assertWithinLimits(voice.modelId, config, text.length);

      const clip = await this.synthesizeOne(voice, config, text, rate, hash);
      await this.recordQuota(userId, clip.charCount);
      await this.usage.record(voice.modelId, voice.id, clip.charCount);

      results.push({
        index: line.index,
        clipId: clip.id,
        durationMs: clip.durationMs + SCENE_PADDING_MS,
        cached: false,
      });
    }

    return results;
  }

  private async synthesizeOne(
    voice: Voice,
    config: VoiceModelConfig,
    text: string,
    rate: number,
    hash: string,
  ): Promise<TtsClip> {
    const { account } = await this.credentials.loadAccount(GOOGLE_TTS_PROVIDER);

    const result = await this.synthesis.synthesize(account, {
      voiceName: voice.providerVoiceId,
      text,
      speakingRate: rate,
      options: {
        apiEndpoint: config.apiEndpoint,
        apiVersion: config.apiVersion,
        // Ép WAV, xem ghi chú ở đầu lớp.
        audioEncoding: 'LINEAR16',
        maxCharsPerRequest: config.maxCharsPerRequest,
        pitch: config.defaultPitch,
      },
    });

    const audio = Buffer.from(result.audioBase64, 'base64');
    const info = readWavInfo(audio);

    const clip = new TtsClip();
    clip.contentHash = hash;
    clip.voiceId = voice.id;
    clip.modelId = voice.modelId;
    clip.charCount = result.charCount;
    clip.durationMs = info.durationMs;
    clip.sampleRate = info.sampleRate;
    clip.byteSize = audio.byteLength;
    clip.lastUsedAt = new Date();
    // Đặt tên theo hash: cùng nội dung luôn ra cùng một file, không bao giờ ghi đè nhầm.
    clip.storageKey = `tts/${hash.slice(0, 2)}/${hash}.wav`;

    await this.storage.put(clip.storageKey, audio, 'audio/wav');

    try {
      return await this.clips.save(clip);
    } catch (error) {
      // Hai request song song cùng một câu: một cái thắng, cái kia dùng lại kết quả đó
      // thay vì báo lỗi cho người dùng về một chuyện họ không gây ra.
      const existing = await this.clips.findOne({ where: { contentHash: hash } });
      if (existing) return existing;
      throw error;
    }
  }

  /**
   * Khoá cache.
   *
   * Gồm mọi thứ ảnh hưởng tới sóng âm phát ra. Thiếu một tham số ở đây nghĩa là đổi tham
   * số đó sẽ lấy nhầm đoạn tiếng cũ — lỗi rất khó nhận ra vì audio vẫn phát bình thường,
   * chỉ là sai giọng hoặc sai tốc độ.
   */
  private hash(
    providerVoiceId: string,
    text: string,
    rate: number,
    config: VoiceModelConfig,
  ): string {
    return createHash('sha256')
      .update(
        [
          providerVoiceId,
          text,
          rate.toFixed(2),
          'LINEAR16',
          config.apiVersion,
          config.defaultPitch,
        ].join('|'),
      )
      .digest('hex');
  }

  private assertSpeed(speed: number): number {
    if (!Number.isFinite(speed) || speed < 0.8 || speed > 1.5) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Tốc độ đọc phải trong khoảng 0.8x đến 1.5x',
      });
    }
    // Làm tròn để khoá cache ổn định: 1.0500000000000001 và 1.05 phải là cùng một đoạn.
    return Number(speed.toFixed(2));
  }

  private day(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async assertQuota(userId: string, charsAboutToSend: number): Promise<void> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, plan: true },
    });

    if (!user) {
      throw new BusinessException('NOT_FOUND', { message: 'Không tìm thấy tài khoản' });
    }

    const limit = DAILY_TTS_LINES[user.plan] ?? DAILY_TTS_LINES.free;
    if (limit === 0) return;

    const row = await this.quotas.findOne({
      where: { userId, day: this.day() },
    });
    const used = row?.lines ?? 0;

    if (used + 1 > limit) {
      throw new BusinessException('TOO_MANY_REQUESTS', {
        message: `Hôm nay bạn đã lồng tiếng ${used}/${limit} câu của gói hiện tại. Hạn mức đặt lại vào ngày mai, hoặc bạn có thể nâng gói.`,
        details: { used, limit, chars: charsAboutToSend },
      });
    }
  }

  /**
   * Cộng dồn sau khi Google đã nhận request — đếm cái đã thật sự tiêu.
   *
   * UPSERT viết tay vì `orUpdate` của TypeORM ghi đè giá trị mới chứ không cộng dồn, giống
   * lý do ở `TtsUsageService.record`.
   */
  private async recordQuota(userId: string, chars: number): Promise<void> {
    try {
      await this.quotas.query(
        `INSERT INTO "user_tts_quota" ("user_id", "day", "lines", "chars")
         VALUES ($1, $2, 1, $3)
         ON CONFLICT ("user_id", "day")
         DO UPDATE SET "lines" = "user_tts_quota"."lines" + 1,
                       "chars" = "user_tts_quota"."chars" + EXCLUDED."chars",
                       "updated_at" = now()`,
        [userId, this.day(), chars],
      );
    } catch (error) {
      // Đếm hỏng không được làm hỏng thao tác người dùng đang chạy.
      this.logger.error(
        `Không ghi được hạn mức lồng tiếng của ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Còn bao nhiêu câu trong ngày — giao diện hiện trước khi người dùng bấm. */
  async remainingToday(userId: string): Promise<{ used: number; limit: number }> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, plan: true },
    });

    const limit = user ? (DAILY_TTS_LINES[user.plan] ?? DAILY_TTS_LINES.free) : 0;
    const row = await this.quotas.findOne({ where: { userId, day: this.day() } });

    return { used: row?.lines ?? 0, limit };
  }
}
