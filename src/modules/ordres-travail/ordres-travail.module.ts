import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import {  BadRequestException, ForbiddenException, NotFoundException  } from '../../common/http-error';
import {
  CodeRole,
  OrigineOt,
  PrioriteOt,
  StatutOt,
  TRANSITIONS_OT,
  TypeMaintenance,
  prioriteDepuisCriticite,
} from '../../common/constants/enums';
import { paginer, PaginationDto } from '../../common/dto/pagination.dto';
import { genererNumero } from '../../common/utils/numero.util';
import {
  CauseDefaillance,
  Equipement,
  JournalAudit,
  OrdreTravail,
  OtMainOeuvre,
  OtOperation,
  Technicien,
} from '../../database/entities';

class CreerOtDto {
  @IsInt() equipementId: number;
  @IsOptional() @IsEnum(TypeMaintenance) typeMaintenance?: TypeMaintenance;
  @IsOptional() @IsEnum(PrioriteOt) priorite?: PrioriteOt;
  @IsOptional() @IsString() descriptionDemandee?: string;
  @IsOptional() @IsString() datePlanifiee?: string;
  @IsOptional() @IsInt() technicienResponsableId?: number;
}

class StatutOtDto {
  @IsEnum(StatutOt) statut: StatutOt;
  @IsOptional() @IsString() motif?: string;
  @IsOptional() @IsString() permisTravailRef?: string;
  @IsOptional() consignationLoto?: boolean;
  @IsOptional() analyseRisqueFaite?: boolean;
}

class PointageDto {
  @IsInt() technicienId: number;
  @IsString() dateTravail: string;
  @IsString() heureDebut: string;
  @IsString() heureFin: string;
  @IsOptional() @IsString() tacheRealisee?: string;
  @IsOptional() @IsString() clientUuid?: string;
}

class FiltreOtDto extends PaginationDto {
  @IsOptional() @IsEnum(StatutOt) statut?: StatutOt;
  @IsOptional() @IsEnum(TypeMaintenance) type?: TypeMaintenance;
  @IsOptional() @IsEnum(PrioriteOt) priorite?: PrioriteOt;
  @IsOptional() @IsInt() technicienId?: number;
  @IsOptional() @IsString() recherche?: string;
}

export class OrdresTravailController {
  constructor(
    private readonly repo: Repository<OrdreTravail>,
    private readonly equipements: Repository<Equipement>,
    private readonly pointages: Repository<OtMainOeuvre>,
    private readonly operations: Repository<OtOperation>,
    private readonly techs: Repository<Technicien>,
    private readonly audit: Repository<JournalAudit>,
    private readonly ds: DataSource,
  ) {}

  async lister(q: FiltreOtDto, user: { id: number; roleCode: string }) {
    const page = Number(q.page ?? 1);
    const limite = Number(q.limite ?? 25);
    const qb = this.repo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.equipement', 'e')
      .leftJoinAndSelect('o.technicienResponsable', 't')
      .orderBy('o.dateCreation', 'DESC')
      .skip((page - 1) * limite)
      .take(limite);
    if (q.statut) qb.andWhere('o.statut = :st', { st: q.statut });
    if (q.type) qb.andWhere('o.typeMaintenance = :tp', { tp: q.type });
    if (q.priorite) qb.andWhere('o.priorite = :pr', { pr: q.priorite });
    if (q.technicienId) qb.andWhere('o.technicienResponsableId = :tid', { tid: Number(q.technicienId) });
    if (q.recherche) {
      qb.andWhere('(o.numero LIKE :r OR e.codeEquipement LIKE :r OR e.designation LIKE :r)', {
        r: `%${q.recherche}%`,
      });
    }
    if (user.roleCode === 'TECH') {
      const tech = await this.techs.findOne({ where: { utilisateurId: user.id } });
      if (tech) qb.andWhere('o.technicienResponsableId = :moi', { moi: tech.id });
    }
    const [donnees, total] = await qb.getManyAndCount();
    return paginer(
      donnees.map((o) => ({ ...o, coutTotal: o.coutTotal })),
      total,
      page,
      limite,
    );
  }

  fiche(id: number) {
    return this.charger(id);
  }

