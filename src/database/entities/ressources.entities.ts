import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Utilisateur } from './securite.entities';

/** Table site — multi-sites dès le Lot 1 (contrainte 5.3). */
@Entity({ name: 'site' })
export class Site {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  libelle: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  client: string | null;

  @Column({ type: 'text', nullable: true })
  adresse: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  ville: string | null;

  @Column({ type: 'varchar', length: 60, default: 'Cote d Ivoire' })
  pays: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @Column({ type: 'boolean', default: true })
  actif: boolean;

  @OneToMany(() => Localisation, (l) => l.site)
  localisations: Localisation[];
}

/** Table localisation — hiérarchie zone / atelier / ligne / poste, profondeur libre. */
@Entity({ name: 'localisation' })
export class Localisation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'site_id' })
  siteId: number;

  @ManyToOne(() => Site, (s) => s.localisations)
  @JoinColumn({ name: 'site_id' })
  site: Site;

  @Column({ type: 'int', name: 'parent_id', nullable: true })
  parentId: number | null;

  @ManyToOne(() => Localisation, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Localisation | null;

  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  libelle: string;

  @Column({ type: 'smallint', default: 1 })
  niveau: number;
}

/** Table specialite — référentiel ouvert (MEC, ELEC, SOUD...). */
@Entity({ name: 'specialite' })
export class Specialite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 80 })
  libelle: string;
}

/** Table technicien — reprise des matricules Access S010…S036. */
@Entity({ name: 'technicien' })
export class Technicien {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  matricule: string;

  @Column({ type: 'varchar', length: 150, name: 'nom_prenom' })
  nomPrenom: string;

  @Column({ type: 'int', name: 'specialite_id', nullable: true })
  specialiteId: number | null;

  @ManyToOne(() => Specialite, { nullable: true })
  @JoinColumn({ name: 'specialite_id' })
  specialite: Specialite | null;

  @Column({ type: 'int', name: 'responsable_id', nullable: true })
  responsableId: number | null;

  @ManyToOne(() => Technicien, { nullable: true })
  @JoinColumn({ name: 'responsable_id' })
  responsable: Technicien | null;

  @Column({ type: 'int', name: 'utilisateur_id', nullable: true })
  utilisateurId: number | null;

  @ManyToOne(() => Utilisateur, { nullable: true })
  @JoinColumn({ name: 'utilisateur_id' })
  utilisateur: Utilisateur | null;

  @Column({ type: 'int', name: 'site_id', nullable: true })
  siteId: number | null;

  @ManyToOne(() => Site, { nullable: true })
  @JoinColumn({ name: 'site_id' })
  site: Site | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIF' })
  statut: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'cout_horaire', default: 0 })
  coutHoraire: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telephone: string | null;

  @Column({ type: 'date', name: 'date_embauche', nullable: true })
  dateEmbauche: string | null;

  @Column({ type: 'text', nullable: true })
  habilitations: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
