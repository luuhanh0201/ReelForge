import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModel } from '../ai-models/ai-model.entity.js';
import { User } from '../auth/user.entity.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { ProviderCredentialsModule } from '../provider-credentials/provider-credentials.module.js';
import { TtsUsageModule } from '../tts-usage/tts-usage.module.js';
import { Voice } from '../voices/voice.entity.js';
import { ProjectVoiceController } from './project-voice.controller.js';
import { TtsClip } from './tts-clip.entity.js';
import { TtsService } from './tts.service.js';
import { UserTtsQuota } from './user-tts-quota.entity.js';

/**
 * Lồng tiếng cho video.
 *
 * Khác `VoicesModule` (danh mục giọng và bản nghe thử của admin): module này lo phần audio
 * sẽ đi vào file MP4 — cache toàn hệ thống, đo thời lượng thật, hạn mức theo tài khoản.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TtsClip, UserTtsQuota, Voice, AiModel, User]),
    ProviderCredentialsModule,
    TtsUsageModule,
    ProjectsModule,
  ],
  controllers: [ProjectVoiceController],
  providers: [TtsService],
  exports: [TtsService],
})
export class TtsModule {}
