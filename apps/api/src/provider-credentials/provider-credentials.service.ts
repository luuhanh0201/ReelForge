import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../audit/audit-log.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { AesGcmEncryptionService } from '../common/security/aes-gcm-encryption.service.js';
import {
  GOOGLE_TTS_PROVIDER,
  ProviderCredential,
  type CredentialStatus,
} from './provider-credential.entity.js';
import {
  maskClientEmail,
  parseGoogleServiceAccount,
  privateKeyIdSuffix,
  type GoogleServiceAccount,
} from './google-service-account.validator.js';
import { GoogleTtsCredentialVerifierService } from './google-tts-credential-verifier.service.js';

/** Thông tin trả về client — đã che, không chứa bất kỳ mẩu bí mật nào. */
export interface CredentialStatusView {
  provider: string;
  configured: boolean;
  projectId: string | null;
  clientEmailMasked: string | null;
  privateKeyIdSuffix: string | null;
  status: CredentialStatus | null;
  latencyMs: number | null;
  lastVerifiedAt: string | null;
  keyVersion: number | null;
}

/** Chặn bấm "Kiểm tra lại" liên tục làm phiền Google. */
const TEST_COOLDOWN_MS = 5000;

@Injectable()
export class ProviderCredentialsService {
  private readonly logger = new Logger(ProviderCredentialsService.name);
  private readonly lastTestAt = new Map<string, number>();

  constructor(
    @InjectRepository(ProviderCredential)
    private readonly repository: Repository<ProviderCredential>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly encryption: AesGcmEncryptionService,
    private readonly verifier: GoogleTtsCredentialVerifierService,
    private readonly auditLogs: AuditLogService,
  ) {}

  /** AAD gắn ciphertext với đúng provider + bản ghi + version khoá. */
  private aad(provider: string, recordId: string, keyVersion: number): string {
    return `${provider}|${recordId}|${keyVersion}`;
  }

  private view(record: ProviderCredential | null): CredentialStatusView {
    if (!record) {
      return {
        provider: GOOGLE_TTS_PROVIDER,
        configured: false,
        projectId: null,
        clientEmailMasked: null,
        privateKeyIdSuffix: null,
        status: null,
        latencyMs: null,
        lastVerifiedAt: null,
        keyVersion: null,
      };
    }

    return {
      provider: record.provider,
      configured: true,
      projectId: record.projectId,
      clientEmailMasked: record.clientEmailMasked,
      privateKeyIdSuffix: record.privateKeyIdSuffix,
      status: record.status,
      latencyMs: record.lastLatencyMs,
      lastVerifiedAt: record.lastVerifiedAt?.toISOString() ?? null,
      keyVersion: record.encryptionKeyVersion,
    };
  }

  private find(provider = GOOGLE_TTS_PROVIDER): Promise<ProviderCredential | null> {
    return this.repository.findOne({ where: { provider } });
  }

  async getStatus(): Promise<CredentialStatusView> {
    return this.view(await this.find());
  }

  /** Giải mã credential đang lưu. Chỉ dùng nội bộ, không bao giờ trả ra controller. */
  async loadAccount(provider = GOOGLE_TTS_PROVIDER): Promise<{
    record: ProviderCredential;
    account: GoogleServiceAccount;
  }> {
    const record = await this.find(provider);

    if (!record) {
      throw new BusinessException('CREDENTIAL_NOT_CONFIGURED');
    }

    const plaintext = this.encryption.decrypt(
      {
        ciphertext: record.encryptedPayload,
        iv: record.iv,
        authTag: record.authTag,
        algorithm: record.algorithm,
        keyVersion: record.encryptionKeyVersion,
      },
      this.aad(record.provider, record.id, record.encryptionKeyVersion),
    );

    return { record, account: JSON.parse(plaintext) as GoogleServiceAccount };
  }

  /**
   * Tải lên hoặc thay thế credential.
   *
   * Thứ tự bắt buộc: validate -> gọi thử Google -> mã hoá -> upsert nguyên tử.
   * Google hỏng ở bước 2 thì không có gì được ghi, credential cũ vẫn chạy.
   */
  async upload(file: Buffer, ip: string | null): Promise<CredentialStatusView> {
    const account = parseGoogleServiceAccount(file);

    let verification: { latencyMs: number; voiceCount: number };
    try {
      verification = await this.verifier.verify(account);
    } catch (error) {
      await this.auditLogs.record({
        action: 'Tải lên credential Google TTS',
        target: `${GOOGLE_TTS_PROVIDER} · ${maskClientEmail(account.client_email)}`,
        level: 'critical',
        success: false,
        ip,
        metadata: {
          reason: error instanceof BusinessException ? error.code : 'UNKNOWN',
        },
      });
      throw error;
    }

    const existing = await this.find();
    const recordId = existing?.id ?? crypto.randomUUID();
    const keyVersion = this.encryption.getActiveVersion();
    const payload = this.encryption.encrypt(
      JSON.stringify(account),
      this.aad(GOOGLE_TTS_PROVIDER, recordId, keyVersion),
    );

    const record = existing ?? new ProviderCredential();
    record.id = recordId;
    record.provider = GOOGLE_TTS_PROVIDER;
    record.encryptedPayload = payload.ciphertext;
    record.iv = payload.iv;
    record.authTag = payload.authTag;
    record.algorithm = payload.algorithm;
    record.encryptionKeyVersion = payload.keyVersion;
    record.credentialFingerprint = this.encryption.fingerprint(
      `${account.client_email}:${account.private_key_id}`,
    );
    record.projectId = account.project_id;
    record.clientEmailMasked = maskClientEmail(account.client_email);
    record.privateKeyIdSuffix = privateKeyIdSuffix(account.private_key_id);
    record.status = 'connected';
    record.lastLatencyMs = verification.latencyMs;
    record.lastVerifiedAt = new Date();

    // Transaction chỉ bọc thao tác ghi — không bao giờ giữ transaction trong lúc chờ Google.
    const saved = await this.dataSource.transaction(async (manager) =>
      manager.getRepository(ProviderCredential).save(record),
    );

    await this.auditLogs.record({
      action: existing
        ? 'Thay thế credential Google TTS'
        : 'Tải lên credential Google TTS',
      target: `${GOOGLE_TTS_PROVIDER} · ${saved.clientEmailMasked}`,
      level: 'critical',
      ip,
      metadata: {
        projectId: saved.projectId,
        fingerprint: saved.credentialFingerprint.slice(0, 12),
        latencyMs: verification.latencyMs,
        voiceCount: verification.voiceCount,
      },
    });

    return this.view(saved);
  }

