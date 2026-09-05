import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ConclusionBulletin,
  DecisionNc,
  StatutCommandeClient,
  StatutDemandeMatiere,
  StatutNc,
  StatutValidation,
  TypeArret,
  TypeExpedition,
  TypeMvtTank,
  TypeValeurAnalyse,
} from '../../common/constants/enums';
import { Equipement } from './equipements.entities';
import { DemandeIntervention } from './interventions.entities';
import { LigneProduction, Produit } from './production.entities';
import { Site } from './ressources.entities';
import { Utilisateur } from './securite.entities';

@Entity({ name: 'journal_quart' })
@Index('idx_jq_jour_quart_ligne', ['dateJournee', 'quart', 'ligneId'])
export class JournalQuart {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  numero: string;

  @Column({ type: 'date', name: 'date_journee' })
  dateJournee: string;

  @Column({ type: 'char', length: 1 })
  quart: string;

  @Column({ type: 'int', name: 'ligne_id' })
  ligneId: number;

  @ManyToOne(() => LigneProduction)
  @JoinColumn({ name: 'ligne_id' })
  ligne: LigneProduction;

  @Column({ type: 'int', name: 'chef_quart_id' })
  chefQuartId: number;

  @ManyToOne(() => Utilisateur)
  @JoinColumn({ name: 'chef_quart_id' })
  chefQuart: Utilisateur;

  @Column({ type: 'timestamptz', name: 'heure_debut', nullable: true })
  heureDebut: Date | null;

  @Column({ type: 'timestamptz', name: 'heure_fin', nullable: true })
  heureFin: Date | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, name: 'heures_fonctionnement', nullable: true })
  heuresFonctionnement: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'total_entrees_kg', default: 0 })
  totalEntreesKg: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'total_sorties_kg', default: 0 })
  totalSortiesKg: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'ecart_kg', default: 0 })
  ecartKg: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, name: 'ecart_pct', nullable: true })
  ecartPct: string | null;

  @Column({ type: 'decimal', precision: 6, scale: 3, name: 'rendement_pct', nullable: true })
  rendementPct: string | null;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @Column({ type: 'text', name: 'commentaire_ecart', nullable: true })
  commentaireEcart: string | null;

  @Column({ type: 'enum', enum: StatutValidation, default: StatutValidation.BROUILLON })
  statut: StatutValidation;

  @Column({ type: 'int', name: 'soumis_par', nullable: true })
  soumisPar: number | null;

  @Column({ type: 'int', name: 'verifie_par', nullable: true })
  verifiePar: number | null;

  @Column({ type: 'int', name: 'approuve_par', nullable: true })
  approuvePar: number | null;

  @Column({ type: 'int', name: 'rapport_rectifie_id', nullable: true })
  rapportRectifieId: number | null;

  @ManyToOne(() => JournalQuart, { nullable: true })
  @JoinColumn({ name: 'rapport_rectifie_id' })
  rapportRectifie: JournalQuart | null;

  @OneToMany(() => JournalEntree, (e) => e.journal)
  entrees: JournalEntree[];

  @OneToMany(() => JournalSortie, (s) => s.journal)
  sorties: JournalSortie[];

  @OneToMany(() => JournalArret, (a) => a.journal)
  arrets: JournalArret[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity({ name: 'demande_matiere' })
export class DemandeMatiere {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  numero: string;

  @CreateDateColumn({ name: 'date_demande' })
  dateDemande: Date;

  @Column({ type: 'int', name: 'produit_id' })
  produitId: number;

  @ManyToOne(() => Produit)
  @JoinColumn({ name: 'produit_id' })
  produit: Produit;

  @Column({ type: 'int', name: 'ligne_id', nullable: true })
  ligneId: number | null;

  @ManyToOne(() => LigneProduction, { nullable: true })
  @JoinColumn({ name: 'ligne_id' })
  ligne: LigneProduction | null;

  @Column({ type: 'char', length: 1, nullable: true })
  quart: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'quantite_demandee' })
  quantiteDemandee: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'quantite_servie', nullable: true })
  quantiteServie: string | null;

  @Column({ type: 'text', name: 'motif_ecart', nullable: true })
  motifEcart: string | null;

  @Column({ type: 'int', name: 'demandeur_id', nullable: true })
  demandeurId: number | null;

  @ManyToOne(() => Utilisateur, { nullable: true })
  @JoinColumn({ name: 'demandeur_id' })
  demandeur: Utilisateur | null;

  @Column({ type: 'int', name: 'magasinier_id', nullable: true })
  magasinierId: number | null;

  @ManyToOne(() => Utilisateur, { nullable: true })
  @JoinColumn({ name: 'magasinier_id' })
  magasinier: Utilisateur | null;

  @Column({ type: 'timestamptz', name: 'date_service', nullable: true })
  dateService: Date | null;

  @Column({ type: 'enum', enum: StatutDemandeMatiere, default: StatutDemandeMatiere.DEMANDEE })
  statut: StatutDemandeMatiere;

  @Column({ type: 'int', name: 'journal_quart_id', nullable: true })
  journalQuartId: number | null;

  @ManyToOne(() => JournalQuart, { nullable: true })
  @JoinColumn({ name: 'journal_quart_id' })
  journalQuart: JournalQuart | null;
}

