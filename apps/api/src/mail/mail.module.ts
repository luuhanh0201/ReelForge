import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { SecurityMailService } from './security-mail.service.js';

/** Global vì cảnh báo bảo mật được bắn ra từ nhiều module (auth, quản trị người dùng). */
@Global()
@Module({
  providers: [MailService, SecurityMailService],
  exports: [MailService, SecurityMailService],
})
export class MailModule {}
