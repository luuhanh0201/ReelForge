import { request } from "./api-client";

export { API_BASE_URL, formatUptime } from "./api-client";

export interface RedisOverview {
  online: boolean;
  version: string;
  host: string;
  uptimeSeconds: number;
  latencyMs: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  fragmentationRatio: number;
  opsPerSec: number;
  totalCommands: number;
  connectedClients: number;
  maxClients: number;
  blockedClients: number;
  totalKeys: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictedKeys: number;
  expiredKeys: number;
}

export interface KeyspaceSlice {
  prefix: string;
  keys: number;
  estimatedBytes: number;
  percent: number;
}

export const fetchRedisOverview = () =>
  request<RedisOverview>("/admin/redis/overview");

export const fetchKeyspace = () =>
  request<{ slices: KeyspaceSlice[] }>("/admin/redis/keyspace");

export const pingRedis = (samples = 5) =>
  request<{ samples: number; averageMs: number }>(
    `/admin/redis/ping?samples=${samples}`,
    { method: "POST" },
  );
