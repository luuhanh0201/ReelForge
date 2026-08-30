/**
 * Nguồn sự thật cho toàn bộ cấu hình lấy từ biến môi trường.
 * Không đọc process.env rải rác trong code — luôn đi qua ConfigService.
 */
export interface DatabaseConfig {
  /** Chuỗi kết nối đã dựng sẵn — dùng chung cho app lẫn TypeORM CLI. */
  url: string;
  /** Bật SSL (bắt buộc với Supabase, Neon và hầu hết Postgres cloud). */
  ssl: boolean;
  logging: boolean;
  /** Dung lượng ổ đĩa/gói (GB) — PostgreSQL không tự biết trần lưu trữ của máy chủ. */
  storageGb: number;
}

export interface RedisConfig {
  /** Dùng REDIS_URL nếu có, không thì ghép từ host/port/username/password. */
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  tls: boolean;
  /** Dung lượng gói (MB) — Redis Cloud không trả maxmemory qua INFO. */
  planMb: number;
  /** TTL mặc định của cache, tính bằng ms. */
  ttlMs: number;
  keyPrefix: string;
}

export interface CredentialsConfig {
  /** Khoá mã hoá theo version — giữ nhiều version cùng lúc để xoay khoá được. */
  keys: Record<number, string>;
  /** Version dùng để mã hoá bản ghi mới. */
  activeVersion: number;
}

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  database: DatabaseConfig;
  redis: RedisConfig;
  credentials: CredentialsConfig;
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

/**
 * PostgreSQL chấp nhận hai kiểu khai báo, giống Redis:
 * một DATABASE_URL đầy đủ (ưu tiên), hoặc bộ DB_HOST/PORT/USERNAME/PASSWORD/DATABASE
 * kiểu Supabase. Nhờ vậy đổi giữa local và cloud chỉ là việc sửa .env.
 */
const buildDatabaseConfig = (): DatabaseConfig => {
  const url = process.env.DATABASE_URL?.trim();
  const host = process.env.DB_HOST?.trim();

  if (!url && !host) {
    throw new Error(
      'Thiếu cấu hình database: cần DATABASE_URL hoặc DB_HOST. Xem apps/api/.env.example',
    );
  }

  // SSL phải bám theo URL thật sự được dùng, không phải theo DB_HOST — vì cả hai
  // cách khai báo có thể cùng tồn tại trong .env khi người dùng chuyển qua lại.
  const effectiveUrl = url || buildDatabaseUrl();
  const sslEnv = process.env.DB_SSL?.trim();
  const targetHost = safeHostname(effectiveUrl);
  const ssl =
    sslEnv === undefined
      ? targetHost !== undefined &&
        targetHost !== 'localhost' &&
        targetHost !== '127.0.0.1'
      : sslEnv === 'true';

  return {
    url: effectiveUrl,
    ssl,
    logging: process.env.NODE_ENV !== 'production' && process.env.DB_LOGGING === 'true',
    storageGb: toNumber(process.env.DB_STORAGE_GB, 250),
  };
};

/** Ghép URL từ các biến rời. Mật khẩu Supabase hay có ký tự lạ nên phải encode. */
const buildDatabaseUrl = (): string => {
  const host = required('DB_HOST');
  const port = toNumber(process.env.DB_PORT, 5432);
  const database = required('DB_DATABASE');
  const username = encodeURIComponent(required('DB_USERNAME'));
  const password = process.env.DB_PASSWORD?.trim();
  const credentials = password
    ? `${username}:${encodeURIComponent(password)}`
    : username;

  return `postgresql://${credentials}@${host}:${port}/${database}`;
};

const safeHostname = (url: string): string | undefined => {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
};

/**
 * Redis chấp nhận hai kiểu khai báo: một REDIS_URL đầy đủ, hoặc bộ
 * REDIS_HOST/PORT/USERNAME/PASSWORD kiểu Redis Cloud. Thiếu cả hai thì dừng ngay.
 */
const buildRedisConfig = (): RedisConfig => {
  const url = process.env.REDIS_URL?.trim();
  const host = process.env.REDIS_HOST?.trim();

  if (!url && !host) {
    throw new Error(
      'Thiếu cấu hình Redis: cần REDIS_URL hoặc REDIS_HOST. Xem apps/api/.env.example',
    );
  }

  return {
    url: url || undefined,
    host: host || undefined,
    port: toNumber(process.env.REDIS_PORT, 6379),
    username: process.env.REDIS_USERNAME?.trim() || undefined,
    password: process.env.REDIS_PASSWORD?.trim() || undefined,
    tls: process.env.REDIS_TLS === 'true',
    planMb: toNumber(process.env.REDIS_PLAN_MB, 30),
    ttlMs: toNumber(process.env.CACHE_TTL_MS, 60_000),
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'reelforge',
  };
};

/**
 * Khai báo dạng "1:<base64>,2:<base64>". Giữ nguyên chuỗi base64 ở đây; việc kiểm tra
 * độ dài khoá do AesGcmEncryptionService làm khi module được nạp, để app vẫn khởi động
 * được ở môi trường không bật tính năng quản lý credential.
 */
const buildCredentialsConfig = (): CredentialsConfig => {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEYS?.trim() ?? '';
  const keys: Record<number, string> = {};

  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (trimmed === '') continue;

    const separator = trimmed.indexOf(':');
    const version = Number(trimmed.slice(0, separator));
    const key = trimmed.slice(separator + 1).trim();

    if (separator === -1 || !Number.isInteger(version) || version <= 0 || key === '') {
      throw new Error(
        'CREDENTIAL_ENCRYPTION_KEYS sai định dạng, cần "1:<base64>,2:<base64>"',
      );
    }

    keys[version] = key;
  }

  return {
    keys,
    activeVersion: toNumber(process.env.CREDENTIAL_ENCRYPTION_KEY_VERSION, 1),
  };
};

export const configuration = (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  return {
    nodeEnv,
    isProduction,
    port: toNumber(process.env.PORT, 3001),
    database: buildDatabaseConfig(),
    redis: buildRedisConfig(),
    credentials: buildCredentialsConfig(),
  };
};
