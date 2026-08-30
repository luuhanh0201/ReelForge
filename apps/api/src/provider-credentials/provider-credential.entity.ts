import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const GOOGLE_TTS_PROVIDER = 'google-tts';

export type CredentialStatus = 'connected' | 'disabled' | 'error';

/**
 * Credential của nhà cung cấp ngoài, lưu dạng đã mã hoá AES-256-GCM.
 * Mỗi provider đúng một bản ghi (provider là unique).
 */
@Entity('provider_credentials')
// Khai báo ở đây để `migration:generate` biết các ràng buộc này tồn tại — nếu không,
// mỗi lần sinh migration TypeORM sẽ tưởng là rác và xoá đi.
@Check('chk_provider_credentials_algorithm', `"algorithm" = 'aes-256-gcm'`)
@Check('chk_provider_credentials_iv_len', 'octet_length("iv") = 12')
@Check('chk_provider_credentials_tag_len', 'octet_length("auth_tag") = 16')
@Check('chk_provider_credentials_key_version', '"encryption_key_version" > 0')
@Check(
  'chk_provider_credentials_status',
  `"status" IN ('connected', 'disabled', 'error')`,
)
export class ProviderCredential {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('uq_provider_credentials_provider', { unique: true })
  @Column({ name: 'provider', type: 'varchar', length: 40 })
  provider!: string;

  @Column({ name: 'encrypted_payload', type: 'bytea' })
  encryptedPayload!: Buffer;

  @Column({ name: 'iv', type: 'bytea' })
  iv!: Buffer;

  @Column({ name: 'auth_tag', type: 'bytea' })
  authTag!: Buffer;

  @Column({ name: 'algorithm', type: 'varchar', length: 20 })
  algorithm!: string;

  @Column({ name: 'encryption_key_version', type: 'smallint' })
  encryptionKeyVersion!: number;

  /** HMAC-SHA256(client_email + private_key_id) — so sánh credential mà không lưu bản rõ. */
  @Column({ name: 'credential_fingerprint', type: 'char', length: 64 })
  credentialFingerprint!: string;

  @Column({ name: 'project_id', type: 'varchar', length: 120 })
  projectId!: string;

  @Column({ name: 'client_email_masked', type: 'varchar', length: 160 })
  clientEmailMasked!: string;

  @Column({ name: 'private_key_id_suffix', type: 'varchar', length: 8 })
  privateKeyIdSuffix!: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'connected' })
  status!: CredentialStatus;

  @Column({ name: 'last_latency_ms', type: 'integer', nullable: true })
  lastLatencyMs!: number | null;

  @Column({ name: 'last_verified_at', type: 'timestamptz', nullable: true })
  lastVerifiedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
