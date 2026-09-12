import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { RenderConfig } from '@repo/shared';
import type { AuthenticatedUser } from '../auth/authenticated-user.type.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RenderConfigService } from './render-config.service.js';
import type { Render } from './render.entity.js';
import { RENDER_COST_CREDITS, RendersService } from './renders.service.js';

const clientIp = (request: Request): string | null => request.ip ?? null;

/**
 * Xuất video.
 *
 * Máy chủ giữ **dữ liệu và chi phí**, máy khách giữ **việc vẽ hình** — đúng ranh giới của
 * tài liệu thiết kế. Vì vậy ở đây không có một dòng nào đụng tới canvas: mở lần xuất, giữ
 * chỗ credit, rồi ghi nhận kết quả trình duyệt báo về.
 */
@Controller('renders')
export class RendersController {
  constructor(
    private readonly renders: RendersService,
    private readonly configs: RenderConfigService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<{ items: Render[] }> {
    return { items: await this.renders.list(user.id) };
  }

  /**
   * Cấu hình để xem trước — **không** trừ credit.
   *
   * Có endpoint riêng để giao diện kiểm tra được dự án đã đủ điều kiện xuất chưa (thiếu
   * ảnh, chưa có cảnh) trước khi người dùng bấm nút và bị trừ tiền.
   */
  @Get('config/:projectId')
  async config(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ config: RenderConfig; cost: number }> {
    return {
      config: await this.configs.build(projectId, user.id),
      cost: RENDER_COST_CREDITS,
    };
  }

  /** Mở một lần xuất: dựng config trên máy chủ và giữ chỗ credit. */
  @Post()
  async start(
    @Body('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ renderId: string; config: RenderConfig; balance: number }> {
    /*
     * Hạt giống mới cho **mỗi lần bấm xuất**, kể cả cùng một dự án.
     *
     * Người dùng đăng 5–15 video mỗi ngày; hai lần xuất cùng một dự án ra hai file giống
     * hệt nhau là tự bóp lượt hiển thị của chính họ. Hạt giống được lưu trong
     * `render_config`, nên khi khách báo lỗi vẫn dựng lại được đúng file đó.
     */
    const config = await this.configs.build(projectId, user.id, randomUUID());

    const { renderId, balance } = await this.renders.start(
      user.id,
      projectId,
      config as unknown as Record<string, unknown>,
      clientIp(request),
    );

    return { renderId, config, balance };
  }

  @Post(':id/complete')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { fileSize?: number; durationMs?: number },
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Render> {
    return this.renders.complete(
      user.id,
      id,
      Number(body.fileSize ?? 0),
      Number(body.durationMs ?? 0),
    );
  }

  /** Trình duyệt báo hỏng hoặc người dùng huỷ — hoàn lại credit đã giữ chỗ. */
  @Post(':id/fail')
  async fail(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ balance: number | null }> {
    return this.renders.fail(
      user.id,
      id,
      reason?.trim() || 'Không rõ nguyên nhân',
      clientIp(request),
    );
  }
}
