import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '../../common/http-error';
import { TypeMouvement, TypeProduit } from '../../common/constants/enums';
import { genererNumero, genererNumeroLotMp } from '../../common/utils/numero.util';
import {
  ArrivageMatiere,
  DemandeAchat,
  DemandeMatiere,
  Depot,
  Fournisseur,
  LotDepot,
  MouvementLotDepot,
  MouvementProduit,
  Produit,
} from '../../database/entities';

class DepotDto {
  @IsString() code: string;
  @IsString() libelle: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsInt() siteId?: number;
}

class ReceptionDto {
  @IsInt() produitId: number;
  @IsInt() depotId: number;
  @IsNumber() @Min(0.001) poidsBrut: number;
  @IsOptional() @IsInt() fournisseurId?: number;
  @IsOptional() @IsString() fournisseurNom?: string;
  @IsOptional() @IsString() dateReception?: string;
  @IsOptional() @IsString() numeroCamion?: string;
  @IsOptional() @IsString() referenceBl?: string;
  @IsOptional() @IsString() commentaire?: string;
}

class TransfertDto {
  @IsInt() depotDestinationId: number;
  @IsOptional() @IsString() motif?: string;
}

class AchatDto {
  @IsInt() produitId: number;
  @IsOptional() @IsNumber() @Min(0.001) quantite?: number;
  @IsOptional() @IsString() motif?: string;
}

type UserCtx = { id: number; roleCode?: string; siteId?: number | null };

export class DepotController {
  constructor(
    private readonly depots: Repository<Depot>,
    private readonly lots: Repository<LotDepot>,
    private readonly arrivages: Repository<ArrivageMatiere>,
    private readonly mvtsLot: Repository<MouvementLotDepot>,
    private readonly achats: Repository<DemandeAchat>,
    private readonly produits: Repository<Produit>,
    private readonly ds: DataSource,
  ) {}

  async listerDepots(siteId?: number | null) {
    const qb = this.depots.createQueryBuilder('d').leftJoinAndSelect('d.site', 's').orderBy('d.libelle', 'ASC');
    if (siteId) qb.andWhere('(d.siteId IS NULL OR d.siteId = :siteId)', { siteId });
    return qb.getMany();
  }

  async creerDepot(dto: DepotDto) {
    const exist = await this.depots.findOne({ where: { code: dto.code.trim().toUpperCase() } });
    if (exist) throw new BadRequestException({ message: `Le dépôt ${dto.code} existe déjà.` });
    return this.depots.save(
      this.depots.create({
        code: dto.code.trim().toUpperCase(),
        libelle: dto.libelle.trim(),
        type: dto.type?.trim() || 'STOCKAGE',
        siteId: dto.siteId ?? null,
        actif: true,
      }),
    );
  }

  async listerLots(siteId?: number | null) {
    const qb = this.lots
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.produit', 'p')
      .leftJoinAndSelect('l.depot', 'd')
      .orderBy('l.numero', 'DESC');
    if (siteId) qb.andWhere('(l.siteId IS NULL OR l.siteId = :siteId)', { siteId });
    return qb.getMany();
  }

  async listerArrivages(siteId?: number | null) {
    const qb = this.arrivages
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.lotDepot', 'l')
      .leftJoinAndSelect('a.produit', 'p')
      .leftJoinAndSelect('a.depot', 'd')
      .leftJoinAndSelect('a.fournisseur', 'f')
      .leftJoinAndSelect('a.utilisateur', 'u')
      .orderBy('a.dateArrivage', 'DESC')
      .take(150);
    if (siteId) qb.andWhere('(l.siteId IS NULL OR l.siteId = :siteId)', { siteId });
    return qb.getMany();
  }

  async listerMouvements(siteId?: number | null) {
    const qb = this.mvtsLot
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.lotDepot', 'l')
      .leftJoinAndSelect('l.produit', 'p')
      .leftJoinAndSelect('m.utilisateur', 'u')
      .orderBy('m.dateMvt', 'DESC')
      .take(200);
    if (siteId) qb.andWhere('(l.siteId IS NULL OR l.siteId = :siteId)', { siteId });
    return qb.getMany();
  }

