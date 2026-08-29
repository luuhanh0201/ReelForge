import { DataSource } from 'typeorm';
import { configuration } from '../config/configuration.js';

/**
 * DataSource riêng cho TypeORM CLI (generate/run/revert migration).
 * CLI không đi qua Nest nên phải tự nạp .env và khai báo đường dẫn tường minh.
 *
 * Chạy trên bản build: `nest build` rồi trỏ CLI vào `dist/database/data-source.js`.
 */
try {
  process.loadEnvFile('.env');
} catch {
  // Không có .env thì dùng biến môi trường sẵn có của tiến trình.
}

const { database } = configuration();

export default new DataSource({
  type: 'postgres',
  url: database.url,
  ssl: database.ssl ? { rejectUnauthorized: false } : undefined,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
  migrationsTableName: 'reelforge_migrations',
  logging: database.logging,
});
