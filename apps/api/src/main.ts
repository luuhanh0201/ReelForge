import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Cần thiết để RedisModule đóng kết nối gọn gàng khi app tắt.
  app.enableShutdownHooks();

  // Access token và refresh token đi bằng cookie HttpOnly nên phải parse trước mọi guard.
  app.use(cookieParser());

  const config = app.get(ConfigService);
  const webOrigin = config.getOrThrow<string>('webOrigin');

  // `credentials: true` là bắt buộc: thiếu nó trình duyệt sẽ không gửi cookie phiên sang
  // api.reelforge.vn dù hai bên cùng registrable domain.
  app.enableCors({ origin: webOrigin, credentials: true });

  // Sau reverse proxy (Nginx/Caddy ở production), `request.ip` phải là IP thật của khách
  // chứ không phải của proxy — nhật ký kiểm toán và phiên đăng nhập đều ghi giá trị này.
  if (config.getOrThrow<boolean>('isProduction')) {
    app.set('trust proxy', 1);
  }

  await app.listen(config.getOrThrow<number>('port'));
}
await bootstrap();