  /** Kiểm tra lại credential đang lưu, cập nhật trạng thái và latency. */
  async test(ip: string | null): Promise<CredentialStatusView> {
    const last = this.lastTestAt.get(GOOGLE_TTS_PROVIDER) ?? 0;
    if (Date.now() - last < TEST_COOLDOWN_MS) {
      throw new BusinessException('TOO_MANY_REQUESTS', {
        message: 'Vui lòng chờ vài giây trước khi kiểm tra lại',
      });
    }
    this.lastTestAt.set(GOOGLE_TTS_PROVIDER, Date.now());

    const { record, account } = await this.loadAccount();

    try {
      const result = await this.verifier.verify(account);
      record.status = 'connected';
      record.lastLatencyMs = result.latencyMs;
      record.lastVerifiedAt = new Date();
      const saved = await this.repository.save(record);

      await this.auditLogs.record({
        action: 'Kiểm tra credential Google TTS',
        target: `${GOOGLE_TTS_PROVIDER} · ${saved.clientEmailMasked}`,
        level: 'info',
        ip,
        metadata: { latencyMs: result.latencyMs, voiceCount: result.voiceCount },
      });

      return this.view(saved);
    } catch (error) {
      record.status = 'error';
      record.lastVerifiedAt = new Date();
      await this.repository.save(record);

      await this.auditLogs.record({
        action: 'Kiểm tra credential Google TTS',
        target: `${GOOGLE_TTS_PROVIDER} · ${record.clientEmailMasked}`,
        level: 'warning',
        success: false,
        ip,
        metadata: {
          reason: error instanceof BusinessException ? error.code : 'UNKNOWN',
        },
      });

      throw error;
    }
  }

  async setStatus(
    status: Extract<CredentialStatus, 'connected' | 'disabled'>,
    ip: string | null,
  ): Promise<CredentialStatusView> {
    const record = await this.find();
    if (!record) throw new BusinessException('CREDENTIAL_NOT_CONFIGURED');

    record.status = status;
    const saved = await this.repository.save(record);

    await this.auditLogs.record({
      action: status === 'disabled' ? 'Tắt credential Google TTS' : 'Bật credential Google TTS',
      target: `${GOOGLE_TTS_PROVIDER} · ${saved.clientEmailMasked}`,
      level: 'critical',
      ip,
    });

    return this.view(saved);
  }

  async remove(ip: string | null): Promise<{ removed: boolean }> {
    const record = await this.find();
    if (!record) throw new BusinessException('CREDENTIAL_NOT_CONFIGURED');

    await this.repository.delete({ id: record.id });

    await this.auditLogs.record({
      action: 'Xóa credential Google TTS',
      target: `${GOOGLE_TTS_PROVIDER} · ${record.clientEmailMasked}`,
      level: 'critical',
      ip,
      metadata: { fingerprint: record.credentialFingerprint.slice(0, 12) },
    });

    return { removed: true };
  }

  /**
   * Mã hoá lại toàn bộ bản ghi bằng khoá đang active.
   * Chạy sau khi thêm khoá mới vào CREDENTIAL_ENCRYPTION_KEYS và đổi
   * CREDENTIAL_ENCRYPTION_KEY_VERSION; xong xuôi mới được gỡ khoá cũ khỏi env.
   */
  async rotateKey(ip: string | null): Promise<{ rotated: number; skipped: number }> {
    const records = await this.repository.find();
    const activeVersion = this.encryption.getActiveVersion();
    let rotated = 0;
    let skipped = 0;

    for (const record of records) {
      if (record.encryptionKeyVersion === activeVersion) {
        skipped += 1;
        continue;
      }

      const plaintext = this.encryption.decrypt(
        {
          ciphertext: record.encryptedPayload,
          iv: record.iv,
          authTag: record.authTag,
          algorithm: record.algorithm,
          keyVersion: record.encryptionKeyVersion,
        },
        this.aad(record.provider, record.id, record.encryptionKeyVersion),
      );

      const payload = this.encryption.encrypt(
        plaintext,
        this.aad(record.provider, record.id, activeVersion),
      );

      record.encryptedPayload = payload.ciphertext;
      record.iv = payload.iv;
      record.authTag = payload.authTag;
      record.algorithm = payload.algorithm;
      record.encryptionKeyVersion = payload.keyVersion;

      await this.dataSource.transaction(async (manager) =>
        manager.getRepository(ProviderCredential).save(record),
      );
      rotated += 1;
    }

    await this.auditLogs.record({
      action: 'Xoay khóa mã hóa credential',
      target: `key version ${activeVersion}`,
      level: 'critical',
      ip,
      metadata: { rotated, skipped },
    });

    this.logger.log(`Đã mã hoá lại ${rotated} bản ghi sang khoá version ${activeVersion}`);
    return { rotated, skipped };
  }
}