@Entity({ name: 'journal_entree' })
export class JournalEntree {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'journal_quart_id' })
  journalQuartId: number;

  @ManyToOne(() => JournalQuart, (j) => j.entrees, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journal_quart_id' })
  journal: JournalQuart;

  @Column({ type: 'int', name: 'produit_id' })
  produitId: number;

  @ManyToOne(() => Produit)
  @JoinColumn({ name: 'produit_id' })
  produit: Produit;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'quantite_kg' })
  quantiteKg: string;

  @Column({ type: 'varchar', length: 40, name: 'lot_matiere', nullable: true })
  lotMatiere: string | null;

  @Column({ type: 'int', name: 'demande_matiere_id', nullable: true })
  demandeMatiereId: number | null;

  @ManyToOne(() => DemandeMatiere, { nullable: true })
  @JoinColumn({ name: 'demande_matiere_id' })
  demandeMatiere: DemandeMatiere | null;

  @Column({ type: 'text', nullable: true })
  observation: string | null;
}

@Entity({ name: 'journal_sortie' })
export class JournalSortie {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'journal_quart_id' })
  journalQuartId: number;

  @ManyToOne(() => JournalQuart, (j) => j.sorties, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journal_quart_id' })
  journal: JournalQuart;

  @Column({ type: 'int', name: 'produit_id' })
  produitId: number;

  @ManyToOne(() => Produit)
  @JoinColumn({ name: 'produit_id' })
  produit: Produit;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'quantite_kg' })
  quantiteKg: string;

  @Column({ type: 'int', name: 'tank_id', nullable: true })
  tankId: number | null;

  @ManyToOne(() => Tank, { nullable: true })
  @JoinColumn({ name: 'tank_id' })
  tank: Tank | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  destination: string | null;

  @Column({ type: 'text', nullable: true })
  observation: string | null;
}

@Entity({ name: 'journal_arret' })
export class JournalArret {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'journal_quart_id' })
  journalQuartId: number;

  @ManyToOne(() => JournalQuart, (j) => j.arrets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journal_quart_id' })
  journal: JournalQuart;

  @Column({ type: 'int', name: 'equipement_id', nullable: true })
  equipementId: number | null;

  @ManyToOne(() => Equipement, { nullable: true })
  @JoinColumn({ name: 'equipement_id' })
  equipement: Equipement | null;

  @Column({ type: 'enum', enum: TypeArret, name: 'type_arret' })
  typeArret: TypeArret;

  @Column({ type: 'text', nullable: true })
  cause: string | null;

  @Column({ type: 'timestamptz', name: 'heure_debut', nullable: true })
  heureDebut: Date | null;

  @Column({ type: 'int', name: 'duree_min' })
  dureeMin: number;

  @Column({ type: 'int', name: 'demande_intervention_id', nullable: true })
  demandeInterventionId: number | null;

  @ManyToOne(() => DemandeIntervention, { nullable: true })
  @JoinColumn({ name: 'demande_intervention_id' })
  demandeIntervention: DemandeIntervention | null;
}

