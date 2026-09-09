import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AesGcmEncryptionService } from '../common/security/aes-gcm-encryption.service.js';
import { GoogleTtsCredentialVerifierService } from './google-tts-credential-verifier.service.js';
import { GoogleTtsSynthesisService } from './google-tts-synthesis.service.js';
import { GoogleTtsCredentialProvider } from './google-tts-credential.provider.js';
import { ProviderCredential } from './provider-credential.entity.js';
import { ProviderCredentialsController } from './provider-credentials.controller.js';
import { ProviderCredentialsService } from './provider-credentials.service.js';

/**
 * Module quản lý credential nhà cung cấp ngoài.
 *
 * Trước đây controller chỉ được nạp ngoài production vì hệ thống chưa có xác thực admin.
 * Nay `AuthModule` bảo vệ bằng vai `admin` thật nên controller chạy ở mọi môi trường.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ProviderCredential])],
  controllers: [ProviderCredentialsController],
  providers: [
    ProviderCredentialsService,
    GoogleTtsCredentialVerifierService,
    GoogleTtsSynthesisService,
    GoogleTtsCredentialProvider,
    AesGcmEncryptionService,
  ],
  exports: [
    GoogleTtsCredentialProvider,
    ProviderCredentialsService,
    GoogleTtsCredentialVerifierService,
    GoogleTtsSynthesisService,
  ],
})
export class ProviderCredentialsModule {}
