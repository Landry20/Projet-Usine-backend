import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {  BadRequestException, NotFoundException  } from '../../common/http-error';
import {
  PrioriteOt,
  STATUTS_DOCUMENT_VERROUILLE,
  StatutDemandeMatiere,
  StatutValidation,
  TypeArret,
  TypeMouvement,
  TypeMvtTank,
  TypeProduit,
} from '../../common/constants/enums';
import { paginer, PaginationDto } from '../../common/dto/pagination.dto';
import { genererNumero } from '../../common/utils/numero.util';
import {
  DemandeIntervention,
  DemandeMatiere,
  Equipement,
  JournalArret,
  JournalEntree,
  JournalQuart,
  JournalSortie,
  LigneProduction,
  Notification,
  Parametre,
  Produit,
  Tank,
  TankMouvement,
} from '../../database/entities';
import { MouvementProduit } from '../../database/entities/production.entities';

class CreerDmDto {
  @IsInt() produitId: number;
  @IsNumber() @Min(0.01) quantiteDemandee: number;
  @IsOptional() @IsInt() ligneId?: number;
  @IsOptional() @IsIn(['A', 'B', 'C']) quart?: string;
}

class ServirDmDto {
  @IsNumber() @Min(0) quantiteServie: number;
  @IsOptional() @IsString() motifEcart?: string;
}

class CreerJournalDto {
  @IsString() dateJournee: string;
  @IsIn(['A', 'B', 'C']) quart: string;
  @IsInt() ligneId: number;
  @IsOptional() @IsString() observations?: string;
}

class EntreeDto {
  @IsInt() produitId: number;
  @IsNumber() @Min(0.01) quantiteKg: number;
  @IsOptional() @IsString() lotMatiere?: string;
  @IsOptional() @IsInt() demandeMatiereId?: number;
  @IsOptional() @IsString() observation?: string;
}

class SortieDto {
  @IsInt() produitId: number;
  @IsNumber() @Min(0) quantiteKg: number;
  @IsOptional() @IsInt() tankId?: number;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() observation?: string;
}

class ArretDto {
  @IsEnum(TypeArret) typeArret: TypeArret;
  @IsInt() @Min(1) dureeMin: number;
  @IsOptional() @IsInt() equipementId?: number;
  @IsOptional() @IsString() cause?: string;
}

type UserCtx = { id: number; roleCode?: string };

export class QuartController {
  constructor(
    private readonly dms: Repository<DemandeMatiere>,
    private readonly journaux: Repository<JournalQuart>,
    private readonly entrees: Repository<JournalEntree>,
    private readonly sorties: Repository<JournalSortie>,
    private readonly arrets: Repository<JournalArret>,
    private readonly produits: Repository<Produit>,
    private readonly lignes: Repository<LigneProduction>,
    private readonly params: Repository<Parametre>,
    private readonly ds: DataSource,
  ) {}

  async listerDm(q: PaginationDto & { statut?: StatutDemandeMatiere }) {
    const page = Number(q.page ?? 1);
    const limite = Number(q.limite ?? 25);
    const qb = this.dms
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.produit', 'p')
      .leftJoinAndSelect('d.ligne', 'l')
      .leftJoinAndSelect('d.demandeur', 'u')
      .leftJoinAndSelect('d.magasinier', 'm')
      .orderBy('d.dateDemande', 'DESC')
      .skip((page - 1) * limite)
      .take(limite);
    if (q.statut) qb.andWhere('d.statut = :st', { st: q.statut });
    const [donnees, total] = await qb.getManyAndCount();
    return paginer(donnees, total, page, limite);
  }

  async creerDm(dto: CreerDmDto, user: UserCtx) {
    const produit = await this.produits.findOne({ where: { id: dto.produitId } });
    if (!produit) throw new NotFoundException({ message: 'Produit introuvable.' });
    if (produit.typeProduit !== TypeProduit.MATIERE_PREMIERE) {
      throw new BadRequestException({ message: 'Seule une matière première peut être demandée.' });
    }
    const numero = await genererNumero(this.ds, 'DM');
    return this.dms.save(
      this.dms.create({
        numero,
        produitId: dto.produitId,
        quantiteDemandee: dto.quantiteDemandee.toFixed(2),
        ligneId: dto.ligneId ?? null,
        quart: dto.quart ?? null,
        demandeurId: user.id,
        statut: StatutDemandeMatiere.DEMANDEE,
      }),
    );
  }

