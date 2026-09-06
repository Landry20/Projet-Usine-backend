import { DataSource } from 'typeorm';

/** Tables / colonnes dépôt-production si absentes (Neon sans DB_SYNC). */
export async function assurerSchemaDepot(ds: DataSource) {
  await ds.query(`
    CREATE TABLE IF NOT EXISTS depot (
      id SERIAL PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      libelle VARCHAR(150) NOT NULL,
      type VARCHAR(30) NOT NULL DEFAULT 'STOCKAGE',
      site_id INT NULL,
      actif BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
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
  await ds.query(`
    CREATE TABLE IF NOT EXISTS mouvement_lot_depot (
      id BIGSERIAL PRIMARY KEY,
      lot_depot_id INT NOT NULL,
      type_mvt VARCHAR(20) NOT NULL,
      quantite DECIMAL(14,3) NOT NULL,
      depot_source_id INT NULL,
      depot_dest_id INT NULL,
      demande_matiere_id INT NULL,
      motif TEXT NULL,
      utilisateur_id INT NULL,
      date_mvt TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await ds.query(`
    CREATE TABLE IF NOT EXISTS demande_achat (
      id SERIAL PRIMARY KEY,
      numero VARCHAR(30) NOT NULL UNIQUE,
      type VARCHAR(20) NOT NULL DEFAULT 'MP',
      statut VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE',
      libelle VARCHAR(200) NOT NULL,
      quantite DECIMAL(14,3) NULL,
      motif TEXT NULL,
      motif_rejet TEXT NULL,
      site_id INT NULL,
      produit_id INT NULL,
      demandeur_id INT NULL,
      valideur_id INT NULL,
      date_decision TIMESTAMPTZ NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await ajouterColonne(ds, 'lot_depot', 'depot_id', 'INT NULL');
  await ajouterColonne(ds, 'lot_depot', 'site_id', 'INT NULL');
  await ajouterColonne(ds, 'lot_depot', 'etat', `VARCHAR(30) NOT NULL DEFAULT 'EN_STOCK'`);
  await ajouterColonne(ds, 'arrivage_matiere', 'depot_id', 'INT NULL');
  await ajouterColonne(ds, 'arrivage_matiere', 'fournisseur_id', 'INT NULL');
  await ajouterColonne(ds, 'arrivage_matiere', 'fournisseur_nom', 'VARCHAR(150) NULL');
  await ajouterColonne(ds, 'arrivage_matiere', 'numero_camion', 'VARCHAR(40) NULL');
  await ajouterColonne(ds, 'arrivage_matiere', 'poids_brut', 'DECIMAL(14,3) NULL');
  await ajouterColonne(ds, 'arrivage_matiere', 'date_reception', 'DATE NULL');
  await ajouterColonne(ds, 'demande_matiere', 'lot_depot_id', 'INT NULL');
  await ajouterColonne(ds, 'journal_sortie', 'stock_applique', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await ajouterColonne(ds, 'depot', 'capacite_max_lots', 'INT NULL');
  await ajouterColonne(ds, 'demande_achat', 'fournisseur_id', 'INT NULL');
  await ajouterColonne(ds, 'demande_achat', 'email_envoye', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await ajouterColonne(ds, 'demande_achat', 'email_erreur', 'TEXT NULL');

  await ds.query(`
    CREATE TABLE IF NOT EXISTS jaugeage (
      id SERIAL PRIMARY KEY,
      tank_id INT NOT NULL,
      date_jaugeage TIMESTAMP NOT NULL DEFAULT NOW(),
      hauteur_cm DECIMAL(8,2) NULL,
      volume_litres DECIMAL(14,2) NOT NULL,
      temperature DECIMAL(6,2) NULL,
      densite DECIMAL(8,4) NULL,
      masse_kg DECIMAL(14,2) NULL,
      stock_theorique_l DECIMAL(14,2) NULL,
      ecart_litres DECIMAL(14,2) NULL,
      ecart_pct DECIMAL(6,3) NULL,
      effectue_par INT NULL,
      observation TEXT NULL
    )
  `);
  try {
    await ds.query(`
      ALTER TABLE tank_mouvement
      ALTER COLUMN type_mvt TYPE VARCHAR(40)
      USING type_mvt::text
    `);
  } catch {
    /* déjà en varchar ou table absente */
  }
  await ds.query(`
    UPDATE tank
    SET bareme_jaugeage = json_build_array(
      json_build_object('hauteurCm', 0, 'litres', 0),
      json_build_object('hauteurCm', 400, 'litres', capacite_litres)
    )
    WHERE bareme_jaugeage IS NULL
  `);
}

async function ajouterColonne(ds: DataSource, table: string, colonne: string, definition: string) {
  await ds.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${colonne} ${definition}`);
}
