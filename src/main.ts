import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './database/database.config';
import * as entities from './database/entities';
import { creerAppHttp } from './http/create-app';

const ENTITES = Object.values(entities).filter((v) => typeof v === 'function') as Function[];

async function demarrer() {
  const ds = new DataSource({ ...buildTypeOrmOptions(process.env, ENTITES), synchronize: process.env.DB_SYNC === 'true' });
  await ds.initialize();
  const app = creerAppHttp(ds);
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`ManuPro API (Node.js) prête sur http://localhost:${port}/v1`);
  });
}

void demarrer();
