import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { auditContext } from './audit-context.js';
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

/**
 * Dùng khi request không có người dùng đăng nhập (tác vụ nền, endpoint công khai).
 * Thao tác của người thật luôn lấy được email từ `auditContext`.
 */
export const SYSTEM_ACTOR = 'system';

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
      // Lời gọi nào truyền actor/ip tường minh thì tôn trọng; còn lại lấy từ ngữ cảnh
      // request để 25 chỗ ghi nhật ký rải rác không phải tự luồn thông tin người dùng.
      const context = auditContext.getStore();

      const log = new AdminAuditLog();
      log.actor = entry.actor ?? context?.email ?? SYSTEM_ACTOR;
      log.ip = entry.ip ?? context?.ip ?? null;
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
