import type { AuditLog, LogLevel } from "@/config/admin/infra.config";
import { request } from "./api-client";

interface ServerAuditLog {
  id: string;
  occurredAt: string;
  actor: string;
  ip: string | null;
  action: string;
  target: string;
  level: LogLevel;
  success: boolean;
}

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  const pad = (value: number) => value.toString().padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/** Nhật ký thật do backend ghi (thao tác credential, ngắt tiến trình, VACUUM...). */
export const fetchAuditLogs = async (limit = 200): Promise<AuditLog[]> => {
  const { items } = await request<{ items: ServerAuditLog[] }>(
    `/admin/audit-logs?limit=${limit}`,
  );

  return items.map((item) => ({
    id: item.id,
    timestamp: formatTimestamp(item.occurredAt),
    admin: item.actor,
    action: item.action,
    target: item.target,
    ip: item.ip ?? "—",
    level: item.level,
    success: item.success,
  }));
};
