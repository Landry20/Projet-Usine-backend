import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { StatutEquip, StatutFiche, CriticiteEquip } from '../../common/constants/enums';
import { paginer, PaginationDto } from '../../common/dto/pagination.dto';
import { formaterCodeEquipement } from '../../common/utils/numero.util';
import {  BadRequestException, NotFoundException  } from '../../common/http-error';
import {
  CompteurReleve,
  Equipement,
  FamilleEquipement,
  ImportLot,
  Localisation,
  OrdreTravail,
  Site,
} from '../../database/entities';

class EquipementDto {
  @IsOptional() @IsString() @MaxLength(30) codeEquipement?: string;
  @IsString() @MaxLength(200) designation: string;
  @IsOptional() @IsInt() familleId?: number;
  @IsOptional() @IsInt() parentId?: number;
  @IsOptional() @IsInt() localisationId?: number;
  @IsOptional() @IsString() marque?: string;
  @IsOptional() @IsString() modele?: string;
  @IsOptional() @IsString() numeroSerie?: string;
  @IsOptional() @IsEnum(CriticiteEquip) criticite?: CriticiteEquip;
  @IsOptional() @IsEnum(StatutEquip) statut?: StatutEquip;
  @IsOptional() @IsString() uniteCompteur?: string;
  @IsOptional() caracteristiques?: Record<string, unknown>;
  @IsOptional() @IsString() observations?: string;
}

class FiltreEquipementDto extends PaginationDto {
  @IsOptional() @IsString() recherche?: string;
  @IsOptional() @IsInt() siteId?: number;
  @IsOptional() @IsInt() familleId?: number;
  @IsOptional() @IsEnum(CriticiteEquip) criticite?: CriticiteEquip;
  @IsOptional() @IsEnum(StatutEquip) statut?: StatutEquip;
}

export class EquipementsController {
  constructor(
    private readonly repo: Repository<Equipement>,
    private readonly familles: Repository<FamilleEquipement>,
    private readonly locs: Repository<Localisation>,
    private readonly sites: Repository<Site>,
    private readonly compteurs: Repository<CompteurReleve>,
    private readonly ots: Repository<OrdreTravail>,
    private readonly lots: Repository<ImportLot>,
  ) {}

  async lister(q: FiltreEquipementDto) {
    const page = Number(q.page ?? 1);
    const limite = Number(q.limite ?? 25);
    const qb = this.repo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.famille', 'f')
      .leftJoinAndSelect('e.localisation', 'l')
      .leftJoinAndSelect('l.site', 's')
      .where('e.deletedAt IS NULL');
    if (q.recherche) {
      qb.andWhere('(e.codeEquipement LIKE :r OR e.designation LIKE :r OR e.qrCode LIKE :r)', {
        r: `%${q.recherche}%`,
      });
    }
    if (q.familleId) qb.andWhere('e.familleId = :fid', { fid: Number(q.familleId) });
    if (q.criticite) qb.andWhere('e.criticite = :c', { c: q.criticite });
    if (q.statut) qb.andWhere('e.statut = :st', { st: q.statut });
    if (q.siteId) qb.andWhere('l.siteId = :sid', { sid: Number(q.siteId) });
    qb.orderBy('e.codeEquipement', 'ASC').skip((page - 1) * limite).take(limite);
    const [donnees, total] = await qb.getManyAndCount();
    return paginer(donnees, total, page, limite);
  }

  async parQr(code: string) {
    const e = await this.repo.findOne({
      where: [{ qrCode: code }, { codeEquipement: code }],
      relations: ['famille', 'localisation', 'localisation.site', 'parent'],
    });
    if (!e) throw new NotFoundException({ message: 'Aucun équipement pour ce QR code.' });
    return this.fiche(e.id);
  }

  fiche(id: number) {
    return this.chargerFiche(id);
  }

  async creer(dto: EquipementDto, user: { roleCode: string }) {
    const code = dto.codeEquipement
      ? dto.codeEquipement.toUpperCase()
      : await this.proposerCode(dto.familleId, dto.localisationId);
    const existe = await this.repo.findOne({ where: { codeEquipement: code } });
    if (existe) throw new BadRequestException({ message: 'Ce code équipement existe déjà.' });
    const e = this.repo.create({
      ...dto,
      codeEquipement: code,
      qrCode: code,
      statutFiche: user.roleCode === 'TECH' || user.roleCode === 'DEMANDEUR' ? StatutFiche.A_VALIDER : StatutFiche.VALIDEE,
      creeDepuisMobile: user.roleCode === 'TECH' || user.roleCode === 'DEMANDEUR',
    });
    const sauve = await this.repo.save(e);
    return this.chargerFiche(sauve.id);
  }

  async dupliquer(id: number) {
    const source = await this.repo.findOne({ where: { id } });
    if (!source) throw new NotFoundException({ message: 'Équipement introuvable.' });
    const code = await this.proposerCode(source.familleId ?? undefined, source.localisationId ?? undefined);
    const copie = this.repo.create({
      ...source,
      id: undefined as unknown as number,
      codeEquipement: code,
      qrCode: code,
      numeroSerie: null,
      clientUuid: null,
    });
    const sauve = await this.repo.save(copie);
    return this.chargerFiche(sauve.id);
  }

  async modifier(id: number, dto: Partial<EquipementDto>) {
    const e = await this.repo.findOne({ where: { id } });
    if (!e) throw new NotFoundException({ message: 'Équipement introuvable.' });
    // RG-02 : le code est immuable après création
    delete (dto as { codeEquipement?: string }).codeEquipement;
    Object.assign(e, dto);
    await this.repo.save(e);
    return this.chargerFiche(id);
  }

