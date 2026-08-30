import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Voice } from './voice.entity.js';

/**
 * Audio nghe thử đã tổng hợp, lưu lại để không phải trả tiền cho Google mỗi lần nghe.
 *
 * **Luôn tổng hợp ở tốc độ 1.0x**: tốc độ được áp ở trình duyệt bằng `playbackRate`
 * (kèm `preservesPitch`) nên đổi tốc độ không cần gọi lại. Vì vậy `input_hash` cố ý
 * **không tính tốc độ** — chỉ gồm những thứ không thể chế ra từ file cũ.
 */
@Entity('voice_previews')
export class VoicePreview {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('uq_voice_previews_voice_id', { unique: true })
  @Column({ name: 'voice_id', type: 'uuid' })
  voiceId!: string;

  @ManyToOne(() => Voice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'voice_id' })
  voice!: Voice;

  @Column({ type: 'bytea' })
  audio!: Buffer;

  @Column({ name: 'mime_type', type: 'varchar', length: 40 })
  mimeType!: string;

  /** Số ký tự đã trả tiền cho lần tổng hợp này. */
  @Column({ name: 'char_count', type: 'integer' })
  charCount!: number;

  /** SHA-256 của providerVoiceId + câu thoại + encoding + apiVersion + pitch. */
  @Column({ name: 'input_hash', type: 'char', length: 64 })
  inputHash!: string;

  @Column({ name: 'api_version', type: 'varchar', length: 20 })
  apiVersion!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
