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
import {
  OrigineOt,
  PrioriteOt,
  StatutDemandePiece,
  StatutDi,
  StatutOt,
  TypeMaintenance,
} from '../../common/constants/enums';
import { Equipement } from './equipements.entities';
import { Article } from './stock.entities';
import { Technicien } from './ressources.entities';
import { Utilisateur } from './securite.entities';

/** Table cause_defaillance — référentiel 5M, ouvert. */
@Entity({ name: 'cause_defaillance' })
export class CauseDefaillance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  libelle: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  categorie: string | null;
}

/**
 * Table demande_intervention.
 * Numéro DI-AAAA-NNNNN généré côté serveur uniquement (RG-01).
 */
@Entity({ name: 'demande_intervention' })
export class DemandeIntervention {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  numero: string;

  @Column({ type: 'int', name: 'equipement_id' })
  equipementId: number;

  @ManyToOne(() => Equipement)
  @JoinColumn({ name: 'equipement_id' })
  equipement: Equipement;

  @Column({ type: 'int', name: 'demandeur_id' })
  demandeurId: number;

  @ManyToOne(() => Utilisateur)
  @JoinColumn({ name: 'demandeur_id' })
  demandeur: Utilisateur;

  @CreateDateColumn({ name: 'date_demande' })
  dateDemande: Date;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: PrioriteOt, default: PrioriteOt.P3_NORMALE })
  urgence: PrioriteOt;

  @Column({ type: 'boolean', name: 'arret_production', default: false })
  arretProduction: boolean;

  @Column({ type: 'enum', enum: StatutDi, default: StatutDi.NOUVELLE })
  statut: StatutDi;

  @Column({ type: 'int', name: 'ot_id', nullable: true })
  otId: number | null;

  @Column({ type: 'text', name: 'motif_rejet', nullable: true })
  motifRejet: string | null;

  @Column({ type: 'int', name: 'traite_par', nullable: true })
  traitePar: number | null;

  @Column({ type: 'timestamptz', name: 'date_traitement', nullable: true })
  dateTraitement: Date | null;

  @Column({ type: 'char', length: 36, name: 'client_uuid', unique: true, nullable: true })
  clientUuid: string | null;
}

/**
 * Table ordre_travail — pièce maîtresse du système.
 * cout_total = cout_main_oeuvre + cout_pieces + cout_externe (RG-07, jamais saisi).
 */
