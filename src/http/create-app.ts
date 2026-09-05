import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';
import { DataSource } from 'typeorm';
import { HttpError } from '../common/http-error';
import { extraireIp } from '../common/utils/numero.util';
import { dossierUploads } from '../common/utils/uploads.util';
import { monterRoutes } from './routes';

function nettoyer(valeur: unknown): unknown {
  if (typeof valeur === 'string') {
    return valeur.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').trim();
  }
  if (Array.isArray(valeur)) return valeur.map(nettoyer);
  if (valeur && typeof valeur === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valeur as Record<string, unknown>)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      o[k] = nettoyer(v);
    }
    return o;
  }
  return valeur;
}

export function creerAppHttp(ds: DataSource) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      hidePoweredBy: true,
    }),
  );
  app.use(hpp());
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use((req, _res, next) => {
    if (req.body) req.body = nettoyer(req.body);
    next();
  });

  const origines = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: origines,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => extraireIp(req),
    }),
  );

  app.use('/v1/fichiers', express.static(dossierUploads()));

  monterRoutes(app, ds);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json(err.corps);
      return;
    }
    const e = err as { status?: number; message?: string };
    const status = e.status ?? 500;
    if (status >= 500 && process.env.NODE_ENV === 'production') {
      res.status(500).json({ message: 'Une erreur interne est survenue.' });
      return;
    }
    res.status(status).json({ message: e.message ?? 'Erreur serveur.' });
  });

  return app;
}
