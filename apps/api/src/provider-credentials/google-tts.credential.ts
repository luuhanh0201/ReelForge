import { Injectable } from '@nestjs/common';
import { BusinessException } from '../common/exceptions/business.exception.js';
import {
  maskClientEmail,
  parseGoogleServiceAccount,
  privateKeyIdSuffix,
  type GoogleServiceAccount,
} from './google-service-account.validator.js';
import { GoogleTtsCredentialVerifierService } from './google-tts-credential-verifier.service.js';
import { GOOGLE_TTS_PROVIDER } from './provider-credential.entity.js';
import type {
  CredentialDescription,
  CredentialProviderSpec,
  CredentialVerification,
} from './credential-registry.js';

/** Google Cloud TTS — credential là file service account JSON. */
@Injectable()
export class GoogleTtsCredentialSpec implements CredentialProviderSpec {
  readonly id = GOOGLE_TTS_PROVIDER;
  readonly label = 'Google Cloud TTS';
  readonly type = 'service_account' as const;
  readonly docsUrl = 'https://console.cloud.google.com/iam-admin/serviceaccounts';

  constructor(private readonly verifier: GoogleTtsCredentialVerifierService) {}

  parse(input: { file?: Buffer; value?: string }): GoogleServiceAccount {
    if (!input.file) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Thiếu file service account trong trường "file"',
      });
    }

    return parseGoogleServiceAccount(input.file);
  }

  describe(payload: unknown): CredentialDescription {
    const account = payload as GoogleServiceAccount;
    const masked = maskClientEmail(account.client_email);

    return {
      projectId: account.project_id,
      clientEmailMasked: masked,
      privateKeyIdSuffix: privateKeyIdSuffix(account.private_key_id),
      displayHint: masked,
      fingerprintSource: `${account.client_email}:${account.private_key_id}`,
    };
  }

  async verify(payload: unknown): Promise<CredentialVerification> {
    const result = await this.verifier.verify(payload as GoogleServiceAccount);

    return {
      latencyMs: result.latencyMs,
      metadata: { voiceCount: result.voiceCount },
    };
  }
}
