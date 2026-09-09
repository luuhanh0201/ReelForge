import { Global, Module } from '@nestjs/common';
import { AccountMailService } from './account-mail.service.js';
import { MailService } from './mail.service.js';
import { SecurityMailService } from './security-mail.service.js';

/** Global vì cảnh báo bảo mật được bắn ra từ nhiều module (auth, quản trị người dùng). */
@Global()
@Module({
  providers: [MailService, SecurityMailService, AccountMailService],
  exports: [MailService, SecurityMailService, AccountMailService],
})
export class MailModule {}
