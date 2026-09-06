import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '../../common/http-error';
import { TypeMouvement, TypeProduit } from '../../common/constants/enums';
import { envoyerEmail } from '../../common/utils/email.util';
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
  @IsOptional() @IsInt() @Min(1) capaciteMaxLots?: number;
}

class CommanderDto {
  @IsInt() fournisseurId: number;
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

  async compterLots(depotId: number) {
    return this.lots.count({ where: { depotId, actif: true } });
  }

  async enrichirDepot(d: Depot) {
    const nbLotsOccupes = await this.compterLots(d.id);
    return {
      ...d,
      nbLotsOccupes,
      nbPalettes: nbLotsOccupes,
      placesLibres:
        d.capaciteMaxLots != null ? Math.max(0, d.capaciteMaxLots - nbLotsOccupes) : null,
    };
  }

  async listerDepots(siteId?: number | null) {
    const qb = this.depots
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.site', 's')
      .where('d.actif = TRUE')
      .orderBy('d.libelle', 'ASC');
    if (siteId) qb.andWhere('(d.siteId IS NULL OR d.siteId = :siteId)', { siteId });
    const liste = await qb.getMany();
    return Promise.all(liste.map((d) => this.enrichirDepot(d)));
  }

  async ficheDepot(id: number) {
    const d = await this.depots.findOne({ where: { id, actif: true }, relations: ['site'] });
    if (!d) throw new NotFoundException({ message: 'Dépôt introuvable.' });
    const lots = await this.lots.find({
      where: { depotId: id, actif: true },
      relations: ['produit'],
      order: { numero: 'DESC' },
    });
    return { ...(await this.enrichirDepot(d)), lots };
  }

  async creerDepot(dto: DepotDto) {
    const exist = await this.depots.findOne({ where: { code: dto.code.trim().toUpperCase() } });
    if (exist) throw new BadRequestException({ message: `Le dépôt ${dto.code} existe déjà.` });
    const d = await this.depots.save(
      this.depots.create({
        code: dto.code.trim().toUpperCase(),
        libelle: dto.libelle.trim(),
        type: dto.type?.trim() || 'STOCKAGE',
        siteId: dto.siteId ?? null,
        capaciteMaxLots: dto.capaciteMaxLots ?? null,
        actif: true,
      }),
    );
    return this.enrichirDepot(d);
  }

  async modifierDepot(id: number, dto: Partial<DepotDto>) {
    const d = await this.depots.findOne({ where: { id } });
    if (!d || !d.actif) throw new NotFoundException({ message: 'Dépôt introuvable.' });
    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const autre = await this.depots.findOne({ where: { code } });
      if (autre && autre.id !== id) throw new BadRequestException({ message: `Le code ${code} est déjà pris.` });
      d.code = code;
    }
    if (dto.libelle) d.libelle = dto.libelle.trim();
    if (dto.type) d.type = dto.type.trim();
    if (dto.siteId !== undefined) d.siteId = dto.siteId ?? null;
    if (dto.capaciteMaxLots !== undefined) d.capaciteMaxLots = dto.capaciteMaxLots ?? null;
    await this.depots.save(d);
    return this.enrichirDepot(d);
  }

  async supprimerDepot(id: number) {
    const d = await this.depots.findOne({ where: { id } });
    if (!d) throw new NotFoundException({ message: 'Dépôt introuvable.' });
    const nb = await this.compterLots(id);
    if (nb > 0) {
      throw new BadRequestException({ message: `Impossible de supprimer : ${nb} lot(s) encore dans cette zone.` });
    }
    d.actif = false;
    await this.depots.save(d);
    return { ok: true };
  }

  private async garantirPlace(depot: Depot, extra = 1) {
    if (depot.capaciteMaxLots == null) return;
    const occupes = await this.compterLots(depot.id);
    if (occupes + extra > depot.capaciteMaxLots) {
      throw new BadRequestException({
        message: `Le dépôt ${depot.libelle} est plein (${occupes}/${depot.capaciteMaxLots} lots).`,
      });
    }
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
    await this.garantirPlace(depot);
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
    await this.garantirPlace(dest);
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
      relations: ['produit', 'demandeur', 'fournisseur'],
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

  async commanderAchat(id: number, dto: CommanderDto, user: UserCtx) {
    const da = await this.achats.findOne({ where: { id }, relations: ['produit'] });
    if (!da) throw new NotFoundException({ message: 'Demande d’achat introuvable.' });
    if (da.statut === 'REJETEE') throw new BadRequestException({ message: 'Cette demande a été rejetée.' });
    if (da.statut === 'COMMANDEE' && da.emailEnvoye) {
      throw new BadRequestException({ message: 'La commande a déjà été envoyée au fournisseur.' });
    }
    const fourn = await this.ds.getRepository(Fournisseur).findOne({ where: { id: dto.fournisseurId, actif: true } });
    if (!fourn) throw new NotFoundException({ message: 'Fournisseur introuvable.' });
    if (!fourn.email) {
      throw new BadRequestException({ message: `Le fournisseur ${fourn.raisonSociale} n’a pas d’e-mail.` });
    }
    if (da.statut === 'EN_ATTENTE') {
      da.statut = 'VALIDEE';
      da.valideurId = user.id;
      da.dateDecision = new Date();
    }
    const qte = da.quantite ?? 'à confirmer';
    const matiere = da.produit ? `${da.produit.refProduit} — ${da.produit.designation}` : da.libelle;
    const mail = await envoyerEmail({
      to: fourn.email,
      subject: `Commande matière première ${da.numero} — ManuPro`,
      text: [
        `Bonjour ${fourn.raisonSociale},`,
        ``,
        `Nous vous passons commande de matière première :`,
        `Référence demande : ${da.numero}`,
        `Matière : ${matiere}`,
        `Quantité : ${qte}`,
        da.motif ? `Motif : ${da.motif}` : '',
        ``,
        `Merci de confirmer le délai de livraison.`,
        `ManuPro — Direction des achats`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
    da.fournisseurId = fourn.id;
    da.statut = 'COMMANDEE';
    da.emailEnvoye = mail.envoye;
    da.emailErreur = mail.envoye ? null : mail.raison ?? null;
    da.valideurId = user.id;
    await this.achats.save(da);
    return this.achats.findOne({ where: { id: da.id }, relations: ['produit', 'demandeur', 'fournisseur'] });
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
