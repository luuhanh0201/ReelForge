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

export interface AuthConfig {
  /** Khoá ký access token (HS256). Đổi khoá này = mọi người bị đăng xuất. */
  jwtSecret: string;
  /** Tuổi thọ access token, tính bằng giây. */
  accessTtlSec: number;
  /** Tuổi thọ refresh token của user thường, tính bằng giây. */
  refreshTtlSec: number;
  /** Refresh token của tài khoản nội bộ sống ngắn hơn user thường. */
  adminRefreshTtlSec: number;
  /** Phiên admin không refresh quá khoảng này (giây) thì bị thu hồi. */
  adminIdleTimeoutSec: number;
  /** Cửa sổ ân hạn (giây) cho refresh token vừa bị xoay — tránh giết phiên khi nhiều tab cùng refresh. */
  rotationGraceSec: number;
  /** Số phiên tối đa mỗi tài khoản; vượt thì thu hồi phiên cũ nhất. */
  maxSessionsPerUser: number;
  /** Domain đặt cho cookie. Để trống ở local; production dùng '.reelforge.vn'. */
  cookieDomain?: string;
  /** Bật cờ Secure cho cookie — luôn bật ở production. */
  cookieSecure: boolean;
  /**
   * OAuth client của Google. Không bắt buộc lúc khởi động — thiếu thì chỉ luồng đăng nhập
   * báo lỗi rõ ràng, giống cách credential Google TTS được xử lý, thay vì chặn cả API.
   */
  google: {
    clientId?: string;
    clientSecret?: string;
  };
  /** Email Google được cấp role admin ngay lần đăng nhập đầu. */
  bootstrapAdminEmails: string[];
}

export interface MailConfig {
  /** Thiếu host hoặc from thì tính năng gửi mail tự tắt, chỉ ghi log. */
  host?: string;
  port: number;
  user?: string;
  password?: string;
  /** Địa chỉ người gửi, ví dụ 'ReelForge <no-reply@reelforge.vn>'. */
  from?: string;
}

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  /** Origin của apps/web — dùng cho CORS và kiểm tra Origin chống CSRF. */
  webOrigin: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  credentials: CredentialsConfig;
  auth: AuthConfig;
  mail: MailConfig;
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

/**
 * Nhận "15m", "30d", "45s", "2h" hoặc số giây thuần. Trả về số giây.
 * Viết ở đây thay vì dùng chuỗi thẳng của jsonwebtoken vì cùng một giá trị còn phải
 * dùng cho Max-Age của cookie và TTL của Redis — cả hai đều cần số.
 */
const toSeconds = (value: string | undefined, fallback: number): number => {
  const raw = value?.trim();
  if (!raw) return fallback;

  const match = /^(\d+)\s*([smhd])?$/.exec(raw);
  if (!match) {
    throw new Error(
      `Thời hạn "${raw}" sai định dạng, cần dạng 15m / 2h / 30d hoặc số giây`,
    );
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  const multiplier = { s: 1, m: 60, h: 3600, d: 86_400 }[unit] ?? 1;

  return amount * multiplier;
};

/**
 * Cấu hình xác thực. `AUTH_JWT_SECRET` bắt buộc vì thiếu nó thì token ký bằng khoá rỗng —
 * lỗi lặng lẽ nguy hiểm hơn nhiều so với việc app không khởi động được.
 */
const buildAuthConfig = (isProduction: boolean): AuthConfig => ({
  jwtSecret: required('AUTH_JWT_SECRET'),
  accessTtlSec: toSeconds(process.env.AUTH_ACCESS_TTL, 15 * 60),
  refreshTtlSec: toSeconds(process.env.AUTH_REFRESH_TTL, 30 * 86_400),
  adminRefreshTtlSec: toSeconds(process.env.AUTH_ADMIN_REFRESH_TTL, 7 * 86_400),
  adminIdleTimeoutSec: toSeconds(process.env.AUTH_ADMIN_IDLE_TIMEOUT, 30 * 60),
  rotationGraceSec: toSeconds(process.env.AUTH_ROTATION_GRACE, 30),
  maxSessionsPerUser: toNumber(process.env.AUTH_MAX_SESSIONS_PER_USER, 10),
  cookieDomain: process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
  cookieSecure: process.env.AUTH_COOKIE_SECURE
    ? process.env.AUTH_COOKIE_SECURE === 'true'
    : isProduction,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() || undefined,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || undefined,
  },
  bootstrapAdminEmails: (process.env.AUTH_BOOTSTRAP_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email !== ''),
});

/**
 * SMTP là tuỳ chọn: thiếu cấu hình thì cảnh báo bảo mật chỉ ghi ra log server chứ không
 * làm app chết. Đăng nhập không bao giờ được phụ thuộc vào máy chủ mail.
 */
const buildMailConfig = (): MailConfig => ({
  host: process.env.SMTP_HOST?.trim() || undefined,
  port: toNumber(process.env.SMTP_PORT, 587),
  user: process.env.SMTP_USER?.trim() || undefined,
  password: process.env.SMTP_PASSWORD?.trim() || undefined,
  from: process.env.SMTP_FROM?.trim() || undefined,
});

export const configuration = (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  return {
    nodeEnv,
    isProduction,
    port: toNumber(process.env.PORT, 3001),
    webOrigin: process.env.WEB_ORIGIN?.trim() || 'http://localhost:3000',
    database: buildDatabaseConfig(),
    redis: buildRedisConfig(),
    credentials: buildCredentialsConfig(),
    auth: buildAuthConfig(isProduction),
    mail: buildMailConfig(),
  };
};
