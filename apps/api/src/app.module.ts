import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AiModelsModule } from './ai-models/ai-models.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AppService } from './app.service.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { configuration } from './config/configuration.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { LandingSettingsModule } from './landing-settings/landing-settings.module.js';
import { ProviderCredentialsModule } from './provider-credentials/provider-credentials.module.js';
import { RedisModule } from './redis/redis.module.js';
import { TtsUsageModule } from './tts-usage/tts-usage.module.js';
import { VoicesModule } from './voices/voices.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      // Dự án cá nhân: dùng thẳng một file .env duy nhất, không tách .env.local.
      envFilePath: '.env',
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuditModule,
    TtsUsageModule,
    AiModelsModule,
    LandingSettingsModule,
    VoicesModule,
    // Module luôn nạp để ai-models/voices xác minh được với nhà cung cấp; riêng các
    // endpoint quản lý credential tự khoá ngoài production (xem ProviderCredentialsModule).
    ProviderCredentialsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Chuẩn hóa mọi lỗi (404, 401, 403, database, business...) về một JSON format.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
