import { useSyncExternalStore } from "react";
import { AUDIT_LOGS, type AuditLog, type LogLevel } from "@/config/admin/infra.config";
import { ADMIN_BRAND } from "@/config/admin/nav.config";

/**
 * Kho nhật ký kiểm toán dùng chung cho toàn admin.
 * Thao tác quan trọng ở bất kỳ trang nào gọi `recordAudit`, trang Nhật ký hệ thống
 * đọc qua `useAuditLogs` nên bản ghi mới hiện ra ngay mà không cần tải lại trang.
 */
let logs: AuditLog[] = AUDIT_LOGS;
const listeners = new Set<() => void>();

/** IP của phiên quản trị hiện tại — mock, sau này lấy từ request thật. */
const OPERATOR_IP = "203.113.44.18";

const timestamp = () => {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours(),
  )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

export const subscribeToAuditLogs = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

export const getAuditLogs = () => logs;

/** Server render dùng đúng dữ liệu seed để markup ổn định khi hydrate. */
export const getServerAuditLogs = () => AUDIT_LOGS;

export const recordAudit = (entry: {
  action: string;
  target: string;
  level: LogLevel;
  success?: boolean;
}) => {
  logs = [
    {
      id: `log-${Date.now()}`,
      timestamp: timestamp(),
      admin: ADMIN_BRAND.operator.name,
      ip: OPERATOR_IP,
      success: entry.success ?? true,
      action: entry.action,
      target: entry.target,
      level: entry.level,
    },
    ...logs,
  ];

  listeners.forEach((listener) => listener());
};

export const useAuditLogs = () =>
  useSyncExternalStore(subscribeToAuditLogs, getAuditLogs, getServerAuditLogs);