  async creer(dto: CreerOtDto, user: { id: number }) {
    const eq = await this.equipements.findOne({ where: { id: dto.equipementId } });
    if (!eq) throw new NotFoundException({ message: 'Équipement introuvable.' });
    const numero = await genererNumero(this.ds, 'OT');
    const ot = await this.repo.save(
      this.repo.create({
        numero,
        equipementId: dto.equipementId,
        typeMaintenance: dto.typeMaintenance ?? TypeMaintenance.CORRECTIF,
        origine: OrigineOt.CREATION_DIRECTE,
        priorite: dto.priorite ?? prioriteDepuisCriticite(eq.criticite),
        descriptionDemandee: dto.descriptionDemandee ?? null,
        datePlanifiee: dto.datePlanifiee ?? null,
        technicienResponsableId: dto.technicienResponsableId ?? null,
        creePar: user.id,
        statut: dto.technicienResponsableId && dto.datePlanifiee ? StatutOt.PLANIFIE : StatutOt.BROUILLON,
      }),
    );
    return this.charger(ot.id);
  }

  async planifier(
    id: number,
    dto: {
      datePlanifiee?: string;
      technicienResponsableId?: number;
      priorite?: PrioriteOt;
      descriptionDemandee?: string;
      coutExterne?: number;
    },
    user: { roleCode: string },
  ) {
    const ot = await this.repo.findOne({ where: { id } });
    if (!ot) throw new NotFoundException({ message: 'Ordre de travail introuvable.' });
    this.interdireSiClos(ot, user.roleCode);
    if (dto.datePlanifiee) ot.datePlanifiee = dto.datePlanifiee;
    if (dto.technicienResponsableId) ot.technicienResponsableId = dto.technicienResponsableId;
    if (dto.priorite && (user.roleCode === 'RESP_MAINT' || user.roleCode === 'ADMIN')) ot.priorite = dto.priorite;
    if (dto.descriptionDemandee) ot.descriptionDemandee = dto.descriptionDemandee;
    if (dto.coutExterne != null && user.roleCode !== 'TECH') ot.coutExterne = String(dto.coutExterne);
    if (ot.statut === StatutOt.BROUILLON && ot.datePlanifiee && ot.technicienResponsableId) {
      ot.statut = StatutOt.PLANIFIE;
    }
    await this.repo.save(ot);
    return this.charger(id);
  }

  /** Transitions contrôlées : RG-06, RG-15, RG-16. */
  async changerStatut(
    id: number,
    dto: StatutOtDto,
    user: { id: number; roleCode: string },
  ) {
    const ot = await this.charger(id);
    const autorisees = TRANSITIONS_OT[ot.statut];
    if (!autorisees.includes(dto.statut)) {
      throw new BadRequestException({
        code: 'TRANSITION_INTERDITE',
        message: `Transition ${ot.statut} → ${dto.statut} interdite.`,
      });
    }

    if (dto.statut === StatutOt.CLOTURE && !['ADMIN', 'RESP_MAINT'].includes(user.roleCode)) {
      throw new ForbiddenException({ message: 'Seuls le responsable maintenance et l\'administrateur peuvent clôturer.' });
    }
    if (dto.statut === StatutOt.ANNULE && !dto.motif) {
      throw new BadRequestException({ message: 'Le motif d\'annulation est obligatoire.' });
    }
    if (dto.statut === StatutOt.EN_ATTENTE && !dto.motif) {
      throw new BadRequestException({ message: 'Le motif d\'attente est obligatoire.' });
    }

    if (dto.statut === StatutOt.EN_COURS) {
      if (ot.permisTravailRequis && !dto.permisTravailRef && !ot.permisTravailRef) {
        throw new BadRequestException({
          code: 'HSE_PERMIS',
          message: 'Le permis de travail est obligatoire avant le démarrage (RG-16).',
        });
      }
      if (dto.permisTravailRef) ot.permisTravailRef = dto.permisTravailRef;
      if (dto.consignationLoto != null) ot.consignationLoto = dto.consignationLoto;
      if (dto.analyseRisqueFaite != null) ot.analyseRisqueFaite = dto.analyseRisqueFaite;
      if (!ot.dateDebutReelle) ot.dateDebutReelle = new Date();
    }

    if (dto.statut === StatutOt.REALISE) {
      const ops = ot.operations ?? [];
      const manquantes = ops.filter(
        (op) => op.obligatoire && op.statut === 'A_FAIRE',
      );
      if (manquantes.length > 0) {
        throw new BadRequestException({
          code: 'CHECKLIST_INCOMPLETE',
          message: `Impossible de passer à RÉALISÉ : ${manquantes.length} opération(s) obligatoire(s) non renseignée(s) (RG-15).`,
        });
      }
      const naSansMotif = ops.filter((op) => op.statut === 'NON_APPLICABLE' && !op.observation);
      if (naSansMotif.length > 0) {
        throw new BadRequestException({
          message: 'Une opération non applicable doit être justifiée.',
        });
      }
      ot.dateFinReelle = new Date();
    }

    if (dto.statut === StatutOt.CLOTURE) {
      ot.validePar = user.id;
      ot.dateCloture = new Date();
    }
    if (dto.statut === StatutOt.EN_ATTENTE) ot.motifAttente = dto.motif ?? null;
    if (dto.statut === StatutOt.ANNULE) ot.motifAnnulation = dto.motif ?? null;

    ot.statut = dto.statut;
    await this.repo.save(ot);
    return this.charger(id);
  }

