import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { Tour, TourScope } from '@repo/shared';
import type { AuthenticatedUser } from '../auth/authenticated-user.type.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { AuditLogService } from '../audit/audit-log.service.js';
import type { TourVersion } from './tour.entity.js';
import { ToursService, type TourStats } from './tours.service.js';

/**
 * Quản trị tour.
 *
 * Trả kèm `registry` ở mọi lần đọc: trình soạn phải dựng dropdown neo và hành động từ đúng
 * danh mục mà mã nguồn đang khai báo, chứ không để quản trị viên gõ tay một selector.
 */
@Roles('admin')
@Controller('admin/tours')
export class AdminToursController {
  constructor(
    private readonly tours: ToursService,
    private readonly auditLogs: AuditLogService,
  ) {}

  @Get()
  registry(): { scopes: TourScope[] } {
    return this.tours.registry();
  }

  @Get(':key')
  async detail(@Param('key') key: string): Promise<{
    tour: Tour;
    scopes: TourScope[];
    history: TourVersion[];
    stats: TourStats;
  }> {
    const [tour, history, stats] = await Promise.all([
      this.tours.current(key),
      this.tours.history(key),
      this.tours.stats(key),
    ]);

    return { tour, scopes: this.tours.registry().scopes, history, stats };
  }

  @Put(':key')
  async publish(
    @Param('key') key: string,
    @Body() body: { tour: unknown; note?: string },
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ tour: Tour; broken: { stepId: string; reason: string }[] }> {
    const result = await this.tours.publish(
      key,
      body.tour,
      user.email ?? user.id,
      body.note ?? null,
    );

    await this.auditLogs.record({
      action: 'Xuất bản tour hướng dẫn',
      target: key,
      level: result.broken.length > 0 ? 'warning' : 'info',
      ip: request.ip ?? null,
      metadata: {
        steps: result.tour.steps.length,
        enabled: result.tour.enabled,
        broken: result.broken.length,
      },
    });

    return result;
  }
}
