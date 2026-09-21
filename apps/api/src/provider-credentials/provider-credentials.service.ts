import { Inject, Injectable, Logger } from '@nestjs/common';
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
import type { GoogleServiceAccount } from './google-service-account.validator.js';
import {
  CREDENTIAL_SPECS,
  type CredentialProviderSpec,
  type CredentialType,
} from './credential-registry.js';

/** Thông tin trả về client — đã che, không chứa bất kỳ mẩu bí mật nào. */
export interface CredentialStatusView {
  provider: string;
  label: string;
  type: CredentialType;
  docsUrl: string;
  configured: boolean;
  displayHint: string | null;
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

  private readonly specs: Map<string, CredentialProviderSpec>;

  constructor(
    @InjectRepository(ProviderCredential)
    private readonly repository: Repository<ProviderCredential>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly encryption: AesGcmEncryptionService,
    @Inject(CREDENTIAL_SPECS) specs: CredentialProviderSpec[],
    private readonly auditLogs: AuditLogService,
  ) {
    this.specs = new Map(specs.map((spec) => [spec.id, spec]));
  }

  /** Danh mục nhà cung cấp để giao diện dựng form và biết chỗ lấy credential. */
  listProviders(): CredentialProviderSpec[] {
    return [...this.specs.values()];
  }

  private spec(provider: string): CredentialProviderSpec {
    const spec = this.specs.get(provider);

    if (!spec) {
      throw new BusinessException('NOT_FOUND', {
        message: 'Không có nhà cung cấp nào mang mã này',
      });
    }

    return spec;
  }

  /** AAD gắn ciphertext với đúng provider + bản ghi + version khoá. */
  private aad(provider: string, recordId: string, keyVersion: number): string {
    return `${provider}|${recordId}|${keyVersion}`;
  }

