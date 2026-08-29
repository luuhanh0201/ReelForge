import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { BusinessException } from '../common/exceptions/business.exception.js';
import {
  DatabaseMetricsService,
  type DatabaseActivityItem,
  type DatabaseOverview,
  type DatabaseTableItem,
} from './database-metrics.service.js';

const unavailable = (message: string, error: unknown): BusinessException =>
  new BusinessException('SERVICE_UNAVAILABLE', {
    message,
    details: { reason: error instanceof Error ? error.message : String(error) },
    cause: error,
  });

/**
 * Số liệu PostgreSQL thật cho dashboard admin.
 * Chưa gắn auth — phải bọc guard trước khi mở ra môi trường thật, vì ở đây có cả
 * hai thao tác can thiệp trực tiếp vào database (ngắt tiến trình và VACUUM).
 */
@Controller('admin/database')
export class DatabaseController {
  constructor(private readonly metrics: DatabaseMetricsService) {}

  @Get('overview')
  async overview(): Promise<DatabaseOverview> {
    try {
      return await this.metrics.getOverview();
    } catch (error) {
      throw unavailable('Không đọc được số liệu PostgreSQL', error);
    }
  }

  @Get('activity')
  async activity(): Promise<{ items: DatabaseActivityItem[] }> {
    try {
      return { items: await this.metrics.getActivity() };
    } catch (error) {
      throw unavailable('Không đọc được pg_stat_activity', error);
    }
  }

  @Get('tables')
  async tables(): Promise<{ items: DatabaseTableItem[] }> {
    try {
      return { items: await this.metrics.getTables() };
    } catch (error) {
      throw unavailable('Không đọc được dung lượng bảng', error);
    }
  }

  @Post('activity/:pid/terminate')
  async terminate(
    @Param('pid', ParseIntPipe) pid: number,
  ): Promise<{ terminated: DatabaseActivityItem }> {
    try {
      return { terminated: await this.metrics.terminateBackend(pid) };
    } catch (error) {
      throw new BusinessException('BAD_REQUEST', {
        message: `Không ngắt được tiến trình ${pid}`,
        details: { reason: error instanceof Error ? error.message : String(error) },
        cause: error,
      });
    }
  }

  @Post('tables/:table/vacuum')
  async vacuum(
    @Param('table') table: string,
  ): Promise<{ table: string; durationMs: number }> {
    try {
      return await this.metrics.vacuumTable(table);
    } catch (error) {
      throw new BusinessException('BAD_REQUEST', {
        message: `Không chạy được VACUUM cho bảng ${table}`,
        details: { reason: error instanceof Error ? error.message : String(error) },
        cause: error,
      });
    }
  }
}
