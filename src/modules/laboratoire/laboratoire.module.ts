import { IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import {  BadRequestException, NotFoundException  } from '../../common/http-error';
import {
  ConclusionBulletin,
  DecisionNc,
  StatutEquip,
  StatutNc,
  StatutValidation,
} from '../../common/constants/enums';
import { paginer, PaginationDto } from '../../common/dto/pagination.dto';
import { genererNumero } from '../../common/utils/numero.util';
import {
  AnalyseResultat,
  BulletinAnalyse,
  Echantillon,
  Equipement,
  JournalQuart,
  NonConformite,
  ParametreAnalyse,
  PointPrelevement,
  Specification,
  Tank,
} from '../../database/entities';

class EchantillonDto {
  @IsInt() produitId: number;
  @IsOptional() @IsInt() pointId?: number;
  @IsOptional() @IsInt() tankId?: number;
  @IsOptional() @IsInt() journalQuartId?: number;
  @IsOptional() @IsInt() chargementId?: number;
  @IsOptional() @IsString() observation?: string;
}

class AnalyseDto {
  @IsInt() parametreId: number;
  @IsOptional() @IsNumber() valeurNumerique?: number;
  @IsOptional() @IsString() valeurTexte?: string;
  @IsOptional() @IsString() appareil?: string;
  @IsOptional() @IsString() observation?: string;
}

class NcDto {
  @IsString() description: string;
  @IsOptional() @IsInt() bulletinId?: number;
  @IsOptional() @IsInt() produitId?: number;
  @IsOptional() @IsInt() tankId?: number;
  @IsOptional() @IsInt() journalQuartId?: number;
}

class DecisionNcDto {
  @IsEnum(DecisionNc) decision: DecisionNc;
  @IsString() justification: string;
}

type UserCtx = { id: number; roleCode?: string };

export class LaboratoireController {
  constructor(
    private readonly points: Repository<PointPrelevement>,
    private readonly parametres: Repository<ParametreAnalyse>,
    private readonly specs: Repository<Specification>,
    private readonly echantillons: Repository<Echantillon>,
    private readonly analyses: Repository<AnalyseResultat>,
    private readonly bulletins: Repository<BulletinAnalyse>,
    private readonly ncs: Repository<NonConformite>,
    private readonly journaux: Repository<JournalQuart>,
    private readonly tanks: Repository<Tank>,
    private readonly equipements: Repository<Equipement>,
    private readonly ds: DataSource,
  ) {}

  pointsListe() {
    return this.points.find({ where: { actif: true }, order: { code: 'ASC' } });
  }

  paramsListe() {
    return this.parametres.find({ where: { actif: true }, order: { ordreAffichage: 'ASC' } });
  }

  async listerEch(q: PaginationDto) {
    const page = Number(q.page ?? 1);
    const limite = Number(q.limite ?? 25);
    const [donnees, total] = await this.echantillons.findAndCount({
      relations: ['produit', 'point', 'tank', 'preleveur'],
      order: { datePrelevement: 'DESC' },
      skip: (page - 1) * limite,
      take: limite,
    });
    return paginer(donnees, total, page, limite);
  }

  async ficheEch(id: number) {
    const e = await this.echantillons.findOne({
      where: { id },
      relations: ['produit', 'point', 'tank', 'preleveur', 'analyses', 'analyses.parametre', 'analyses.specification'],
    });
    if (!e) throw new NotFoundException({ message: 'Échantillon introuvable.' });
    const bulletin = await this.bulletins.findOne({ where: { echantillonId: id } });
    return { ...e, bulletin };
  }

  async creerEch(dto: EchantillonDto, user: UserCtx) {
    const numero = await genererNumero(this.ds, 'ECH');
    return this.echantillons.save(
      this.echantillons.create({
        numero,
        produitId: dto.produitId,
        pointId: dto.pointId ?? null,
        tankId: dto.tankId ?? null,
        journalQuartId: dto.journalQuartId ?? null,
        chargementId: dto.chargementId ?? null,
        prelevePar: user.id,
        observation: dto.observation ?? null,
      }),
    );
  }

  /** RG-45 : conformité calculée contre la spécification en vigueur à la date de prélèvement. */
  async saisirAnalyse(
    id: number,
    dto: AnalyseDto,
    user: UserCtx,
  ) {
    const ech = await this.echantillons.findOne({ where: { id } });
    if (!ech) throw new NotFoundException({ message: 'Échantillon introuvable.' });
    const date = ech.datePrelevement.toISOString().slice(0, 10);
    const spec = await this.specs
      .createQueryBuilder('s')
      .where('s.produit_id = :p AND s.parametre_id = :pa', { p: ech.produitId, pa: dto.parametreId })
      .andWhere('s.date_debut <= :d', { d: date })
      .andWhere('(s.date_fin IS NULL OR s.date_fin >= :d)', { d: date })
      .orderBy('s.date_debut', 'DESC')
      .getOne();
    let conforme: boolean | null = null;
    if (spec && dto.valeurNumerique != null) {
      const minOk = spec.valeurMin == null || dto.valeurNumerique >= Number(spec.valeurMin);
      const maxOk = spec.valeurMax == null || dto.valeurNumerique <= Number(spec.valeurMax);
      conforme = minOk && maxOk;
    }
    const existant = await this.analyses.findOne({ where: { echantillonId: id, parametreId: dto.parametreId } });
    if (existant) {
      existant.valeurNumerique = dto.valeurNumerique != null ? String(dto.valeurNumerique) : null;
      existant.valeurTexte = dto.valeurTexte ?? null;
      existant.specificationId = spec?.id ?? null;
      existant.conforme = conforme;
      existant.analysePar = user.id;
      existant.appareil = dto.appareil ?? null;
      existant.observation = dto.observation ?? null;
      await this.analyses.save(existant);
    } else {
      await this.analyses.save(
        this.analyses.create({
          echantillonId: id,
          parametreId: dto.parametreId,
          valeurNumerique: dto.valeurNumerique != null ? String(dto.valeurNumerique) : null,
          valeurTexte: dto.valeurTexte ?? null,
          specificationId: spec?.id ?? null,
          conforme,
          analysePar: user.id,
          appareil: dto.appareil ?? null,
          observation: dto.observation ?? null,
        }),
      );
    }
    return this.ficheEch(id);
  }

  async listerBa(q: PaginationDto & { statut?: StatutValidation }) {
    const page = Number(q.page ?? 1);
    const limite = Number(q.limite ?? 25);
    const qb = this.bulletins
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.echantillon', 'e')
      .leftJoinAndSelect('e.produit', 'p')
      .orderBy('b.id', 'DESC')
      .skip((page - 1) * limite)
      .take(limite);
    if (q.statut) qb.andWhere('b.statut = :st', { st: q.statut });
    const [donnees, total] = await qb.getManyAndCount();
    return paginer(donnees, total, page, limite);
  }

  async ficheBa(id: number) {
    const b = await this.bulletins.findOne({
      where: { id },
      relations: ['echantillon', 'echantillon.produit', 'echantillon.analyses', 'echantillon.analyses.parametre'],
    });
    if (!b) throw new NotFoundException({ message: 'Bulletin introuvable.' });
    return b;
  }

  async creerBa(dto: { echantillonId: number; commentaire?: string }, user: UserCtx) {
    const existant = await this.bulletins.findOne({ where: { echantillonId: dto.echantillonId } });
    if (existant) return existant;
    const numero = await genererNumero(this.ds, 'BA');
    return this.bulletins.save(
      this.bulletins.create({
        numero,
        echantillonId: dto.echantillonId,
        saisiPar: user.id,
        dateSaisie: new Date(),
        commentaire: dto.commentaire ?? null,
      }),
    );
  }

  async soumettreBa(id: number, user: UserCtx) {
    const b = await this.bulletins.findOne({ where: { id }, relations: ['echantillon', 'echantillon.analyses'] });
    if (!b) throw new NotFoundException({ message: 'Bulletin introuvable.' });
    if (![StatutValidation.BROUILLON, StatutValidation.RETOURNE].includes(b.statut)) {
      throw new BadRequestException({ message: 'Ce bulletin n’est plus saisissable.' });
    }
    const analyses = b.echantillon?.analyses ?? [];
    if (!analyses.length) throw new BadRequestException({ message: 'Saisissez au moins une analyse.' });
    b.conclusion = analyses.some((a) => a.conforme === false)
      ? ConclusionBulletin.NON_CONFORME
      : ConclusionBulletin.CONFORME;
    b.statut = StatutValidation.SOUMIS;
    b.saisiPar = user.id;
    b.dateSaisie = new Date();
    await this.bulletins.save(b);
    return this.ficheBa(id);
  }

  async verifierBa(id: number, user: UserCtx) {
    const b = await this.bulletins.findOneBy({ id });
    if (!b) throw new NotFoundException({ message: 'Bulletin introuvable.' });
    if (b.statut !== StatutValidation.SOUMIS) {
      throw new BadRequestException({ message: 'Seul un bulletin soumis peut être vérifié.' });
    }
    if (b.saisiPar === user.id && user.roleCode !== 'ADMIN') {
      throw new BadRequestException({ message: 'Séparation des tâches : le saisisseur ne peut pas vérifier.' });
    }
    b.statut = StatutValidation.VERIFIE;
    b.verifiePar = user.id;
    await this.bulletins.save(b);
    return this.ficheBa(id);
  }

  async approuverBa(
    id: number,
    body: { derogation?: boolean; commentaire?: string },
    user: UserCtx,
  ) {
    const b = await this.bulletins.findOne({ where: { id }, relations: ['echantillon'] });
    if (!b) throw new NotFoundException({ message: 'Bulletin introuvable.' });
    if (b.statut !== StatutValidation.VERIFIE) {
      throw new BadRequestException({ message: 'Seul un bulletin vérifié peut être approuvé.' });
    }
    if (b.verifiePar === user.id && user.roleCode !== 'ADMIN') {
      throw new BadRequestException({ message: 'Séparation des tâches : le vérificateur ne peut pas approuver.' });
    }
    if (body.derogation) b.conclusion = ConclusionBulletin.DEROGATION;
    b.statut = StatutValidation.APPROUVE;
    b.approuvePar = user.id;
    b.dateApprobation = new Date();
    b.commentaire = body.commentaire ?? b.commentaire;
    await this.bulletins.save(b);
    if (b.conclusion === ConclusionBulletin.NON_CONFORME) {
      const deja = await this.ncs.findOne({ where: { bulletinId: b.id } });
      if (!deja) {
        const numero = await genererNumero(this.ds, 'NC');
        await this.ncs.save(
          this.ncs.create({
            numero,
            bulletinId: b.id,
            produitId: b.echantillon?.produitId ?? null,
            tankId: b.echantillon?.tankId ?? null,
            journalQuartId: b.echantillon?.journalQuartId ?? null,
            description: `Non-conformité automatique depuis ${b.numero}.`,
          }),
        );
      }
    }
    return this.ficheBa(id);
  }

  async listerNc(q: PaginationDto & { statut?: StatutNc }) {
    const page = Number(q.page ?? 1);
    const limite = Number(q.limite ?? 25);
    const qb = this.ncs
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.bulletin', 'b')
      .leftJoinAndSelect('n.produit', 'p')
      .leftJoinAndSelect('n.tank', 't')
      .orderBy('n.dateOuverture', 'DESC')
      .skip((page - 1) * limite)
      .take(limite);
    if (q.statut) qb.andWhere('n.statut = :st', { st: q.statut });
    const [donnees, total] = await qb.getManyAndCount();
    return paginer(donnees, total, page, limite);
  }

  async creerNc(dto: NcDto) {
    const numero = await genererNumero(this.ds, 'NC');
    return this.ncs.save(
      this.ncs.create({
        numero,
        description: dto.description,
        bulletinId: dto.bulletinId ?? null,
        produitId: dto.produitId ?? null,
        tankId: dto.tankId ?? null,
        journalQuartId: dto.journalQuartId ?? null,
      }),
    );
  }

  async decisionNc(
    id: number,
    dto: DecisionNcDto,
    user: UserCtx,
  ) {
    const nc = await this.ncs.findOne({ where: { id }, relations: ['tank'] });
    if (!nc) throw new NotFoundException({ message: 'Non-conformité introuvable.' });
    if (nc.statut !== StatutNc.OUVERTE) {
      throw new BadRequestException({ message: 'Cette non-conformité est déjà clôturée.' });
    }
    if (dto.justification.trim().length < 3) {
      throw new BadRequestException({ message: 'La justification est obligatoire.' });
    }
    nc.decision = dto.decision;
    nc.justification = dto.justification.trim();
    nc.traitePar = user.id;
    nc.dateCloture = new Date();
    nc.statut = StatutNc.CLOTUREE;
    await this.ncs.save(nc);
    if (dto.decision === DecisionNc.BLOCAGE && nc.tankId) {
      await this.tanks.update({ id: nc.tankId }, { statut: 'BLOQUE' });
    }
    return nc;
  }

  async dashLabo() {
    const [nbEch, enCours, ncOuvertes, bulletins] = await Promise.all([
      this.echantillons.count(),
      this.bulletins.count({
        where: [
          { statut: StatutValidation.BROUILLON },
          { statut: StatutValidation.SOUMIS },
          { statut: StatutValidation.VERIFIE },
        ],
      }),
      this.ncs.count({ where: { statut: StatutNc.OUVERTE } }),
      this.bulletins.find({ where: { statut: StatutValidation.APPROUVE } }),
    ]);
    const conformes = bulletins.filter((b) => b.conclusion === ConclusionBulletin.CONFORME).length;
    const taux = bulletins.length ? Math.round((1000 * conformes) / bulletins.length) / 10 : null;
    return {
      echantillons: nbEch,
      bulletinsEnCours: enCours,
      tauxConformite: taux,
      ncOuvertes,
    };
  }

  async dashDirection() {
    const approuves = [StatutValidation.APPROUVE, StatutValidation.DIFFUSE];
    const journaux = await this.journaux.find({ where: approuves.map((s) => ({ statut: s })) });
    const rendements = journaux.map((j) => Number(j.rendementPct)).filter((n) => !Number.isNaN(n));
    const rendementMoyen =
      rendements.length ? Math.round((rendements.reduce((a, b) => a + b, 0) / rendements.length) * 10) / 10 : null;
    const tanks = await this.tanks.find();
    const stockTanksKg = tanks.reduce((s, t) => s + Number(t.stockKg), 0);
    const [eqTotal, eqService, labo, jqAttente, baAttente] = await Promise.all([
      this.equipements.count(),
      this.equipements.count({ where: { statut: StatutEquip.EN_SERVICE } }),
      this.dashLabo(),
      this.journaux.count({ where: [{ statut: StatutValidation.SOUMIS }, { statut: StatutValidation.VERIFIE }] }),
      this.bulletins.count({ where: [{ statut: StatutValidation.SOUMIS }, { statut: StatutValidation.VERIFIE }] }),
    ]);
    return {
      rendementExtraction: rendementMoyen,
      stockTanksKg: Math.round(stockTanksKg * 10) / 10,
      conformiteLabo: labo.tauxConformite,
      disponibiliteMachines: eqTotal ? Math.round((1000 * eqService) / eqTotal) / 10 : null,
      documentsEnAttente: jqAttente + baAttente,
      journauxEnAttente: jqAttente,
      bulletinsEnAttente: baAttente,
      ncOuvertes: labo.ncOuvertes,
    };
  }
}

