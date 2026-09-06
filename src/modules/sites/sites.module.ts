import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '../../common/http-error';
import { Localisation, Site, Utilisateur } from '../../database/entities';

class SiteDto {
  @IsString() @MaxLength(20) code: string;
  @IsString() @MaxLength(120) libelle: string;
  @IsOptional() @IsString() client?: string;
  @IsOptional() @IsString() adresse?: string;
  @IsOptional() @IsString() ville?: string;
}

class LocalisationDto {
  @IsInt() siteId: number;
  @IsOptional() @IsInt() parentId?: number;
  @IsString() @MaxLength(30) code: string;
  @IsString() @MaxLength(120) libelle: string;
  @IsOptional() @IsInt() niveau?: number;
}

export class SitesController {
  constructor(
    private readonly sites: Repository<Site>,
    private readonly locs: Repository<Localisation>,
    private readonly users: Repository<Utilisateur>,
  ) {}

  lister() {
    return this.sites.find({ order: { libelle: 'ASC' } });
  }

  async creer(dto: SiteDto, acteur?: { id: number; roleCode?: string }) {
    const existe = await this.sites.findOne({ where: { code: dto.code.toUpperCase() } });
    if (existe) throw new BadRequestException({ message: 'Ce code site existe déjà.' });
    const site = await this.sites.save(this.sites.create({ ...dto, code: dto.code.toUpperCase() }));
    if (acteur?.roleCode === 'ADMIN') {
      const admin = await this.users.findOne({ where: { id: acteur.id } });
      if (admin && !admin.siteId) {
        admin.siteId = site.id;
        await this.users.save(admin);
      }
    }
    return site;
  }

  async modifier(id: number, dto: Partial<SiteDto>) {
    const s = await this.sites.findOne({ where: { id } });
    if (!s) throw new NotFoundException({ message: 'Site introuvable.' });
    Object.assign(s, dto);
    return this.sites.save(s);
  }

  listerLoc() {
    return this.locs.find({ relations: ['site', 'parent'], order: { libelle: 'ASC' } });
  }

  creerLoc(dto: LocalisationDto) {
    return this.locs.save(this.locs.create(dto));
  }

  async supprimerLoc(id: number) {
    const l = await this.locs.findOne({ where: { id } });
    if (!l) throw new NotFoundException({ message: 'Localisation introuvable.' });
    await this.locs.remove(l);
    return { message: 'Localisation retirée.' };
  }
}

