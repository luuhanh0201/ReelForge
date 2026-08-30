import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Số ký tự đã gửi sang nhà cung cấp TTS, cộng dồn theo ngày.
 *
 * Google **không có API trả về "còn bao nhiêu ký tự miễn phí tháng này"** — hạn mức miễn
 * phí là khái niệm của hoá đơn. Nên hệ thống tự đếm: mỗi lần tổng hợp giọng đều biết
 * chính xác số ký tự đã gửi. Cộng theo ngày để tính được cả trần ngày lẫn trần tháng.
 */
@Entity('tts_usage')
@Index('uq_tts_usage_day_model_voice', ['day', 'modelId', 'voiceId'], { unique: true })
export class TtsUsage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_tts_usage_day')
  @Column({ type: 'date' })
  day!: string;

  @Column({ name: 'model_id', type: 'varchar', length: 60 })
  modelId!: string;

  /**
   * Luôn có giá trị: PostgreSQL coi mỗi NULL là khác nhau trong unique index, để
   * nullable thì `ON CONFLICT` không khớp và mỗi lần gọi lại sinh một dòng mới.
   */
  @Column({ name: 'voice_id', type: 'uuid' })
  voiceId!: string;

  @Column({ type: 'integer', default: 0 })
  chars!: number;

  @Column({ type: 'integer', default: 0 })
  requests!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