@Entity({ name: 'tank' })
export class Tank {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  libelle: string | null;

  @Column({ type: 'int', name: 'produit_id', nullable: true })
  produitId: number | null;

  @ManyToOne(() => Produit, { nullable: true })
  @JoinColumn({ name: 'produit_id' })
  produit: Produit | null;

  @Column({ type: 'int', name: 'site_id', nullable: true })
  siteId: number | null;

  @ManyToOne(() => Site, { nullable: true })
  @JoinColumn({ name: 'site_id' })
  site: Site | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'capacite_litres' })
  capaciteLitres: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'stock_litres', default: 0 })
  stockLitres: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'stock_kg', default: 0 })
  stockKg: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'litres_reserves', default: 0 })
  litresReserves: string;

  @Column({ type: 'smallint', name: 'seuil_haut_pct', default: 90 })
  seuilHautPct: number;

  @Column({ type: 'smallint', name: 'seuil_bas_pct', default: 10 })
  seuilBasPct: number;

  @Column({ type: 'json', name: 'bareme_jaugeage', nullable: true })
  baremeJaugeage: { hauteurCm: number; litres: number }[] | null;

  @Column({ type: 'varchar', length: 20, default: 'EN_SERVICE' })
  statut: string;

  @Column({ type: 'boolean', default: true })
  actif: boolean;
}

@Entity({ name: 'tank_mouvement' })
export class TankMouvement {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'int', name: 'tank_id' })
  tankId: number;

  @ManyToOne(() => Tank)
  @JoinColumn({ name: 'tank_id' })
  tank: Tank;

  @Column({ type: 'enum', enum: TypeMvtTank, name: 'type_mvt' })
  typeMvt: TypeMvtTank;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'quantite_litres' })
  quantiteLitres: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'quantite_kg', nullable: true })
  quantiteKg: string | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  temperature: string | null;

  @Column({ type: 'decimal', precision: 8, scale: 4, nullable: true })
  densite: string | null;

  @CreateDateColumn({ name: 'date_mvt' })
  dateMvt: Date;

  @Column({ type: 'int', name: 'journal_quart_id', nullable: true })
  journalQuartId: number | null;

  @Column({ type: 'int', name: 'chargement_id', nullable: true })
  chargementId: number | null;

  @Column({ type: 'int', name: 'tank_destination_id', nullable: true })
  tankDestinationId: number | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'stock_avant_litres', nullable: true })
  stockAvantLitres: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'stock_apres_litres', nullable: true })
  stockApresLitres: string | null;

  @Column({ type: 'text', nullable: true })
  motif: string | null;

  @Column({ type: 'int', name: 'utilisateur_id', nullable: true })
  utilisateurId: number | null;
}

@Entity({ name: 'jaugeage' })
export class Jaugeage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'tank_id' })
  tankId: number;

  @ManyToOne(() => Tank)
  @JoinColumn({ name: 'tank_id' })
  tank: Tank;

  @CreateDateColumn({ name: 'date_jaugeage' })
  dateJaugeage: Date;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'hauteur_cm', nullable: true })
  hauteurCm: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'volume_litres' })
  volumeLitres: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  temperature: string | null;

  @Column({ type: 'decimal', precision: 8, scale: 4, nullable: true })
  densite: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'masse_kg', nullable: true })
  masseKg: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'stock_theorique_l', nullable: true })
  stockTheoriqueL: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'ecart_litres', nullable: true })
  ecartLitres: string | null;

  @Column({ type: 'decimal', precision: 6, scale: 3, name: 'ecart_pct', nullable: true })
  ecartPct: string | null;

  @Column({ type: 'int', name: 'effectue_par', nullable: true })
  effectuePar: number | null;

  @ManyToOne(() => Utilisateur, { nullable: true })
  @JoinColumn({ name: 'effectue_par' })
  effecteur: Utilisateur | null;

  @Column({ type: 'text', nullable: true })
  observation: string | null;
}

@Entity({ name: 'client' })
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 150, name: 'raison_sociale' })
  raisonSociale: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  pays: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  contact: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telephone: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  incoterm: string | null;

  @Column({ type: 'boolean', default: true })
  actif: boolean;
}