  async dashboard(siteId?: number | null) {
    const [lots, depots, produits, demandes] = await Promise.all([
      this.listerLots(siteId),
      this.listerDepots(siteId),
      this.produits.find({ where: { typeProduit: TypeProduit.MATIERE_PREMIERE, actif: true } }),
      this.ds.getRepository(DemandeMatiere).count({ where: { statut: 'DEMANDEE' as never } }),
    ]);
    const parDepot = depots.map((d) => {
      const lotsD = lots.filter((l) => l.depotId === d.id);
      return {
        depot: d,
        nbLots: lotsD.length,
        quantite: lotsD.reduce((s, l) => s + Number(l.quantite), 0).toFixed(3),
      };
    });
    const alertes = produits
      .filter((p) => Number(p.seuilReappro) > 0 && Number(p.quantiteStock) <= Number(p.seuilReappro))
      .map((p) => ({
        produitId: p.id,
        refProduit: p.refProduit,
        designation: p.designation,
        unite: p.unite,
        quantiteStock: p.quantiteStock,
        seuilReappro: p.seuilReappro,
      }));
    return {
      nbLots: lots.length,
      stockTotal: lots.reduce((s, l) => s + Number(l.quantite), 0).toFixed(3),
      demandesEnAttente: demandes,
      alertes,
      parDepot,
      lots,
    };
  }

  async receptionner(dto: ReceptionDto, user: UserCtx, siteId?: number | null) {
    if (dto.poidsBrut <= 0) throw new BadRequestException({ message: 'Le poids brut doit être positif.' });
    const depot = await this.depots.findOne({ where: { id: dto.depotId } });
    if (!depot || !depot.actif) throw new NotFoundException({ message: 'Dépôt introuvable.' });
    const produit = await this.produits.findOne({ where: { id: dto.produitId } });
    if (!produit || produit.typeProduit !== TypeProduit.MATIERE_PREMIERE) {
      throw new BadRequestException({ message: 'Choisissez une matière première.' });
    }
    let fournisseurNom = dto.fournisseurNom?.trim() || null;
    if (dto.fournisseurId) {
      const f = await this.ds.getRepository(Fournisseur).findOne({ where: { id: dto.fournisseurId } });
      if (f) fournisseurNom = f.raisonSociale;
    }
    const numeroLot = await genererNumeroLotMp(this.ds);
    const numeroArr = await genererNumero(this.ds, 'ARR');
    const site = siteId ?? depot.siteId ?? user.siteId ?? null;
    return this.ds.transaction(async (m) => {
      const lot = await m.save(
        m.create(LotDepot, {
          numero: numeroLot,
          libelle: produit.designation,
          produitId: produit.id,
          depotId: depot.id,
          siteId: site,
          quantite: '0',
          etat: 'EN_STOCK',
          actif: true,
        }),
      );
      return this.entrerLot(m, {
        lot,
        produit,
        depot,
        quantite: dto.poidsBrut,
        numeroArr,
        fournisseurId: dto.fournisseurId ?? null,
        fournisseurNom,
        dateReception: dto.dateReception || new Date().toISOString().slice(0, 10),
        numeroCamion: dto.numeroCamion?.trim() || null,
        referenceBl: dto.referenceBl?.trim() || null,
        commentaire: dto.commentaire?.trim() || null,
        utilisateurId: user.id,
      });
    });
  }

  async transferer(lotId: number, dto: TransfertDto, user: UserCtx) {
    const dest = await this.depots.findOne({ where: { id: dto.depotDestinationId } });
    if (!dest || !dest.actif) throw new NotFoundException({ message: 'Dépôt de destination introuvable.' });
    return this.ds.transaction(async (m) => {
      const lot = await m.findOne(LotDepot, { where: { id: lotId }, relations: ['depot', 'produit'] });
      if (!lot || !lot.actif) throw new NotFoundException({ message: 'Lot introuvable.' });
      if (lot.depotId === dest.id) {
        throw new BadRequestException({ message: 'Le lot est déjà dans ce dépôt.' });
      }
      if (Number(lot.quantite) <= 0) {
        throw new BadRequestException({ message: 'Lot vide : aucun transfert possible.' });
      }
      const sourceId = lot.depotId;
      lot.depotId = dest.id;
      lot.emplacement = dest.libelle;
      await m.save(lot);
      await m.save(
        m.create(MouvementLotDepot, {
          lotDepotId: lot.id,
          typeMvt: 'TRANSFERT',
          quantite: lot.quantite,
          depotSourceId: sourceId,
          depotDestId: dest.id,
          motif: dto.motif?.trim() || `Transfert vers ${dest.libelle}`,
          utilisateurId: user.id,
        }),
      );
      return m.findOne(LotDepot, { where: { id: lot.id }, relations: ['produit', 'depot'] });
    });
  }

  async listerAchats() {
    return this.achats.find({
      relations: ['produit', 'demandeur'],
      order: { createdAt: 'DESC' },
      take: 150,
    });
  }

