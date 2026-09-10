import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../auth/user.entity.js';
import { Project } from '../projects/project.entity.js';

export type RenderStatus = 'running' | 'done' | 'failed';

/**
 * Một lần xuất video.
 *
 * Việc dựng hình chạy trên **máy khách**, nên máy chủ không tự biết lần xuất có thành công
 * hay không — nó chỉ biết những gì trình duyệt báo về. Vì vậy mỗi lần xuất là một dòng có
 * trạng thái: credit trừ lúc bắt đầu, hoàn lại khi thất bại. Không có bảng này thì một tab
 * đóng giữa chừng sẽ để lại một khoản trừ mà không ai giải thích được.
 *
 * `render_config` là **ảnh chụp đầy đủ** cấu hình đã dùng: người dùng báo lỗi thì dựng lại
 * được đúng video đó, kể cả khi họ đã sửa dự án sau đấy.
 */
@Entity('renders')
@Index('idx_renders_user_recent', ['userId', 'createdAt'])
export class Render {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status!: RenderStatus;

  @Column({ name: 'render_config', type: 'jsonb' })
  renderConfig!: Record<string, unknown>;

  /** Số credit đã trừ cho lần này; 0 sau khi đã hoàn lại. */
  @Column({ name: 'credits_charged', type: 'integer', default: 0 })
  creditsCharged!: number;

  @Column({ name: 'duration_ms', type: 'integer', default: 0 })
  durationMs!: number;

  /** Dung lượng file người dùng nhận được, để đối chiếu khi họ báo file hỏng. */
  @Column({ name: 'file_size', type: 'integer', default: 0 })
  fileSize!: number;

  @Column({ name: 'failure_reason', type: 'varchar', length: 500, nullable: true })
  failureReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
