import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Utilisateur } from './securite.entities';

/**
 * Table journal_audit — RG-18.
 * Non modifiable depuis l'application : aucun endpoint UPDATE/DELETE n'existe.
 */
@Entity({ name: 'journal_audit' })
export class JournalAudit {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'int', name: 'utilisateur_id', nullable: true })
  utilisateurId: number | null;

  @ManyToOne(() => Utilisateur, { nullable: true })
  @JoinColumn({ name: 'utilisateur_id' })
  utilisateur: Utilisateur | null;

  @Column({ type: 'varchar', length: 20 })
  action: string;

  @Column({ type: 'varchar', length: 60, name: 'table_concernee', nullable: true })
  tableConcernee: string | null;

  @Column({ type: 'varchar', length: 40, name: 'enregistrement_id', nullable: true })
  enregistrementId: string | null;

  @Column({ type: 'json', name: 'valeurs_avant', nullable: true })
  valeursAvant: unknown;

  @Column({ type: 'json', name: 'valeurs_apres', nullable: true })
  valeursApres: unknown;

  @Column({ type: 'varchar', length: 45, name: 'adresse_ip', nullable: true })
  adresseIp: string | null;

  @CreateDateColumn({ name: 'date_action' })
  dateAction: Date;
}

@Entity({ name: 'notification' })
export class Notification {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'int', name: 'destinataire_id' })
  destinataireId: number;

  @ManyToOne(() => Utilisateur)
  @JoinColumn({ name: 'destinataire_id' })
  destinataire: Utilisateur;

  @Column({ type: 'varchar', length: 40 })
  type: string;

  @Column({ type: 'varchar', length: 150 })
  titre: string;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  lien: string | null;

  @Column({ type: 'boolean', default: false })
  lu: boolean;

  @CreateDateColumn({ name: 'date_creation' })
  dateCreation: Date;
}

@Entity({ name: 'parametre' })
export class Parametre {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  cle: string;

  @Column({ type: 'text' })
  valeur: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}

/** Compteurs de numérotation annuelle OT / DI / BC (RG-01). Table technique. */
@Entity({ name: 'sequence_numero' })
export class SequenceNumero {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  type: string;

  @PrimaryColumn({ type: 'int' })
  annee: number;

  @Column({ type: 'int', default: 0 })
  dernier: number;
}
