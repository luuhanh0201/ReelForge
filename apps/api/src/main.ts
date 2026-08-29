import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  // Cần thiết để RedisModule đóng kết nối gọn gàng khi app tắt.
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  await app.listen(config.getOrThrow<number>('port'));
}
await bootstrap();
