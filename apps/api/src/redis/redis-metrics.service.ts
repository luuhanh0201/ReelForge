import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { RedisConfig } from '../config/configuration.js';
import { REDIS_CLIENT } from './redis.constants.js';
import { describeTarget } from './redis-connection.js';

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

/** Giới hạn số key quét mỗi lần để không đốt hạn mức ops/s của Redis Cloud. */
const SCAN_LIMIT = 1500;
const SCAN_BATCH = 300;
const SAMPLE_PER_PREFIX = 20;

@Injectable()
export class RedisMetricsService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  private get redisConfig(): RedisConfig {
    return this.config.getOrThrow<RedisConfig>('redis');
  }

  private get keyPrefix(): string {
    return `${this.redisConfig.keyPrefix}:`;
  }

  /** INFO trả về text nhiều section — chuyển thành map để đọc từng chỉ số. */
  private parseInfo(raw: string): Map<string, string> {
    const entries = new Map<string, string>();

    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) continue;

      const separator = trimmed.indexOf(':');
      if (separator === -1) continue;

      entries.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
    }

    return entries;
  }

  private toNumber(value: string | undefined, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  async measureLatency(samples = 1): Promise<number> {
    const results: number[] = [];

    for (let index = 0; index < samples; index += 1) {
      const start = process.hrtime.bigint();
      await this.redis.ping();
      results.push(Number(process.hrtime.bigint() - start) / 1_000_000);
    }

    return results.reduce((sum, value) => sum + value, 0) / results.length;
  }

  async getOverview(): Promise<RedisOverview> {
    const [info, dbSize, latencyMs] = await Promise.all([
      this.redis.info(),
      this.redis.dbsize(),
      this.measureLatency(),
    ]);

    const stats = this.parseInfo(info);
    const hits = this.toNumber(stats.get('keyspace_hits'));
    const misses = this.toNumber(stats.get('keyspace_misses'));
    const maxMemory = this.toNumber(stats.get('maxmemory'));

    return {
      online: true,
      version: stats.get('redis_version') ?? 'unknown',
      host: describeTarget(this.redisConfig),
      uptimeSeconds: this.toNumber(stats.get('uptime_in_seconds')),
      latencyMs: Number(latencyMs.toFixed(2)),
      memoryUsedMb: Number(
        (this.toNumber(stats.get('used_memory')) / 1024 / 1024).toFixed(1),
      ),
      memoryTotalMb:
        maxMemory > 0
          ? Number((maxMemory / 1024 / 1024).toFixed(1))
          : this.redisConfig.planMb,
      fragmentationRatio: Number(
        this.toNumber(stats.get('mem_fragmentation_ratio'), 1).toFixed(2),
      ),
      opsPerSec: this.toNumber(stats.get('instantaneous_ops_per_sec')),
      totalCommands: this.toNumber(stats.get('total_commands_processed')),
      connectedClients: this.toNumber(stats.get('connected_clients')),
      maxClients: this.toNumber(stats.get('maxclients')),
      blockedClients: this.toNumber(stats.get('blocked_clients')),
      totalKeys: dbSize,
      hits,
      misses,
      hitRate: hits + misses > 0 ? Number(((hits / (hits + misses)) * 100).toFixed(1)) : 0,
      evictedKeys: this.toNumber(stats.get('evicted_keys')),
      expiredKeys: this.toNumber(stats.get('expired_keys')),
    };
  }

  /**
   * Quét mẫu keyspace và gộp theo hai đoạn đầu của key.
   * Cố ý giới hạn số key quét: đây là dashboard, không phải công cụ phân tích đầy đủ.
   */
  async getKeyspaceBreakdown(): Promise<KeyspaceSlice[]> {
    const counts = new Map<string, string[]>();
    let cursor = '0';
    let scanned = 0;

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${this.keyPrefix}*`,
        'COUNT',
        SCAN_BATCH,
      );
      cursor = nextCursor;
      scanned += keys.length;

      for (const key of keys) {
        const withoutPrefix = key.slice(this.keyPrefix.length);
        const segments = withoutPrefix.split(':');
        const group = `${segments.slice(0, Math.min(2, segments.length - 1) || 1).join(':')}:*`;

        const bucket = counts.get(group) ?? [];
        if (bucket.length < SAMPLE_PER_PREFIX) bucket.push(key);
        counts.set(group, bucket);
      }
    } while (cursor !== '0' && scanned < SCAN_LIMIT);

    const slices: KeyspaceSlice[] = [];

    for (const [prefix, sampleKeys] of counts) {
      let sampledBytes = 0;

      for (const key of sampleKeys) {
        // MEMORY USAGE nhận key đầy đủ nên phải bỏ keyPrefix mà ioredis tự thêm.
        const usage = await this.redis.memory(
          'USAGE',
          key.slice(this.keyPrefix.length),
        );
        sampledBytes += Number(usage ?? 0);
      }

      const averageBytes = sampleKeys.length > 0 ? sampledBytes / sampleKeys.length : 0;
      slices.push({
        prefix,
        keys: sampleKeys.length,
        estimatedBytes: Math.round(averageBytes * sampleKeys.length),
        percent: 0,
      });
    }

    const totalBytes = slices.reduce((sum, slice) => sum + slice.estimatedBytes, 0);

    return slices
      .map((slice) => ({
        ...slice,
        percent:
          totalBytes > 0 ? Number(((slice.estimatedBytes / totalBytes) * 100).toFixed(1)) : 0,
      }))
      .sort((left, right) => right.estimatedBytes - left.estimatedBytes);
  }
}
