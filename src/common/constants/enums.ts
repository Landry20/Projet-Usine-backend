/**
 * Types énumérés du schéma cible (section 0 du script SQL).
 * Les valeurs sont stables : elles ne doivent pas être saisies en texte libre (anomalie A7).
 */

export enum TypeMaintenance {
  PREVENTIF = 'PREVENTIF',
  CORRECTIF = 'CORRECTIF',
  REGLEMENTAIRE = 'REGLEMENTAIRE',
  AMELIORATIF = 'AMELIORATIF',
  PREDICTIF = 'PREDICTIF',
}

export enum StatutOt {
  BROUILLON = 'BROUILLON',
  PLANIFIE = 'PLANIFIE',
  EN_COURS = 'EN_COURS',
  EN_ATTENTE = 'EN_ATTENTE',
  REALISE = 'REALISE',
  CLOTURE = 'CLOTURE',
  ANNULE = 'ANNULE',
}

export enum PrioriteOt {
  P1_URGENT = 'P1_URGENT',
  P2_HAUTE = 'P2_HAUTE',
  P3_NORMALE = 'P3_NORMALE',
  P4_BASSE = 'P4_BASSE',
}

export enum OrigineOt {
  DEMANDE = 'DEMANDE',
  PLAN_PREVENTIF = 'PLAN_PREVENTIF',
  CREATION_DIRECTE = 'CREATION_DIRECTE',
  RONDE = 'RONDE',
}

export enum StatutDi {
  NOUVELLE = 'NOUVELLE',
  VALIDEE = 'VALIDEE',
  REJETEE = 'REJETEE',
  CONVERTIE = 'CONVERTIE',
}

export enum CriticiteEquip {
  A = 'A',
  B = 'B',
  C = 'C',
}

export enum StatutEquip {
  EN_SERVICE = 'EN_SERVICE',
  A_L_ARRET = 'A_L_ARRET',
  EN_PANNE = 'EN_PANNE',
  EN_REPARATION = 'EN_REPARATION',
  REFORME = 'REFORME',
}

export enum TypeMouvement {
  ENTREE = 'ENTREE',
  SORTIE = 'SORTIE',
  RETOUR = 'RETOUR',
  AJUSTEMENT = 'AJUSTEMENT',
  INVENTAIRE = 'INVENTAIRE',
}

export enum TypePeriodicite {
  JOUR = 'JOUR',
  SEMAINE = 'SEMAINE',
  MOIS = 'MOIS',
  ANNEE = 'ANNEE',
  HEURE_FONCTIONNEMENT = 'HEURE_FONCTIONNEMENT',
  KILOMETRE = 'KILOMETRE',
  CYCLE = 'CYCLE',
}

export enum StatutCommande {
  BROUILLON = 'BROUILLON',
  ENVOYEE = 'ENVOYEE',
  PARTIELLEMENT_RECUE = 'PARTIELLEMENT_RECUE',
  RECUE = 'RECUE',
  ANNULEE = 'ANNULEE',
}

export enum StatutFiche {
  A_VALIDER = 'A_VALIDER',
  VALIDEE = 'VALIDEE',
  REJETEE = 'REJETEE',
}

export enum StatutDemandePiece {
  EN_ATTENTE = 'EN_ATTENTE',
  VALIDEE = 'VALIDEE',
  REFUSEE = 'REFUSEE',
}

export enum CodeRole {
  ADMIN = 'ADMIN',
  RESP_MAINT = 'RESP_MAINT',
  PLANIF = 'PLANIF',
  TECH = 'TECH',
  MAGASIN = 'MAGASIN',
  DEMANDEUR = 'DEMANDEUR',
  DIRECTION = 'DIRECTION',
  QHSE = 'QHSE',
  RESP_PROD = 'RESP_PROD',
  OPERATEUR = 'OPERATEUR',
  QUALITE = 'QUALITE',
  RESP_PF = 'RESP_PF',
  MAGASIN_PF = 'MAGASIN_PF',
  MAGASIN_MP = 'MAGASIN_MP',
  CHEF_QUART = 'CHEF_QUART',
  CHEF_USINE = 'CHEF_USINE',
  AGENT_EXPEDITION = 'AGENT_EXPEDITION',
  TECH_LABO = 'TECH_LABO',
  RESP_LABO = 'RESP_LABO',
  RESP_QUALITE = 'RESP_QUALITE',
  DIRECTION_GENERALE = 'DIRECTION_GENERALE',
}

/** Quatre domaines métier + pilotage direction (Dossier architecture V2.0). */
export enum Compartiment {
  PRODUCTION = 'PRODUCTION',
  PRODUITS_FINIS = 'PRODUITS_FINIS',
  LABORATOIRE = 'LABORATOIRE',
  MAINTENANCE = 'MAINTENANCE',
  DIRECTION = 'DIRECTION',
}

export enum TypeProduit {
  MATIERE_PREMIERE = 'MATIERE_PREMIERE',
  SEMI_FINI = 'SEMI_FINI',
  PRODUIT_FINI = 'PRODUIT_FINI',
  SOUS_PRODUIT = 'SOUS_PRODUIT',
  CONSOMMABLE = 'CONSOMMABLE',
}

