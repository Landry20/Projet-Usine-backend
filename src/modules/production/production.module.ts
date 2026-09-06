import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import {  BadRequestException, NotFoundException  } from '../../common/http-error';
import {
  PERMISSIONS,
  StatutEquip,
  StatutLot,
  StatutOf,
  TRANSITIONS_OF,
  TypeMouvement,
  TypeMvtTank,
  TypeProduit,
} from '../../common/constants/enums';
import { paginer, PaginationDto } from '../../common/dto/pagination.dto';
import { genererNumero } from '../../common/utils/numero.util';
import { serieAnneeSurAnnee } from '../../common/utils/series.util';
import {
  ArrivageMatiere,
  Equipement,
  LigneProduction,
  LotDepot,
  LotProduit,
  MouvementProduit,
  Nomenclature,
  NomenclatureLigne,
  OrdreFabrication,
  Produit,
  Tank,
} from '../../database/entities';
import { appliquerMouvementTank } from '../quart/quart.module';

class ProduitDto {
  @IsString() refProduit: string;
  @IsString() designation: string;
  @IsEnum(TypeProduit) typeProduit: TypeProduit;
  @IsOptional() @IsString() unite?: string;
  @IsOptional() @IsNumber() seuilReappro?: number;
  @IsOptional() @IsInt() dureeConservationJours?: number;
}

class OfDto {
  @IsInt() produitId: number;
  @IsNumber() @Min(0.001) quantitePrevue: number;
  @IsOptional() @IsInt() nomenclatureId?: number;
  @IsOptional() @IsInt() ligneId?: number;
  @IsOptional() @IsString() datePlanifiee?: string;
}

class ControleDto {
  @IsNumber() @Min(0) quantiteConforme: number;
  @IsNumber() @Min(0) quantiteRejetee: number;
  @IsOptional() @IsString() emplacement?: string;
}

class LotDepotDto {
  @IsString() libelle: string;
  @IsInt() produitId: number;
  @IsOptional() @IsNumber() capacite?: number;
  @IsOptional() @IsString() emplacement?: string;
}

class ArrivageDto {
  @IsInt() lotDepotId: number;
  @IsNumber() @Min(0.001) quantite: number;
  @IsOptional() @IsString() referenceBl?: string;
  @IsOptional() @IsString() commentaire?: string;
}

export class ProductionController {
  constructor(
    private readonly produits: Repository<Produit>,
    private readonly lignes: Repository<LigneProduction>,
    private readonly nomenclatures: Repository<Nomenclature>,
    private readonly nomLignes: Repository<NomenclatureLigne>,
    private readonly ofs: Repository<OrdreFabrication>,
    private readonly lots: Repository<LotProduit>,
    private readonly mvts: Repository<MouvementProduit>,
    private readonly equipements: Repository<Equipement>,
    private readonly lotsDepot: Repository<LotDepot>,
    private readonly arrivages: Repository<ArrivageMatiere>,
    private readonly ds: DataSource,
  ) {}

  async listerProduits(q: PaginationDto & { type?: TypeProduit; recherche?: string }) {
    const page = Number(q.page ?? 1);
    const limite = Number(q.limite ?? 25);
    const qb = this.produits.createQueryBuilder('p').where('p.deletedAt IS NULL').orderBy('p.refProduit', 'ASC');
    if (q.type) qb.andWhere('p.typeProduit = :t', { t: q.type });
    if (q.recherche) qb.andWhere('(p.refProduit LIKE :r OR p.designation LIKE :r)', { r: `%${q.recherche}%` });
    qb.skip((page - 1) * limite).take(limite);
    const [donnees, total] = await qb.getManyAndCount();
    return paginer(donnees, total, page, limite);
  }

