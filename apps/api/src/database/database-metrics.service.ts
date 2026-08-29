import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { DatabaseConfig } from '../config/configuration.js';

export interface DatabaseOverview {
  online: boolean;
  version: string;
  host: string;
  uptimeSeconds: number;
  /** Độ trễ một truy vấn rỗng, tính bằng ms. */
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
  /** Tỷ lệ đọc trúng shared buffer, %. */
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

/** Số bảng và số tiến trình đưa lên dashboard — đây là bảng theo dõi, không phải công cụ phân tích đầy đủ. */
const TABLE_LIMIT = 12;
const ACTIVITY_LIMIT = 50;
const BYTES_PER_GB = 1024 ** 3;

interface OverviewRow {
  version: string;
  uptime_seconds: string;
  connections: string;
  max_connections: string;
  active_connections: string;
  idle_in_transaction: string;
  storage_used_bytes: string;
  longest_query_sec: string;
  longest_idle_tx_sec: string;
  deadlocks: string;
  blocks_hit: string;
  blocks_read: string;
}

interface ActivityRow {
  pid: number;
  application: string;
  username: string | null;
  state: string | null;
  duration_sec: string;
  query: string | null;
  wait_event: string | null;
}

interface TableRow {
  name: string;
  live_rows: string;
  dead_rows: string;
  data_bytes: string;
  index_bytes: string;
  total_bytes: string;
  last_vacuum: Date | null;
}

const toNumber = (value: string | number | null | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toGb = (bytes: string | number): number =>
  Number((toNumber(bytes) / BYTES_PER_GB).toFixed(2));

/** Chuỗi nhận diện node — cắt bỏ user/password trước khi trả về trình duyệt. */
export const describeDatabaseTarget = (url: string): string => {
  try {
    const parsed = new URL(url);
    const port = parsed.port === '' ? '5432' : parsed.port;
    return `${parsed.hostname}:${port}${parsed.pathname}`;
  } catch {
    return 'postgres';
  }
};

@Injectable()
export class DatabaseMetricsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  private get databaseConfig(): DatabaseConfig {
    return this.config.getOrThrow<DatabaseConfig>('database');
  }

  /** Đo độ trễ bằng chính đường kết nối của app, không qua pool riêng. */
  async measureLatency(samples = 1): Promise<number> {
    const results: number[] = [];

    for (let index = 0; index < samples; index += 1) {
      const start = process.hrtime.bigint();
      await this.dataSource.query('SELECT 1');
      results.push(Number(process.hrtime.bigint() - start) / 1_000_000);
    }

    return results.reduce((sum, value) => sum + value, 0) / results.length;
  }

  async getOverview(): Promise<DatabaseOverview> {
    const [rows, latencyMs] = await Promise.all([
      this.dataSource.query<OverviewRow[]>(`
        SELECT
          current_setting('server_version') AS version,
          EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time())) AS uptime_seconds,
          current_setting('max_connections') AS max_connections,
          pg_database_size(current_database()) AS storage_used_bytes,
          (SELECT count(*) FROM pg_stat_activity
            WHERE datname = current_database()) AS connections,
          (SELECT count(*) FROM pg_stat_activity
            WHERE datname = current_database() AND state = 'active') AS active_connections,
          (SELECT count(*) FROM pg_stat_activity
            WHERE datname = current_database()
              AND state IN ('idle in transaction', 'idle in transaction (aborted)')
          ) AS idle_in_transaction,
          (SELECT greatest(coalesce(max(EXTRACT(EPOCH FROM (clock_timestamp() - query_start))), 0), 0)
             FROM pg_stat_activity
            WHERE datname = current_database()
              AND state = 'active'
              AND pid <> pg_backend_pid()) AS longest_query_sec,
          (SELECT greatest(coalesce(max(EXTRACT(EPOCH FROM (clock_timestamp() - state_change))), 0), 0)
             FROM pg_stat_activity
            WHERE datname = current_database()
              AND state IN ('idle in transaction', 'idle in transaction (aborted)')
          ) AS longest_idle_tx_sec,
          (SELECT coalesce(deadlocks, 0) FROM pg_stat_database
            WHERE datname = current_database()) AS deadlocks,
          (SELECT coalesce(blks_hit, 0) FROM pg_stat_database
            WHERE datname = current_database()) AS blocks_hit,
          (SELECT coalesce(blks_read, 0) FROM pg_stat_database
            WHERE datname = current_database()) AS blocks_read
      `),
      this.measureLatency(),
    ]);

    const row = rows[0];
    if (!row) {
      throw new Error('pg_stat_database không trả về dữ liệu cho database hiện tại');
    }

    const hit = toNumber(row.blocks_hit);
    const read = toNumber(row.blocks_read);

    return {
      online: true,
      version: row.version,
      host: describeDatabaseTarget(this.databaseConfig.url),
      uptimeSeconds: Math.round(toNumber(row.uptime_seconds)),
      latencyMs: Number(latencyMs.toFixed(2)),
      connections: toNumber(row.connections),
      maxConnections: toNumber(row.max_connections),
      activeConnections: toNumber(row.active_connections),
      idleInTransaction: toNumber(row.idle_in_transaction),
      storageUsedMb: Number((toNumber(row.storage_used_bytes) / 1024 ** 2).toFixed(1)),
      storageUsedGb: toGb(row.storage_used_bytes),
      storageTotalGb: this.databaseConfig.storageGb,
      longestQuerySec: Number(toNumber(row.longest_query_sec).toFixed(2)),
      longestIdleTxSec: Number(toNumber(row.longest_idle_tx_sec).toFixed(1)),
      deadlocks: toNumber(row.deadlocks),
      cacheHitRate:
        hit + read > 0 ? Number(((hit / (hit + read)) * 100).toFixed(1)) : 0,
    };
  }

  /** Ảnh chụp pg_stat_activity — chỉ các client backend của database hiện tại. */
  async getActivity(): Promise<DatabaseActivityItem[]> {
    const rows = await this.dataSource.query<ActivityRow[]>(
      `
        SELECT
          pid,
          coalesce(nullif(application_name, ''), 'unknown') AS application,
          usename AS username,
          state,
          greatest(
            coalesce(
              EXTRACT(
                EPOCH FROM (clock_timestamp() - coalesce(query_start, xact_start, backend_start))
              ),
              0
            ),
            0
          ) AS duration_sec,
          left(query, 600) AS query,
          wait_event_type AS wait_event
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND backend_type = 'client backend'
          AND pid <> pg_backend_pid()
        ORDER BY duration_sec DESC
        LIMIT $1
      `,
      [ACTIVITY_LIMIT],
    );

    return rows.map((row) => ({
      pid: row.pid,
      application: row.application,
      username: row.username ?? 'unknown',
      state: row.state ?? 'unknown',
      durationSec: Number(toNumber(row.duration_sec).toFixed(2)),
      query: (row.query ?? '').trim() || '—',
      waitEvent: row.wait_event,
    }));
  }

  /** Dung lượng và độ phân mảnh của các bảng lớn nhất. */
  async getTables(): Promise<DatabaseTableItem[]> {
    const rows = await this.dataSource.query<TableRow[]>(
      `
        SELECT
          relname AS name,
          n_live_tup AS live_rows,
          n_dead_tup AS dead_rows,
          pg_table_size(relid) AS data_bytes,
          pg_indexes_size(relid) AS index_bytes,
          pg_total_relation_size(relid) AS total_bytes,
          greatest(last_vacuum, last_autovacuum) AS last_vacuum
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT $1
      `,
      [TABLE_LIMIT],
    );

    return rows.map((row) => {
      const live = toNumber(row.live_rows);
      const dead = toNumber(row.dead_rows);

      return {
        name: row.name,
        liveRows: live,
        deadRows: dead,
        dataGb: toGb(row.data_bytes),
        indexGb: toGb(row.index_bytes),
        totalGb: toGb(row.total_bytes),
        bloatPercent: live + dead > 0 ? Number(((dead / (live + dead)) * 100).toFixed(1)) : 0,
        lastVacuum: row.last_vacuum ? row.last_vacuum.toISOString() : null,
      };
    });
  }

  /**
   * Ngắt một backend đang treo. Chỉ chấp nhận pid thuộc database hiện tại và là
   * client backend — không cho phép đụng vào tiến trình nền của PostgreSQL.
   */
  async terminateBackend(pid: number): Promise<DatabaseActivityItem> {
    const [target] = await this.dataSource.query<ActivityRow[]>(
      `
        SELECT
          pid,
          coalesce(nullif(application_name, ''), 'unknown') AS application,
          usename AS username,
          state,
          greatest(
            coalesce(
              EXTRACT(
                EPOCH FROM (clock_timestamp() - coalesce(query_start, xact_start, backend_start))
              ),
              0
            ),
            0
          ) AS duration_sec,
          left(query, 600) AS query,
          wait_event_type AS wait_event
        FROM pg_stat_activity
        WHERE pid = $1
          AND datname = current_database()
          AND backend_type = 'client backend'
          AND pid <> pg_backend_pid()
      `,
      [pid],
    );

    if (!target) {
      throw new Error(`Không tìm thấy tiến trình client ${pid} trong database hiện tại`);
    }

    await this.dataSource.query('SELECT pg_terminate_backend($1)', [pid]);

    return {
      pid: target.pid,
      application: target.application,
      username: target.username ?? 'unknown',
      state: target.state ?? 'unknown',
      durationSec: Number(toNumber(target.duration_sec).toFixed(2)),
      query: (target.query ?? '').trim() || '—',
      waitEvent: target.wait_event,
    };
  }

  /**
   * Chạy VACUUM ANALYZE cho một bảng. Tên bảng không thể truyền bằng tham số nên
   * phải đối chiếu với pg_stat_user_tables trước, rồi mới ghép định danh đã quote.
   */
  async vacuumTable(table: string): Promise<{ table: string; durationMs: number }> {
    const [target] = await this.dataSource.query<{ schema: string; name: string }[]>(
      `
        SELECT schemaname AS schema, relname AS name
        FROM pg_stat_user_tables
        WHERE relname = $1
      `,
      [table],
    );

    if (!target) {
      throw new Error(`Không tìm thấy bảng "${table}" trong database hiện tại`);
    }

    const identifier = `"${target.schema.replace(/"/g, '""')}"."${target.name.replace(/"/g, '""')}"`;
    const start = process.hrtime.bigint();
    await this.dataSource.query(`VACUUM (ANALYZE) ${identifier}`);

    return {
      table: `${target.schema}.${target.name}`,
      durationMs: Number((Number(process.hrtime.bigint() - start) / 1_000_000).toFixed(1)),
    };
  }
}
