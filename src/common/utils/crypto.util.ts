import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';

type Argon = typeof import('argon2');
let argon: Argon | null = null;
try {
  // Optionnel : binaire natif souvent absent sur Vercel.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  argon = require('argon2');
} catch {
  argon = null;
}

const COUT_BCRYPT = Number(process.env.BCRYPT_COST ?? 12);

/** Hachage mot de passe — bcrypt (portable). Compatible lecture Argon2id existant. */
export async function hasherMotDePasse(clair: string): Promise<string> {
  return bcrypt.hash(clair, COUT_BCRYPT);
}

export async function verifierMotDePasse(hash: string, clair: string): Promise<boolean> {
  try {
    if (hash.startsWith('$2')) return bcrypt.compare(clair, hash);
    if (hash.startsWith('$argon') && argon) return argon.verify(hash, clair);
    return bcrypt.compare(clair, hash);
  } catch {
    return false;
  }
}

export function hasherJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

export function genererJetonAleatoire(octets = 48): string {
  return randomBytes(octets).toString('hex');
}

export function comparaisonConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function validerComplexiteMotDePasse(mdp: string): string | null {
  if (mdp.length < 10) return 'Le mot de passe doit contenir au moins 10 caractères.';
  if (!/[A-Z]/.test(mdp)) return 'Le mot de passe doit contenir une majuscule.';
  if (!/[a-z]/.test(mdp)) return 'Le mot de passe doit contenir une minuscule.';
  if (!/[0-9]/.test(mdp)) return 'Le mot de passe doit contenir un chiffre.';
  if (!/[^A-Za-z0-9]/.test(mdp)) return 'Le mot de passe doit contenir un caractère spécial.';
  return null;
}

export function chiffrerTexte(clair: string): string {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET || 'manupro-dev';
  const cle = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const { createCipheriv } = require('crypto') as typeof import('crypto');
  const cipher = createCipheriv('aes-256-gcm', cle, iv);
  const enc = Buffer.concat([cipher.update(clair, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}.${tag.toString('hex')}.${enc.toString('hex')}`;
}

export function dechiffrerTexte(payload: string): string {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET || 'manupro-dev';
  const cle = createHash('sha256').update(secret).digest();
  const [ivH, tagH, dataH] = payload.split('.');
  const { createDecipheriv } = require('crypto') as typeof import('crypto');
  const decipher = createDecipheriv('aes-256-gcm', cle, Buffer.from(ivH, 'hex'));
  decipher.setAuthTag(Buffer.from(tagH, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataH, 'hex')), decipher.final()]).toString('utf8');
}
