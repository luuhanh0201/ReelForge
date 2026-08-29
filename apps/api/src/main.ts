import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cần thiết để RedisModule đóng kết nối gọn gàng khi app tắt.
  app.enableShutdownHooks();

  // Admin dashboard ở apps/web gọi thẳng sang API này khi chạy local.
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });

  const config = app.get(ConfigService);
  await app.listen(config.getOrThrow<number>('port'));
}
await bootstrap();