@Entity({ name: 'commande_client' })
export class CommandeClient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  numero: string;

  @Column({ type: 'int', name: 'client_id' })
  clientId: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'int', name: 'produit_id' })
  produitId: number;

  @ManyToOne(() => Produit)
  @JoinColumn({ name: 'produit_id' })
  produit: Produit;

  @Column({ type: 'date', name: 'date_commande' })
  dateCommande: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'quantite_commandee_kg' })
  quantiteCommandeeKg: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'quantite_livree_kg', default: 0 })
  quantiteLivreeKg: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  destination: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  incoterm: string | null;

  @Column({ type: 'date', name: 'date_livraison_prevue', nullable: true })
  dateLivraisonPrevue: string | null;

  @Column({ type: 'enum', enum: StatutCommandeClient, default: StatutCommandeClient.OUVERTE })
  statut: StatutCommandeClient;

  @Column({ type: 'text', nullable: true })
  observations: string | null;
}

@Entity({ name: 'expedition' })
export class Expedition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  numero: string;

  @Column({ type: 'int', name: 'commande_id', nullable: true })
  commandeId: number | null;

  @ManyToOne(() => CommandeClient, { nullable: true })
  @JoinColumn({ name: 'commande_id' })
  commande: CommandeClient | null;

  @Column({ type: 'int', name: 'client_id' })
  clientId: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'enum', enum: TypeExpedition, default: TypeExpedition.CONTENEUR_FLEXITANK })
  type: TypeExpedition;

  @Column({ type: 'date', name: 'date_expedition' })
  dateExpedition: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  transporteur: string | null;

  @Column({ type: 'varchar', length: 40, name: 'numero_bl', nullable: true })
  numeroBl: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  destination: string | null;

  @Column({ type: 'enum', enum: StatutValidation, default: StatutValidation.BROUILLON })
  statut: StatutValidation;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'total_litres', default: 0 })
  totalLitres: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'total_kg', default: 0 })
  totalKg: string;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @OneToMany(() => Chargement, (c) => c.expedition)
  chargements: Chargement[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity({ name: 'chargement' })
@Index('idx_chargement_flexitank', ['numeroFlexitank'], { unique: true })
export class Chargement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'expedition_id' })
  expeditionId: number;

  @ManyToOne(() => Expedition, (e) => e.chargements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expedition_id' })
  expedition: Expedition;

  @Column({ type: 'int', name: 'tank_id' })
  tankId: number;

  @ManyToOne(() => Tank)
  @JoinColumn({ name: 'tank_id' })
  tank: Tank;

  @Column({ type: 'varchar', length: 20, name: 'numero_conteneur' })
  numeroConteneur: string;

  @Column({ type: 'varchar', length: 40, name: 'numero_flexitank' })
  numeroFlexitank: string;

  @Column({ type: 'varchar', length: 30, name: 'numero_remorque', nullable: true })
  numeroRemorque: string | null;

  @Column({ type: 'varchar', length: 30, name: 'numero_tracteur', nullable: true })
  numeroTracteur: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  chauffeur: string | null;

  @Column({ type: 'varchar', length: 40, name: 'piece_chauffeur', nullable: true })
  pieceChauffeur: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  transporteur: string | null;

  @Column({ type: 'varchar', length: 40, name: 'numero_scelle', nullable: true })
  numeroScelle: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'quantite_litres' })
  quantiteLitres: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  temperature: string | null;

  @Column({ type: 'decimal', precision: 8, scale: 4, nullable: true })
  densite: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'masse_calculee_kg', nullable: true })
  masseCalculeeKg: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'poids_tare_kg', nullable: true })
  poidsTareKg: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'poids_brut_kg', nullable: true })
  poidsBrutKg: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'poids_net_kg', nullable: true })
  poidsNetKg: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'ecart_pesee_kg', nullable: true })
  ecartPeseeKg: string | null;

  @Column({ type: 'int', name: 'bulletin_analyse_id', nullable: true })
  bulletinAnalyseId: number | null;

  @ManyToOne(() => BulletinAnalyse, { nullable: true })
  @JoinColumn({ name: 'bulletin_analyse_id' })
  bulletinAnalyse: BulletinAnalyse | null;

  @Column({ type: 'int', name: 'operateur_id', nullable: true })
  operateurId: number | null;

  @Column({ type: 'enum', enum: StatutValidation, default: StatutValidation.BROUILLON })
  statut: StatutValidation;

  @Column({ type: 'text', nullable: true })
  observations: string | null;
}