  /** Réouverture réservée à l'administrateur, motif + audit (RG-06). */
  async rouvrir(
    id: number,
    motif: string,
    user: { id: number; roleCode: string },
  ) {
    if (user.roleCode !== CodeRole.ADMIN) {
      throw new ForbiddenException({ message: 'Seul l\'administrateur peut réouvrir un OT clôturé.' });
    }
    if (!motif) throw new BadRequestException({ message: 'Le motif de réouverture est obligatoire.' });
    const ot = await this.repo.findOne({ where: { id } });
    if (!ot) throw new NotFoundException({ message: 'Ordre de travail introuvable.' });
    if (ot.statut !== StatutOt.CLOTURE) {
      throw new BadRequestException({ message: 'Seul un OT clôturé peut être réouvert.' });
    }
    const avant = { ...ot };
    ot.statut = StatutOt.REALISE;
    ot.dateCloture = null;
    await this.repo.save(ot);
    await this.audit.save({
      utilisateurId: user.id,
      action: 'UPDATE',
      tableConcernee: 'ordre_travail',
      enregistrementId: String(id),
      valeursAvant: { statut: avant.statut },
      valeursApres: { statut: ot.statut, motifReouverture: motif },
    });
    return this.charger(id);
  }

  async pointer(
    id: number,
    dto: PointageDto,
    user: { roleCode: string },
  ) {
    const ot = await this.repo.findOne({ where: { id } });
    if (!ot) throw new NotFoundException({ message: 'Ordre de travail introuvable.' });
    this.interdireSiClos(ot, user.roleCode);
    if (dto.clientUuid) {
      const doublon = await this.pointages.findOne({ where: { clientUuid: dto.clientUuid } });
      if (doublon) return doublon;
    }
    if (dto.heureFin <= dto.heureDebut) {
      throw new BadRequestException({ message: 'L\'heure de fin doit être postérieure à l\'heure de début.' });
    }
    // RG-11 : pas de chevauchement le même jour pour un technicien.
    const existants = await this.pointages.find({
      where: { technicienId: dto.technicienId, dateTravail: dto.dateTravail },
      relations: ['ordreTravail'],
    });
    const conflit = existants.find(
      (p) => dto.heureDebut < p.heureFin && dto.heureFin > p.heureDebut,
    );
    if (conflit) {
      throw new BadRequestException({
        code: 'CHEVAUCHEMENT',
        message: `Le technicien est déjà pointé sur ${conflit.ordreTravail?.numero ?? 'un autre OT'} de ${conflit.heureDebut} à ${conflit.heureFin}.`,
      });
    }
    const tech = await this.techs.findOne({ where: { id: dto.technicienId } });
    if (!tech) throw new NotFoundException({ message: 'Technicien introuvable.' });
    const duree = this.dureeHeures(dto.heureDebut, dto.heureFin);
    const taux = Number(tech.coutHoraire);
    const ligne = await this.pointages.save(
      this.pointages.create({
        otId: id,
        technicienId: dto.technicienId,
        dateTravail: dto.dateTravail,
        heureDebut: dto.heureDebut,
        heureFin: dto.heureFin,
        dureeH: duree.toFixed(2),
        tauxHoraire: taux.toFixed(2),
        cout: (duree * taux).toFixed(2),
        tacheRealisee: dto.tacheRealisee ?? null,
        clientUuid: dto.clientUuid ?? null,
      }),
    );
    await this.recalculerCouts(id);
    return ligne;
  }

