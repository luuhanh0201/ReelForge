import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditTransaction } from './credit-transaction.entity.js';
import { CreditsService } from './credits.service.js';

/**
 * Global vì nhiều module cần ghi giao dịch credit (đăng ký, render, TTS vượt hạn mức,
 * quản trị) — nhưng tất cả đều phải đi qua `CreditsService`, không ai tự sửa số dư.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CreditTransaction])],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}
