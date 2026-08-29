import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { DatabaseConfig } from '../config/configuration.js';
import { DatabaseController } from './database.controller.js';
import { DatabaseMetricsService } from './database-metrics.service.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const database = config.getOrThrow<DatabaseConfig>('database');

        return {
          type: 'postgres' as const,
          url: database.url,
          // Postgres cloud (Supabase, Neon...) bắt buộc SSL nhưng dùng CA riêng,
          // nên không xác minh chuỗi chứng chỉ — vẫn mã hoá đường truyền.
          ssl: database.ssl ? { rejectUnauthorized: false } : undefined,
          extra: {
            // Pool mặc định đóng kết nối rỗi sau 10s. Với database ở xa, mỗi lần mở lại
            // phải bắt tay TCP + TLS mất ~390ms, trong khi truy vấn trên kết nối ấm chỉ
            // ~55ms. Giữ 60s để nhịp poll 15s của dashboard và các request thưa không
            // phải trả giá bắt tay.
            idleTimeoutMillis: 60_000,
          },
          // Hiện trong pg_stat_activity để trang admin biết kết nối đến từ đâu.
          applicationName: 'reelforge-api',
          autoLoadEntities: true,
          synchronize: false,
          logging: database.logging,
          migrations: ['dist/migrations/*.js'],
          migrationsTableName: 'reelforge_migrations',
        };
      },
    }),
  ],
  controllers: [DatabaseController],
  providers: [DatabaseMetricsService],
  exports: [DatabaseMetricsService],
})
export class DatabaseModule {}