  async supprimer(id: number) {
    const e = await this.repo.findOne({ where: { id } });
    if (!e) throw new NotFoundException({ message: 'Équipement introuvable.' });
    e.statut = StatutEquip.REFORME;
    await this.repo.save(e);
    await this.repo.softRemove(e);
    return { message: 'Équipement réformé (suppression logique). L\'historique reste consultable.' };
  }

  async releve(
    body: { equipementId: number; valeur: number; dateReleve?: string; unite?: string },
    user: { id: number; roleCode: string },
  ) {
    const dernier = await this.compteurs.findOne({
      where: { equipementId: body.equipementId },
      order: { dateReleve: 'DESC', id: 'DESC' },
    });
    // RG-17 : un relevé ne peut pas être inférieur au précédent (sauf admin).
    if (dernier && Number(body.valeur) < Number(dernier.valeur) && user.roleCode !== 'ADMIN') {
      throw new BadRequestException({
        code: 'COMPTEUR_INFERIEUR',
        message: `Le relevé (${body.valeur}) est inférieur au dernier relevé (${dernier.valeur}). Un ajustement administrateur est requis.`,
      });
    }
    const ligne = await this.compteurs.save(
      this.compteurs.create({
        equipementId: body.equipementId,
        valeur: String(body.valeur),
        dateReleve: body.dateReleve ?? new Date().toISOString().slice(0, 10),
        unite: body.unite ?? null,
        relevePar: user.id,
      }),
    );
    await this.repo.update({ id: body.equipementId }, { compteurActuel: String(body.valeur) });
    return ligne;
  }

  async importer(
    fichier: Express.Multer.File,
    user: { id: number },
  ) {
    if (!fichier) throw new BadRequestException({ message: 'Fichier Excel manquant.' });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(fichier.buffer as unknown as ArrayBuffer);
    const feuille = wb.worksheets[0];
    const erreurs: { ligne: number; message: string }[] = [];
    let succes = 0;
    const lot = await this.lots.save(
      this.lots.create({
        typeImport: 'EQUIPEMENT',
        nomFichier: fichier.originalname,
        importePar: user.id,
        nbLignes: Math.max(feuille.rowCount - 1, 0),
      }),
    );
    for (let i = 2; i <= feuille.rowCount; i++) {
      const row = feuille.getRow(i);
      const designation = String(row.getCell(1).value ?? '').trim();
      const codeFamille = String(row.getCell(2).value ?? '').trim().toUpperCase();
      const codeSite = String(row.getCell(3).value ?? '').trim().toUpperCase();
      const criticite = String(row.getCell(4).value ?? 'C').trim().toUpperCase() as CriticiteEquip;
      if (!designation) continue;
      try {
        const famille = await this.familles.findOne({ where: { code: codeFamille } });
        const site = await this.sites.findOne({ where: { code: codeSite } });
        const loc = site
          ? await this.locs.findOne({ where: { siteId: site.id } })
          : null;
        const code = await this.proposerCode(famille?.id, loc?.id);
        await this.repo.save(
          this.repo.create({
            designation,
            codeEquipement: code,
            qrCode: code,
            familleId: famille?.id ?? null,
            localisationId: loc?.id ?? null,
            criticite: ['A', 'B', 'C'].includes(criticite) ? criticite : CriticiteEquip.C,
            importLotId: lot.id,
          }),
        );
        succes += 1;
      } catch (err) {
        erreurs.push({ ligne: i, message: err instanceof Error ? err.message : 'Erreur inconnue' });
      }
    }
    lot.nbSucces = succes;
    lot.nbErreurs = erreurs.length;
    lot.rapport = erreurs;
    await this.lots.save(lot);
    return lot;
  }

  private async proposerCode(familleId?: number | null, localisationId?: number | null) {
    let siteCode = 'ABJ';
    let famCode = 'EQP';
    if (localisationId) {
      const loc = await this.locs.findOne({ where: { id: localisationId }, relations: ['site'] });
      if (loc?.site?.code) siteCode = loc.site.code;
    }
    if (familleId) {
      const fam = await this.familles.findOne({ where: { id: familleId } });
      if (fam) famCode = fam.code;
    }
    const prefixe = `${siteCode}-${famCode}-`;
    const derniers = await this.repo
      .createQueryBuilder('e')
      .where('e.codeEquipement LIKE :p', { p: `${prefixe}%` })
      .orderBy('e.codeEquipement', 'DESC')
      .getMany();
    const rang =
      derniers.length === 0
        ? 1
        : Number(derniers[0].codeEquipement.split('-').pop()) + 1;
    return formaterCodeEquipement(siteCode, famCode, Number.isFinite(rang) ? rang : 1);
  }

  private async chargerFiche(id: number) {
    const e = await this.repo.findOne({
      where: { id },
      relations: ['famille', 'localisation', 'localisation.site', 'parent', 'fournisseur'],
    });
    if (!e) throw new NotFoundException({ message: 'Équipement introuvable.' });
    const historique = await this.ots.find({
      where: { equipementId: id },
      order: { dateCreation: 'DESC' },
      take: 20,
    });
    const enfants = await this.repo.find({ where: { parentId: id } });
    const releves = await this.compteurs.find({ where: { equipementId: id }, order: { dateReleve: 'DESC' }, take: 12 });
    const coutCumule = historique
      .filter((o) => o.statut === 'CLOTURE')
      .reduce((s, o) => s + Number(o.coutMainOeuvre) + Number(o.coutPieces) + Number(o.coutExterne), 0);
    return { ...e, historique, enfants, releves, coutCumule };
  }
}

