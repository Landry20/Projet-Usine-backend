import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Repository } from 'typeorm';
import { paginer, PaginationDto } from '../../common/dto/pagination.dto';
import { hasherMotDePasse, validerComplexiteMotDePasse } from '../../common/utils/crypto.util';
import { compartimentsDuRole } from '../../common/constants/enums';
import { Permission, Role, Utilisateur } from '../../database/entities';
import { BadRequestException, NotFoundException } from '../../common/http-error';

export class CreerUtilisateurDto {
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(80)
  nom: string;

  @IsOptional()
  @IsString()
  prenom?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsInt()
  roleId: number;

  @IsOptional()
  @IsInt()
  siteId?: number;

  @IsOptional()
  @IsString()
  motDePasse?: string;
}

export class ModifierUtilisateurDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  prenom?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsInt()
  roleId?: number;

  @IsOptional()
  @IsInt()
  siteId?: number;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class UtilisateursService {
  constructor(
    private readonly users: Repository<Utilisateur>,
    private readonly roles: Repository<Role>,
    private readonly perms: Repository<Permission>,
  ) {}

  async lister(q: PaginationDto) {
    const page = q.page ?? 1;
    const limite = q.limite ?? 25;
    const [donnees, total] = await this.users.findAndCount({
      relations: ['role', 'site'],
      skip: (page - 1) * limite,
      take: limite,
      order: { nom: 'ASC' },
    });
    return paginer(
      donnees.map((u) => this.publicUser(u)),
      total,
      page,
      limite,
    );
  }

  async creer(dto: CreerUtilisateurDto) {
    const existe = await this.users.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existe) throw new BadRequestException({ code: 'EMAIL_PRIS', message: 'Cette adresse e-mail est déjà utilisée.' });
    const mdp = dto.motDePasse ?? 'ChangeMoi@2026!';
    const err = validerComplexiteMotDePasse(mdp);
    if (err) throw new BadRequestException({ code: 'MOT_DE_PASSE_FAIBLE', message: err });
    const user = this.users.create({
      email: dto.email.toLowerCase().trim(),
      nom: dto.nom,
      prenom: dto.prenom ?? null,
      telephone: dto.telephone ?? null,
      roleId: dto.roleId,
      siteId: dto.siteId ?? null,
      motDePasse: await hasherMotDePasse(mdp),
      doitChangerMdp: true,
      actif: true,
    });
    const sauve = await this.users.save(user);
    return this.trouver(sauve.id);
  }

  async trouver(id: number) {
    const u = await this.users.findOne({ where: { id }, relations: ['role', 'role.permissions', 'site'] });
    if (!u) throw new NotFoundException({ message: 'Utilisateur introuvable.' });
    return this.publicUser(u);
  }

  async modifier(id: number, dto: ModifierUtilisateurDto) {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException({ message: 'Utilisateur introuvable.' });
    Object.assign(u, dto);
    await this.users.save(u);
    return this.trouver(id);
  }

  /** RG-12 / RG-20 : désactivation, pas de suppression physique. */
  async desactiver(id: number) {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException({ message: 'Utilisateur introuvable.' });
    u.actif = false;
    await this.users.save(u);
    await this.users.softRemove(u);
    return { message: 'Utilisateur désactivé. L\'historique est conservé.' };
  }

  async listerRoles() {
    return this.roles.find({ relations: ['permissions'], order: { id: 'ASC' } });
  }

  async listerPermissions() {
    return this.perms.find({ order: { module: 'ASC', code: 'ASC' } });
  }

  async definirPermissionsRole(roleId: number, permissionIds: number[]) {
    const role = await this.roles.findOne({ where: { id: roleId }, relations: ['permissions'] });
    if (!role) throw new NotFoundException({ message: 'Rôle introuvable.' });
    role.permissions = await this.perms.findByIds(permissionIds);
    return this.roles.save(role);
  }

  private publicUser(u: Utilisateur) {
    return {
      id: u.id,
      email: u.email,
      nom: u.nom,
      prenom: u.prenom,
      telephone: u.telephone,
      actif: u.actif,
      doitChangerMdp: u.doitChangerMdp,
      derniereConnexion: u.derniereConnexion,
      role: u.role ? { id: u.role.id, code: u.role.code, libelle: u.role.libelle } : null,
      site: u.site ? { id: u.site.id, code: u.site.code, libelle: u.site.libelle } : null,
      permissions: (u.role?.permissions ?? []).map((p) => p.code),
      compartiments: compartimentsDuRole(u.role?.code),
    };
  }
}
