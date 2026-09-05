import 'reflect-metadata';
import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './database/database.config';
import * as entities from './database/entities';
import { assurerSchemaDepot } from './database/assurer-schema-depot';
import { creerAppHttp } from './http/create-app';

const ENTITES = Object.values(entities).filter((v) => typeof v === 'function') as Function[];

let cached: ReturnType<typeof creerAppHttp> | undefined;
let ds: DataSource | undefined;

function chemin(req: Request) {
  return String(req.url ?? '/').split('?')[0];
}

async function getApp() {
  if (cached) return cached;
  if (!ds) {
    ds = new DataSource({
      ...buildTypeOrmOptions(process.env, ENTITES),
      synchronize: false,
    });
    await ds.initialize();
    await assurerSchemaDepot(ds);
  }
  cached = creerAppHttp(ds);
  return cached;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  if (chemin(req) === '/v1/sante') {
    res.status(200).json({ ok: true, nom: 'ManuPro' });
    return;
  }
  try {
    const app = await getApp();
    app(req, res);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Erreur serveur.';
    if (!res.headersSent) {
      res.status(503).json({
        ok: false,
        message: 'API indisponible. Vérifiez DATABASE_URL et les variables Vercel.',
        detail,
      });
    }
  }
}
