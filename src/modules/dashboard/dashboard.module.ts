import { Repository } from 'typeorm';
import { StatutDemandePiece, StatutDi, StatutOt, TypeMaintenance } from '../../common/constants/enums';
import { serieAnneeSurAnnee } from '../../common/utils/series.util';
import {
  Article,
  DemandeIntervention,
  DemandePiece,
  Equipement,
  OrdreTravail,
  Technicien,
  Utilisateur,
} from '../../database/entities';

export class DashboardController {
  constructor(
    private readonly ots: Repository<OrdreTravail>,
    private readonly dis: Repository<DemandeIntervention>,
    private readonly articles: Repository<Article>,
    private readonly dpieces: Repository<DemandePiece>,
    private readonly equipements: Repository<Equipement>,
    private readonly techs: Repository<Technicien>,
    private readonly users: Repository<Utilisateur>,
  ) {}

  /**
   * Indicateurs calculés côté serveur uniquement (CDC 13).
   * Le frontend n'effectue aucun calcul métier.
   */
  async accueil(user: { id: number; roleCode: string }) {
    const aujourdHui = new Date().toISOString().slice(0, 10);
    const ouverts = [StatutOt.BROUILLON, StatutOt.PLANIFIE, StatutOt.EN_COURS, StatutOt.EN_ATTENTE, StatutOt.REALISE];

    const [otOuverts, demandesAttente, stockCritique, demandesPieces, nbEquip, nbUsers] = await Promise.all([
      this.ots.count({ where: ouverts.map((s) => ({ statut: s })) }),
      this.dis.count({ where: { statut: StatutDi.NOUVELLE } }),
      this.articles
        .createQueryBuilder('a')
        .where('a.actif = 1 AND a.quantiteStock <= a.seuilReappro')
        .getCount(),
      this.dpieces.count({ where: { statut: StatutDemandePiece.EN_ATTENTE } }),
      this.equipements.count(),
      this.users.count({ where: { actif: true } }),
    ]);

    const otRetard = await this.ots
      .createQueryBuilder('o')
      .where('o.statut IN (:...st)', { st: [StatutOt.PLANIFIE, StatutOt.EN_COURS, StatutOt.EN_ATTENTE] })
      .andWhere('o.datePlanifiee IS NOT NULL AND o.datePlanifiee < :j', { j: aujourdHui })
      .getCount();

    const duJour = await this.ots.find({
      where: { datePlanifiee: aujourdHui },
      relations: ['equipement', 'technicienResponsable'],
      take: 10,
      order: { priorite: 'ASC' },
    });

    const clotures = await this.ots.find({ where: { statut: StatutOt.CLOTURE } });
    const coutMaintenance = clotures.reduce(
      (s, o) => s + Number(o.coutMainOeuvre) + Number(o.coutPieces) + Number(o.coutExterne),
      0,
    );
    const nbPrev = clotures.filter((o) =>
      [TypeMaintenance.PREVENTIF, TypeMaintenance.REGLEMENTAIRE].includes(o.typeMaintenance),
    ).length;
    const ratioPreventif = clotures.length ? Math.round((1000 * nbPrev) / clotures.length) / 10 : 0;

    const valeurStockRaw = await this.articles
      .createQueryBuilder('a')
      .select('SUM(a.quantiteStock * a.prixUnitaireMoyen)', 'valeur')
      .where('a.actif = 1')
      .getRawOne<{ valeur: string }>();

    const heuresArret = clotures.reduce((s, o) => s + Number(o.dureeArretH || 0), 0);
    const tauxDispo = Math.round(((8760 - heuresArret) / 8760) * 10000) / 100;
    const correctifs = clotures.filter((o) => o.typeMaintenance === TypeMaintenance.CORRECTIF);
    const mttr =
      correctifs.length > 0
        ? Math.round(
            (correctifs.reduce((s, o) => {
              if (!o.dateDebutReelle || !o.dateFinReelle) return s;
              return s + (o.dateFinReelle.getTime() - o.dateDebutReelle.getTime()) / 3600000;
            }, 0) /
              correctifs.length) *
              10,
          ) / 10
        : 0;
    const mtbf = correctifs.length > 0 ? Math.round((8760 - heuresArret) / correctifs.length) : null;

    let mesOt: OrdreTravail[] = [];
    if (user.roleCode === 'TECH') {
      const tech = await this.techs.findOne({ where: { utilisateurId: user.id } });
      if (tech) {
        mesOt = await this.ots.find({
          where: { technicienResponsableId: tech.id },
          relations: ['equipement'],
          order: { datePlanifiee: 'ASC' },
          take: 15,
        });
      }
    }

    const series = await serieAnneeSurAnnee(
      this.ots,
      'o',
      'date_creation',
      '(CAST(o.cout_main_oeuvre AS DECIMAL(14,2)) + CAST(o.cout_pieces AS DECIMAL(14,2)) + CAST(o.cout_externe AS DECIMAL(14,2)))',
    );

    return {
      role: user.roleCode,
      otOuverts,
      otRetard,
      demandesAttente,
      stockCritique,
      demandesPieces,
      interventionsDuJour: duJour,
      coutMaintenance,
      ratioPreventif,
      valeurStock: Number(valeurStockRaw?.valeur ?? 0),
      tauxDisponibilite: tauxDispo,
      mtbf,
      mttr,
      nbEquipements: nbEquip,
      nbUtilisateurs: nbUsers,
      mesOt,
      series,
    };
  }
}