@Entity({ name: 'parametre_analyse' })
export class ParametreAnalyse {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  libelle: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unite: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  methode: string | null;

  @Column({ type: 'enum', enum: TypeValeurAnalyse, name: 'type_valeur', default: TypeValeurAnalyse.NUMERIQUE })
  typeValeur: TypeValeurAnalyse;

  @Column({ type: 'smallint', default: 2 })
  decimales: number;

  @Column({ type: 'smallint', name: 'ordre_affichage', default: 1 })
  ordreAffichage: number;

  @Column({ type: 'boolean', default: true })
  actif: boolean;
}

@Entity({ name: 'specification' })
export class Specification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'produit_id' })
  produitId: number;

  @ManyToOne(() => Produit)
  @JoinColumn({ name: 'produit_id' })
  produit: Produit;

  @Column({ type: 'int', name: 'parametre_id' })
  parametreId: number;

  @ManyToOne(() => ParametreAnalyse)
  @JoinColumn({ name: 'parametre_id' })
  parametre: ParametreAnalyse;

  @Column({ type: 'int', name: 'client_id', nullable: true })
  clientId: number | null;

  @Column({ type: 'decimal', precision: 14, scale: 4, name: 'valeur_min', nullable: true })
  valeurMin: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 4, name: 'valeur_cible', nullable: true })
  valeurCible: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 4, name: 'valeur_max', nullable: true })
  valeurMax: string | null;

  @Column({ type: 'varchar', length: 120, name: 'reference_norme', nullable: true })
  referenceNorme: string | null;

  @Column({ type: 'boolean', default: true })
  obligatoire: boolean;

  @Column({ type: 'date', name: 'date_debut' })
  dateDebut: string;

  @Column({ type: 'date', name: 'date_fin', nullable: true })
  dateFin: string | null;
}

@Entity({ name: 'point_prelevement' })
export class PointPrelevement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  libelle: string;

  @Column({ type: 'varchar', length: 30 })
  type: string;

  @Column({ type: 'boolean', default: true })
  actif: boolean;
}

@Entity({ name: 'echantillon' })
export class Echantillon {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  numero: string;

  @CreateDateColumn({ name: 'date_prelevement' })
  datePrelevement: Date;

  @Column({ type: 'int', name: 'point_id', nullable: true })
  pointId: number | null;

  @ManyToOne(() => PointPrelevement, { nullable: true })
  @JoinColumn({ name: 'point_id' })
  point: PointPrelevement | null;

  @Column({ type: 'int', name: 'produit_id' })
  produitId: number;

  @ManyToOne(() => Produit)
  @JoinColumn({ name: 'produit_id' })
  produit: Produit;

  @Column({ type: 'int', name: 'tank_id', nullable: true })
  tankId: number | null;

  @ManyToOne(() => Tank, { nullable: true })
  @JoinColumn({ name: 'tank_id' })
  tank: Tank | null;

  @Column({ type: 'int', name: 'journal_quart_id', nullable: true })
  journalQuartId: number | null;

  @ManyToOne(() => JournalQuart, { nullable: true })
  @JoinColumn({ name: 'journal_quart_id' })
  journalQuart: JournalQuart | null;

  @Column({ type: 'int', name: 'chargement_id', nullable: true })
  chargementId: number | null;

  @Column({ type: 'int', name: 'preleve_par', nullable: true })
  prelevePar: number | null;

  @ManyToOne(() => Utilisateur, { nullable: true })
  @JoinColumn({ name: 'preleve_par' })
  preleveur: Utilisateur | null;

  @Column({ type: 'text', nullable: true })
  observation: string | null;

  @OneToMany(() => AnalyseResultat, (a) => a.echantillon)
  analyses: AnalyseResultat[];
}

@Entity({ name: 'bulletin_analyse' })
export class BulletinAnalyse {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  numero: string;

  @Column({ type: 'int', name: 'echantillon_id' })
  echantillonId: number;