  async rapport(
    id: number,
    dto: {
      travauxRealises?: string;
      diagnostic?: string;
      causeId?: number;
      remede?: string;
      dureeArretH?: number;
    },
    user: { roleCode: string },
  ) {
    const ot = await this.repo.findOne({ where: { id } });
    if (!ot) throw new NotFoundException({ message: 'Ordre de travail introuvable.' });
    this.interdireSiClos(ot, user.roleCode);
    Object.assign(ot, dto);
    if (dto.dureeArretH != null) ot.dureeArretH = String(dto.dureeArretH);
    await this.repo.save(ot);
    return this.charger(id);
  }

  async majOperation(
    otId: number,
    opId: number,
    dto: { statut?: string; valeurMesuree?: number; observation?: string; conforme?: boolean },
    user: { roleCode: string },
  ) {
    const ot = await this.repo.findOne({ where: { id: otId } });
    if (!ot) throw new NotFoundException({ message: 'Ordre de travail introuvable.' });
    this.interdireSiClos(ot, user.roleCode);
    const op = await this.operations.findOne({ where: { id: opId, otId } });
    if (!op) throw new NotFoundException({ message: 'Opération introuvable.' });
    if (dto.statut) op.statut = dto.statut;
    if (dto.valeurMesuree != null) op.valeurMesuree = String(dto.valeurMesuree);
    if (dto.observation !== undefined) op.observation = dto.observation;
    if (dto.conforme != null) op.conforme = dto.conforme;
    if (dto.statut === 'FAIT' || dto.statut === 'NON_APPLICABLE') op.realiseLe = new Date();
    await this.operations.save(op);
    return op;
  }

  async ajouterOperation(
    id: number,
    dto: { libelle: string; obligatoire?: boolean },
  ) {
    const count = await this.operations.count({ where: { otId: id } });
    return this.operations.save(
      this.operations.create({
        otId: id,
        ordre: count + 1,
        libelle: dto.libelle,
        obligatoire: dto.obligatoire ?? true,
      }),
    );
  }

  private interdireSiClos(ot: OrdreTravail, roleCode: string) {
    if (ot.statut === StatutOt.CLOTURE && roleCode !== CodeRole.ADMIN) {
      throw new ForbiddenException({
        code: 'OT_CLOTURE',
        message: 'Un ordre de travail clôturé n\'est plus modifiable (RG-06).',
      });
    }
  }

  private dureeHeures(debut: string, fin: string): number {
    const [hd, md] = debut.split(':').map(Number);
    const [hf, mf] = fin.split(':').map(Number);
    return (hf * 60 + mf - (hd * 60 + md)) / 60;
  }

  private async recalculerCouts(otId: number) {
    const mo = await this.pointages.find({ where: { otId } });
    const coutMo = mo.reduce((s, l) => s + Number(l.cout), 0);
    await this.repo.update({ id: otId }, { coutMainOeuvre: coutMo.toFixed(2) });
  }

  private async charger(id: number) {
    const ot = await this.repo.findOne({
      where: { id },
      relations: [
        'equipement',
        'equipement.localisation',
        'equipement.famille',
        'technicienResponsable',
        'cause',
        'demande',
        'mainOeuvre',
        'mainOeuvre.technicien',
        'operations',
        'pieces',
        'pieces.article',
      ],
    });
    if (!ot) throw new NotFoundException({ message: 'Ordre de travail introuvable.' });
    return { ...ot, coutTotal: ot.coutTotal };
  }
}

