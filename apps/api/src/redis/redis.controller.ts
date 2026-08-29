import { Controller, Get, Post, Query } from '@nestjs/common';
import { BusinessException } from '../common/exceptions/business.exception.js';
import {
  RedisMetricsService,
  type KeyspaceSlice,
  type RedisOverview,
} from './redis-metrics.service.js';

/**
 * Số liệu Redis thật cho dashboard admin.
 * Chưa gắn auth — phải bọc guard trước khi mở ra môi trường thật.
 */
@Controller('admin/redis')
export class RedisController {
  constructor(private readonly metrics: RedisMetricsService) {}

  @Get('overview')
  async overview(): Promise<RedisOverview> {
    try {
      return await this.metrics.getOverview();
    } catch (error) {
      throw new BusinessException('SERVICE_UNAVAILABLE', {
        message: 'Không đọc được số liệu Redis',
        details: { reason: error instanceof Error ? error.message : String(error) },
        cause: error,
      });
    }
  }

  @Get('keyspace')
  async keyspace(): Promise<{ slices: KeyspaceSlice[] }> {
    return { slices: await this.metrics.getKeyspaceBreakdown() };
  }

  @Post('ping')
  async ping(@Query('samples') samples?: string): Promise<{
    samples: number;
    averageMs: number;
  }> {
    const count = Math.min(Math.max(Number(samples) || 5, 1), 10);
    const averageMs = await this.metrics.measureLatency(count);

    return { samples: count, averageMs: Number(averageMs.toFixed(2)) };
  }
}
