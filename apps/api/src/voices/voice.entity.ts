import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type VoiceGender = 'female' | 'male';

/** Câu mặc định khi thêm giọng — đủ ngắn để nghe thử gần như không tốn tiền. */
export const DEFAULT_SAMPLE_TEXT =
  'Xin chào, đây là giọng đọc thử của ReelForge. Sản phẩm đang giảm giá năm mươi phần trăm.';

@Entity('voices')
export class Voice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column({ name: 'persona_name', length: 120 })
  personaName!: string;
  @Column({ name: 'origin_name', length: 120 })
  originName!: string;
  @Index('uq_voices_provider_voice_id', { unique: true })
  @Column({ name: 'provider_voice_id', length: 160 })
  providerVoiceId!: string;
  @Column({ name: 'model_id', length: 60 })
  modelId!: string;
  @Column({ type: 'varchar', length: 10 })
  gender!: VoiceGender;
  @Column({ length: 60 })
  region!: string;
  @Column({ type: 'numeric', precision: 3, scale: 2, default: 1 })
  speed!: string;
  @Column({ name: 'usage_count', type: 'integer', default: 0 })
  usageCount!: number;
  @Column({ name: 'supports_timepoints', type: 'boolean', default: false })
  supportsTimepoints!: boolean;
  @Column({
    name: 'cost_per_million_usd',
    type: 'numeric',
    precision: 8,
    scale: 2,
    default: 0,
  })
  costPerMillionUsd!: string;
  @Column({ name: 'duration_sec', type: 'integer', default: 0 })
  durationSec!: number;
  @Index('idx_voices_enabled')
  @Column({ type: 'boolean', default: false })
  enabled!: boolean;
  /** Câu thoại ngắn dùng để nghe thử giọng này. */
  @Column({
    name: 'sample_text',
    type: 'varchar',
    length: 300,
    default: DEFAULT_SAMPLE_TEXT,
  })
  sampleText!: string;

  /** Lần cuối xác nhận provider_voice_id này có thật bên nhà cung cấp. */
  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column({ name: 'verification_note', type: 'varchar', length: 200, nullable: true })
  verificationNote!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