  /** RG-31 : le stock magasin baisse uniquement au service. Écart → motif obligatoire. */
  async servirDm(
    id: number,
    dto: ServirDmDto,
    user: UserCtx,
  ) {
    return this.ds.transaction(async (m) => {
      const dm = await m.findOne(DemandeMatiere, { where: { id }, relations: ['produit'] });
      if (!dm) throw new NotFoundException({ message: 'Demande de matière introuvable.' });
      if (![StatutDemandeMatiere.DEMANDEE, StatutDemandeMatiere.PARTIELLE].includes(dm.statut)) {
        throw new BadRequestException({ message: 'Cette demande ne peut plus être servie.' });
      }
      const demandee = Number(dm.quantiteDemandee);
      if (Math.abs(dto.quantiteServie - demandee) > 0.001 && !(dto.motifEcart ?? '').trim()) {
        throw new BadRequestException({
          code: 'MOTIF_ECART_OBLIGATOIRE',
          message: 'L’écart entre quantité demandée et servie exige un motif (RG-31).',
        });
      }
      const p = await m.findOne(Produit, { where: { id: dm.produitId }, lock: { mode: 'pessimistic_write' } });
      if (!p) throw new NotFoundException({ message: 'Produit introuvable.' });
      const avant = Number(p.quantiteStock);
      if (avant < dto.quantiteServie) {
        throw new BadRequestException({
          code: 'STOCK_INSUFFISANT',
          message: `Stock insuffisant pour ${p.refProduit} (dispo ${avant}, demandé ${dto.quantiteServie}).`,
        });
      }
      const apres = avant - dto.quantiteServie;
      p.quantiteStock = apres.toFixed(3);
      await m.save(p);
      await m.save(
        m.create(MouvementProduit, {
          produitId: p.id,
          typeStock: p.typeProduit,
          typeMvt: TypeMouvement.SORTIE,
          quantite: dto.quantiteServie.toFixed(3),
          stockAvant: avant.toFixed(3),
          stockApres: apres.toFixed(3),
          motif: `Service ${dm.numero}`,
          utilisateurId: user.id,
        }),
      );
      dm.quantiteServie = dto.quantiteServie.toFixed(2);
      dm.motifEcart = dto.motifEcart?.trim() || null;
      dm.magasinierId = user.id;
      dm.dateService = new Date();
      dm.statut =
        dto.quantiteServie + 0.001 >= demandee ? StatutDemandeMatiere.SERVIE : StatutDemandeMatiere.PARTIELLE;
      return m.save(dm);
    });
  }

  async refuserDm(id: number, motif: string) {
    if (!motif || motif.trim().length < 3) {
      throw new BadRequestException({ message: 'Le motif de refus est obligatoire.' });
    }
    const dm = await this.dms.findOne({ where: { id } });
    if (!dm) throw new NotFoundException({ message: 'Demande de matière introuvable.' });
    if (dm.statut !== StatutDemandeMatiere.DEMANDEE) {
      throw new BadRequestException({ message: 'Seule une demande encore ouverte peut être refusée.' });
    }
    dm.statut = StatutDemandeMatiere.REFUSEE;
    dm.motifEcart = motif.trim();
    return this.dms.save(dm);
  }

  async listerJournaux(q: PaginationDto & { statut?: StatutValidation }) {
    const page = Number(q.page ?? 1);
    const limite = Number(q.limite ?? 25);
    const qb = this.journaux
      .createQueryBuilder('j')
      .leftJoinAndSelect('j.ligne', 'l')
      .leftJoinAndSelect('j.chefQuart', 'c')
      .orderBy('j.dateJournee', 'DESC')
      .addOrderBy('j.quart', 'ASC')
      .skip((page - 1) * limite)
      .take(limite);
    if (q.statut) qb.andWhere('j.statut = :st', { st: q.statut });
    const [donnees, total] = await qb.getManyAndCount();
    return paginer(donnees, total, page, limite);
  }