@Entity({ name: 'ordre_travail' })
export class OrdreTravail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  numero: string;

  @Column({ type: 'int', name: 'equipement_id' })
  equipementId: number;

  @ManyToOne(() => Equipement)
  @JoinColumn({ name: 'equipement_id' })
  equipement: Equipement;

  @Column({ type: 'enum', enum: TypeMaintenance, name: 'type_maintenance' })
  typeMaintenance: TypeMaintenance;

  @Column({ type: 'enum', enum: OrigineOt, default: OrigineOt.CREATION_DIRECTE })
  origine: OrigineOt;

  @Column({ type: 'int', name: 'plan_id', nullable: true })
  planId: number | null;

  @Column({ type: 'int', name: 'gamme_id', nullable: true })
  gammeId: number | null;

  @Column({ type: 'int', name: 'demande_id', nullable: true })
  demandeId: number | null;

  @ManyToOne(() => DemandeIntervention, { nullable: true })
  @JoinColumn({ name: 'demande_id' })
  demande: DemandeIntervention | null;

  @Column({ type: 'enum', enum: PrioriteOt, default: PrioriteOt.P3_NORMALE })
  priorite: PrioriteOt;

  @Column({ type: 'enum', enum: StatutOt, default: StatutOt.BROUILLON })
  statut: StatutOt;

  @Column({ type: 'text', name: 'description_demandee', nullable: true })
  descriptionDemandee: string | null;

  @CreateDateColumn({ name: 'date_creation' })
  dateCreation: Date;

  @Column({ type: 'date', name: 'date_planifiee', nullable: true })
  datePlanifiee: string | null;

  @Column({ type: 'int', name: 'technicien_responsable_id', nullable: true })
  technicienResponsableId: number | null;

  @ManyToOne(() => Technicien, { nullable: true })
  @JoinColumn({ name: 'technicien_responsable_id' })
  technicienResponsable: Technicien | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, name: 'duree_estimee_h', nullable: true })
  dureeEstimeeH: string | null;

  @Column({ type: 'timestamptz', name: 'date_debut_reelle', nullable: true })
  dateDebutReelle: Date | null;

  @Column({ type: 'timestamptz', name: 'date_fin_reelle', nullable: true })
  dateFinReelle: Date | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'duree_arret_h', default: 0 })
  dureeArretH: string;

  @Column({ type: 'text', name: 'travaux_realises', nullable: true })
  travauxRealises: string | null;

  @Column({ type: 'text', nullable: true })
  diagnostic: string | null;

  @Column({ type: 'int', name: 'cause_id', nullable: true })
  causeId: number | null;

  @ManyToOne(() => CauseDefaillance, { nullable: true })
  @JoinColumn({ name: 'cause_id' })
  cause: CauseDefaillance | null;

  @Column({ type: 'text', nullable: true })
  remede: string | null;

  @Column({ type: 'boolean', name: 'permis_travail_requis', default: false })
  permisTravailRequis: boolean;

  @Column({ type: 'varchar', length: 40, name: 'permis_travail_ref', nullable: true })
  permisTravailRef: string | null;

  @Column({ type: 'boolean', name: 'consignation_loto', default: false })
  consignationLoto: boolean;

  @Column({ type: 'boolean', name: 'analyse_risque_faite', default: false })
  analyseRisqueFaite: boolean;

  @Column({ type: 'boolean', name: 'incident_associe', default: false })
  incidentAssocie: boolean;

  @Column({ type: 'text', name: 'observations_hse', nullable: true })
  observationsHse: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'cout_main_oeuvre', default: 0 })
  coutMainOeuvre: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'cout_pieces', default: 0 })
  coutPieces: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'cout_externe', default: 0 })
  coutExterne: string;

  @Column({ type: 'int', name: 'valide_par', nullable: true })
  validePar: number | null;

  @Column({ type: 'timestamptz', name: 'date_cloture', nullable: true })
  dateCloture: Date | null;

  @Column({ type: 'int', name: 'cree_par', nullable: true })
  creePar: number | null;

  @Column({ type: 'text', name: 'motif_attente', nullable: true })
  motifAttente: string | null;

  @Column({ type: 'text', name: 'motif_annulation', nullable: true })
  motifAnnulation: string | null;

  @Column({ type: 'char', length: 36, name: 'client_uuid', unique: true, nullable: true })
  clientUuid: string | null;

  @Column({ type: 'boolean', name: 'saisi_hors_ligne', default: false })
  saisiHorsLigne: boolean;

  @Column({ type: 'timestamptz', name: 'date_saisie_terrain', nullable: true })
  dateSaisieTerrain: Date | null;

  @Column({ type: 'timestamptz', name: 'date_synchronisation', nullable: true })
  dateSynchronisation: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @OneToMany(() => OtMainOeuvre, (m) => m.ordreTravail)
  mainOeuvre: OtMainOeuvre[];

  @OneToMany(() => OtOperation, (o) => o.ordreTravail)
  operations: OtOperation[];

  @OneToMany(() => OtPiece, (p) => p.ordreTravail)
  pieces: OtPiece[];

  /** Coût total calculé en mémoire (colonne générée côté Postgres). */
  get coutTotal(): number {
    return Number(this.coutMainOeuvre) + Number(this.coutPieces) + Number(this.coutExterne);
  }
}

/** Table ot_main_oeuvre — pointage horaire, RG-11 chevauchement interdit. */
@Entity({ name: 'ot_main_oeuvre' })
export class OtMainOeuvre {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'ot_id' })
  otId: number;

  @ManyToOne(() => OrdreTravail, (o) => o.mainOeuvre, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ot_id' })
  ordreTravail: OrdreTravail;

  @Column({ type: 'int', name: 'technicien_id' })
  technicienId: number;

  @ManyToOne(() => Technicien)
  @JoinColumn({ name: 'technicien_id' })
  technicien: Technicien;

  @Column({ type: 'date', name: 'date_travail' })
  dateTravail: string;

  @Column({ type: 'time', name: 'heure_debut' })
  heureDebut: string;

  @Column({ type: 'time', name: 'heure_fin' })
  heureFin: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, name: 'duree_h' })
  dureeH: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'taux_horaire', default: 0 })
  tauxHoraire: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  cout: string;

  @Column({ type: 'text', name: 'tache_realisee', nullable: true })
  tacheRealisee: string | null;

  @Column({ type: 'char', length: 36, name: 'client_uuid', unique: true, nullable: true })
  clientUuid: string | null;

  @Column({ type: 'timestamptz', name: 'date_saisie_terrain', nullable: true })
  dateSaisieTerrain: Date | null;

  @Column({ type: 'timestamptz', name: 'date_synchronisation', nullable: true })
  dateSynchronisation: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/** Table ot_operation — copie de la check-list à la création de l'OT. */
