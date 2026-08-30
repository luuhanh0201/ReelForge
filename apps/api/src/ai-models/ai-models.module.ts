import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderCredentialsModule } from '../provider-credentials/provider-credentials.module.js';
import { Voice } from '../voices/voice.entity.js';
import { AiModel } from './ai-model.entity.js';
import { AiModelsController } from './ai-models.controller.js';
import { AiModelsService } from './ai-models.service.js';

@Module({
  // Voice được nạp để kiểm tra ràng buộc trước khi xoá model.
  imports: [TypeOrmModule.forFeature([AiModel, Voice]), ProviderCredentialsModule],
  controllers: [AiModelsController],
  providers: [AiModelsService],
  exports: [AiModelsService],
})
export class AiModelsModule {}
