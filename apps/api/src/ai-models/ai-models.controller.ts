import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { BusinessException } from '../common/exceptions/business.exception.js';
import {
  AiModelsService,
  type AiModelInput,
  type AiModelView,
} from './ai-models.service.js';

const clientIp = (request: Request): string | null => request.ip ?? null;

/**
 * Danh mục model AI cho ba trang video / voice / script.
 * Chưa gắn auth — xem ghi chú ở AppModule.
 */
@Controller('admin/ai-models')
export class AiModelsController {
  constructor(private readonly models: AiModelsService) {}

  @Get()
  async list(@Query('kind') kind?: string): Promise<{ items: AiModelView[] }> {
    return { items: await this.models.list(kind) };
  }

  @Post()
  async create(
    @Body() body: AiModelInput,
    @Req() request: Request,
  ): Promise<AiModelView> {
    return this.models.create(body, clientIp(request));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: AiModelInput,
    @Req() request: Request,
  ): Promise<AiModelView> {
    return this.models.update(id, body, clientIp(request));
  }

  @Patch(':id/status')
  async setStatus(
    @Param('id') id: string,
    @Body('enabled') enabled: unknown,
    @Req() request: Request,
  ): Promise<AiModelView> {
    if (typeof enabled !== 'boolean') {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Trường "enabled" phải là true hoặc false',
      });
    }

    return this.models.setEnabled(id, enabled, clientIp(request));
  }

  @Get(':id/usage')
  async usage(@Param('id') id: string) {
    return this.models.usage(id);
  }

  @Post(':id/verify')
  async verify(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<AiModelView> {
    return this.models.verify(id, clientIp(request));
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<{ removed: boolean }> {
    return this.models.remove(id, clientIp(request));
  }
}
