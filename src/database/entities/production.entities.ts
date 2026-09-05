import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StatutLot, StatutOf, TypeMouvement, TypeProduit } from '../../common/constants/enums';
import { Equipement } from './equipements.entities';
import { Site } from './ressources.entities';
import { Utilisateur } from './securite.entities';

/** Ligne / atelier de fabrication — reliée aux machines (pont Production ↔ Maintenance). */
@Entity({ name: 'ligne_production' })
export class LigneProduction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  libelle: string;

  @Column({ type: 'int', name: 'site_id', nullable: true })
  siteId: number | null;

  @ManyToOne(() => Site, { nullable: true })
  @JoinColumn({ name: 'site_id' })
  site: Site | null;

  @Column({ type: 'int', name: 'equipement_id', nullable: true })
  equipementId: number | null;

  @ManyToOne(() => Equipement, { nullable: true })
  @JoinColumn({ name: 'equipement_id' })
  equipement: Equipement | null;

  @Column({ type: 'boolean', default: true })
  actif: boolean;
}

/**
 * Produit industriel (MP / semi-fini / PF).
 * Distinct du stock pièces de maintenance (`article`).
 */
@Entity({ name: 'produit' })
export class Produit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 40, unique: true, name: 'ref_produit' })
  refProduit: string;

  @Column({ type: 'varchar', length: 200 })
  designation: string;

  @Column({ type: 'enum', enum: TypeProduit, name: 'type_produit' })
  typeProduit: TypeProduit;

  @Column({ type: 'varchar', length: 20, default: 'U' })
  unite: string;

  @Column({ type: 'decimal', precision: 14, scale: 3, name: 'quantite_stock', default: 0 })
  quantiteStock: string;

  @Column({ type: 'decimal', precision: 14, scale: 3, name: 'seuil_reappro', default: 0 })
  seuilReappro: string;

  @Column({ type: 'int', name: 'duree_conservation_jours', nullable: true })
  dureeConservationJours: number | null;

  @Column({ type: 'decimal', precision: 8, scale: 4, name: 'densite_reference', nullable: true })
  densiteReference: string | null;

  @Column({ type: 'boolean', default: true })
  actif: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

@Entity({ name: 'nomenclature' })
export class Nomenclature {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  libelle: string;

  @Column({ type: 'int', name: 'produit_id' })
  produitId: number;

  @ManyToOne(() => Produit)
  @JoinColumn({ name: 'produit_id' })
  produit: Produit;

  @Column({ type: 'boolean', default: true })
  actif: boolean;

  @OneToMany(() => NomenclatureLigne, (l) => l.nomenclature, { cascade: true })
  lignes: NomenclatureLigne[];
}

@Entity({ name: 'nomenclature_ligne' })
export class NomenclatureLigne {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'nomenclature_id' })
  nomenclatureId: number;

  @ManyToOne(() => Nomenclature, (n) => n.lignes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nomenclature_id' })
  nomenclature: Nomenclature;

  @Column({ type: 'int', name: 'composant_id' })
  composantId: number;

  @ManyToOne(() => Produit)
  @JoinColumn({ name: 'composant_id' })
  composant: Produit;

  @Column({ type: 'decimal', precision: 14, scale: 3 })
  quantite: string;
}

@Entity({ name: 'ordre_fabrication' })
export class OrdreFabrication {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  numero: string;

  @Column({ type: 'int', name: 'produit_id' })
  produitId: number;

  @ManyToOne(() => Produit)
  @JoinColumn({ name: 'produit_id' })
  produit: Produit;

  @Column({ type: 'int', name: 'nomenclature_id', nullable: true })
  nomenclatureId: number | null;

  @ManyToOne(() => Nomenclature, { nullable: true })
  @JoinColumn({ name: 'nomenclature_id' })
  nomenclature: Nomenclature | null;

  @Column({ type: 'int', name: 'ligne_id', nullable: true })
  ligneId: number | null;

  @ManyToOne(() => LigneProduction, { nullable: true })
  @JoinColumn({ name: 'ligne_id' })
  ligne: LigneProduction | null;

  @Column({ type: 'decimal', precision: 14, scale: 3, name: 'quantite_prevue' })
  quantitePrevue: string;

  @Column({ type: 'decimal', precision: 14, scale: 3, name: 'quantite_conforme', default: 0 })
  quantiteConforme: string;

  @Column({ type: 'decimal', precision: 14, scale: 3, name: 'quantite_rejetee', default: 0 })
  quantiteRejetee: string;

  @Column({ type: 'enum', enum: StatutOf, default: StatutOf.BROUILLON })
  statut: StatutOf;

  @Column({ type: 'date', name: 'date_planifiee', nullable: true })
  datePlanifiee: string | null;

