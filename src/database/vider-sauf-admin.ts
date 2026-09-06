import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './database.config';
import * as E from './entities';

config({ path: resolve(__dirname, '../../.env') });

const ENTITES = Object.values(E).filter((v) => typeof v === 'function') as Function[];
const CONSERVER = new Set(['role', 'permission', 'role_permission', 'utilisateur']);

async function main() {
  const ds = new DataSource({
    ...buildTypeOrmOptions(process.env, ENTITES),
    synchronize: false,
  });
  await ds.initialize();
  const tables = (
    await ds.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`)
  ) as Array<{ tablename: string }>;
  const cibles = tables.map((t) => t.tablename).filter((n) => !CONSERVER.has(n));

  await ds.query(`UPDATE utilisateur SET site_id = NULL`);

  for (let tour = 0; tour < 25; tour += 1) {
    let reste = 0;
    for (const table of cibles) {
      try {
        const r = (await ds.query(`DELETE FROM "${table}"`)) as { rowCount?: number };
        reste += r?.rowCount ?? 0;
      } catch {
        reste += 1;
      }
    }
    if (reste === 0) break;
  }

  await ds.query(`
    DELETE FROM utilisateur
    WHERE email <> 'admin@usine.ci'
      AND (role_id IS NULL OR role_id NOT IN (SELECT id FROM role WHERE code = 'ADMIN'))
  `);

  const restants = await ds.query(`SELECT email FROM utilisateur ORDER BY email`);
  console.log('Base vidée. Utilisateurs conservés :', restants);
  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
