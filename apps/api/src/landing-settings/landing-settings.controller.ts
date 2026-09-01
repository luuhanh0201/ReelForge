import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BusinessException } from '../common/exceptions/business.exception.js';
import type { LandingConfig } from './landing-config.schema.js';
import { GoogleTranslateService } from './google-translate.service.js';
import {
  LandingSettingsService,
  type LandingSettingView,
} from './landing-settings.service.js';

const clientIp = (request: Request): string | null => request.ip ?? null;

/** Quản trị CMS Landing Page. Chưa gắn auth — xem ghi chú ở AppModule. */
@Controller('admin/landing-settings')
export class LandingSettingsAdminController {
  constructor(
    private readonly settings: LandingSettingsService,
    private readonly translator: GoogleTranslateService,
  ) {}

  /** Dịch nội dung tiếng Việt sang tiếng Anh cho các ô song ngữ trong CMS. */
  @Post('translate')
  async translate(
    @Body('texts') texts: string[],
  ): Promise<{ translations: string[] }> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Cần ít nhất một chuỗi để dịch',
      });
    }

    return { translations: await this.translator.translate(texts) };
  }

  @Get()
  async current(): Promise<LandingSettingView> {
    return this.settings.current();
  }

  @Put()
  async publish(
    @Body('config') config: unknown,
    @Body('note') note: string | undefined,
    @Req() request: Request,
  ): Promise<LandingSettingView> {
    return this.settings.publish(config, clientIp(request), note);
  }

  @Post('reset')
  async reset(@Req() request: Request): Promise<LandingSettingView> {
    return this.settings.reset(clientIp(request));
  }
}

/**
 * Endpoint công khai cho landing page đọc lúc render.
 * Tách khỏi nhóm `/admin` để sau này gắn auth cho admin mà không chặn trang chủ.
 */
@Controller('landing-config')
export class LandingConfigController {
  constructor(private readonly settings: LandingSettingsService) {}

  @Get()
  async config(): Promise<LandingConfig> {
    return this.settings.publicConfig();
  }

  /** Chỉ trả bản audio đã cache — không bao giờ gọi nhà cung cấp từ trang công khai. */
  @Get('voice/:slot')
  async voice(@Param('slot') slot: string) {
    if (slot !== 'hero' && slot !== 'studio' && slot !== 'testimonial') {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Vị trí chỉ nhận hero, studio hoặc testimonial',
      });
    }

    return this.settings.voicePreview(slot);
  }
}