export enum StatutValidation {
  BROUILLON = 'BROUILLON',
  SOUMIS = 'SOUMIS',
  VERIFIE = 'VERIFIE',
  APPROUVE = 'APPROUVE',
  DIFFUSE = 'DIFFUSE',
  RETOURNE = 'RETOURNE',
  ANNULE = 'ANNULE',
}

export enum ConclusionBulletin {
  CONFORME = 'CONFORME',
  NON_CONFORME = 'NON_CONFORME',
  DEROGATION = 'DEROGATION',
  EN_COURS = 'EN_COURS',
}

export enum StatutDemandeMatiere {
  DEMANDEE = 'DEMANDEE',
  SERVIE = 'SERVIE',
  PARTIELLE = 'PARTIELLE',
  REFUSEE = 'REFUSEE',
  ANNULEE = 'ANNULEE',
}

export enum TypeMvtTank {
  ENTREE_PRODUCTION = 'ENTREE_PRODUCTION',
  TRANSFERT_ENTREE = 'TRANSFERT_ENTREE',
  TRANSFERT_SORTIE = 'TRANSFERT_SORTIE',
  CHARGEMENT = 'CHARGEMENT',
  AJUSTEMENT_JAUGE = 'AJUSTEMENT_JAUGE',
}

export enum TypeExpedition {
  CONTENEUR_FLEXITANK = 'CONTENEUR_FLEXITANK',
  CAMION_CITERNE = 'CAMION_CITERNE',
  FUT = 'FUT',
  VRAC = 'VRAC',
}

export enum StatutCommandeClient {
  OUVERTE = 'OUVERTE',
  PARTIELLE = 'PARTIELLE',
  LIVREE = 'LIVREE',
  ANNULEE = 'ANNULEE',
}

export enum TypeValeurAnalyse {
  NUMERIQUE = 'NUMERIQUE',
  TEXTE = 'TEXTE',
  LISTE = 'LISTE',
  BOOLEEN = 'BOOLEEN',
}

export enum TypeArret {
  PANNE = 'PANNE',
  REGLAGE = 'REGLAGE',
  ENERGIE = 'ENERGIE',
  MP = 'MP',
  NETTOYAGE = 'NETTOYAGE',
}

export enum DecisionNc {
  BLOCAGE = 'BLOCAGE',
  DECLASSEMENT = 'DECLASSEMENT',
  DEROGATION = 'DEROGATION',
}

export enum StatutNc {
  OUVERTE = 'OUVERTE',
  CLOTUREE = 'CLOTUREE',
}

/** Circuit de validation des documents (journal, bulletin, expédition). */
export const TRANSITIONS_VALIDATION: Record<StatutValidation, StatutValidation[]> = {
  [StatutValidation.BROUILLON]: [StatutValidation.SOUMIS, StatutValidation.ANNULE],
  [StatutValidation.SOUMIS]: [StatutValidation.VERIFIE, StatutValidation.RETOURNE, StatutValidation.ANNULE],
  [StatutValidation.VERIFIE]: [StatutValidation.APPROUVE, StatutValidation.RETOURNE],
  [StatutValidation.APPROUVE]: [StatutValidation.DIFFUSE],
  [StatutValidation.DIFFUSE]: [],
  [StatutValidation.RETOURNE]: [StatutValidation.SOUMIS, StatutValidation.ANNULE],
  [StatutValidation.ANNULE]: [],
};

export const STATUTS_DOCUMENT_VERROUILLE = [StatutValidation.APPROUVE, StatutValidation.DIFFUSE] as const;

export enum StatutOf {
  BROUILLON = 'BROUILLON',
  PLANIFIE = 'PLANIFIE',
  EN_COURS = 'EN_COURS',
  EN_ATTENTE = 'EN_ATTENTE',
  CONTROLE = 'CONTROLE',
  CLOTURE = 'CLOTURE',
  ANNULE = 'ANNULE',
}

export enum StatutLot {
  DISPONIBLE = 'DISPONIBLE',
  BLOQUE = 'BLOQUE',
  REJETE = 'REJETE',
  EXPEDIE = 'EXPEDIE',
}

export const TRANSITIONS_OF: Record<StatutOf, StatutOf[]> = {
  [StatutOf.BROUILLON]: [StatutOf.PLANIFIE, StatutOf.ANNULE],
  [StatutOf.PLANIFIE]: [StatutOf.EN_COURS, StatutOf.ANNULE],
  [StatutOf.EN_COURS]: [StatutOf.EN_ATTENTE, StatutOf.CONTROLE],
  [StatutOf.EN_ATTENTE]: [StatutOf.EN_COURS],
  [StatutOf.CONTROLE]: [StatutOf.CLOTURE],
  [StatutOf.CLOTURE]: [],
  [StatutOf.ANNULE]: [],
};

