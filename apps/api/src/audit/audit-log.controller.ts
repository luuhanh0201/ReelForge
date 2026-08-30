import { Controller, Get, Query } from '@nestjs/common';
import type { AdminAuditLog } from './admin-audit-log.entity.js';
import { AuditLogService } from './audit-log.service.js';

/** Nhật ký kiểm toán cho trang /admin/logs. Chưa gắn auth — xem ghi chú ở AppModule. */
@Controller('admin/audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogs: AuditLogService) {}

  @Get()
  async list(@Query('limit') limit?: string): Promise<{ items: AdminAuditLog[] }> {
    return { items: await this.auditLogs.list(Number(limit) || 200) };
  }
}
