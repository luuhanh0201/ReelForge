import { Logger } from '@nestjs/common';
import { Redis, type RedisOptions } from 'ioredis';
import type { RedisConfig } from '../config/configuration.js';

/**
 * Nơi duy nhất dựng kết nối Redis cho toàn app.
 * Hỗ trợ cả REDIS_URL lẫn bộ host/port/username/password của Redis Cloud.
 */
export const createRedisClient = (
  config: RedisConfig,
  context = 'Redis',
): Redis => {
  const logger = new Logger(context);

  const options: RedisOptions = {
    keyPrefix: `${config.keyPrefix}:`,
    lazyConnect: false,
    // Giữ số lần retry hữu hạn để lỗi cấu hình lộ ra ngay thay vì treo im lặng.
    maxRetriesPerRequest: 3,
    ...(config.tls ? { tls: {} } : {}),
  };

  const client = config.url
    ? new Redis(config.url, options)
    : new Redis({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        ...options,
      });

  client.on('ready', () =>
    logger.log(`Redis sẵn sàng tại ${describeTarget(config)}`),
  );
  client.on('error', (error: Error) => logger.error(error.message));

  return client;
};

/**
 * URL dùng cho các thư viện chỉ nhận chuỗi kết nối (ví dụ Keyv).
 * Mật khẩu được encode để ký tự đặc biệt không làm hỏng URL.
 */
export const buildRedisUrl = (config: RedisConfig): string => {
  if (config.url) return config.url;

  const scheme = config.tls ? 'rediss' : 'redis';
  const auth = config.password
    ? `${encodeURIComponent(config.username ?? 'default')}:${encodeURIComponent(config.password)}@`
    : '';

  return `${scheme}://${auth}${config.host}:${config.port}`;
};

/** Mô tả đích kết nối để ghi log — không bao giờ kèm mật khẩu. */
export const describeTarget = (config: RedisConfig): string => {
  if (config.host) return `${config.host}:${config.port}`;

  try {
    const parsed = new URL(config.url ?? '');
    return `${parsed.hostname}:${parsed.port || 6379}`;
  } catch {
    return 'redis';
  }
};
