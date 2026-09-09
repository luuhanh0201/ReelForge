import { AsyncLocalStorage } from 'node:async_hooks';

/** Ai đang thực hiện request hiện tại. */
export interface AuditActor {
  email: string;
  ip: string | null;
}

/**
 * Ngữ cảnh người thao tác cho nhật ký kiểm toán.
 *
 * Có 25 chỗ ghi nhật ký nằm rải trong 5 service. Thay vì luồn `actor` qua từng chữ ký
 * hàm — làm phình toàn bộ tầng service chỉ để phục vụ việc ghi log — request hiện tại
 * được giữ trong `AsyncLocalStorage` và `AuditLogService` tự đọc ra.
 */
export const auditContext = new AsyncLocalStorage<AuditActor>();
