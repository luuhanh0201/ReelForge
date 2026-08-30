import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../common/exceptions/business.exception.js';
import type { VoiceModelConfig } from '../ai-models/model-config.schema.js';
import { TtsUsage } from './tts-usage.entity.js';

export interface UsageSummary {
  modelId: string;
  /** Số ký tự đã dùng hôm nay và trong tháng hiện tại. */
  todayChars: number;
  monthChars: number;
  todayRequests: number;
  monthRequests: number;
  dailyCharLimit: number;
  monthlyCharLimit: number;
  /** Hạn mức miễn phí còn lại trong tháng; null khi model không khai báo free tier. */
  freeTierRemaining: number | null;
  /** Ước tính tiền phải trả cho phần vượt hạn mức miễn phí, tính bằng USD. */
  estimatedCostUsd: number;
}

/** "2026-08-31" theo giờ máy chủ. */
const today = (): string => new Date().toISOString().slice(0, 10);

/** Ngày đầu tháng hiện tại. */
const monthStart = (): string => `${new Date().toISOString().slice(0, 7)}-01`;

@Injectable()
export class TtsUsageService {
  private readonly logger = new Logger(TtsUsageService.name);

  constructor(
    @InjectRepository(TtsUsage) private readonly repository: Repository<TtsUsage>,
  ) {}

  private async sum(
    modelId: string,
    fromDay: string,
  ): Promise<{ chars: number; requests: number }> {
    const row = await this.repository
      .createQueryBuilder('usage')
      .select('coalesce(sum(usage.chars), 0)', 'chars')
      .addSelect('coalesce(sum(usage.requests), 0)', 'requests')
      .where('usage.model_id = :modelId', { modelId })
      .andWhere('usage.day >= :fromDay', { fromDay })
      .getRawOne<{ chars: string; requests: string }>();

    return {
      chars: Number(row?.chars ?? 0),
      requests: Number(row?.requests ?? 0),
    };
  }

  /**
   * Chặn trước khi gọi nhà cung cấp: vượt trần thì không gửi đi.
   * Trần 0 nghĩa là không giới hạn.
   */
  async assertWithinLimits(
    modelId: string,
    config: VoiceModelConfig,
    charsAboutToSend: number,
  ): Promise<void> {
    const [day, month] = await Promise.all([
      this.sum(modelId, today()),
      this.sum(modelId, monthStart()),
    ]);

    if (
      config.dailyCharLimit > 0 &&
      day.chars + charsAboutToSend > config.dailyCharLimit
    ) {
      throw new BusinessException('TOO_MANY_REQUESTS', {
        message: `Đã chạm trần ${config.dailyCharLimit.toLocaleString('vi-VN')} ký tự/ngày của model này (đã dùng ${day.chars.toLocaleString('vi-VN')}).`,
      });
    }

    if (
      config.monthlyCharLimit > 0 &&
      month.chars + charsAboutToSend > config.monthlyCharLimit
    ) {
      throw new BusinessException('TOO_MANY_REQUESTS', {
        message: `Đã chạm trần ${config.monthlyCharLimit.toLocaleString('vi-VN')} ký tự/tháng của model này (đã dùng ${month.chars.toLocaleString('vi-VN')}).`,
      });
    }
  }

  /**
   * Cộng dồn sau khi nhà cung cấp đã nhận request — đếm cái đã thật sự tiêu.
   *
   * Dùng UPSERT viết tay vì `orUpdate` của TypeORM chỉ ghi đè giá trị mới, không cộng
   * dồn được vào giá trị đang có.
   */
  async record(modelId: string, voiceId: string, chars: number): Promise<void> {
    try {
      await this.repository.query(
        `INSERT INTO "tts_usage" ("day", "model_id", "voice_id", "chars", "requests")
         VALUES ($1, $2, $3, $4, 1)
         ON CONFLICT ("day", "model_id", "voice_id")
         DO UPDATE SET "chars" = "tts_usage"."chars" + EXCLUDED."chars",
                       "requests" = "tts_usage"."requests" + 1,
                       "updated_at" = now()`,
        [today(), modelId, voiceId, chars],
      );
    } catch (error) {
      // Đếm hỏng không được làm hỏng thao tác nghiệp vụ đang chạy.
      this.logger.error(
        `Không ghi được số ký tự đã dùng cho ${modelId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async summary(
    modelId: string,
    config: VoiceModelConfig,
    cost: { amount: number; freeTierAmount: number | null },
  ): Promise<UsageSummary> {
    const [day, month] = await Promise.all([
      this.sum(modelId, today()),
      this.sum(modelId, monthStart()),
    ]);

    const billableChars =
      cost.freeTierAmount === null
        ? month.chars
        : Math.max(0, month.chars - cost.freeTierAmount);

    return {
      modelId,
      todayChars: day.chars,
      monthChars: month.chars,
      todayRequests: day.requests,
      monthRequests: month.requests,
      dailyCharLimit: config.dailyCharLimit,
      monthlyCharLimit: config.monthlyCharLimit,
      freeTierRemaining:
        cost.freeTierAmount === null
          ? null
          : Math.max(0, cost.freeTierAmount - month.chars),
      estimatedCostUsd: Number(((billableChars / 1_000_000) * cost.amount).toFixed(4)),
    };
  }
}