  creerProduit(
    dto: ProduitDto,
    user: { roleCode?: string; permissions?: string[] },
  ) {
    const perms = user.permissions ?? [];
    const admin = user.roleCode === 'ADMIN';
    const peutProd = admin || perms.includes(PERMISSIONS.PRODUCTION_GERER);
    const peutDepot = admin || perms.includes(PERMISSIONS.DEPOT_GERER);
    const peutPf = admin || perms.includes(PERMISSIONS.PF_GERER);
    if (dto.typeProduit === TypeProduit.PRODUIT_FINI && !peutPf && !peutProd) {
      throw new BadRequestException({ message: 'Création d\'un produit fini non autorisée.' });
    }
    if (dto.typeProduit === TypeProduit.MATIERE_PREMIERE && !peutProd && !peutDepot) {
      throw new BadRequestException({ message: 'Création d\'une matière première non autorisée.' });
    }
    if (dto.typeProduit !== TypeProduit.PRODUIT_FINI && dto.typeProduit !== TypeProduit.MATIERE_PREMIERE && !peutProd) {
      throw new BadRequestException({ message: 'Création d\'une matière / semi-fini non autorisée.' });
    }
    return this.produits.save(
      this.produits.create({
        ...dto,
        refProduit: dto.refProduit.toUpperCase(),
        seuilReappro: String(dto.seuilReappro ?? 0),
        quantiteStock: '0',
      }),
    );
  }

  private peutGererProduit(
    user: { roleCode?: string; permissions?: string[] },
    type: TypeProduit,
  ) {
    const perms = user.permissions ?? [];
    const admin = user.roleCode === 'ADMIN';
    if (admin) return true;
    if (type === TypeProduit.PRODUIT_FINI) return perms.includes(PERMISSIONS.PF_GERER) || perms.includes(PERMISSIONS.PRODUCTION_GERER);
    if (type === TypeProduit.MATIERE_PREMIERE) {
      return perms.includes(PERMISSIONS.PRODUCTION_GERER) || perms.includes(PERMISSIONS.DEPOT_GERER);
    }
    return perms.includes(PERMISSIONS.PRODUCTION_GERER);
  }

  async modifierProduit(
    id: number,
    dto: Partial<ProduitDto>,
    user: { roleCode?: string; permissions?: string[] },
  ) {
    const p = await this.produits.findOne({ where: { id } });
    if (!p || !p.actif) throw new NotFoundException({ message: 'Produit introuvable.' });
    if (!this.peutGererProduit(user, p.typeProduit)) {
      throw new BadRequestException({ message: 'Modification non autorisée.' });
    }
    if (dto.refProduit) p.refProduit = dto.refProduit.toUpperCase();
    if (dto.designation) p.designation = dto.designation;
    if (dto.unite) p.unite = dto.unite;
    if (dto.seuilReappro != null) p.seuilReappro = String(dto.seuilReappro);
    if (dto.dureeConservationJours !== undefined) p.dureeConservationJours = dto.dureeConservationJours ?? null;
    return this.produits.save(p);
  }

  async supprimerProduit(id: number, user: { roleCode?: string; permissions?: string[] }) {
    const p = await this.produits.findOne({ where: { id } });
    if (!p) throw new NotFoundException({ message: 'Produit introuvable.' });
    if (!this.peutGererProduit(user, p.typeProduit)) {
      throw new BadRequestException({ message: 'Suppression non autorisée.' });
    }
    p.actif = false;
    await this.produits.save(p);
    await this.produits.softRemove(p);
    return { ok: true };
  }

  lignesListe() {
    return this.lignes.find({ relations: ['equipement', 'site'], order: { code: 'ASC' } });
  }

  creerLigne(dto: { code: string; libelle: string; siteId?: number; equipementId?: number }) {
    return this.lignes.save(this.lignes.create({ ...dto, code: dto.code.toUpperCase() }));
  }

  noms() {
    return this.nomenclatures.find({ relations: ['produit', 'lignes', 'lignes.composant'], order: { code: 'ASC' } });
  }

  async creerNom(dto: { code: string; libelle: string; produitId: number; lignes: { composantId: number; quantite: number }[] }) {
    const nom = await this.nomenclatures.save(
      this.nomenclatures.create({ code: dto.code.toUpperCase(), libelle: dto.libelle, produitId: dto.produitId }),
    );
    for (const l of dto.lignes ?? []) {
      await this.nomLignes.save(this.nomLignes.create({ nomenclatureId: nom.id, composantId: l.composantId, quantite: String(l.quantite) }));
    }
    return this.nomenclatures.findOne({ where: { id: nom.id }, relations: ['produit', 'lignes', 'lignes.composant'] });
  }

