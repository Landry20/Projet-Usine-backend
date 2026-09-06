import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Repository } from 'typeorm';
import {
  CategorieArticle,
  CauseDefaillance,
  ChampPersonnalise,
  FamilleEquipement,
  Fournisseur,
  Parametre,
  Specialite,
} from '../../database/entities';

class CodeLibelleDto {
  @IsString() @MaxLength(20) code: string;
  @IsString() @MaxLength(150) libelle: string;
  @IsOptional() @IsString() categorie?: string;
}

class FournisseurDto {
  @IsString() code: string;
  @IsString() raisonSociale: string;
  @IsOptional() @IsString() contact?: string;
  @IsOptional() @IsString() telephone?: string;
  @IsOptional() @IsString() email?: string;
}

class ChampDto {
  @IsOptional() familleId?: number;
  @IsString() code: string;
  @IsString() libelle: string;
  @IsString() typeChamp: string;
  @IsOptional() @IsString() unite?: string;
  @IsOptional() valeursPossibles?: string[];
  @IsOptional() obligatoire?: boolean;
  @IsOptional() ordreAffichage?: number;
}

export class ReferentielsController {
  constructor(
    private readonly specialites: Repository<Specialite>,
    private readonly causes: Repository<CauseDefaillance>,
    private readonly familles: Repository<FamilleEquipement>,
    private readonly categories: Repository<CategorieArticle>,
    private readonly fournisseurs: Repository<Fournisseur>,
    private readonly params: Repository<Parametre>,
    private readonly champs: Repository<ChampPersonnalise>,
  ) {}

  specialitesListe() {
    return this.specialites.find({ order: { libelle: 'ASC' } });
  }

  creerSpecialite(dto: CodeLibelleDto) {
    return this.specialites.save(this.specialites.create({ code: dto.code.toUpperCase(), libelle: dto.libelle }));
  }

  causesListe() {
    return this.causes.find({ order: { libelle: 'ASC' } });
  }

  creerCause(dto: CodeLibelleDto) {
    return this.causes.save(
      this.causes.create({ code: dto.code.toUpperCase(), libelle: dto.libelle, categorie: dto.categorie ?? null }),
    );
  }

  famillesListe() {
    return this.familles.find({ relations: ['champs'], order: { libelle: 'ASC' } });
  }

  creerFamille(dto: CodeLibelleDto) {
    return this.familles.save(this.familles.create({ code: dto.code.toUpperCase(), libelle: dto.libelle }));
  }

  cats() {
    return this.categories.find({ order: { libelle: 'ASC' } });
  }

  creerCat(dto: CodeLibelleDto) {
    return this.categories.save(this.categories.create({ code: dto.code.toUpperCase(), libelle: dto.libelle }));
  }

  fourns() {
    return this.fournisseurs.find({ order: { raisonSociale: 'ASC' } });
  }

  creerFourn(dto: FournisseurDto) {
    return this.fournisseurs.save(this.fournisseurs.create({ ...dto, code: dto.code.toUpperCase() }));
  }

  async modifierFourn(id: number, dto: Partial<FournisseurDto> & { actif?: boolean }) {
    const actuel = await this.fournisseurs.findOne({ where: { id } });
    if (!actuel) return null;
    if (dto.code) dto.code = dto.code.toUpperCase();
    await this.fournisseurs.update({ id }, dto);
    return this.fournisseurs.findOne({ where: { id } });
  }

  parametres() {
    return this.params.find();
  }

  async majParam(cle: string, valeur: string) {
    await this.params.update({ cle }, { valeur });
    return this.params.findOne({ where: { cle } });
  }

  champsListe() {
    return this.champs.find({ relations: ['famille'], order: { ordreAffichage: 'ASC' } });
  }

  creerChamp(dto: ChampDto) {
    return this.champs.save(this.champs.create(dto));
  }

  champsFamille(id: number) {
    return this.champs.find({ where: { familleId: id, actif: true }, order: { ordreAffichage: 'ASC' } });
  }
}

