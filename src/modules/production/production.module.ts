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
  TypeProduit,
} from '../../common/constants/enums';
import { paginer, PaginationDto } from '../../common/dto/pagination.dto';
import { genererNumero } from '../../common/utils/numero.util';
import { serieAnneeSurAnnee } from '../../common/utils/series.util';
import {
  Equipement,
  LigneProduction,
  LotProduit,
  MouvementProduit,
  Nomenclature,
  NomenclatureLigne,
  OrdreFabrication,
  Produit,
} from '../../database/entities';

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
    const peutPf = admin || perms.includes(PERMISSIONS.PF_GERER);
    if (dto.typeProduit === TypeProduit.PRODUIT_FINI && !peutPf && !peutProd) {
      throw new BadRequestException({ message: 'Création d\'un produit fini non autorisée.' });
    }
    if (dto.typeProduit !== TypeProduit.PRODUIT_FINI && !peutProd) {
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
}