@Entity({ name: 'ot_operation' })
export class OtOperation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'ot_id' })
  otId: number;

  @ManyToOne(() => OrdreTravail, (o) => o.operations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ot_id' })
  ordreTravail: OrdreTravail;

  @Column({ type: 'int', name: 'gamme_operation_id', nullable: true })
  gammeOperationId: number | null;

  @Column({ type: 'smallint' })
  ordre: number;

  @Column({ type: 'varchar', length: 200 })
  libelle: string;

  @Column({ type: 'varchar', length: 20, default: 'A_FAIRE' })
  statut: string;

  @Column({ type: 'decimal', precision: 12, scale: 3, name: 'valeur_mesuree', nullable: true })
  valeurMesuree: string | null;

  @Column({ type: 'boolean', nullable: true })
  conforme: boolean | null;

  @Column({ type: 'text', nullable: true })
  observation: string | null;

  @Column({ type: 'int', name: 'realise_par', nullable: true })
  realisePar: number | null;

  @Column({ type: 'timestamptz', name: 'realise_le', nullable: true })
  realiseLe: Date | null;

  @Column({ type: 'boolean', default: true })
  obligatoire: boolean;

  @Column({ type: 'char', length: 36, name: 'client_uuid', unique: true, nullable: true })
  clientUuid: string | null;
}

/** Table ot_piece — consommation validée (déclenche mouvement SORTIE). */
@Entity({ name: 'ot_piece' })
export class OtPiece {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'ot_id' })
  otId: number;

  @ManyToOne(() => OrdreTravail, (o) => o.pieces, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ot_id' })
  ordreTravail: OrdreTravail;

  @Column({ type: 'int', name: 'article_id' })
  articleId: number;

  @ManyToOne(() => Article)
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantite: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'prix_unitaire', default: 0 })
  prixUnitaire: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  montant: string;

  @CreateDateColumn({ name: 'date_sortie' })
  dateSortie: Date;

  @Column({ type: 'int', name: 'delivre_par', nullable: true })
  delivrePar: number | null;

  @Column({ type: 'bigint', name: 'mouvement_id', nullable: true })
  mouvementId: string | null;

  @Column({ type: 'char', length: 36, name: 'client_uuid', unique: true, nullable: true })
  clientUuid: string | null;
}

/**
 * Table demande_piece — sortie saisie hors ligne ou par le technicien.
 * RG-26 : ne devient un mouvement qu'après validation magasinier.
 */
@Entity({ name: 'demande_piece' })
export class DemandePiece {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'char', length: 36, name: 'client_uuid', unique: true, nullable: true })
  clientUuid: string | null;

  @Column({ type: 'int', name: 'ot_id' })
  otId: number;

  @ManyToOne(() => OrdreTravail, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ot_id' })
  ordreTravail: OrdreTravail;

  @Column({ type: 'int', name: 'article_id' })
  articleId: number;

  @ManyToOne(() => Article)
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantite: string;

  @Column({ type: 'int', name: 'demande_par', nullable: true })
  demandePar: number | null;

  @CreateDateColumn({ name: 'date_demande' })
  dateDemande: Date;

  @Column({ type: 'enum', enum: StatutDemandePiece, default: StatutDemandePiece.EN_ATTENTE })
  statut: StatutDemandePiece;

  @Column({ type: 'int', name: 'traite_par', nullable: true })
  traitePar: number | null;

  @Column({ type: 'timestamptz', name: 'date_traitement', nullable: true })
  dateTraitement: Date | null;

  @Column({ type: 'text', name: 'motif_refus', nullable: true })
  motifRefus: string | null;

  @Column({ type: 'int', name: 'ot_piece_id', nullable: true })
  otPieceId: number | null;
}

/** Table piece_jointe — fichiers hors base, seule l'URL est stockée (A11). */
@Entity({ name: 'piece_jointe' })
export class PieceJointe {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 40 })
  entite: string;

  @Column({ type: 'int', name: 'entite_id' })
  entiteId: number;

  @Column({ type: 'varchar', length: 40, name: 'type_document', nullable: true })
  typeDocument: string | null;

  @Column({ type: 'varchar', length: 200, name: 'nom_fichier' })
  nomFichier: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'int', name: 'taille_ko', nullable: true })
  tailleKo: number | null;

  @Column({ type: 'int', name: 'ajoute_par', nullable: true })
  ajoutePar: number | null;

  @CreateDateColumn({ name: 'date_ajout' })
  dateAjout: Date;

  @Column({ type: 'char', length: 36, name: 'client_uuid', unique: true, nullable: true })
  clientUuid: string | null;

  @Column({ type: 'timestamptz', name: 'date_prise_vue', nullable: true })
  datePriseVue: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @Column({ type: 'boolean', default: true })
  synchronisee: boolean;
}
