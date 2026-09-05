import { IsInt, IsOptional, IsString } from 'class-validator';
import { Repository } from 'typeorm';
import { Technicien } from '../../database/entities';
import { NotFoundException } from '../../common/http-error';

class TechnicienDto {
  @IsString() matricule: string;
  @IsString() nomPrenom: string;
  @IsOptional() @IsInt() specialiteId?: number;
  @IsOptional() @IsInt() siteId?: number;
  @IsOptional() @IsInt() utilisateurId?: number;
  @IsOptional() @IsString() telephone?: string;
  @IsOptional() coutHoraire?: number;
  @IsOptional() @IsString() statut?: string;
}

export class TechniciensController {
  constructor(private readonly repo: Repository<Technicien>) {}

  lister() {
    return this.repo.find({ relations: ['specialite', 'site', 'utilisateur'], order: { matricule: 'ASC' } });
  }

  async fiche(id: number) {
    const t = await this.repo.findOne({ where: { id }, relations: ['specialite', 'site', 'utilisateur'] });
    if (!t) throw new NotFoundException({ message: 'Technicien introuvable.' });
    return t;
  }

  creer(dto: TechnicienDto) {
    return this.repo.save(
      this.repo.create({
        ...dto,
        matricule: dto.matricule.toUpperCase(),
        coutHoraire: String(dto.coutHoraire ?? 2500),
      }),
    );
  }

  async modifier(id: number, dto: Partial<TechnicienDto>) {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException({ message: 'Technicien introuvable.' });
    Object.assign(t, dto);
    if (dto.coutHoraire != null) t.coutHoraire = String(dto.coutHoraire);
    return this.repo.save(t);
  }
}

