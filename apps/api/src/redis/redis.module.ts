import KeyvRedis from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import Keyv from 'keyv';
import type { RedisConfig } from '../config/configuration.js';
import { REDIS_CLIENT } from './redis.constants.js';

/**
 * Cung cấp hai thứ dùng chung toàn app:
 * - `REDIS_CLIENT`: client ioredis cho các nhu cầu thao tác trực tiếp.
 * - `CacheModule`: cache layer của Nest, lưu qua Keyv trên chính Redis đó.
 */
@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.getOrThrow<RedisConfig>('redis');

        return {
          stores: [
            new Keyv({
              store: new KeyvRedis(redis.url),
              namespace: redis.keyPrefix,
            }),
          ],
          ttl: redis.ttlMs,
        };
      },
    }),
  ],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.getOrThrow<RedisConfig>('redis');
        const logger = new Logger('Redis');

        const client = new Redis(redis.url, {
          keyPrefix: `${redis.keyPrefix}:`,
          lazyConnect: false,
        });

        client.on('ready', () => logger.log('Redis đã sẵn sàng'));
        client.on('error', (error: Error) => logger.error(error.message));

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT, CacheModule],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  /** Đóng kết nối khi app tắt (cần app.enableShutdownHooks()). */
  async onApplicationShutdown(): Promise<void> {
    await this.client.quit();
  }
}
