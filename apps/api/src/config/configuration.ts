/**
 * Nguồn sự thật cho toàn bộ cấu hình lấy từ biến môi trường.
 * Không đọc process.env rải rác trong code — luôn đi qua ConfigService.
 */
export interface DatabaseConfig {
  url: string;
  /** Chỉ bật ở môi trường dev; production phải dùng migration. */
  synchronize: boolean;
  logging: boolean;
}

export interface RedisConfig {
  url: string;
  /** TTL mặc định của cache, tính bằng ms. */
  ttlMs: number;
  keyPrefix: string;
}

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  database: DatabaseConfig;
  redis: RedisConfig;
}

const required = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(
      `Thiếu biến môi trường bắt buộc: ${key}. Xem apps/api/.env.example`,
    );
  }
  return value;
};

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const configuration = (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  return {
    nodeEnv,
    isProduction,
    port: toNumber(process.env.PORT, 3001),
    database: {
      url: required('DATABASE_URL'),
      synchronize: !isProduction && process.env.DB_SYNCHRONIZE === 'true',
      logging: !isProduction && process.env.DB_LOGGING === 'true',
    },
    redis: {
      url: required('REDIS_URL'),
      ttlMs: toNumber(process.env.CACHE_TTL_MS, 60_000),
      keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'reelforge',
    },
  };
};