  async listerOf(q: PaginationDto & { statut?: StatutOf }) {
    const page = Number(q.page ?? 1);
    const limite = Number(q.limite ?? 25);
    const qb = this.ofs
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.produit', 'p')
      .leftJoinAndSelect('o.ligne', 'l')
      .leftJoinAndSelect('l.equipement', 'e')
      .orderBy('o.createdAt', 'DESC')
      .skip((page - 1) * limite)
      .take(limite);
    if (q.statut) qb.andWhere('o.statut = :st', { st: q.statut });
    const [donnees, total] = await qb.getManyAndCount();
    return paginer(donnees, total, page, limite);
  }

  async ficheOf(id: number) {
    const of = await this.ofs.findOne({
      where: { id },
      relations: ['produit', 'nomenclature', 'nomenclature.lignes', 'nomenclature.lignes.composant', 'ligne', 'ligne.equipement'],
    });
    if (!of) throw new NotFoundException({ message: 'Ordre de fabrication introuvable.' });
    const lots = await this.lots.find({ where: { ofId: id } });
    return { ...of, lots, machineDisponible: of.ligne?.equipement ? of.ligne.equipement.statut === StatutEquip.EN_SERVICE : true };
  }

  async creerOf(dto: OfDto, user: { id: number }) {
    const numero = await genererNumero(this.ds, 'OF');
    return this.ofs.save(
      this.ofs.create({
        numero,
        produitId: dto.produitId,
        quantitePrevue: String(dto.quantitePrevue),
        nomenclatureId: dto.nomenclatureId ?? null,
        ligneId: dto.ligneId ?? null,
        datePlanifiee: dto.datePlanifiee ?? null,
        creePar: user.id,
        statut: dto.datePlanifiee ? StatutOf.PLANIFIE : StatutOf.BROUILLON,
      }),
    );
  }

  async statutOf(
    id: number,
    dto: { statut: StatutOf; motif?: string },
    user: { id: number },
  ) {
    const of = await this.ofs.findOne({ where: { id }, relations: ['ligne', 'ligne.equipement', 'nomenclature', 'nomenclature.lignes'] });
    if (!of) throw new NotFoundException({ message: 'Ordre de fabrication introuvable.' });
    if (!TRANSITIONS_OF[of.statut].includes(dto.statut)) {
      throw new BadRequestException({ message: `Transition ${of.statut} → ${dto.statut} interdite.` });
    }
    if (dto.statut === StatutOf.EN_COURS) {
      const eq = of.ligne?.equipement;
      if (eq && eq.statut !== StatutEquip.EN_SERVICE) {
        throw new BadRequestException({
          code: 'MACHINE_INDISPONIBLE',
          message: `La machine ${eq.codeEquipement} n'est pas en service (${eq.statut}). La production ne peut pas démarrer.`,
        });
      }
      if (!of.dateDebut) of.dateDebut = new Date();
      if (of.nomenclatureId) await this.consommerNomenclature(of, user.id);
    }
    if (dto.statut === StatutOf.EN_ATTENTE && !dto.motif) {
      throw new BadRequestException({ message: "Le motif d'attente est obligatoire (panne, manque matière…)." });
    }
    if (dto.statut === StatutOf.EN_ATTENTE) of.motifAttente = dto.motif ?? null;
    if (dto.statut === StatutOf.CLOTURE) of.dateFin = new Date();
    of.statut = dto.statut;
    await this.ofs.save(of);
    return this.ficheOf(id);
  }

