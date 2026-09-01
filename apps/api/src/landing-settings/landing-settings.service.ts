import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from '../audit/audit-log.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { VoicePreview } from '../voices/voice-preview.entity.js';
import { DEFAULT_LANDING_CONFIG } from './landing-config.default.js';
import { parseLandingConfig, type LandingConfig } from './landing-config.schema.js';
import { LandingSetting } from './landing-setting.entity.js';

export interface LandingSettingView {
  config: LandingConfig;
  publishedAt: string | null;
  publishedBy: string | null;
  note: string | null;
  /** false = chưa xuất bản lần nào, đang chạy cấu hình gốc. */
  published: boolean;
}

@Injectable()
export class LandingSettingsService {
  constructor(
    @InjectRepository(LandingSetting)
    private readonly repository: Repository<LandingSetting>,
    @InjectRepository(VoicePreview)
    private readonly previews: Repository<VoicePreview>,
    private readonly auditLogs: AuditLogService,
  ) {}

  /** Bản đang chạy = bản xuất bản mới nhất; chưa có thì dùng cấu hình gốc. */
  async current(): Promise<LandingSettingView> {
    const latest = await this.repository.findOne({
      where: {},
      order: { publishedAt: 'DESC' },
    });

    if (!latest) {
      return {
        config: DEFAULT_LANDING_CONFIG,
        publishedAt: null,
        publishedBy: null,
        note: null,
        published: false,
      };
    }

    return {
      // Khoan dung khi đọc: bản cũ thiếu trường thì lấy mặc định bù vào.
      config: parseLandingConfig(latest.config, DEFAULT_LANDING_CONFIG),
      publishedAt: latest.publishedAt.toISOString(),
      publishedBy: latest.publishedBy,
      note: latest.note,
      published: true,
    };
  }

  /** Cấu hình cho trang công khai đọc — chỉ trả phần landing cần. */
  async publicConfig(): Promise<LandingConfig> {
    return (await this.current()).config;
  }

  /**
   * Audio nghe thử cho một vị trí trên landing.
   *
   * **Chỉ đọc bản đã cache, tuyệt đối không gọi Google** — đây là endpoint công khai,
   * khách bấm bao nhiêu lần cũng không phát sinh chi phí. Chưa có cache thì trả 404 để
   * giao diện ẩn nút đi thay vì phát ra tiếng lạ.
   */
  async voicePreview(slot: 'hero' | 'studio' | 'testimonial'): Promise<{
    audioBase64: string;
    mimeType: string;
    speed: number;
  }> {
    const { config } = await this.current();
    const target = config.voice[slot];

    if (!target.voiceId) {
      throw new BusinessException('NOT_FOUND', {
        message: `Vị trí "${slot}" chưa chọn giọng đọc`,
      });
    }

    const cached = await this.previews.findOne({ where: { voiceId: target.voiceId } });

    if (!cached) {
      throw new BusinessException('NOT_FOUND', {
        message:
          'Giọng này chưa có bản nghe thử. Vào trang quản trị bấm nghe thử một lần để tạo bản lưu.',
      });
    }

    return {
      audioBase64: cached.audio.toString('base64'),
      mimeType: cached.mimeType,
      // Bản lưu luôn ở 1.0x, tốc độ do trình duyệt áp bằng playbackRate.
      speed: slot === 'testimonial' ? config.voice.testimonial.speed : 1,
    };
  }

  async publish(
    input: unknown,
    ip: string | null,
    note?: string,
  ): Promise<LandingSettingView> {
    const current = await this.current();
    const config = parseLandingConfig(input, current.config);

    const record = new LandingSetting();
    record.config = config as unknown as Record<string, unknown>;
    record.publishedBy = 'local-admin';
    record.note = note?.trim() || null;
    await this.repository.save(record);

    await this.auditLogs.record({
      action: 'Cập nhật CMS Landing Page',
      target: `màu ${config.theme.brandHex} · ${config.content.keywords.length} từ khoá`,
      level: 'warning',
      ip,
      metadata: {
        brandHex: config.theme.brandHex,
        keywords: config.content.keywords.length,
        featuredVideoCount: config.showcase.featuredVideoCount,
      },
    });

    return this.current();
  }

  /** Xuất bản lại cấu hình gốc — giữ nguyên lịch sử để còn quay lại được. */
  async reset(ip: string | null): Promise<LandingSettingView> {
    const record = new LandingSetting();
    record.config = DEFAULT_LANDING_CONFIG as unknown as Record<string, unknown>;
    record.publishedBy = 'local-admin';
    record.note = 'Khôi phục cấu hình gốc';
    await this.repository.save(record);

    await this.auditLogs.record({
      action: 'Khôi phục CMS Mặc định',
      target: 'landing page',
      level: 'critical',
      ip,
    });

    return this.current();
  }
}