  @Column({ type: 'timestamptz', name: 'date_debut', nullable: true })
  dateDebut: Date | null;

  @Column({ type: 'timestamptz', name: 'date_fin', nullable: true })
  dateFin: Date | null;

  @Column({ type: 'text', name: 'motif_attente', nullable: true })
  motifAttente: string | null;

  @Column({ type: 'int', name: 'cree_par', nullable: true })
  creePar: number | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

@Entity({ name: 'lot_produit' })
export class LotProduit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  numero: string;

  @Column({ type: 'int', name: 'produit_id' })
  produitId: number;

  @ManyToOne(() => Produit)
  @JoinColumn({ name: 'produit_id' })
  produit: Produit;

  @Column({ type: 'int', name: 'of_id', nullable: true })
  ofId: number | null;

  @ManyToOne(() => OrdreFabrication, { nullable: true })
  @JoinColumn({ name: 'of_id' })
  ordreFabrication: OrdreFabrication | null;

  @Column({ type: 'decimal', precision: 14, scale: 3 })
  quantite: string;

  @Column({ type: 'enum', enum: StatutLot, default: StatutLot.DISPONIBLE })
  statut: StatutLot;

  @Column({ type: 'varchar', length: 80, nullable: true })
  emplacement: string | null;

  @Column({ type: 'date', name: 'date_fabrication', nullable: true })
  dateFabrication: string | null;

  @Column({ type: 'date', name: 'date_expiration', nullable: true })
  dateExpiration: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity({ name: 'mouvement_produit' })
export class MouvementProduit {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'int', name: 'produit_id' })
  produitId: number;

  @ManyToOne(() => Produit)
  @JoinColumn({ name: 'produit_id' })
  produit: Produit;

  @Column({ type: 'enum', enum: TypeProduit, name: 'type_stock' })
  typeStock: TypeProduit;

  @Column({ type: 'enum', enum: TypeMouvement, name: 'type_mvt' })
  typeMvt: TypeMouvement;

  @Column({ type: 'decimal', precision: 14, scale: 3 })
  quantite: string;

  @Column({ type: 'decimal', precision: 14, scale: 3, name: 'stock_avant' })
  stockAvant: string;

  @Column({ type: 'decimal', precision: 14, scale: 3, name: 'stock_apres' })
  stockApres: string;

  @Column({ type: 'int', name: 'lot_id', nullable: true })
  lotId: number | null;

  @Column({ type: 'int', name: 'of_id', nullable: true })
  ofId: number | null;

  @Column({ type: 'text', nullable: true })
  motif: string | null;

  @Column({ type: 'int', name: 'utilisateur_id', nullable: true })
  utilisateurId: number | null;

  @ManyToOne(() => Utilisateur, { nullable: true })
  @JoinColumn({ name: 'utilisateur_id' })
  utilisateur: Utilisateur | null;

  @CreateDateColumn({ name: 'date_mvt' })
  dateMvt: Date;
}

/** Emplacement de stockage MP dans le dépôt. */
@Entity({ name: 'lot_depot' })
export class LotDepot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  numero: string;

  @Column({ type: 'varchar', length: 150 })
  libelle: string;

  @Column({ type: 'int', name: 'produit_id' })
  produitId: number;

  @ManyToOne(() => Produit)
  @JoinColumn({ name: 'produit_id' })
  produit: Produit;

  @Column({ type: 'decimal', precision: 14, scale: 3, nullable: true })
  capacite: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 3, default: 0 })
  quantite: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  emplacement: string | null;

  @Column({ type: 'boolean', default: true })
  actif: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/** Réception de matière première dans un lot du dépôt. */
@Entity({ name: 'arrivage_matiere' })
export class ArrivageMatiere {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  numero: string;

  @Column({ type: 'int', name: 'lot_depot_id' })
  lotDepotId: number;

  @ManyToOne(() => LotDepot)
  @JoinColumn({ name: 'lot_depot_id' })
  lotDepot: LotDepot;

  @Column({ type: 'int', name: 'produit_id' })
  produitId: number;

  @ManyToOne(() => Produit)
  @JoinColumn({ name: 'produit_id' })
  produit: Produit;

  @Column({ type: 'decimal', precision: 14, scale: 3 })
  quantite: string;

  @Column({ type: 'varchar', length: 80, name: 'reference_bl', nullable: true })
  referenceBl: string | null;

  @Column({ type: 'text', nullable: true })
  commentaire: string | null;

  @Column({ type: 'int', name: 'utilisateur_id', nullable: true })
  utilisateurId: number | null;

  @ManyToOne(() => Utilisateur, { nullable: true })
  @JoinColumn({ name: 'utilisateur_id' })
  utilisateur: Utilisateur | null;

  @CreateDateColumn({ name: 'date_arrivage' })
  dateArrivage: Date;
}
