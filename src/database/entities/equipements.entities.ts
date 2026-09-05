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
import { CriticiteEquip, StatutEquip, StatutFiche } from '../../common/constants/enums';
import { Localisation } from './ressources.entities';
import { Fournisseur } from './stock.entities';
import { Utilisateur } from './securite.entities';

/** Table famille_equipement — POM, COM, GRP... créable sans redéveloppement. */
@Entity({ name: 'famille_equipement' })
export class FamilleEquipement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  libelle: string;

  @OneToMany(() => ChampPersonnalise, (c) => c.famille)
  champs: ChampPersonnalise[];
}

/**
 * Table champ_personnalise — champs techniques par famille (JSONB côté équipement).
 * Permet d'ajouter puissance, débit, tension... sans modifier le code.
 */
@Entity({ name: 'champ_personnalise' })
export class ChampPersonnalise {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'famille_id', nullable: true })
  familleId: number | null;

  @ManyToOne(() => FamilleEquipement, (f) => f.champs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'famille_id' })
  famille: FamilleEquipement | null;

  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  libelle: string;

  @Column({ type: 'varchar', length: 20, name: 'type_champ' })
  typeChamp: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unite: string | null;

  @Column({ type: 'json', name: 'valeurs_possibles', nullable: true })
  valeursPossibles: string[] | null;

  @Column({ type: 'boolean', default: false })
  obligatoire: boolean;

  @Column({ type: 'smallint', name: 'ordre_affichage', default: 1 })
  ordreAffichage: number;

  @Column({ type: 'boolean', default: true })
  actif: boolean;
}

/**
 * Table equipement — pièce maîtresse du parc.
 * RG-02 : code SITE-FAMILLE-NNN immuable après création.
 * RG-27 : statut_fiche A_VALIDER pour les créations terrain.
 */
@Entity({ name: 'equipement' })
export class Equipement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true, name: 'code_equipement' })
  codeEquipement: string;

  @Column({ type: 'varchar', length: 200 })
  designation: string;

  @Column({ type: 'int', name: 'famille_id', nullable: true })
  familleId: number | null;

  @ManyToOne(() => FamilleEquipement, { nullable: true })
  @JoinColumn({ name: 'famille_id' })
  famille: FamilleEquipement | null;

  @Column({ type: 'int', name: 'parent_id', nullable: true })
  parentId: number | null;

  @ManyToOne(() => Equipement, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Equipement | null;

  @Column({ type: 'int', name: 'localisation_id', nullable: true })
  localisationId: number | null;

  @ManyToOne(() => Localisation, { nullable: true })
  @JoinColumn({ name: 'localisation_id' })
  localisation: Localisation | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  marque: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  modele: string | null;

  @Column({ type: 'varchar', length: 80, name: 'numero_serie', nullable: true })
  numeroSerie: string | null;

  @Column({ type: 'int', name: 'fournisseur_id', nullable: true })
  fournisseurId: number | null;

  @ManyToOne(() => Fournisseur, { nullable: true })
  @JoinColumn({ name: 'fournisseur_id' })
  fournisseur: Fournisseur | null;

  @Column({ type: 'date', name: 'date_mise_service', nullable: true })
  dateMiseService: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'valeur_acquisition', nullable: true })
  valeurAcquisition: string | null;

  @Column({ type: 'date', name: 'fin_garantie', nullable: true })
  finGarantie: string | null;

  @Column({ type: 'enum', enum: CriticiteEquip, default: CriticiteEquip.C })
  criticite: CriticiteEquip;

  @Column({ type: 'enum', enum: StatutEquip, default: StatutEquip.EN_SERVICE })
  statut: StatutEquip;

  @Column({ type: 'varchar', length: 20, name: 'unite_compteur', nullable: true })
  uniteCompteur: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'compteur_actuel', default: 0 })
  compteurActuel: string;

  @Column({ type: 'varchar', length: 60, name: 'qr_code', unique: true, nullable: true })
  qrCode: string | null;

  @Column({ type: 'text', name: 'photo_url', nullable: true })
  photoUrl: string | null;

  /** JSONB Postgres — caractéristiques variables par famille. */
  @Column({ type: 'json', nullable: true })
  caracteristiques: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @Column({ type: 'enum', enum: StatutFiche, name: 'statut_fiche', default: StatutFiche.VALIDEE })
  statutFiche: StatutFiche;

  @Column({ type: 'boolean', name: 'cree_depuis_mobile', default: false })
  creeDepuisMobile: boolean;

  @Column({ type: 'int', name: 'valide_par', nullable: true })
  validePar: number | null;

  @Column({ type: 'timestamptz', name: 'date_validation', nullable: true })
  dateValidation: Date | null;

  @Column({ type: 'char', length: 36, name: 'client_uuid', unique: true, nullable: true })
  clientUuid: string | null;

  @Column({ type: 'int', name: 'import_lot_id', nullable: true })
  importLotId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

/** Table compteur_releve — RG-17 : un relevé ne peut pas être inférieur au précédent. */
@Entity({ name: 'compteur_releve' })
export class CompteurReleve {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'equipement_id' })
  equipementId: number;

  @ManyToOne(() => Equipement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipement_id' })
  equipement: Equipement;

  @Column({ type: 'date', name: 'date_releve' })
  dateReleve: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  valeur: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unite: string | null;

  @Column({ type: 'int', name: 'releve_par', nullable: true })
  relevePar: number | null;

  @ManyToOne(() => Utilisateur, { nullable: true })
  @JoinColumn({ name: 'releve_par' })
  releveur: Utilisateur | null;

  @Column({ type: 'char', length: 36, name: 'client_uuid', unique: true, nullable: true })
  clientUuid: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/** Table import_lot — traçabilité des imports Excel (annulation possible). */
@Entity({ name: 'import_lot' })
export class ImportLot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, name: 'type_import' })
  typeImport: string;

  @Column({ type: 'varchar', length: 200, name: 'nom_fichier', nullable: true })
  nomFichier: string | null;

  @Column({ type: 'int', name: 'nb_lignes', nullable: true })
  nbLignes: number | null;

  @Column({ type: 'int', name: 'nb_succes', nullable: true })
  nbSucces: number | null;

  @Column({ type: 'int', name: 'nb_erreurs', nullable: true })
  nbErreurs: number | null;

  @Column({ type: 'json', nullable: true })
  rapport: unknown;

  @Column({ type: 'boolean', default: false })
  annule: boolean;

  @Column({ type: 'int', name: 'importe_par', nullable: true })
  importePar: number | null;

  @CreateDateColumn({ name: 'date_import' })
  dateImport: Date;
}
