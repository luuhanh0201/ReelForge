import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AesGcmEncryptionService } from '../common/security/aes-gcm-encryption.service.js';
import { CREDENTIAL_SPECS, type CredentialProviderSpec } from './credential-registry.js';
import { GeminiCredentialProvider } from './gemini-credential.provider.js';
import { GeminiCredentialSpec } from './gemini.credential.js';
import { GoogleTtsCredentialSpec } from './google-tts.credential.js';
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
    GoogleTtsCredentialSpec,
    GeminiCredentialSpec,
    {
      // Danh sách nhà cung cấp. Thêm một nhà cung cấp mới = thêm một spec vào đây.
      provide: CREDENTIAL_SPECS,
      inject: [GoogleTtsCredentialSpec, GeminiCredentialSpec],
      useFactory: (...specs: CredentialProviderSpec[]) => specs,
    },
    GoogleTtsCredentialVerifierService,
    GoogleTtsSynthesisService,
    GoogleTtsCredentialProvider,
    GeminiCredentialProvider,
    AesGcmEncryptionService,
  ],
  exports: [
    GoogleTtsCredentialProvider,
    GeminiCredentialProvider,
    ProviderCredentialsService,
    GoogleTtsCredentialVerifierService,
    GoogleTtsSynthesisService,
  ],
})
export class ProviderCredentialsModule {}
