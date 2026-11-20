import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { entities } from './entities';
import { Initial1761955200000, MaintenancePlanActive1762041600000 } from './migration';
export function createDataSource(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('Defina DATABASE_URL no arquivo .env.');
  return new DataSource({
    type: 'postgres',
    url,
    entities,
    migrations: [Initial1761955200000, MaintenancePlanActive1762041600000],
    synchronize: false,
    logging: false,
  });
}