  /** Contrôle qualité : conforme → lot + entrée stock PF. */
  async controle(id: number, dto: ControleDto, user: { id: number }) {
    const of = await this.ofs.findOne({ where: { id }, relations: ['produit'] });
    if (!of) throw new NotFoundException({ message: 'Ordre de fabrication introuvable.' });
    if (of.statut !== StatutOf.CONTROLE && of.statut !== StatutOf.EN_COURS) {
      throw new BadRequestException({ message: 'Le contrôle n\'est possible que sur un OF en cours ou en contrôle.' });
    }
    const dejaControle = Number(of.quantiteConforme) > 0 || (await this.lots.count({ where: { ofId: of.id } })) > 0;
    if (dejaControle) {
      throw new BadRequestException({ message: 'Ce contrôle a déjà généré un lot. Clôturez l\'OF ou contactez un administrateur.' });
    }
    of.quantiteConforme = String(dto.quantiteConforme);
    of.quantiteRejetee = String(dto.quantiteRejetee);
    of.statut = StatutOf.CONTROLE;
    await this.ofs.save(of);

    if (dto.quantiteConforme > 0) {
      const numeroLot = await genererNumero(this.ds, 'LOT');
      const expiration = of.produit.dureeConservationJours
        ? new Date(Date.now() + of.produit.dureeConservationJours * 86400000).toISOString().slice(0, 10)
        : null;
      const lot = await this.lots.save(
        this.lots.create({
          numero: numeroLot,
          produitId: of.produitId,
          ofId: of.id,
          quantite: String(dto.quantiteConforme),
          statut: StatutLot.DISPONIBLE,
          emplacement: dto.emplacement ?? null,
          dateFabrication: new Date().toISOString().slice(0, 10),
          dateExpiration: expiration,
        }),
      );
      await this.mouvement(of.produit, TypeMouvement.ENTREE, dto.quantiteConforme, user.id, {
        lotId: lot.id,
        ofId: of.id,
        motif: `Entrée PF depuis ${of.numero}`,
      });
    }
    return this.ficheOf(id);
  }

  async remplirTank(id: number, dto: { tankId: number; volumeLitres: number }, user: { id: number }) {
    if (!dto.tankId || !(dto.volumeLitres > 0)) {
      throw new BadRequestException({ message: 'Indiquez le tank et un volume positif.' });
    }
    const of = await this.ofs.findOne({ where: { id }, relations: ['produit'] });
    if (!of) throw new NotFoundException({ message: 'Ordre de fabrication introuvable.' });
    if (![StatutOf.EN_COURS, StatutOf.CONTROLE].includes(of.statut)) {
      throw new BadRequestException({ message: 'Le remplissage n’est possible que sur un OF en cours ou au contrôle.' });
    }
    const tank = await this.ds.getRepository(Tank).findOne({ where: { id: dto.tankId } });
    if (!tank) throw new NotFoundException({ message: 'Tank introuvable.' });
    await this.ds.transaction(async (m) => {
      await appliquerMouvementTank(m, {
        tankId: tank.id,
        typeMvt: TypeMvtTank.ENTREE_PRODUCTION,
        quantiteLitres: dto.volumeLitres,
        utilisateurId: user.id,
        motif: `Remplissage depuis ${of.numero}`,
      });
    });
    return this.ds.getRepository(Tank).findOne({ where: { id: tank.id }, relations: ['produit'] });
  }

  async listerLots(q: PaginationDto & { statut?: StatutLot }) {
    const page = Number(q.page ?? 1);
    const limite = Number(q.limite ?? 25);
    const qb = this.lots.createQueryBuilder('l').leftJoinAndSelect('l.produit', 'p').leftJoinAndSelect('l.ordreFabrication', 'o').orderBy('l.createdAt', 'DESC');
    if (q.statut) qb.andWhere('l.statut = :st', { st: q.statut });
    qb.skip((page - 1) * limite).take(limite);
    const [donnees, total] = await qb.getManyAndCount();
    return paginer(donnees, total, page, limite);
  }

  async expedier(id: number, quantite: number, user: { id: number }) {
    const lot = await this.lots.findOne({ where: { id }, relations: ['produit'] });
    if (!lot) throw new NotFoundException({ message: 'Lot introuvable.' });
    if (lot.statut !== StatutLot.DISPONIBLE) throw new BadRequestException({ message: 'Ce lot n\'est pas disponible.' });
    const qte = quantite ?? Number(lot.quantite);
    if (qte > Number(lot.quantite)) throw new BadRequestException({ message: 'Quantité supérieure au lot.' });
    await this.mouvement(lot.produit, TypeMouvement.SORTIE, qte, user.id, { lotId: lot.id, motif: `Expédition lot ${lot.numero}` });
    lot.quantite = String(Number(lot.quantite) - qte);
    if (Number(lot.quantite) <= 0) lot.statut = StatutLot.EXPEDIE;
    await this.lots.save(lot);
    return lot;
  }