  async ficheJournal(id: number) {
    const j = await this.journaux.findOne({
      where: { id },
      relations: [
        'ligne',
        'ligne.equipement',
        'chefQuart',
        'entrees',
        'entrees.produit',
        'entrees.demandeMatiere',
        'sorties',
        'sorties.produit',
        'sorties.tank',
        'arrets',
        'arrets.equipement',
        'arrets.demandeIntervention',
      ],
    });
    if (!j) throw new NotFoundException({ message: 'Journal de quart introuvable.' });
    return j;
  }

  async creerJournal(dto: CreerJournalDto, user: UserCtx) {
    const ligne = await this.lignes.findOne({ where: { id: dto.ligneId } });
    if (!ligne) throw new NotFoundException({ message: 'Ligne de production introuvable.' });
    const existant = await this.journaux.findOne({
      where: { dateJournee: dto.dateJournee, quart: dto.quart, ligneId: dto.ligneId },
    });
    if (existant) {
      throw new BadRequestException({
        message: `Un journal existe déjà pour le ${dto.dateJournee} quart ${dto.quart} sur ${ligne.code}.`,
      });
    }
    const numero = await genererNumero(this.ds, 'JQ');
    return this.journaux.save(
      this.journaux.create({
        numero,
        dateJournee: dto.dateJournee,
        quart: dto.quart,
        ligneId: dto.ligneId,
        chefQuartId: user.id,
        observations: dto.observations ?? null,
        statut: StatutValidation.BROUILLON,
      }),
    );
  }

  async ajouterEntree(id: number, dto: EntreeDto) {
    const j = await this.journalModifiable(id);
    if (dto.demandeMatiereId) {
      const dm = await this.dms.findOne({ where: { id: dto.demandeMatiereId } });
      if (!dm) throw new NotFoundException({ message: 'Demande de matière introuvable.' });
      if (![StatutDemandeMatiere.SERVIE, StatutDemandeMatiere.PARTIELLE].includes(dm.statut)) {
        throw new BadRequestException({ message: 'Seule une demande déjà servie peut entrer dans le journal.' });
      }
      if (dm.journalQuartId && dm.journalQuartId !== j.id) {
        throw new BadRequestException({ message: 'Cette demande est déjà engagée dans un autre journal.' });
      }
      dm.journalQuartId = j.id;
      await this.dms.save(dm);
    }
    await this.entrees.save(
      this.entrees.create({
        journalQuartId: j.id,
        produitId: dto.produitId,
        quantiteKg: dto.quantiteKg.toFixed(2),
        lotMatiere: dto.lotMatiere ?? null,
        demandeMatiereId: dto.demandeMatiereId ?? null,
        observation: dto.observation ?? null,
      }),
    );
    await this.recalculerBilan(j.id);
    return this.ficheJournal(j.id);
  }

  async ajouterSortie(id: number, dto: SortieDto) {
    const j = await this.journalModifiable(id);
    const produit = await this.produits.findOne({ where: { id: dto.produitId } });
    if (!produit) throw new NotFoundException({ message: 'Produit introuvable.' });
    if (produit.typeProduit === TypeProduit.PRODUIT_FINI && !dto.tankId) {
      throw new BadRequestException({ message: 'Une sortie de produit fini doit viser un tank.' });
    }
    await this.sorties.save(
      this.sorties.create({
        journalQuartId: j.id,
        produitId: dto.produitId,
        quantiteKg: dto.quantiteKg.toFixed(2),
        tankId: dto.tankId ?? null,
        destination: dto.destination ?? null,
        observation: dto.observation ?? null,
      }),
    );
    await this.recalculerBilan(j.id);
    return this.ficheJournal(j.id);
  }

