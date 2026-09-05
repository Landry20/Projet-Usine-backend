import { DataSource } from 'typeorm';

/** Crée les tables dépôt / arrivage si elles n'existent pas encore (Neon sans DB_SYNC). */
export async function assurerSchemaDepot(ds: DataSource) {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS lot_depot (
      id SERIAL PRIMARY KEY,
      numero VARCHAR(30) NOT NULL UNIQUE,
      libelle VARCHAR(150) NOT NULL,
      produit_id INT NOT NULL,
      capacite DECIMAL(14,3) NULL,
      quantite DECIMAL(14,3) NOT NULL DEFAULT 0,
      emplacement VARCHAR(80) NULL,
      actif BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`
    CREATE TABLE IF NOT EXISTS arrivage_matiere (
      id SERIAL PRIMARY KEY,
      numero VARCHAR(30) NOT NULL UNIQUE,
      lot_depot_id INT NOT NULL,
      produit_id INT NOT NULL,
      quantite DECIMAL(14,3) NOT NULL,
      reference_bl VARCHAR(80) NULL,
      commentaire TEXT NULL,
      utilisateur_id INT NULL,
      date_arrivage TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}