  async mvtsListe(q: PaginationDto & { typeStock?: TypeProduit }) {
    const page = Number(q.page ?? 1);
    const limite = Number(q.limite ?? 25);
    const qb = this.mvts.createQueryBuilder('m').leftJoinAndSelect('m.produit', 'p').orderBy('m.dateMvt', 'DESC');
    if (q.typeStock) qb.andWhere('m.typeStock = :t', { t: q.typeStock });
    qb.skip((page - 1) * limite).take(limite);
    const [donnees, total] = await qb.getManyAndCount();
    return paginer(donnees, total, page, limite);
  }

  async dashProd() {
    const ouverts = [StatutOf.BROUILLON, StatutOf.PLANIFIE, StatutOf.EN_COURS, StatutOf.EN_ATTENTE, StatutOf.CONTROLE];
    const [ofOuverts, ofAttente, ofJour] = await Promise.all([
      this.ofs.count({ where: ouverts.map((s) => ({ statut: s })) }),
      this.ofs.count({ where: { statut: StatutOf.EN_ATTENTE } }),
      this.ofs.find({ where: { statut: StatutOf.EN_COURS }, relations: ['produit', 'ligne'], take: 10 }),
    ]);
    const mp = await this.produits.count({ where: { typeProduit: TypeProduit.MATIERE_PREMIERE, actif: true } });
    const series = await serieAnneeSurAnnee(this.ofs, 'o', 'created_at', 'quantite_conforme');
    return { ofOuverts, ofAttente, ofEnCours: ofJour, nbMatieres: mp, series };
  }

  async dashPf() {
    const [lotsDispo, lotsBloques, valeur] = await Promise.all([
      this.lots.count({ where: { statut: StatutLot.DISPONIBLE } }),
      this.lots.count({ where: { statut: StatutLot.BLOQUE } }),
      this.produits
        .createQueryBuilder('p')
        .select('SUM(p.quantiteStock)', 'q')
        .where('p.typeProduit = :t', { t: TypeProduit.PRODUIT_FINI })
        .getRawOne<{ q: string }>(),
    ]);
    const series = await serieAnneeSurAnnee(this.lots, 'l', 'created_at', 'quantite');
    return { lotsDisponibles: lotsDispo, lotsBloques, stockPf: Number(valeur?.q ?? 0), series };
  }

  private async consommerNomenclature(of: OrdreFabrication, utilisateurId: number) {
    const lignes = of.nomenclature?.lignes?.length
      ? of.nomenclature.lignes
      : await this.nomLignes.find({ where: { nomenclatureId: of.nomenclatureId! }, relations: ['composant'] });
    const facteur = Number(of.quantitePrevue);
    for (const l of lignes) {
      const besoin = Number(l.quantite) * facteur;
      const composant = l.composant ?? (await this.produits.findOne({ where: { id: l.composantId } }));
      if (!composant) continue;
      if (Number(composant.quantiteStock) < besoin) {
        throw new BadRequestException({
          code: 'MATIERE_INSUFFISANTE',
          message: `Matière insuffisante : ${composant.refProduit} (besoin ${besoin}, stock ${composant.quantiteStock}).`,
        });
      }
      await this.mouvement(composant, TypeMouvement.SORTIE, besoin, utilisateurId, {
        ofId: of.id,
        motif: `Consommation OF ${of.numero}`,
      });
    }
  }

