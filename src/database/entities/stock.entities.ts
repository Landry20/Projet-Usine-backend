import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TypeMouvement } from '../../common/constants/enums';
import { Utilisateur } from './securite.entities';
import { OrdreTravail } from './interventions.entities';

/** Table fournisseur. */
@Entity({ name: 'fournisseur' })
export class Fournisseur {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 150, name: 'raison_sociale' })
  raisonSociale: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  contact: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telephone: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  adresse: string | null;

  @Column({ type: 'smallint', name: 'delai_livraison_jours', default: 0 })
  delaiLivraisonJours: number;

  @Column({ type: 'smallint', name: 'note_evaluation', nullable: true })
  noteEvaluation: number | null;

  @Column({ type: 'boolean', default: true })
  actif: boolean;
}

/** Table categorie_article. */
@Entity({ name: 'categorie_article' })
export class CategorieArticle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  libelle: string;
}

/**
 * Table article.
 * quantite_stock n'est JAMAIS mise à jour directement par un PATCH :
 * seules les écritures via mouvement_stock sont autorisées (RG-03 / RG-04).
 */
@Entity({ name: 'article' })
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 40, unique: true, name: 'ref_article' })
  refArticle: string;

  @Column({ type: 'varchar', length: 200 })
  designation: string;

  @Column({ type: 'int', name: 'categorie_id', nullable: true })
  categorieId: number | null;

  @ManyToOne(() => CategorieArticle, { nullable: true })
  @JoinColumn({ name: 'categorie_id' })
  categorie: CategorieArticle | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  marque: string | null;

  @Column({ type: 'varchar', length: 20, default: 'U' })
  unite: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'quantite_stock', default: 0 })
  quantiteStock: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'seuil_reappro', default: 0 })
  seuilReappro: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'stock_max', nullable: true })
  stockMax: string | null;

  /** Prix unitaire moyen pondéré — recalculé à chaque ENTRÉE. */
  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'prix_unitaire_moyen', default: 0 })
  prixUnitaireMoyen: string;

  @Column({ type: 'varchar', length: 40, name: 'emplacement_magasin', nullable: true })
  emplacementMagasin: string | null;

  @Column({ type: 'int', name: 'fournisseur_principal_id', nullable: true })
  fournisseurPrincipalId: number | null;

  @ManyToOne(() => Fournisseur, { nullable: true })
  @JoinColumn({ name: 'fournisseur_principal_id' })
  fournisseurPrincipal: Fournisseur | null;

  @Column({ type: 'smallint', name: 'delai_appro_jours', default: 0 })
  delaiApproJours: number;

  @Column({ type: 'varchar', length: 60, nullable: true })
  garantie: string | null;

  @Column({ type: 'boolean', name: 'piece_critique', default: false })
  pieceCritique: boolean;

  @Column({ type: 'boolean', default: true })
  actif: boolean;

  @Column({ type: 'int', name: 'import_lot_id', nullable: true })
  importLotId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

/**
 * Table mouvement_stock — seule source de vérité des variations de quantité.
 * Conserve stock_avant / stock_apres, utilisateur et document d'origine.
 */
@Entity({ name: 'mouvement_stock' })
export class MouvementStock {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'int', name: 'article_id' })
  articleId: number;

  @ManyToOne(() => Article)
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @Column({ type: 'enum', enum: TypeMouvement, name: 'type_mvt' })
  typeMvt: TypeMouvement;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantite: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'prix_unitaire', default: 0 })
  prixUnitaire: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  montant: string;

  @Column({ type: 'timestamptz', name: 'date_mvt' })
  dateMvt: Date;

  @Column({ type: 'int', name: 'ot_id', nullable: true })
  otId: number | null;

  @ManyToOne(() => OrdreTravail, { nullable: true })
  @JoinColumn({ name: 'ot_id' })
  ordreTravail: OrdreTravail | null;

  @Column({ type: 'int', name: 'commande_id', nullable: true })
  commandeId: number | null;

  @Column({ type: 'varchar', length: 40, name: 'bon_reference', nullable: true })
  bonReference: string | null;

  @Column({ type: 'text', nullable: true })
  motif: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'stock_avant', nullable: true })
  stockAvant: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'stock_apres', nullable: true })
  stockApres: string | null;

  @Column({ type: 'int', name: 'utilisateur_id', nullable: true })
  utilisateurId: number | null;

  @ManyToOne(() => Utilisateur, { nullable: true })
  @JoinColumn({ name: 'utilisateur_id' })
  utilisateur: Utilisateur | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
