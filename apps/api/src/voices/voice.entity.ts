import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type VoiceGender = 'female' | 'male';

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
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
