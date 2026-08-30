import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditLog, type AuditLevel } from './admin-audit-log.entity.js';

export interface AuditEntry {
  action: string;
  target: string;
  level: AuditLevel;
  success?: boolean;
  actor?: string;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}

/** Chưa có auth: mọi thao tác đều quy về một actor duy nhất. */
export const LOCAL_ACTOR = 'local-admin';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly repository: Repository<AdminAuditLog>,
  ) {}

  /**
   * Ghi nhật ký. Lỗi ghi log không được làm hỏng thao tác nghiệp vụ đang chạy,
   * nên nuốt lỗi ở đây và chỉ log lại phía server.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      // Dựng entity trực tiếp thay vì object literal: cột jsonb không khớp kiểu
      // DeepPartial mà insert() yêu cầu.
      const log = new AdminAuditLog();
      log.actor = entry.actor ?? LOCAL_ACTOR;
      log.ip = entry.ip ?? null;
      log.action = entry.action;
      log.target = entry.target;
      log.level = entry.level;
      log.success = entry.success ?? true;
      log.metadata = entry.metadata ?? null;

      await this.repository.save(log);
    } catch (error) {
      this.logger.error(
        `Không ghi được nhật ký kiểm toán: ${entry.action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async list(limit = 200): Promise<AdminAuditLog[]> {
    return this.repository.find({
      order: { occurredAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }
}
