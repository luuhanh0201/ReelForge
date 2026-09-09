import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AiModelsModule } from './ai-models/ai-models.module.js';
import { AuditContextInterceptor } from './audit/audit-context.interceptor.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { OriginGuard } from './auth/origin.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { AppService } from './app.service.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { configuration } from './config/configuration.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { LandingSettingsModule } from './landing-settings/landing-settings.module.js';
import { MailModule } from './mail/mail.module.js';
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
    MailModule,
    AuthModule,
    HealthModule,
    AuditModule,
    TtsUsageModule,
    AiModelsModule,
    LandingSettingsModule,
    VoicesModule,
    // Nạp ở mọi môi trường: các endpoint quản lý credential nay do AuthModule bảo vệ
    // bằng vai admin thật, không còn phải tự khoá ngoài production nữa.
    ProviderCredentialsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Chuẩn hóa mọi lỗi (404, 401, 403, database, business...) về một JSON format.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Thứ tự có ý nghĩa: chặn nguồn gửi request, rồi xác thực, rồi mới xét vai.
    // Mặc định MỌI route đều yêu cầu đăng nhập — endpoint công khai phải tự đánh dấu
    // `@Public()`, để quên thì route bị khoá chứ không lộ ra ngoài.
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Chạy sau guard nên đã biết ai đăng nhập: nhật ký kiểm toán ghi đúng người thao tác.
    { provide: APP_INTERCEPTOR, useClass: AuditContextInterceptor },
  ],
})
export class AppModule {}
