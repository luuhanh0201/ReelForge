import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TtsUsage } from './tts-usage.entity.js';
import { TtsUsageService } from './tts-usage.service.js';

/** Global vì cả voices lẫn ai-models đều cần đọc số liệu sử dụng. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([TtsUsage])],
  providers: [TtsUsageService],
  exports: [TtsUsageService],
})
export class TtsUsageModule {}
