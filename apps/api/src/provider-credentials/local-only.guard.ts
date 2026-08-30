import { CanActivate, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException } from '../common/exceptions/business.exception.js';

/**
 * Lớp chặn thứ hai cho các endpoint quản lý credential.
 *
 * `AppModule` đã không đăng ký module này ở production, nhưng guard vẫn kiểm tra lại
 * để nếu ai đó lỡ bật lại module thì endpoint vẫn đóng. Thay guard này bằng
 * AdminAuthGuard khi hệ thống có đăng nhập thật.
 */
@Injectable()
export class LocalOnlyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    if (this.config.get<boolean>('isProduction')) {
      throw new BusinessException('FORBIDDEN', {
        message:
          'Quản lý credential chưa mở ở production vì hệ thống chưa có xác thực admin',
      });
    }

    return true;
  }
}
