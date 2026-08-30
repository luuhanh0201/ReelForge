import { useSyncExternalStore } from "react";
import { AUDIT_LOGS, type AuditLog, type LogLevel } from "@/config/admin/infra.config";

/**
 * Kho nhật ký kiểm toán dùng chung cho toàn admin.
 *
 * Hai nguồn ghép lại: bản ghi **thật** do backend lưu trong `admin_audit_logs`
 * (nạp qua `hydrateAuditLogs`) và bản ghi tạm phía client từ các trang còn chạy
 * mock (`recordAudit`). Bản ghi client chỉ sống trong phiên làm việc.
 */
let logs: AuditLog[] = AUDIT_LOGS;

/** Tham chiếu cố định: useSyncExternalStore so sánh bằng identity. */
const EMPTY: AuditLog[] = [];
const listeners = new Set<() => void>();

/**
 * Bản ghi phía client không biết danh tính lẫn IP thật — đó là việc của server.
 * Ghi đúng như vậy thay vì bịa tên admin và IP giả.
 */
const CLIENT_ACTOR = "trình duyệt";
const CLIENT_IP = "—";

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

/** Server render luôn ra danh sách rỗng — dữ liệu thật chỉ có sau khi client gọi API. */
export const getServerAuditLogs = () => EMPTY;

/**
 * Thay toàn bộ nhật ký bằng dữ liệu thật từ API, giữ lại các bản ghi client
 * phát sinh trong phiên để thao tác vừa làm không biến mất khỏi màn hình.
 */
export const hydrateAuditLogs = (serverLogs: AuditLog[]) => {
  const clientOnly = logs.filter((log) => log.id.startsWith('log-'));
  logs = [...serverLogs, ...clientOnly].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp),
  );

  listeners.forEach((listener) => listener());
};

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
      admin: CLIENT_ACTOR,
      ip: CLIENT_IP,
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
