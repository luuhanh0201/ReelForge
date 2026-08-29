import { request } from "./api-client";

export interface DatabaseOverview {
  online: boolean;
  version: string;
  host: string;
  uptimeSeconds: number;
  latencyMs: number;
  connections: number;
  maxConnections: number;
  activeConnections: number;
  idleInTransaction: number;
  storageUsedMb: number;
  storageUsedGb: number;
  storageTotalGb: number;
  longestQuerySec: number;
  longestIdleTxSec: number;
  deadlocks: number;
  cacheHitRate: number;
}

export interface DatabaseActivityItem {
  pid: number;
  application: string;
  username: string;
  state: string;
  durationSec: number;
  query: string;
  waitEvent: string | null;
}

export interface DatabaseTableItem {
  name: string;
  liveRows: number;
  deadRows: number;
  dataGb: number;
  indexGb: number;
  totalGb: number;
  bloatPercent: number;
  lastVacuum: string | null;
}

export const fetchDatabaseOverview = () =>
  request<DatabaseOverview>("/admin/database/overview");

export const fetchDatabaseActivity = () =>
  request<{ items: DatabaseActivityItem[] }>("/admin/database/activity");

export const fetchDatabaseTables = () =>
  request<{ items: DatabaseTableItem[] }>("/admin/database/tables");

export const terminateBackend = (pid: number) =>
  request<{ terminated: DatabaseActivityItem }>(
    `/admin/database/activity/${pid}/terminate`,
    { method: "POST" },
  );

export const vacuumTable = (table: string) =>
  request<{ table: string; durationMs: number }>(
    `/admin/database/tables/${encodeURIComponent(table)}/vacuum`,
    { method: "POST" },
  );
