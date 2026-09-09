import { Controller, Get, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { Public } from '../auth/public.decorator.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

type DependencyStatus = 'up' | 'down';

interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  dependencies: Record<'database' | 'redis', DependencyStatus>;
}

/** Công khai: monitoring và load balancer phải gọi được mà không cần token. */
@Public()
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([
      this.ping(() => this.dataSource.query('SELECT 1')),
      this.ping(() => this.redis.ping()),
    ]);

    if (database === 'down' || redis === 'down') {
      throw new BusinessException('SERVICE_UNAVAILABLE', {
        details: { database, redis },
      });
    }

    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      dependencies: { database, redis },
    };
  }

  private async ping(probe: () => Promise<unknown>): Promise<DependencyStatus> {
    try {
      await probe();
      return 'up';
    } catch {
      return 'down';
    }
  }
}
