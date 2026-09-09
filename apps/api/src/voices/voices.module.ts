import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModel } from '../ai-models/ai-model.entity.js';
import { ProviderCredentialsModule } from '../provider-credentials/provider-credentials.module.js';
import { VoicePreview } from './voice-preview.entity.js';
import { Voice } from './voice.entity.js';
import { VoiceCatalogController } from './voice-catalog.controller.js';
import { VoicesController } from './voices.controller.js';
import { VoicesService } from './voices.service.js';

@Module({
  // AiModel được nạp để đọc trần ký tự trong cấu hình model.
  imports: [TypeOrmModule.forFeature([Voice, VoicePreview, AiModel]), ProviderCredentialsModule],
  controllers: [VoicesController, VoiceCatalogController],
  providers: [VoicesService],
  exports: [VoicesService],
})
export class VoicesModule {}
