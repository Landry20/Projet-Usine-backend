import { IsArray, IsBoolean, IsEmail, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Repository } from 'typeorm';
import { paginer, PaginationDto } from '../../common/dto/pagination.dto';
import { hasherMotDePasse, validerComplexiteMotDePasse } from '../../common/utils/crypto.util';
import { resoudreCompartiments } from '../../common/constants/enums';
import { Permission, Role, Utilisateur } from '../../database/entities';
import { BadRequestException, ForbiddenException, NotFoundException } from '../../common/http-error';

type Acteur = { id: number; roleCode?: string; siteId?: number | null };

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
  @IsArray()
  @IsString({ each: true })
  compartiments?: string[];

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
  @IsArray()
  @IsString({ each: true })
  compartiments?: string[];

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

const ROLES_SENSIBLES = new Set(['ADMIN', 'DIRECTION_GENERALE']);
const PEUT_GERER = new Set(['ADMIN', 'DIRECTION', 'DIRECTION_GENERALE', 'CHEF_USINE']);

export class UtilisateursService {
  constructor(
    private readonly users: Repository<Utilisateur>,
    private readonly roles: Repository<Role>,
    private readonly perms: Repository<Permission>,
  ) {}

  private estAdmin(acteur: Acteur) {
    return acteur.roleCode === 'ADMIN';
  }

  private siteForce(acteur: Acteur, demande?: number | null, usineHeader?: number | null) {
    if (this.estAdmin(acteur)) return demande ?? usineHeader ?? null;
    return acteur.siteId ?? null;
  }

  async lister(q: PaginationDto, acteur: Acteur, usineHeader?: number | null) {
    const page = q.page ?? 1;
    const limite = q.limite ?? 25;
    const site = this.siteForce(acteur, undefined, usineHeader);
    const qb = this.users.createQueryBuilder('u').leftJoinAndSelect('u.role', 'r').leftJoinAndSelect('u.site', 's');
    if (site) qb.andWhere('u.siteId = :site', { site });
    qb.orderBy('u.nom', 'ASC').skip((page - 1) * limite).take(limite);
    const [donnees, total] = await qb.getManyAndCount();
    return paginer(
      donnees.map((u) => this.publicUser(u)),
      total,
      page,
      limite,
    );
  }

  async creer(dto: CreerUtilisateurDto, acteur: Acteur, usineHeader?: number | null) {
    if (!PEUT_GERER.has(acteur.roleCode ?? '')) {
      throw new ForbiddenException({ message: 'Vous ne pouvez pas créer d’employé.' });
    }
    const existe = await this.users.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existe) throw new BadRequestException({ code: 'EMAIL_PRIS', message: 'Cette adresse e-mail est déjà utilisée.' });
    const role = await this.roles.findOne({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException({ message: 'Rôle introuvable.' });
    if (!this.estAdmin(acteur) && ROLES_SENSIBLES.has(role.code)) {
      throw new ForbiddenException({ message: 'Seul l’administrateur peut créer ce profil.' });
    }
    if (!this.estAdmin(acteur) && role.code === 'DIRECTION' && acteur.roleCode === 'DIRECTION') {
      throw new ForbiddenException({ message: 'Un directeur ne crée pas un autre directeur.' });
    }
    const siteId = this.siteForce(acteur, dto.siteId ?? null, usineHeader);
    if (!this.estAdmin(acteur) && !siteId) {
      throw new BadRequestException({ message: 'Aucun site d’usine n’est associé à votre compte.' });
    }
    const mdp = dto.motDePasse ?? 'ChangeMoi@2026!';
    const err = validerComplexiteMotDePasse(mdp);
    if (err) throw new BadRequestException({ code: 'MOT_DE_PASSE_FAIBLE', message: err });
    const user = this.users.create({
      email: dto.email.toLowerCase().trim(),
      nom: dto.nom,
      prenom: dto.prenom ?? null,
      telephone: dto.telephone ?? null,
      roleId: dto.roleId,
      siteId,
      compartiments: dto.compartiments?.length ? dto.compartiments : null,
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

  async modifier(id: number, dto: ModifierUtilisateurDto, acteur: Acteur) {
    const u = await this.users.findOne({ where: { id }, relations: ['role'] });
    if (!u) throw new NotFoundException({ message: 'Utilisateur introuvable.' });
    if (!this.estAdmin(acteur) && u.siteId !== acteur.siteId) {
      throw new ForbiddenException({ message: 'Cet employé n’appartient pas à votre usine.' });
    }
    if (dto.roleId) {
      const role = await this.roles.findOne({ where: { id: dto.roleId } });
      if (role && !this.estAdmin(acteur) && ROLES_SENSIBLES.has(role.code)) {
        throw new ForbiddenException({ message: 'Rôle non autorisé.' });
      }
      u.roleId = dto.roleId;
    }
    if (dto.nom !== undefined) u.nom = dto.nom;
    if (dto.prenom !== undefined) u.prenom = dto.prenom ?? null;
    if (dto.telephone !== undefined) u.telephone = dto.telephone ?? null;
    if (dto.actif !== undefined) u.actif = dto.actif;
    if (dto.compartiments !== undefined) u.compartiments = dto.compartiments?.length ? dto.compartiments : null;
    if (this.estAdmin(acteur) && dto.siteId !== undefined) u.siteId = dto.siteId ?? null;
    await this.users.save(u);
    return this.trouver(id);
  }

  async desactiver(id: number, acteur: Acteur) {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException({ message: 'Utilisateur introuvable.' });
    if (u.id === acteur.id) throw new BadRequestException({ message: 'Vous ne pouvez pas vous désactiver.' });
    if (!this.estAdmin(acteur) && u.siteId !== acteur.siteId) {
      throw new ForbiddenException({ message: 'Cet employé n’appartient pas à votre usine.' });
    }
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
      siteId: u.siteId,
      role: u.role ? { id: u.role.id, code: u.role.code, libelle: u.role.libelle } : null,
      site: u.site ? { id: u.site.id, code: u.site.code, libelle: u.site.libelle } : null,
      permissions: (u.role?.permissions ?? []).map((p) => p.code),
      compartiments: resoudreCompartiments({ roleCode: u.role?.code, compartiments: u.compartiments }),
    };
  }
}
