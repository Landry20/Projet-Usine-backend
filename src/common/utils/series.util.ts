import { ObjectLiteral, Repository } from 'typeorm';

const LIB_MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export interface PointSerie {
  mois: string;
  annee: number;
  precedente: number;
}

export interface SerieComparee {
  anneeCourante: number;
  anneePrecedente: number;
  activite: PointSerie[];
  volume: PointSerie[];
}

function douze(map: Record<number, number>) {
  return LIB_MOIS.map((mois, i) => ({ mois, n: map[i + 1] ?? 0 }));
}

function fusionner(a: { mois: string; n: number }[], b: { mois: string; n: number }[]): PointSerie[] {
  return a.map((p, i) => ({ mois: p.mois, annee: p.n, precedente: b[i]?.n ?? 0 }));
}

/** Compte et somme mensuels, année N vs N-1 — calcul serveur uniquement. */
export async function serieAnneeSurAnnee<T extends ObjectLiteral>(
  repo: Repository<T>,
  alias: string,
  colonneDate: string,
  colonneVolume?: string,
): Promise<SerieComparee> {
  const anneeCourante = new Date().getFullYear();
  const anneePrecedente = anneeCourante - 1;

  async function pour(annee: number) {
    const qb = repo
      .createQueryBuilder(alias)
      .select(`MONTH(${alias}.${colonneDate})`, 'm')
      .addSelect('COUNT(*)', 'n');
    if (colonneVolume) {
      const expr = /[\s(+]/.test(colonneVolume) ? colonneVolume : `${alias}.${colonneVolume}`;
      qb.addSelect(`COALESCE(SUM(${expr}), 0)`, 'v');
    }
    qb.where(`YEAR(${alias}.${colonneDate}) = :y`, { y: annee }).groupBy('m');
    const rows = await qb.getRawMany<{ m: string; n: string; v?: string }>();
    const counts: Record<number, number> = {};
    const volumes: Record<number, number> = {};
    for (const r of rows) {
      counts[Number(r.m)] = Number(r.n);
      volumes[Number(r.m)] = Number(r.v ?? 0);
    }
    return { counts: douze(counts), volumes: douze(volumes) };
  }

  const [c, p] = await Promise.all([pour(anneeCourante), pour(anneePrecedente)]);
  return {
    anneeCourante,
    anneePrecedente,
    activite: fusionner(c.counts, p.counts),
    volume: fusionner(c.volumes, p.volumes),
  };
}
