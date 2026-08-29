import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { DatabaseConfig } from '../config/configuration.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const database = config.getOrThrow<DatabaseConfig>('database');

        return {
          type: 'postgres' as const,
          url: database.url,
          // Entity của từng feature module tự đăng ký qua TypeOrmModule.forFeature.
          autoLoadEntities: true,
          synchronize: database.synchronize,
          logging: database.logging,
          migrations: ['dist/migrations/*.js'],
          migrationsTableName: 'reelforge_migrations',
        };
      },
    }),
  ],
})
export class DatabaseModule {}
