import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ModelKind = 'video' | 'voice' | 'script';

export type ModelBadge =
  | 'Default Primary'
  | 'Fallback Tier-1'
  | 'Fallback Tier-2'
  | 'Enterprise Only'
  | 'Experimental';

/**
 * Model AI của nhà cung cấp ngoài, dùng chung cho ba trang video / voice / script.
 *
 * Khoá chính cố ý là **slug do người dùng đọc được** (`google-chirp3`) chứ không phải
 * uuid: bảng `voices.model_id` tham chiếu tới nó và giao diện cũng hiển thị slug này.
 */
@Entity('ai_models')
@Check('chk_ai_models_kind', `"kind" IN ('video', 'voice', 'script')`)
@Check(
  'chk_ai_models_badge',
  `"badge" IN ('Default Primary', 'Fallback Tier-1', 'Fallback Tier-2', 'Enterprise Only', 'Experimental')`,
)
@Check(
  'chk_ai_models_cost_unit',
  `"cost_unit" IN ('per_million_chars', 'per_second', 'per_million_input_tokens', 'contract')`,
)
@Check('chk_ai_models_cost_amount', '"cost_amount" >= 0')
export class AiModel {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  id!: string;

  @Index('idx_ai_models_kind')
  @Column({ type: 'varchar', length: 10 })
  kind!: ModelKind;

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 80 })
  vendor!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'varchar', length: 40 })
  badge!: ModelBadge;

  /** Chuỗi mô tả có đơn vị riêng theo loại model, ví dụ "~1,2s / cảnh". */
  @Column({ length: 60 })
  latency!: string;

  @Column({ length: 120 })
  capability!: string;

  /**
   * Cấu hình kỹ thuật, **schema khác nhau theo `kind`** — xem `model-config.schema.ts`.
   * Để jsonb thay vì cột phẳng vì ba loại model không dùng chung tham số nào:
   * voice cần apiVersion/maxCharsPerRequest, video cần resolution/fps, script cần
   * maxTokens/temperature.
   */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  config!: Record<string, unknown>;

  /** Đơn giá cho một đơn vị tính; bỏ qua khi `cost_unit = contract`. */
  @Column({ name: 'cost_amount', type: 'numeric', precision: 12, scale: 4, default: 0 })
  costAmount!: string;

  @Column({ name: 'cost_unit', type: 'varchar', length: 32, default: 'contract' })
  costUnit!: string;

  /** Số đơn vị cơ sở miễn phí mỗi tháng (ký tự / giây / token). */
  @Column({
    name: 'free_tier_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  freeTierAmount!: string | null;

  /**
   * Nhà cung cấp credential dùng để gọi model này (`provider_credentials.provider`).
   * Null nghĩa là chưa có luồng xác minh — model chỉ là khai báo suông.
   */
  @Column({ name: 'credential_provider', type: 'varchar', length: 40, nullable: true })
  credentialProvider!: string | null;

  /** Lần cuối gọi thật sang nhà cung cấp và được chấp nhận. */
  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  /** Tóm tắt kết quả xác minh, ví dụ "Google trả về 40 giọng vi-VN". */
  @Column({ name: 'verification_note', type: 'varchar', length: 200, nullable: true })
  verificationNote!: string | null;

  @Column({ name: 'last_latency_ms', type: 'integer', nullable: true })
  lastLatencyMs!: number | null;

  /** Model chưa mở — giao diện hiển thị nhưng khoá mọi thao tác. */
  @Column({ name: 'coming_soon', type: 'boolean', default: false })
  comingSoon!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