  private view(
    spec: CredentialProviderSpec,
    record: ProviderCredential | null,
  ): CredentialStatusView {
    const base = {
      provider: spec.id,
      label: spec.label,
      type: spec.type,
      docsUrl: spec.docsUrl,
    };

    if (!record) {
      return {
        ...base,
        configured: false,
        displayHint: null,
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
      ...base,
      configured: true,
      displayHint: record.displayHint || record.clientEmailMasked,
      projectId: record.projectId,
      clientEmailMasked: record.clientEmailMasked,
      privateKeyIdSuffix: record.privateKeyIdSuffix,
      status: record.status,
      latencyMs: record.lastLatencyMs,
      lastVerifiedAt: record.lastVerifiedAt?.toISOString() ?? null,
      keyVersion: record.encryptionKeyVersion,
    };
  }

  private find(provider: string): Promise<ProviderCredential | null> {
    return this.repository.findOne({ where: { provider } });
  }

  async getStatus(provider = GOOGLE_TTS_PROVIDER): Promise<CredentialStatusView> {
    const spec = this.spec(provider);

    return this.view(spec, await this.find(provider));
  }

  /** Tất cả nhà cung cấp kèm trạng thái, cho trang quản lý khoá. */
  async listStatuses(): Promise<CredentialStatusView[]> {
    const records = await this.repository.find();

    return this.listProviders().map((spec) =>
      this.view(spec, records.find((record) => record.provider === spec.id) ?? null),
    );
  }

  /** Giải mã credential đang lưu. Chỉ dùng nội bộ, không bao giờ trả ra controller. */
  async loadPayload(provider = GOOGLE_TTS_PROVIDER): Promise<{
    record: ProviderCredential;
    payload: unknown;
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

    // Service account lưu nguyên JSON; api key lưu chính chuỗi khoá.
    return {
      record,
      payload: record.credentialType === 'api_key' ? plaintext : JSON.parse(plaintext),
    };
  }

  /**
   * Credential Google TTS dưới dạng service account.
   *
   * Giữ lại tên cũ vì `GoogleTtsCredentialProvider` và bộ tổng hợp giọng đang gọi nó, và
   * chúng chỉ quan tâm đúng một nhà cung cấp.
   */
  async loadAccount(provider = GOOGLE_TTS_PROVIDER): Promise<{
    record: ProviderCredential;
    account: GoogleServiceAccount;
  }> {
    const { record, payload } = await this.loadPayload(provider);

    return { record, account: payload as GoogleServiceAccount };
  }

  /**
   * Tải lên hoặc thay thế credential.
   *
   * Thứ tự bắt buộc: validate -> gọi thử nhà cung cấp -> mã hoá -> upsert nguyên tử.
   * Nhà cung cấp hỏng ở bước 2 thì không có gì được ghi, credential cũ vẫn chạy.
   */
  async upload(
    provider: string,
    input: { file?: Buffer; value?: string },
    ip: string | null,
  ): Promise<CredentialStatusView> {
    const spec = this.spec(provider);
    const payload = spec.parse(input);
    const described = spec.describe(payload);

    let verification: { latencyMs: number; metadata: Record<string, unknown> };
    try {
      verification = await spec.verify(payload);
    } catch (error) {
      await this.auditLogs.record({
        action: `Tải lên credential ${spec.label}`,
        target: `${spec.id} · ${described.displayHint}`,
        level: 'critical',
        success: false,
        ip,
        metadata: {
          reason: error instanceof BusinessException ? error.code : 'UNKNOWN',
        },
      });
      throw error;
    }

    const existing = await this.find(spec.id);
    const recordId = existing?.id ?? crypto.randomUUID();
    const keyVersion = this.encryption.getActiveVersion();
    const encrypted = this.encryption.encrypt(
      typeof payload === 'string' ? payload : JSON.stringify(payload),
      this.aad(spec.id, recordId, keyVersion),
    );

    const record = existing ?? new ProviderCredential();
    record.id = recordId;
    record.provider = spec.id;
    record.credentialType = spec.type;
    record.encryptedPayload = encrypted.ciphertext;
    record.iv = encrypted.iv;
    record.authTag = encrypted.authTag;
    record.algorithm = encrypted.algorithm;
    record.encryptionKeyVersion = encrypted.keyVersion;
    record.credentialFingerprint = this.encryption.fingerprint(described.fingerprintSource);
    record.projectId = described.projectId;
    record.clientEmailMasked = described.clientEmailMasked;
    record.privateKeyIdSuffix = described.privateKeyIdSuffix;
    record.displayHint = described.displayHint;
    record.status = 'connected';
    record.lastLatencyMs = verification.latencyMs;
    record.lastVerifiedAt = new Date();

    // Transaction chỉ bọc thao tác ghi — không bao giờ giữ transaction trong lúc chờ mạng.
    const saved = await this.dataSource.transaction(async (manager) =>
      manager.getRepository(ProviderCredential).save(record),
    );

    await this.auditLogs.record({
      action: existing
        ? `Thay thế credential ${spec.label}`
        : `Tải lên credential ${spec.label}`,
      target: `${spec.id} · ${saved.displayHint}`,
      level: 'critical',
      ip,
      metadata: {
        projectId: saved.projectId,
        fingerprint: saved.credentialFingerprint.slice(0, 12),
        latencyMs: verification.latencyMs,
        ...verification.metadata,
      },
    });

    return this.view(spec, saved);
  }

  /** Kiểm tra lại credential đang lưu, cập nhật trạng thái và latency. */
  async test(provider: string, ip: string | null): Promise<CredentialStatusView> {
    const spec = this.spec(provider);
    const last = this.lastTestAt.get(spec.id) ?? 0;

    if (Date.now() - last < TEST_COOLDOWN_MS) {
      throw new BusinessException('TOO_MANY_REQUESTS', {
        message: 'Vui lòng chờ vài giây trước khi kiểm tra lại',
      });
    }
    this.lastTestAt.set(spec.id, Date.now());

    const { record, payload } = await this.loadPayload(spec.id);

    try {
      const result = await spec.verify(payload);
      record.status = 'connected';
      record.lastLatencyMs = result.latencyMs;
      record.lastVerifiedAt = new Date();
      const saved = await this.repository.save(record);

      await this.auditLogs.record({
        action: `Kiểm tra credential ${spec.label}`,
        target: `${spec.id} · ${saved.displayHint}`,
        level: 'info',
        ip,
        metadata: { latencyMs: result.latencyMs, ...result.metadata },
      });

      return this.view(spec, saved);
    } catch (error) {
      record.status = 'error';
      record.lastVerifiedAt = new Date();
      await this.repository.save(record);

      await this.auditLogs.record({
        action: `Kiểm tra credential ${spec.label}`,
        target: `${spec.id} · ${record.displayHint}`,
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
    provider: string,
    status: Extract<CredentialStatus, 'connected' | 'disabled'>,
    ip: string | null,
  ): Promise<CredentialStatusView> {
    const spec = this.spec(provider);
    const record = await this.find(spec.id);
    if (!record) throw new BusinessException('CREDENTIAL_NOT_CONFIGURED');

    record.status = status;
    const saved = await this.repository.save(record);

    await this.auditLogs.record({
      action:
        status === 'disabled'
          ? `Tắt credential ${spec.label}`
          : `Bật credential ${spec.label}`,
      target: `${spec.id} · ${saved.displayHint}`,
      level: 'critical',
      ip,
    });

    return this.view(spec, saved);
  }

  async remove(provider: string, ip: string | null): Promise<{ removed: boolean }> {
    const spec = this.spec(provider);
    const record = await this.find(spec.id);
    if (!record) throw new BusinessException('CREDENTIAL_NOT_CONFIGURED');

    await this.repository.delete({ id: record.id });

    await this.auditLogs.record({
      action: `Xóa credential ${spec.label}`,
      target: `${spec.id} · ${record.displayHint}`,
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