  /** RG-35 : arrêt ≥ seuil → DI maintenance générée côté serveur. */
  async ajouterArret(
    id: number,
    dto: ArretDto,
    user: UserCtx,
  ) {
    const j = await this.journalModifiable(id);
    const ligne = await this.lignes.findOne({ where: { id: j.ligneId }, relations: ['equipement'] });
    const equipementId = dto.equipementId ?? ligne?.equipementId ?? null;
    const seuil = Number((await this.lireParam('DUREE_ARRET_GENERANT_DI_MIN', '30')) || 30);
    let diId: number | null = null;
    if (dto.dureeMin >= seuil && equipementId) {
      const eq = await this.ds.getRepository(Equipement).findOne({ where: { id: equipementId } });
      if (eq) {
        const numero = await genererNumero(this.ds, 'DI');
        const di = await this.ds.getRepository(DemandeIntervention).save(
          this.ds.getRepository(DemandeIntervention).create({
            numero,
            equipementId,
            demandeurId: user.id,
            description: `Arrêt machine déclaré au journal ${j.numero} : ${dto.typeArret}${dto.cause ? ` — ${dto.cause}` : ''} (${dto.dureeMin} min).`,
            urgence: PrioriteOt.P2_HAUTE,
            arretProduction: true,
          }),
        );
        diId = di.id;
        await this.ds.getRepository(Notification).save(
          this.ds.getRepository(Notification).create({
            destinataireId: user.id,
            type: 'DI_AUTO_QUART',
            titre: `DI ${di.numero} créée depuis le quart`,
            message: `Arrêt de ${dto.dureeMin} min sur ${eq.codeEquipement}.`,
            lien: `/demandes/${di.id}`,
          }),
        );
      }
    }
    await this.arrets.save(
      this.arrets.create({
        journalQuartId: j.id,
        typeArret: dto.typeArret,
        dureeMin: dto.dureeMin,
        equipementId,
        cause: dto.cause ?? null,
        heureDebut: new Date(),
        demandeInterventionId: diId,
      }),
    );
    return this.ficheJournal(j.id);
  }

  async soumettre(id: number, body: { commentaireEcart?: string }, user: UserCtx) {
    const j = await this.journalModifiable(id);
    await this.recalculerBilan(j.id);
    const fresh = await this.journaux.findOneByOrFail({ id: j.id });
    const alerte = Number(await this.lireParam('ECART_ALERTE_PCT', '1'));
    const blocage = Number(await this.lireParam('ECART_BLOCAGE_PCT', '3'));
    const pct = Math.abs(Number(fresh.ecartPct ?? 0));
    if (pct >= blocage) {
      throw new BadRequestException({
        code: 'ECART_BLOCAGE',
        message: `Écart de ${pct.toFixed(3)} % : soumission refusée au-delà de ${blocage} % (RG-30).`,
      });
    }
    if (pct >= alerte && !(body.commentaireEcart ?? fresh.commentaireEcart ?? '').trim()) {
      throw new BadRequestException({
        code: 'COMMENTAIRE_ECART',
        message: `Écart de ${pct.toFixed(3)} % : un commentaire est obligatoire au-delà de ${alerte} % (RG-30).`,
      });
    }
    if (Number(fresh.totalEntreesKg) <= 0) {
      throw new BadRequestException({ message: 'Impossible de soumettre un journal sans entrée matière.' });
    }
    fresh.commentaireEcart = (body.commentaireEcart ?? fresh.commentaireEcart)?.trim() || null;
    fresh.statut = StatutValidation.SOUMIS;
    fresh.soumisPar = user.id;
    await this.journaux.save(fresh);
    return this.ficheJournal(id);
  }

  async verifier(id: number, user: UserCtx) {
    const j = await this.journaux.findOneBy({ id });
    if (!j) throw new NotFoundException({ message: 'Journal de quart introuvable.' });
    if (j.statut !== StatutValidation.SOUMIS) {
      throw new BadRequestException({ message: 'Seul un journal soumis peut être vérifié.' });
    }
    if (j.soumisPar === user.id && user.roleCode !== 'ADMIN') {
      throw new BadRequestException({ message: 'Séparation des tâches : le soumetteur ne peut pas vérifier son propre rapport.' });
    }
    j.statut = StatutValidation.VERIFIE;
    j.verifiePar = user.id;
    await this.journaux.save(j);
    return this.ficheJournal(id);
  }

