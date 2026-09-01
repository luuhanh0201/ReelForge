import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  LandingConfigController,
  LandingSettingsAdminController,
} from './landing-settings.controller.js';
import { ProviderCredentialsModule } from '../provider-credentials/provider-credentials.module.js';
import { VoicePreview } from '../voices/voice-preview.entity.js';
import { GoogleTranslateService } from './google-translate.service.js';
import { LandingSetting } from './landing-setting.entity.js';
import { LandingSettingsService } from './landing-settings.service.js';

@Module({
  // VoicePreview được nạp để phục vụ audio đã cache cho trang công khai.
  imports: [
    TypeOrmModule.forFeature([LandingSetting, VoicePreview]),
    ProviderCredentialsModule,
  ],
  controllers: [LandingSettingsAdminController, LandingConfigController],
  providers: [LandingSettingsService, GoogleTranslateService],
  exports: [LandingSettingsService],
})
export class LandingSettingsModule {}
