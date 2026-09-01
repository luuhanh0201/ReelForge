import { DataSource } from 'typeorm';
import { configuration } from './dist/config/configuration.js';
process.loadEnvFile('.env');
const { database } = configuration();
const ds = new DataSource({ type: 'postgres', url: database.url, ssl: database.ssl ? { rejectUnauthorized: false } : undefined });
await ds.initialize();
const [r] = await ds.query('select voice_id from voice_previews limit 1');
console.log(r?.voice_id ?? '');
await ds.destroy();
