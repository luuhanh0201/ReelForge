import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AesGcmEncryptionService } from '../common/security/aes-gcm-encryption.service.js';
import { GoogleTtsCredentialVerifierService } from './google-tts-credential-verifier.service.js';
import { GoogleTtsSynthesisService } from './google-tts-synthesis.service.js';
import { GoogleTtsCredentialProvider } from './google-tts-credential.provider.js';
import { LocalOnlyGuard } from './local-only.guard.js';
import { ProviderCredential } from './provider-credential.entity.js';
import { ProviderCredentialsController } from './provider-credentials.controller.js';
import { ProviderCredentialsService } from './provider-credentials.service.js';

/**
 * Module quản lý credential nhà cung cấp ngoài.
 *
 * Module luôn được nạp vì các module khác (ai-models, voices) cần service để xác minh
 * với nhà cung cấp. **Riêng controller chỉ mở ngoài production** vì hệ thống chưa có
 * xác thực admin — `LocalOnlyGuard` chặn thêm lần nữa ở tầng route.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ProviderCredential])],
  controllers:
    process.env.NODE_ENV === 'production' ? [] : [ProviderCredentialsController],
  providers: [
    ProviderCredentialsService,
    GoogleTtsCredentialVerifierService,
    GoogleTtsSynthesisService,
    GoogleTtsCredentialProvider,
    AesGcmEncryptionService,
    LocalOnlyGuard,
  ],
  exports: [
    GoogleTtsCredentialProvider,
    ProviderCredentialsService,
    GoogleTtsCredentialVerifierService,
    GoogleTtsSynthesisService,
  ],
})
export class ProviderCredentialsModule {}