const TOUS_COMPARTIMENTS = [
  Compartiment.PRODUCTION,
  Compartiment.PRODUITS_FINIS,
  Compartiment.LABORATOIRE,
  Compartiment.MAINTENANCE,
  Compartiment.DIRECTION,
];

/** Quel rôle ouvre quels compartiments. ADMIN et direction voient tout. */
export function compartimentsDuRole(code?: string): Compartiment[] {
  switch (code) {
    case CodeRole.ADMIN:
    case CodeRole.DIRECTION:
    case CodeRole.DIRECTION_GENERALE:
    case CodeRole.CHEF_USINE:
      return TOUS_COMPARTIMENTS;
    case CodeRole.RESP_PROD:
    case CodeRole.OPERATEUR:
    case CodeRole.CHEF_QUART:
    case CodeRole.MAGASIN_MP:
      return [Compartiment.PRODUCTION];
    case CodeRole.QUALITE:
    case CodeRole.RESP_QUALITE:
      return [Compartiment.PRODUCTION, Compartiment.PRODUITS_FINIS, Compartiment.LABORATOIRE];
    case CodeRole.RESP_PF:
    case CodeRole.MAGASIN_PF:
    case CodeRole.AGENT_EXPEDITION:
      return [Compartiment.PRODUITS_FINIS];
    case CodeRole.TECH_LABO:
    case CodeRole.RESP_LABO:
      return [Compartiment.LABORATOIRE];
    default:
      return [Compartiment.MAINTENANCE];
  }
}

/**
 * Codes de permissions (matrice 4.3 du CDC).
 * Le masquage d'un bouton React n'est PAS une protection : chaque route vérifie ces codes.
 */
export const PERMISSIONS = {
  REFERENTIEL_LIRE: 'referentiel.lire',
  REFERENTIEL_GERER: 'referentiel.gerer',
  EQUIPEMENT_LIRE: 'equipement.lire',
  EQUIPEMENT_CREER: 'equipement.creer',
  EQUIPEMENT_MODIFIER: 'equipement.modifier',
  EQUIPEMENT_SUPPRIMER: 'equipement.supprimer',
  DEMANDE_LIRE: 'demande.lire',
  DEMANDE_CREER: 'demande.creer',
  DEMANDE_MODIFIER: 'demande.modifier',
  DEMANDE_VALIDER: 'demande.valider',
  OT_LIRE: 'ot.lire',
  OT_CREER: 'ot.creer',
  OT_PLANIFIER: 'ot.planifier',
  OT_EXECUTER: 'ot.executer',
  OT_CLOTURER: 'ot.cloturer',
  STOCK_LIRE: 'stock.lire',
  STOCK_DEMANDER: 'stock.demander',
  STOCK_SORTIR: 'stock.sortir',
  STOCK_ENTRER: 'stock.entrer',
  PREVENTIF_LIRE: 'preventif.lire',
  PREVENTIF_GERER: 'preventif.gerer',
  KPI_LIRE: 'kpi.lire',
  UTILISATEUR_GERER: 'utilisateur.gerer',
  AUDIT_LIRE: 'audit.lire',
  PRODUCTION_LIRE: 'production.lire',
  PRODUCTION_GERER: 'production.gerer',
  OF_CREER: 'of.creer',
  OF_EXECUTER: 'of.executer',
  OF_CLOTURER: 'of.cloturer',
  PF_LIRE: 'pf.lire',
  PF_GERER: 'pf.gerer',
  PF_STOCK: 'pf.stock',
  PF_EXPEDIER: 'pf.expedier',
  QUART_LIRE: 'quart.lire',
  QUART_SAISIR: 'quart.saisir',
  QUART_VALIDER: 'quart.valider',
  TANK_LIRE: 'tank.lire',
  TANK_GERER: 'tank.gerer',
  LABO_LIRE: 'labo.lire',
  LABO_SAISIR: 'labo.saisir',
  LABO_VALIDER: 'labo.valider',
  DIRECTION_LIRE: 'direction.lire',
} as const;

/** Transitions d'état autorisées pour un ordre de travail (section 9.1). */
export const TRANSITIONS_OT: Record<StatutOt, StatutOt[]> = {
  [StatutOt.BROUILLON]: [StatutOt.PLANIFIE, StatutOt.ANNULE],
  [StatutOt.PLANIFIE]: [StatutOt.EN_COURS, StatutOt.ANNULE],
  [StatutOt.EN_COURS]: [StatutOt.EN_ATTENTE, StatutOt.REALISE],
  [StatutOt.EN_ATTENTE]: [StatutOt.EN_COURS],
  [StatutOt.REALISE]: [StatutOt.CLOTURE],
  [StatutOt.CLOTURE]: [],
  [StatutOt.ANNULE]: [],
};

/** RG-13 : criticité équipement → priorité OT proposée. */
export function prioriteDepuisCriticite(criticite: CriticiteEquip): PrioriteOt {
  if (criticite === CriticiteEquip.A) return PrioriteOt.P1_URGENT;
  if (criticite === CriticiteEquip.B) return PrioriteOt.P2_HAUTE;
  return PrioriteOt.P3_NORMALE;
}