  async creerAchat(dto: AchatDto, user: UserCtx, siteId?: number | null) {
    const produit = await this.produits.findOne({ where: { id: dto.produitId } });
    if (!produit) throw new NotFoundException({ message: 'Matière première introuvable.' });
    const ouvert = await this.achats.findOne({
      where: { produitId: produit.id, statut: 'EN_ATTENTE' },
    });
    if (ouvert) {
      throw new BadRequestException({
        message: `Une demande ${ouvert.numero} est déjà en attente pour ${produit.refProduit}.`,
      });
    }
    const numero = await genererNumero(this.ds, 'DA');
    return this.achats.save(
      this.achats.create({
        numero,
        type: 'MP',
        statut: 'EN_ATTENTE',
        libelle: `Réappro ${produit.refProduit} — ${produit.designation}`,
        quantite: dto.quantite != null ? String(dto.quantite) : null,
        motif: dto.motif?.trim() || `Stock sous le seuil (${produit.quantiteStock} / seuil ${produit.seuilReappro})`,
        produitId: produit.id,
        siteId: siteId ?? user.siteId ?? null,
        demandeurId: user.id,
      }),
    );
  }

  async validerAchat(id: number, user: UserCtx) {
    const da = await this.achats.findOne({ where: { id }, relations: ['produit'] });
    if (!da) throw new NotFoundException({ message: 'Demande d’achat introuvable.' });
    if (da.statut !== 'EN_ATTENTE') throw new BadRequestException({ message: 'Cette demande a déjà été traitée.' });
    da.statut = 'VALIDEE';
    da.valideurId = user.id;
    da.dateDecision = new Date();
    return this.achats.save(da);
  }

  async rejeterAchat(id: number, motif: string, user: UserCtx) {
    if (!motif || motif.trim().length < 3) {
      throw new BadRequestException({ message: 'Le motif de rejet est obligatoire.' });
    }
    const da = await this.achats.findOne({ where: { id } });
    if (!da) throw new NotFoundException({ message: 'Demande d’achat introuvable.' });
    if (da.statut !== 'EN_ATTENTE') throw new BadRequestException({ message: 'Cette demande a déjà été traitée.' });
    da.statut = 'REJETEE';
    da.motifRejet = motif.trim();
    da.valideurId = user.id;
    da.dateDecision = new Date();
    return this.achats.save(da);
  }

  private async entrerLot(
    m: EntityManager,
    opts: {
      lot: LotDepot;
      produit: Produit;
      depot: Depot;
      quantite: number;
      numeroArr: string;
      fournisseurId: number | null;
      fournisseurNom: string | null;
      dateReception: string;
      numeroCamion: string | null;
      referenceBl: string | null;
      commentaire: string | null;
      utilisateurId: number;
    },
  ) {
    const avant = Number(opts.produit.quantiteStock);
    const apresLot = Number(opts.lot.quantite) + opts.quantite;
    const apres = avant + opts.quantite;
    opts.lot.quantite = apresLot.toFixed(3);
    opts.lot.etat = 'EN_STOCK';
    opts.produit.quantiteStock = apres.toFixed(3);
    await m.save(opts.lot);
    await m.save(opts.produit);
    const arrivage = await m.save(
      m.create(ArrivageMatiere, {
        numero: opts.numeroArr,
        lotDepotId: opts.lot.id,
        produitId: opts.produit.id,
        depotId: opts.depot.id,
        quantite: String(opts.quantite),
        fournisseurId: opts.fournisseurId,
        fournisseurNom: opts.fournisseurNom,
        dateReception: opts.dateReception,
        numeroCamion: opts.numeroCamion,
        poidsBrut: String(opts.quantite),
        referenceBl: opts.referenceBl,
        commentaire: opts.commentaire,
        utilisateurId: opts.utilisateurId,
      }),
    );
    await m.save(
      m.create(MouvementProduit, {
        produitId: opts.produit.id,
        typeStock: TypeProduit.MATIERE_PREMIERE,
        typeMvt: TypeMouvement.ENTREE,
        quantite: String(opts.quantite),
        stockAvant: avant.toFixed(3),
        stockApres: apres.toFixed(3),
        lotId: opts.lot.id,
        motif: `Réception ${opts.numeroArr} → ${opts.lot.numero}`,
        utilisateurId: opts.utilisateurId,
      }),
    );
    await m.save(
      m.create(MouvementLotDepot, {
        lotDepotId: opts.lot.id,
        typeMvt: 'ENTREE',
        quantite: String(opts.quantite),
        depotDestId: opts.depot.id,
        motif: `Réception camion ${opts.numeroCamion ?? ''}`.trim(),
        utilisateurId: opts.utilisateurId,
      }),
    );
    opts.lot.produit = opts.produit;
    opts.lot.depot = opts.depot;
    arrivage.lotDepot = opts.lot;
    arrivage.produit = opts.produit;
    arrivage.depot = opts.depot;
    return arrivage;
  }
}
