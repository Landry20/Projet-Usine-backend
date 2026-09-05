import { mkdirSync } from 'fs';
import { join } from 'path';

/** Dossier d'uploads : /tmp sur Vercel (FS en lecture seule hors /tmp). */
export function dossierUploads(): string {
  const surVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const dir = surVercel
    ? join('/tmp', 'uploads')
    : process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
  mkdirSync(dir, { recursive: true });
  return dir;
}
