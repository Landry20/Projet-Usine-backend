import { DataSource } from 'typeorm';
import { SequenceNumero } from '../../database/entities';

/**
 * RG-01 : numérotation serveur uniquement, non réutilisable, compteur annuel.
 * Format : OT-2026-00001 / DI-2026-00087 / BC-2026-00019
 */
export async function genererNumero(ds: DataSource, type: string): Promise<string> {
  const annee = new Date().getFullYear();
  return ds.transaction(async (manager) => {
    let seq = await manager.findOne(SequenceNumero, { where: { type, annee } });
    if (!seq) {
      seq = manager.create(SequenceNumero, { type, annee, dernier: 0 });
    }
    seq.dernier += 1;
    await manager.save(seq);
    return `${type}-${annee}-${String(seq.dernier).padStart(5, '0')}`;
  });
}

/** RG-02 : proposition de code SITE-FAMILLE-NNN. */
export function formaterCodeEquipement(codeSite: string, codeFamille: string, rang: number): string {
  return `${codeSite}-${codeFamille}-${String(rang).padStart(3, '0')}`;
}

export function extraireIp(requete: { headers: Record<string, unknown>; ip?: string; socket?: { remoteAddress?: string } }): string {
  const xff = requete.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  return requete.ip || requete.socket?.remoteAddress || '0.0.0.0';
}

export function arrondirFcfa(valeur: number): number {
  return Math.round(valeur);
}
