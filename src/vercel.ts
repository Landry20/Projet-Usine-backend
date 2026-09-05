import 'reflect-metadata';
import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './database/database.config';
import * as entities from './database/entities';
import { creerAppHttp } from './http/create-app';

const ENTITES = Object.values(entities).filter((v) => typeof v === 'function') as Function[];

let cached: ReturnType<typeof creerAppHttp> | undefined;
let ds: DataSource | undefined;

async function getApp() {
  if (cached) return cached;
  if (!ds) {
    ds = new DataSource({
      ...buildTypeOrmOptions(process.env, ENTITES),
      synchronize: false,
    });
    await ds.initialize();
  }
  cached = creerAppHttp(ds);
  return cached;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  const app = await getApp();
  app(req, res);
}