  @ManyToOne(() => Echantillon)
  @JoinColumn({ name: 'echantillon_id' })
  echantillon: Echantillon;

  @Column({ type: 'int', name: 'saisi_par', nullable: true })
  saisiPar: number | null;

  @Column({ type: 'int', name: 'verifie_par', nullable: true })
  verifiePar: number | null;

  @Column({ type: 'int', name: 'approuve_par', nullable: true })
  approuvePar: number | null;

  @Column({ type: 'timestamptz', name: 'date_saisie', nullable: true })
  dateSaisie: Date | null;

  @Column({ type: 'timestamptz', name: 'date_approbation', nullable: true })
  dateApprobation: Date | null;

  @Column({ type: 'enum', enum: ConclusionBulletin, default: ConclusionBulletin.EN_COURS })
  conclusion: ConclusionBulletin;

  @Column({ type: 'enum', enum: StatutValidation, default: StatutValidation.BROUILLON })
  statut: StatutValidation;

  @Column({ type: 'int', name: 'bulletin_rectifie_id', nullable: true })
  bulletinRectifieId: number | null;

  @Column({ type: 'text', nullable: true })
  commentaire: string | null;
}

@Entity({ name: 'analyse' })
export class AnalyseResultat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'echantillon_id' })
  echantillonId: number;

  @ManyToOne(() => Echantillon, (e) => e.analyses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'echantillon_id' })
  echantillon: Echantillon;

  @Column({ type: 'int', name: 'parametre_id' })
  parametreId: number;

  @ManyToOne(() => ParametreAnalyse)
  @JoinColumn({ name: 'parametre_id' })
  parametre: ParametreAnalyse;

  @Column({ type: 'decimal', precision: 14, scale: 4, name: 'valeur_numerique', nullable: true })
  valeurNumerique: string | null;

  @Column({ type: 'varchar', length: 120, name: 'valeur_texte', nullable: true })
  valeurTexte: string | null;

  @Column({ type: 'int', name: 'specification_id', nullable: true })
  specificationId: number | null;

  @ManyToOne(() => Specification, { nullable: true })
  @JoinColumn({ name: 'specification_id' })
  specification: Specification | null;

  @Column({ type: 'boolean', nullable: true })
  conforme: boolean | null;

  @Column({ type: 'int', name: 'analyse_par', nullable: true })
  analysePar: number | null;

  @CreateDateColumn({ name: 'date_analyse' })
  dateAnalyse: Date;

  @Column({ type: 'varchar', length: 80, nullable: true })
  appareil: string | null;

  @Column({ type: 'text', nullable: true })
  observation: string | null;
}

@Entity({ name: 'non_conformite' })
export class NonConformite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  numero: string;

  @Column({ type: 'int', name: 'bulletin_id', nullable: true })
  bulletinId: number | null;

  @ManyToOne(() => BulletinAnalyse, { nullable: true })
  @JoinColumn({ name: 'bulletin_id' })
  bulletin: BulletinAnalyse | null;

  @Column({ type: 'int', name: 'produit_id', nullable: true })
  produitId: number | null;

  @ManyToOne(() => Produit, { nullable: true })
  @JoinColumn({ name: 'produit_id' })
  produit: Produit | null;

  @Column({ type: 'int', name: 'tank_id', nullable: true })
  tankId: number | null;

  @ManyToOne(() => Tank, { nullable: true })
  @JoinColumn({ name: 'tank_id' })
  tank: Tank | null;

  @Column({ type: 'int', name: 'journal_quart_id', nullable: true })
  journalQuartId: number | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: DecisionNc, nullable: true })
  decision: DecisionNc | null;

  @Column({ type: 'text', nullable: true })
  justification: string | null;

  @Column({ type: 'int', name: 'traite_par', nullable: true })
  traitePar: number | null;

  @CreateDateColumn({ name: 'date_ouverture' })
  dateOuverture: Date;

  @Column({ type: 'timestamptz', name: 'date_cloture', nullable: true })
  dateCloture: Date | null;

  @Column({ type: 'enum', enum: StatutNc, default: StatutNc.OUVERTE })
  statut: StatutNc;
}
