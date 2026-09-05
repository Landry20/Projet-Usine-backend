import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Site } from './ressources.entities';

/**
 * Table role — profils métier (ADMIN, RESP_MAINT, PLANIF, TECH, MAGASIN, DEMANDEUR, DIRECTION, QHSE).
 * La matrice des droits est le paramétrage par défaut et reste modifiable sans redéveloppement.
 */
@Entity({ name: 'role' })
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 80 })
  libelle: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToMany(() => Permission, (p) => p.roles, { cascade: false })
  @JoinTable({
    name: 'role_permission',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];

  @OneToMany(() => Utilisateur, (u) => u.role)
  utilisateurs: Utilisateur[];
}

/** Table permission — codes atomiques (ot.creer, stock.sortir, param.gerer...). */
@Entity({ name: 'permission' })
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 60, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 40 })
  module: string;

  @Column({ type: 'varchar', length: 120 })
  libelle: string;

  @ManyToMany(() => Role, (r) => r.permissions)
  roles: Role[];
}

/**
 * Table utilisateur.
 * RG-12 : suppression logique via deleted_at.
 * RG-20 : un compte désactivé conserve son historique.
 * Colonnes de verrouillage : extension sécurité (non présentes dans le schéma d'origine).
 */
@Entity({ name: 'utilisateur' })
export class Utilisateur {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120, unique: true })
  email: string;

  /** Hash Argon2id — jamais renvoyé dans les réponses API. */
  @Column({ type: 'varchar', length: 255, name: 'mot_de_passe', select: false })
  motDePasse: string;

  @Column({ type: 'varchar', length: 80 })
  nom: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  prenom: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telephone: string | null;

  @Column({ type: 'int', name: 'role_id' })
  roleId: number;

  @ManyToOne(() => Role, (r) => r.utilisateurs, { eager: false })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ type: 'int', name: 'site_id', nullable: true })
  siteId: number | null;

  @ManyToOne(() => Site, { nullable: true })
  @JoinColumn({ name: 'site_id' })
  site: Site | null;

  @Column({ type: 'boolean', default: true })
  actif: boolean;

  @Column({ type: 'boolean', name: 'mfa_actif', default: false })
  mfaActif: boolean;

  @Column({ type: 'timestamptz', name: 'derniere_connexion', nullable: true })
  derniereConnexion: Date | null;

  /** CDC : changement obligatoire à la première connexion. */
  @Column({ type: 'boolean', name: 'doit_changer_mdp', default: true })
  doitChangerMdp: boolean;

  /** Extension sécurité : compteur d'échecs de connexion. */
  @Column({ type: 'int', name: 'tentatives_echec', default: 0 })
  tentativesEchec: number;

  @Column({ type: 'timestamptz', name: 'bloque_jusqu_a', nullable: true })
  bloqueJusqua: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

/**
 * Table refresh_token — ABSENTE du schéma d'origine.
 * Nécessaire pour JWT court + refresh (CDC 5.2 / 14). Documentée ici volontairement.
 */
@Entity({ name: 'refresh_token' })
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'utilisateur_id' })
  utilisateurId: number;

  @ManyToOne(() => Utilisateur, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'utilisateur_id' })
  utilisateur: Utilisateur;

  /** Hash du jeton (le jeton brut n'est jamais stocké). */
  @Column({ type: 'varchar', length: 255 })
  jetonHash: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  adresseIp: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @Column({ type: 'timestamptz' })
  expireLe: Date;

  @Column({ type: 'boolean', default: false })
  revoque: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