  /** Approbation : pousse le PF vers les tanks (pont production → produit fini). */
  async approuver(id: number, user: UserCtx) {
    return this.ds.transaction(async (m) => {
      const j = await m.findOne(JournalQuart, { where: { id }, relations: ['sorties', 'sorties.produit'] });
      if (!j) throw new NotFoundException({ message: 'Journal de quart introuvable.' });
      if (j.statut !== StatutValidation.VERIFIE) {
        throw new BadRequestException({ message: 'Seul un journal vérifié peut être approuvé.' });
      }
      if (j.verifiePar === user.id && user.roleCode !== 'ADMIN') {
        throw new BadRequestException({ message: 'Séparation des tâches : le vérificateur ne peut pas approuver.' });
      }
      for (const s of j.sorties ?? []) {
        if (s.produit?.typeProduit === TypeProduit.PRODUIT_FINI && s.tankId) {
          await appliquerMouvementTank(m, {
            tankId: s.tankId,
            typeMvt: TypeMvtTank.ENTREE_PRODUCTION,
            quantiteKg: Number(s.quantiteKg),
            journalQuartId: j.id,
            utilisateurId: user.id,
            motif: `Entrée production ${j.numero}`,
          });
        }
        if (s.produit?.typeProduit === TypeProduit.SOUS_PRODUIT) {
          const p = await m.findOne(Produit, { where: { id: s.produitId }, lock: { mode: 'pessimistic_write' } });
          if (p) {
            const avant = Number(p.quantiteStock);
            const qte = Number(s.quantiteKg);
            p.quantiteStock = (avant + qte).toFixed(3);
            await m.save(p);
            await m.save(
              m.create(MouvementProduit, {
                produitId: p.id,
                typeStock: p.typeProduit,
                typeMvt: TypeMouvement.ENTREE,
                quantite: qte.toFixed(3),
                stockAvant: avant.toFixed(3),
                stockApres: p.quantiteStock,
                motif: `Sous-produit ${j.numero}`,
                utilisateurId: user.id,
              }),
            );
          }
        }
      }
      j.statut = StatutValidation.APPROUVE;
      j.approuvePar = user.id;
      await m.save(j);
    }).then(() => this.ficheJournal(id));
  }

  async retourner(id: number, motif: string) {
    if (!motif || motif.trim().length < 3) {
      throw new BadRequestException({ message: 'Le motif de retour est obligatoire.' });
    }
    const j = await this.journaux.findOneBy({ id });
    if (!j) throw new NotFoundException({ message: 'Journal de quart introuvable.' });
    if (![StatutValidation.SOUMIS, StatutValidation.VERIFIE].includes(j.statut)) {
      throw new BadRequestException({ message: 'Ce journal ne peut pas être retourné.' });
    }
    j.statut = StatutValidation.RETOURNE;
    j.observations = [j.observations, `Retour : ${motif.trim()}`].filter(Boolean).join('\n');
    await this.journaux.save(j);
    return this.ficheJournal(id);
  }

  /** RG-34 : un rapport approuvé n’est plus modifié — on crée un rectificatif. */
  async rectificatif(id: number, user: UserCtx) {
    const source = await this.ficheJournal(id);
    if (!STATUTS_DOCUMENT_VERROUILLE.includes(source.statut as (typeof STATUTS_DOCUMENT_VERROUILLE)[number])) {
      throw new BadRequestException({ message: 'Un rectificatif ne s’applique qu’à un rapport déjà approuvé.' });
    }
    const numero = await genererNumero(this.ds, 'JQ');
    const copie = await this.journaux.save(
      this.journaux.create({
        numero,
        dateJournee: source.dateJournee,
        quart: source.quart,
        ligneId: source.ligneId,
        chefQuartId: user.id,
        observations: `Rectificatif de ${source.numero}`,
        rapportRectifieId: source.id,
        statut: StatutValidation.BROUILLON,
      }),
    );
    return this.ficheJournal(copie.id);
  }

  private async journalModifiable(id: number) {
    const j = await this.journaux.findOneBy({ id });
    if (!j) throw new NotFoundException({ message: 'Journal de quart introuvable.' });
    if (STATUTS_DOCUMENT_VERROUILLE.includes(j.statut as (typeof STATUTS_DOCUMENT_VERROUILLE)[number])) {
      throw new BadRequestException({
        code: 'JOURNAL_VERROUILLE',
        message: 'Rapport approuvé : correction uniquement par rectificatif (RG-34).',
      });
    }
    if (![StatutValidation.BROUILLON, StatutValidation.RETOURNE].includes(j.statut)) {
      throw new BadRequestException({ message: 'Ce journal n’est plus saisissable.' });
    }
    return j;
  }

