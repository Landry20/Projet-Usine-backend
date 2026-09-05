import { mkdirSync } from 'fs';
import { join } from 'path';

/** Dossier d'uploads : /tmp sur Vercel (FS en lecture seule hors /tmp). */
export function dossierUploads(): string {
  const dir =
    process.env.UPLOAD_DIR ||
    (process.env.VERCEL ? join('/tmp', 'uploads') : join(process.cwd(), 'uploads'));
  mkdirSync(dir, { recursive: true });
  return dir;
}