  private async mouvement(
    produit: Produit,
    type: TypeMouvement,
    quantite: number,
    utilisateurId: number,
    extra: { lotId?: number; ofId?: number; motif?: string },
  ) {
    return this.ds.transaction(async (m) => {
      const p = await m.findOne(Produit, { where: { id: produit.id }, lock: { mode: 'pessimistic_write' } });
      if (!p) throw new NotFoundException({ message: 'Produit introuvable.' });
      const avant = Number(p.quantiteStock);
      let apres = avant;
      if (type === TypeMouvement.ENTREE || type === TypeMouvement.RETOUR) apres = avant + quantite;
      else if (type === TypeMouvement.SORTIE) {
        if (avant < quantite) {
          throw new BadRequestException({
            code: 'STOCK_PRODUIT_INSUFFISANT',
            message: `Stock insuffisant pour ${p.refProduit} (dispo ${avant}, demandé ${quantite}).`,
          });
        }
        apres = avant - quantite;
      }
      p.quantiteStock = apres.toFixed(3);
      await m.save(p);
      return m.save(
        m.create(MouvementProduit, {
          produitId: p.id,
          typeStock: p.typeProduit,
          typeMvt: type,
          quantite: String(quantite),
          stockAvant: avant.toFixed(3),
          stockApres: apres.toFixed(3),
          lotId: extra.lotId ?? null,
          ofId: extra.ofId ?? null,
          motif: extra.motif ?? null,
          utilisateurId,
        }),
      );
    });
  }

  async listerLotsDepot() {
    return this.lotsDepot.find({
      relations: ['produit'],
      order: { numero: 'ASC' },
    });
  }

  async creerLotDepot(dto: LotDepotDto) {
    const produit = await this.produits.findOne({ where: { id: dto.produitId } });
    if (!produit || produit.typeProduit !== TypeProduit.MATIERE_PREMIERE) {
      throw new BadRequestException({ message: 'Choisissez une matière première.' });
    }
    const numero = await genererNumero(this.ds, 'DEP');
    return this.lotsDepot.save(
      this.lotsDepot.create({
        numero,
        libelle: dto.libelle.trim(),
        produitId: produit.id,
        capacite: dto.capacite != null ? String(dto.capacite) : null,
        quantite: '0',
        emplacement: dto.emplacement?.trim() || null,
        actif: true,
      }),
    );
  }

  async listerArrivages() {
    return this.arrivages.find({
      relations: ['lotDepot', 'produit', 'utilisateur'],
      order: { dateArrivage: 'DESC' },
      take: 100,
    });
  }

  async enregistrerArrivage(dto: ArrivageDto, user: { id: number }) {
    if (dto.quantite <= 0) throw new BadRequestException({ message: 'La quantité doit être positive.' });
    const numero = await genererNumero(this.ds, 'ARR');
    return this.ds.transaction(async (m) => {
      const lot = await m.findOne(LotDepot, { where: { id: dto.lotDepotId }, relations: ['produit'] });
      if (!lot || !lot.actif) throw new NotFoundException({ message: 'Lot de dépôt introuvable.' });
      const capacite = lot.capacite != null ? Number(lot.capacite) : null;
      const apresLot = Number(lot.quantite) + dto.quantite;
      if (capacite != null && apresLot > capacite) {
        throw new BadRequestException({
          message: `Capacité du lot ${lot.numero} dépassée (max ${capacite}, après arrivage ${apresLot}).`,
        });
      }
      const produit = await m.findOne(Produit, { where: { id: lot.produitId } });
      if (!produit) throw new NotFoundException({ message: 'Matière première introuvable.' });
      const avant = Number(produit.quantiteStock);
      const apres = avant + dto.quantite;
      lot.quantite = apresLot.toFixed(3);
      produit.quantiteStock = apres.toFixed(3);
      await m.save(lot);
      await m.save(produit);
      const arrivage = await m.save(
        m.create(ArrivageMatiere, {
          numero,
          lotDepotId: lot.id,
          produitId: produit.id,
          quantite: String(dto.quantite),
          referenceBl: dto.referenceBl?.trim() || null,
          commentaire: dto.commentaire?.trim() || null,
          utilisateurId: user.id,
        }),
      );
      await m.save(
        m.create(MouvementProduit, {
          produitId: produit.id,
          typeStock: TypeProduit.MATIERE_PREMIERE,
          typeMvt: TypeMouvement.ENTREE,
          quantite: String(dto.quantite),
          stockAvant: avant.toFixed(3),
          stockApres: apres.toFixed(3),
          lotId: lot.id,
          motif: `Arrivage ${numero} → lot ${lot.numero}`,
          utilisateurId: user.id,
        }),
      );
      return arrivage;
    });
  }
}