  private async recalculerBilan(journalId: number) {
    const entrees = await this.entrees.find({ where: { journalQuartId: journalId } });
    const sorties = await this.sorties.find({ where: { journalQuartId: journalId }, relations: ['produit'] });
    const vEnt = entrees.reduce((s, e) => s + Number(e.quantiteKg), 0);
    const vSor = sorties.reduce((s, e) => s + Number(e.quantiteKg), 0);
    const vPf = sorties
      .filter((s) => s.produit?.typeProduit === TypeProduit.PRODUIT_FINI)
      .reduce((s, e) => s + Number(e.quantiteKg), 0);
    const j = await this.journaux.findOneByOrFail({ id: journalId });
    j.totalEntreesKg = vEnt.toFixed(2);
    j.totalSortiesKg = vSor.toFixed(2);
    j.ecartKg = (vEnt - vSor).toFixed(2);
    j.ecartPct = vEnt > 0 ? (((vEnt - vSor) / vEnt) * 100).toFixed(3) : null;
    j.rendementPct = vEnt > 0 ? ((vPf / vEnt) * 100).toFixed(3) : null;
    await this.journaux.save(j);
  }

  private async lireParam(cle: string, defaut: string) {
    const p = await this.params.findOne({ where: { cle } });
    return p?.valeur ?? defaut;
  }
}

export async function appliquerMouvementTank(
  m: EntityManager,
  opts: {
    tankId: number;
    typeMvt: TypeMvtTank;
    quantiteLitres?: number;
    quantiteKg?: number;
    densite?: number;
    journalQuartId?: number;
    chargementId?: number;
    tankDestinationId?: number;
    utilisateurId?: number;
    motif?: string;
    temperature?: number;
  },
) {
  const tank = await m.findOne(Tank, { where: { id: opts.tankId }, lock: { mode: 'pessimistic_write' }, relations: ['produit'] });
  if (!tank) throw new NotFoundException({ message: 'Tank introuvable.' });
  const densite = opts.densite ?? Number(tank.produit?.densiteReference ?? 0.91);
  let litres = opts.quantiteLitres;
  let kg = opts.quantiteKg;
  if (litres == null && kg != null) litres = kg / densite;
  if (kg == null && litres != null) kg = litres * densite;
  if (litres == null) throw new BadRequestException({ message: 'Quantité tank manquante.' });
  const avant = Number(tank.stockLitres);
  const signe = [TypeMvtTank.ENTREE_PRODUCTION, TypeMvtTank.TRANSFERT_ENTREE].includes(opts.typeMvt)
    ? 1
    : opts.typeMvt === TypeMvtTank.AJUSTEMENT_JAUGE
      ? Math.sign(litres) || 1
      : -1;
  const delta = opts.typeMvt === TypeMvtTank.AJUSTEMENT_JAUGE ? litres : signe * Math.abs(litres);
  if (avant + delta < -0.001) {
    throw new BadRequestException({
      code: 'STOCK_TANK_INSUFFISANT',
      message: `Stock insuffisant dans ${tank.code} (dispo ${avant} L, mouvement ${delta} L).`,
    });
  }
  if (avant + delta > Number(tank.capaciteLitres) + 0.001 && delta > 0) {
    throw new BadRequestException({ message: `Capacité du tank ${tank.code} dépassée.` });
  }
  const apres = avant + delta;
  tank.stockLitres = apres.toFixed(2);
  tank.stockKg = (apres * densite).toFixed(2);
  await m.save(tank);
  return m.save(
    m.create(TankMouvement, {
      tankId: tank.id,
      typeMvt: opts.typeMvt,
      quantiteLitres: litres.toFixed(2),
      quantiteKg: (kg ?? 0).toFixed(2),
      densite: densite.toFixed(4),
      temperature: opts.temperature != null ? String(opts.temperature) : null,
      journalQuartId: opts.journalQuartId ?? null,
      chargementId: opts.chargementId ?? null,
      tankDestinationId: opts.tankDestinationId ?? null,
      stockAvantLitres: avant.toFixed(2),
      stockApresLitres: apres.toFixed(2),
      motif: opts.motif ?? null,
      utilisateurId: opts.utilisateurId ?? null,
    }),
  );
}

