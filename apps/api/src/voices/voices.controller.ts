import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { BusinessException } from '../common/exceptions/business.exception.js';
import {
  VoicesService,
  type VoiceInput,
  type VoiceView,
} from './voices.service.js';

const clientIp = (request: Request): string | null => request.ip ?? null;

/**
 * Danh mục giọng đọc cho trang /admin/voice-models.
 * Chưa gắn auth — xem ghi chú ở AppModule.
 */
@Controller('admin/voices')
export class VoicesController {
  constructor(private readonly voices: VoicesService) {}

  @Get()
  async list(): Promise<{ items: VoiceView[] }> {
    return { items: await this.voices.list() };
  }

  /** Danh mục giọng Google đang cung cấp — nguồn để nhập, tránh gõ tay sai ID. */
  @Get('provider-catalog')
  async providerCatalog(@Query('languageCode') languageCode?: string) {
    return this.voices.listProviderCatalog(languageCode?.trim() || 'vi-VN');
  }

  @Post('import')
  async importFromProvider(
    @Body('providerVoiceIds') providerVoiceIds: string[],
    @Body('modelId') modelId: string,
    @Body('languageCode') languageCode: string | undefined,
    @Req() request: Request,
  ): Promise<{ imported: number; skipped: number }> {
    return this.voices.importFromProvider(
      providerVoiceIds,
      modelId,
      languageCode?.trim() || 'vi-VN',
      clientIp(request),
    );
  }

  @Post()
  async create(
    @Body() body: VoiceInput,
    @Req() request: Request,
  ): Promise<VoiceView> {
    return this.voices.create(body, clientIp(request));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Partial<VoiceInput>,
    @Req() request: Request,
  ): Promise<VoiceView> {
    return this.voices.update(id, body, clientIp(request));
  }

  @Patch(':id/status')
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('enabled') enabled: unknown,
    @Req() request: Request,
  ): Promise<VoiceView> {
    if (typeof enabled !== 'boolean') {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Trường "enabled" phải là true hoặc false',
      });
    }

    return this.voices.setEnabled(id, enabled, clientIp(request));
  }

  /** `force=true` bỏ qua bộ nhớ đệm và gọi lại Google — có tính phí. */
  @Post(':id/preview')
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
    @Query('force') force?: string,
  ): Promise<{
    audioBase64: string;
    mimeType: string;
    apiVersion: string;
    charCount: number;
    latencyMs: number;
    cached: boolean;
  }> {
    return this.voices.preview(id, clientIp(request), force === 'true');
  }

  @Post(':id/verify')
  async verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<VoiceView> {
    return this.voices.verify(id, clientIp(request));
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<{ removed: boolean }> {
    return this.voices.remove(id, clientIp(request));
  }
}
