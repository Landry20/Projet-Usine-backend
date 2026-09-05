import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from '../database.config';

config({ path: resolve(__dirname, '../../../.env') });
import { PERMISSIONS } from '../../common/constants/enums';
import { hasherMotDePasse } from '../../common/utils/crypto.util';
import * as E from '../entities';

const ENTITES = Object.values(E).filter((v) => typeof v === 'function') as Function[];

const ds = new DataSource({
  ...buildTypeOrmOptions(process.env, ENTITES),
  synchronize: true,
});

const CATALOGUE_PERMISSIONS: { code: string; module: string; libelle: string }[] = [
  { code: PERMISSIONS.REFERENTIEL_LIRE, module: 'referentiel', libelle: 'Consulter les référentiels' },
  { code: PERMISSIONS.REFERENTIEL_GERER, module: 'referentiel', libelle: 'Gérer les référentiels' },
  { code: PERMISSIONS.EQUIPEMENT_LIRE, module: 'equipement', libelle: 'Consulter le parc' },
  { code: PERMISSIONS.EQUIPEMENT_CREER, module: 'equipement', libelle: 'Créer un équipement' },
  { code: PERMISSIONS.EQUIPEMENT_MODIFIER, module: 'equipement', libelle: 'Modifier un équipement' },
  { code: PERMISSIONS.EQUIPEMENT_SUPPRIMER, module: 'equipement', libelle: 'Réformer un équipement' },
  { code: PERMISSIONS.DEMANDE_LIRE, module: 'demande', libelle: 'Consulter les demandes' },
  { code: PERMISSIONS.DEMANDE_CREER, module: 'demande', libelle: 'Créer une demande' },
  { code: PERMISSIONS.DEMANDE_MODIFIER, module: 'demande', libelle: 'Modifier une demande' },
  { code: PERMISSIONS.DEMANDE_VALIDER, module: 'demande', libelle: 'Valider / rejeter une demande' },
  { code: PERMISSIONS.OT_LIRE, module: 'ot', libelle: 'Consulter les OT' },
  { code: PERMISSIONS.OT_CREER, module: 'ot', libelle: 'Créer un OT' },
  { code: PERMISSIONS.OT_PLANIFIER, module: 'ot', libelle: 'Planifier un OT' },
  { code: PERMISSIONS.OT_EXECUTER, module: 'ot', libelle: 'Exécuter un OT' },
  { code: PERMISSIONS.OT_CLOTURER, module: 'ot', libelle: 'Clôturer un OT' },
  { code: PERMISSIONS.STOCK_LIRE, module: 'stock', libelle: 'Consulter le stock' },
  { code: PERMISSIONS.STOCK_DEMANDER, module: 'stock', libelle: 'Demander une pièce' },
  { code: PERMISSIONS.STOCK_SORTIR, module: 'stock', libelle: 'Valider une sortie' },
  { code: PERMISSIONS.STOCK_ENTRER, module: 'stock', libelle: 'Enregistrer une entrée / inventaire' },
  { code: PERMISSIONS.PREVENTIF_LIRE, module: 'preventif', libelle: 'Consulter le préventif' },
  { code: PERMISSIONS.PREVENTIF_GERER, module: 'preventif', libelle: 'Gérer gammes et plans' },
  { code: PERMISSIONS.KPI_LIRE, module: 'kpi', libelle: 'Consulter les indicateurs' },
  { code: PERMISSIONS.UTILISATEUR_GERER, module: 'admin', libelle: 'Gérer les comptes et rôles' },
  { code: PERMISSIONS.AUDIT_LIRE, module: 'admin', libelle: 'Consulter le journal d\'audit' },
  { code: PERMISSIONS.PRODUCTION_LIRE, module: 'production', libelle: 'Consulter la production' },
  { code: PERMISSIONS.PRODUCTION_GERER, module: 'production', libelle: 'Gérer nomenclatures et lignes' },
  { code: PERMISSIONS.OF_CREER, module: 'production', libelle: 'Créer un ordre de fabrication' },
  { code: PERMISSIONS.OF_EXECUTER, module: 'production', libelle: 'Exécuter un OF' },
  { code: PERMISSIONS.OF_CLOTURER, module: 'production', libelle: 'Contrôler / clôturer un OF' },
  { code: PERMISSIONS.PF_LIRE, module: 'pf', libelle: 'Consulter les produits finis' },
  { code: PERMISSIONS.PF_GERER, module: 'pf', libelle: 'Gérer les produits finis' },
  { code: PERMISSIONS.PF_STOCK, module: 'pf', libelle: 'Mouvements stock PF' },
  { code: PERMISSIONS.PF_EXPEDIER, module: 'pf', libelle: 'Expédier un lot' },
  { code: PERMISSIONS.QUART_LIRE, module: 'production', libelle: 'Consulter les journaux de quart' },
  { code: PERMISSIONS.QUART_SAISIR, module: 'production', libelle: 'Saisir un journal de quart' },
  { code: PERMISSIONS.QUART_VALIDER, module: 'production', libelle: 'Valider un journal de quart' },
  { code: PERMISSIONS.TANK_LIRE, module: 'pf', libelle: 'Consulter les tanks' },
  { code: PERMISSIONS.TANK_GERER, module: 'pf', libelle: 'Gérer tanks et jaugeages' },
  { code: PERMISSIONS.LABO_LIRE, module: 'laboratoire', libelle: 'Consulter le laboratoire' },
  { code: PERMISSIONS.LABO_SAISIR, module: 'laboratoire', libelle: 'Saisir analyses et échantillons' },
  { code: PERMISSIONS.LABO_VALIDER, module: 'laboratoire', libelle: 'Valider un bulletin d’analyse' },
  { code: PERMISSIONS.DIRECTION_LIRE, module: 'direction', libelle: 'Consulter le pilotage direction' },
];

/** Matrice 4.3 du CDC : C/M/S/L/V traduits en codes de permission. */
const MATRICE: Record<string, string[]> = {
  ADMIN: CATALOGUE_PERMISSIONS.map((p) => p.code),
  RESP_MAINT: [
    PERMISSIONS.REFERENTIEL_LIRE,
    PERMISSIONS.EQUIPEMENT_LIRE,
    PERMISSIONS.EQUIPEMENT_CREER,
    PERMISSIONS.EQUIPEMENT_MODIFIER,
    PERMISSIONS.DEMANDE_LIRE,
    PERMISSIONS.DEMANDE_CREER,
    PERMISSIONS.DEMANDE_MODIFIER,
    PERMISSIONS.DEMANDE_VALIDER,
    PERMISSIONS.OT_LIRE,
    PERMISSIONS.OT_CREER,
    PERMISSIONS.OT_PLANIFIER,
    PERMISSIONS.OT_EXECUTER,
    PERMISSIONS.OT_CLOTURER,
    PERMISSIONS.STOCK_LIRE,
    PERMISSIONS.PREVENTIF_LIRE,
    PERMISSIONS.PREVENTIF_GERER,
    PERMISSIONS.KPI_LIRE,
    PERMISSIONS.AUDIT_LIRE,
  ],
  PLANIF: [
    PERMISSIONS.REFERENTIEL_LIRE,
    PERMISSIONS.EQUIPEMENT_LIRE,
    PERMISSIONS.DEMANDE_LIRE,
    PERMISSIONS.DEMANDE_MODIFIER,
    PERMISSIONS.OT_LIRE,
    PERMISSIONS.OT_CREER,
    PERMISSIONS.OT_PLANIFIER,
    PERMISSIONS.OT_EXECUTER,
    PERMISSIONS.STOCK_LIRE,
    PERMISSIONS.PREVENTIF_LIRE,
    PERMISSIONS.PREVENTIF_GERER,
    PERMISSIONS.KPI_LIRE,
  ],
  TECH: [
    PERMISSIONS.EQUIPEMENT_LIRE,
    PERMISSIONS.EQUIPEMENT_CREER,
    PERMISSIONS.DEMANDE_CREER,
    PERMISSIONS.DEMANDE_LIRE,
    PERMISSIONS.OT_LIRE,
    PERMISSIONS.OT_EXECUTER,
    PERMISSIONS.STOCK_LIRE,
    PERMISSIONS.STOCK_DEMANDER,
    PERMISSIONS.PREVENTIF_LIRE,
    PERMISSIONS.KPI_LIRE,
  ],
  MAGASIN: [
    PERMISSIONS.EQUIPEMENT_LIRE,
    PERMISSIONS.STOCK_LIRE,
    PERMISSIONS.STOCK_SORTIR,
    PERMISSIONS.STOCK_ENTRER,
    PERMISSIONS.STOCK_DEMANDER,
    PERMISSIONS.KPI_LIRE,
  ],
  DEMANDEUR: [
    PERMISSIONS.EQUIPEMENT_LIRE,
    PERMISSIONS.DEMANDE_CREER,
    PERMISSIONS.DEMANDE_LIRE,
  ],
  DIRECTION: [
    PERMISSIONS.REFERENTIEL_LIRE,
    PERMISSIONS.EQUIPEMENT_LIRE,
    PERMISSIONS.DEMANDE_LIRE,
    PERMISSIONS.OT_LIRE,
    PERMISSIONS.STOCK_LIRE,
    PERMISSIONS.PREVENTIF_LIRE,
    PERMISSIONS.KPI_LIRE,
    PERMISSIONS.PRODUCTION_LIRE,
    PERMISSIONS.PF_LIRE,
    PERMISSIONS.QUART_LIRE,
    PERMISSIONS.TANK_LIRE,
    PERMISSIONS.LABO_LIRE,
    PERMISSIONS.DIRECTION_LIRE,
  ],
  QHSE: [
    PERMISSIONS.EQUIPEMENT_LIRE,
    PERMISSIONS.OT_LIRE,
    PERMISSIONS.PREVENTIF_LIRE,
    PERMISSIONS.KPI_LIRE,
  ],
  RESP_PROD: [
    PERMISSIONS.PRODUCTION_LIRE,
    PERMISSIONS.PRODUCTION_GERER,
    PERMISSIONS.OF_CREER,
    PERMISSIONS.OF_EXECUTER,
    PERMISSIONS.OF_CLOTURER,
    PERMISSIONS.EQUIPEMENT_LIRE,
    PERMISSIONS.KPI_LIRE,
    PERMISSIONS.PF_LIRE,
    PERMISSIONS.QUART_LIRE,
    PERMISSIONS.QUART_VALIDER,
    PERMISSIONS.TANK_LIRE,
  ],
  OPERATEUR: [
    PERMISSIONS.PRODUCTION_LIRE,
    PERMISSIONS.OF_EXECUTER,
    PERMISSIONS.DEMANDE_CREER,
    PERMISSIONS.DEMANDE_LIRE,
    PERMISSIONS.EQUIPEMENT_LIRE,
    PERMISSIONS.KPI_LIRE,
    PERMISSIONS.QUART_LIRE,
    PERMISSIONS.QUART_SAISIR,
    PERMISSIONS.TANK_LIRE,
  ],
  QUALITE: [
    PERMISSIONS.PRODUCTION_LIRE,
    PERMISSIONS.OF_CLOTURER,
    PERMISSIONS.PF_LIRE,
    PERMISSIONS.PF_GERER,
    PERMISSIONS.KPI_LIRE,
    PERMISSIONS.LABO_LIRE,
    PERMISSIONS.LABO_SAISIR,
    PERMISSIONS.LABO_VALIDER,
  ],
  RESP_PF: [
    PERMISSIONS.PF_LIRE,
    PERMISSIONS.PF_GERER,
    PERMISSIONS.PF_STOCK,
    PERMISSIONS.PF_EXPEDIER,
    PERMISSIONS.PRODUCTION_LIRE,
    PERMISSIONS.KPI_LIRE,
    PERMISSIONS.TANK_LIRE,
    PERMISSIONS.TANK_GERER,
  ],
  MAGASIN_PF: [
    PERMISSIONS.PF_LIRE,
    PERMISSIONS.PF_STOCK,
    PERMISSIONS.PF_EXPEDIER,
    PERMISSIONS.KPI_LIRE,
    PERMISSIONS.TANK_LIRE,
    PERMISSIONS.TANK_GERER,
  ],
  MAGASIN_MP: [
    PERMISSIONS.PRODUCTION_LIRE,
    PERMISSIONS.QUART_LIRE,
    PERMISSIONS.QUART_SAISIR,
    PERMISSIONS.KPI_LIRE,
  ],
  CHEF_QUART: [
    PERMISSIONS.PRODUCTION_LIRE,
    PERMISSIONS.QUART_LIRE,
    PERMISSIONS.QUART_SAISIR,
    PERMISSIONS.DEMANDE_CREER,
    PERMISSIONS.KPI_LIRE,
    PERMISSIONS.TANK_LIRE,
  ],
  CHEF_USINE: [
    PERMISSIONS.PRODUCTION_LIRE,
    PERMISSIONS.QUART_LIRE,
    PERMISSIONS.QUART_VALIDER,
    PERMISSIONS.PF_LIRE,
    PERMISSIONS.TANK_LIRE,
    PERMISSIONS.LABO_LIRE,
    PERMISSIONS.KPI_LIRE,
    PERMISSIONS.DIRECTION_LIRE,
  ],
  AGENT_EXPEDITION: [
    PERMISSIONS.PF_LIRE,
    PERMISSIONS.PF_EXPEDIER,
    PERMISSIONS.TANK_LIRE,
    PERMISSIONS.TANK_GERER,
    PERMISSIONS.KPI_LIRE,
  ],
  TECH_LABO: [PERMISSIONS.LABO_LIRE, PERMISSIONS.LABO_SAISIR, PERMISSIONS.KPI_LIRE],
  RESP_LABO: [PERMISSIONS.LABO_LIRE, PERMISSIONS.LABO_SAISIR, PERMISSIONS.LABO_VALIDER, PERMISSIONS.KPI_LIRE],
  RESP_QUALITE: [
    PERMISSIONS.LABO_LIRE,
    PERMISSIONS.LABO_VALIDER,
    PERMISSIONS.PRODUCTION_LIRE,
    PERMISSIONS.PF_LIRE,
    PERMISSIONS.KPI_LIRE,
  ],
  DIRECTION_GENERALE: [
    PERMISSIONS.KPI_LIRE,
    PERMISSIONS.DIRECTION_LIRE,
    PERMISSIONS.PRODUCTION_LIRE,
    PERMISSIONS.PF_LIRE,
    PERMISSIONS.LABO_LIRE,
    PERMISSIONS.OT_LIRE,
    PERMISSIONS.EQUIPEMENT_LIRE,
  ],
};

async function run() {
  await ds.initialize();
  console.log('Connexion PostgreSQL OK — initialisation des référentiels...');

  const permRepo = ds.getRepository(E.Permission);
  const roleRepo = ds.getRepository(E.Role);
  for (const p of CATALOGUE_PERMISSIONS) {
    const existe = await permRepo.findOne({ where: { code: p.code } });
    if (!existe) await permRepo.save(permRepo.create(p));
  }
  const toutesPerms = await permRepo.find();

  const rolesDef = [
    { code: 'ADMIN', libelle: 'Administrateur' },
    { code: 'RESP_MAINT', libelle: 'Responsable maintenance' },
    { code: 'PLANIF', libelle: 'Planificateur' },
    { code: 'TECH', libelle: 'Technicien' },
    { code: 'MAGASIN', libelle: 'Magasinier' },
    { code: 'DEMANDEUR', libelle: 'Demandeur / exploitation' },
    { code: 'DIRECTION', libelle: 'Direction (lecture)' },
    { code: 'QHSE', libelle: 'Responsable QHSE' },
    { code: 'RESP_PROD', libelle: 'Responsable production' },
    { code: 'OPERATEUR', libelle: 'Opérateur de production' },
    { code: 'QUALITE', libelle: 'Contrôle qualité' },
    { code: 'RESP_PF', libelle: 'Responsable produits finis' },
    { code: 'MAGASIN_PF', libelle: 'Magasinier produits finis' },
    { code: 'MAGASIN_MP', libelle: 'Magasinier matière première' },
    { code: 'CHEF_QUART', libelle: 'Chef de quart' },
    { code: 'CHEF_USINE', libelle: 'Chef d’usine' },
    { code: 'AGENT_EXPEDITION', libelle: 'Agent d’expédition' },
    { code: 'TECH_LABO', libelle: 'Technicien de laboratoire' },
    { code: 'RESP_LABO', libelle: 'Responsable laboratoire' },
    { code: 'RESP_QUALITE', libelle: 'Responsable qualité' },
    { code: 'DIRECTION_GENERALE', libelle: 'Direction générale' },
  ];
  for (const r of rolesDef) {
    let role = await roleRepo.findOne({ where: { code: r.code }, relations: ['permissions'] });
    if (!role) role = roleRepo.create(r);
    role.permissions = toutesPerms.filter((p) => MATRICE[r.code].includes(p.code));
    await roleRepo.save(role);
  }

  const siteRepo = ds.getRepository(E.Site);
  let site = await siteRepo.findOne({ where: { code: 'ABJ' } });
  if (!site) {
    site = await siteRepo.save(
      siteRepo.create({
        code: 'ABJ',
        libelle: 'Site Abidjan',
        client: 'Usine pilote',
        ville: 'Abidjan',
        pays: "Cote d'Ivoire",
      }),
    );
  }

  const locRepo = ds.getRepository(E.Localisation);
  let zone = await locRepo.findOne({ where: { code: 'PROD', siteId: site.id } });
  if (!zone) {
    zone = await locRepo.save(
      locRepo.create({ siteId: site.id, code: 'PROD', libelle: 'Zone Production', niveau: 1 }),
    );
  }

  const specRepo = ds.getRepository(E.Specialite);
  const specs = [
    ['MEC', 'Mecanicien'],
    ['ELEC', 'Electricien'],
    ['SOUD', 'Soudeur'],
    ['HYD', 'Hydraulicien'],
    ['INSTR', 'Instrumentiste'],
    ['POLY', 'Polyvalent'],
  ];
  for (const [code, libelle] of specs) {
    if (!(await specRepo.findOne({ where: { code } }))) await specRepo.save(specRepo.create({ code, libelle }));
  }

  const causeRepo = ds.getRepository(E.CauseDefaillance);
  const causes = [
    ['USU', 'Usure normale', 'Materiel'],
    ['LUB', 'Defaut de lubrification', 'Methode'],
    ['SUR', 'Surcharge / surintensite', 'Milieu'],
    ['HUM', "Erreur humaine / mauvaise utilisation", "Main d'oeuvre"],
    ['PIE', 'Piece defectueuse', 'Matiere'],
    ['COR', 'Corrosion', 'Milieu'],
    ['MTG', 'Defaut de montage', 'Methode'],
    ['ENV', 'Conditions environnementales', 'Milieu'],
    ['INC', 'Cause inconnue', 'Autre'],
  ];
  for (const [code, libelle, categorie] of causes) {
    if (!(await causeRepo.findOne({ where: { code } }))) {
      await causeRepo.save(causeRepo.create({ code, libelle, categorie }));
    }
  }

  const famRepo = ds.getRepository(E.FamilleEquipement);
  for (const [code, libelle] of [
    ['POM', 'Pompe'],
    ['COM', 'Compresseur'],
    ['GRP', 'Groupe electrogene'],
    ['VEH', 'Vehicule'],
    ['LEV', 'Appareil de levage'],
    ['ELEC', 'Equipement electrique'],
  ] as const) {
    if (!(await famRepo.findOne({ where: { code } }))) await famRepo.save(famRepo.create({ code, libelle }));
  }

  const catRepo = ds.getRepository(E.CategorieArticle);
  for (const [code, libelle] of [
    ['ROU', 'Roulements'],
    ['JNT', 'Joints'],
    ['FLT', 'Filtres'],
    ['HUI', 'Lubrifiants'],
  ] as const) {
    if (!(await catRepo.findOne({ where: { code } }))) await catRepo.save(catRepo.create({ code, libelle }));
  }

  const paramRepo = ds.getRepository(E.Parametre);
  const params = [
    ['DEVISE', 'FCFA', 'Devise de valorisation'],
    ['TAUX_HORAIRE_DEFAUT', '2500', "Cout horaire par defaut d'un technicien (FCFA/h)"],
    ['JOURS_GENERATION_PREVENTIF', '15', "Jours avant echeance pour generer l'OT preventif"],
    ['FORMAT_NUM_OT', 'OT-{AAAA}-{00000}', 'Format de numerotation des OT'],
    ['HEURES_OUVREES_MOIS', '173', "Base de calcul du taux d'occupation"],
    ['ECART_ALERTE_PCT', '1', 'Seuil d’alerte du bilan matière (%) — commentaire obligatoire'],
    ['ECART_BLOCAGE_PCT', '3', 'Seuil de blocage du bilan matière (%) — soumission refusée'],
    ['DUREE_ARRET_GENERANT_DI_MIN', '30', 'Durée d’arrêt machine générant une DI (RG-35)'],
  ];
  for (const [cle, valeur, description] of params) {
    if (!(await paramRepo.findOne({ where: { cle } }))) {
      await paramRepo.save(paramRepo.create({ cle, valeur, description }));
    }
  }

  const hash = await hasherMotDePasse('ChangeMoi@2026!');
  const userRepo = ds.getRepository(E.Utilisateur);
  const comptes = [
    { email: 'admin@usine.ci', nom: 'KOUASSI', prenom: 'Admin', role: 'ADMIN' },
    { email: 'maintenance@usine.ci', nom: 'N\'DRI', prenom: 'Jean Louis', role: 'RESP_MAINT' },
    { email: 'planning@usine.ci', nom: 'YAO', prenom: 'Awa', role: 'PLANIF' },
    { email: 'technicien@usine.ci', nom: 'KOUAKOU', prenom: 'Rubin', role: 'TECH' },
    { email: 'magasin@usine.ci', nom: 'TRAORE', prenom: 'Mariam', role: 'MAGASIN' },
    { email: 'exploitation@usine.ci', nom: 'KONE', prenom: 'Issa', role: 'DEMANDEUR' },
    { email: 'direction@usine.ci', nom: 'Bamba', prenom: 'Directeur', role: 'DIRECTION' },
    { email: 'qhse@usine.ci', nom: 'N\'Guessan', prenom: 'Sandra', role: 'QHSE' },
    { email: 'production@usine.ci', nom: 'DIALLO', prenom: 'Fatou', role: 'RESP_PROD' },
    { email: 'operateur@usine.ci', nom: 'TOURE', prenom: 'Moussa', role: 'OPERATEUR' },
    { email: 'qualite@usine.ci', nom: 'KOFFI', prenom: 'Ama', role: 'QUALITE' },
    { email: 'produits@usine.ci', nom: 'MENSAH', prenom: 'Kodjo', role: 'RESP_PF' },
    { email: 'entrepot@usine.ci', nom: 'SANOGO', prenom: 'Aicha', role: 'MAGASIN_PF' },
    { email: 'chefquart@usine.ci', nom: 'BLE', prenom: 'Yao', role: 'CHEF_QUART' },
    { email: 'labo@usine.ci', nom: 'AKA', prenom: 'Sylvie', role: 'RESP_LABO' },
    { email: 'usine@usine.ci', nom: 'GBOHO', prenom: 'Paul', role: 'CHEF_USINE' },
    { email: 'magasinmp@usine.ci', nom: 'OUATTARA', prenom: 'Kader', role: 'MAGASIN_MP' },
    { email: 'expedition@usine.ci', nom: 'YAO', prenom: 'Linda', role: 'AGENT_EXPEDITION' },
  ];
  for (const c of comptes) {
    if (await userRepo.findOne({ where: { email: c.email } })) continue;
    const role = await roleRepo.findOne({ where: { code: c.role } });
    await userRepo.save(
      userRepo.create({
        email: c.email,
        nom: c.nom,
        prenom: c.prenom,
        roleId: role!.id,
        siteId: site.id,
        motDePasse: hash,
        doitChangerMdp: false,
        actif: true,
      }),
    );
  }

  const specMap = Object.fromEntries((await specRepo.find()).map((s) => [s.code, s.id]));
  const techRepo = ds.getRepository(E.Technicien);
  const techUser = await userRepo.findOne({ where: { email: 'technicien@usine.ci' } });
  const techs = [
    ['S010', 'SOGOBA Issa', 'MEC'],
    ['S011', 'KOUAKOU Kouame Rubin', 'MEC'],
    ['S012', 'BAMBA Bakary Siriky', 'MEC'],
    ['S014', 'DIARASSOUBA Ben Swaliho', 'MEC'],
    ['S015', 'KOUAME Koffi JB', 'MEC'],
    ['S016', 'SEKONGO Kiboni', 'MEC'],
    ['S017', 'DOUMBIA Idrissa', 'MEC'],
    ['S019', 'KOFFI Renaud', 'SOUD'],
    ['S022', "BOHOUSSOU N'dri Germain", 'SOUD'],
    ['S028', 'ZORO Bi Arnaud', 'ELEC'],
    ['S036', 'KONAN Kouame Olivier', 'SOUD'],
  ];
  for (const [matricule, nomPrenom, spec] of techs) {
    if (await techRepo.findOne({ where: { matricule } })) continue;
    await techRepo.save(
      techRepo.create({
        matricule,
        nomPrenom,
        specialiteId: specMap[spec],
        siteId: site.id,
        utilisateurId: matricule === 'S011' ? techUser?.id ?? null : null,
        coutHoraire: '2500',
        statut: 'ACTIF',
      }),
    );
  }

  const pompe = await famRepo.findOne({ where: { code: 'POM' } });
  const eqRepo = ds.getRepository(E.Equipement);
  if (!(await eqRepo.findOne({ where: { codeEquipement: 'ABJ-POM-001' } }))) {
    await eqRepo.save(
      eqRepo.create({
        codeEquipement: 'ABJ-POM-001',
        designation: 'Pompe alimentation ligne 1',
        familleId: pompe?.id ?? null,
        localisationId: zone.id,
        criticite: 'A' as never,
        statut: 'EN_SERVICE' as never,
        qrCode: 'ABJ-POM-001',
        marque: 'Grundfos',
        modele: 'CR 32',
        uniteCompteur: 'h',
        compteurActuel: '9800',
        caracteristiques: { puissance_kw: 15, debit_m3h: 40 },
      }),
    );
  }

  const catRou = await catRepo.findOne({ where: { code: 'ROU' } });
  const artRepo = ds.getRepository(E.Article);
  if (!(await artRepo.findOne({ where: { refArticle: 'ROU-0125' } }))) {
    await artRepo.save(
      artRepo.create({
        refArticle: 'ROU-0125',
        designation: 'Roulement 6205',
        categorieId: catRou?.id ?? null,
        unite: 'U',
        quantiteStock: '25',
        seuilReappro: '5',
        prixUnitaireMoyen: '4000',
        emplacementMagasin: 'A-12-03',
        pieceCritique: true,
      }),
    );
  }

  const prodRepo = ds.getRepository(E.Produit);
  if (!(await prodRepo.findOne({ where: { refProduit: 'MP-SUC-001' } }))) {
    const mp1 = await prodRepo.save(prodRepo.create({
      refProduit: 'MP-SUC-001', designation: 'Sucre cristallisé', typeProduit: 'MATIERE_PREMIERE' as never, unite: 'kg', quantiteStock: '12000', seuilReappro: '2000',
    }));
    const mp2 = await prodRepo.save(prodRepo.create({
      refProduit: 'MP-EAU-001', designation: 'Eau de process', typeProduit: 'MATIERE_PREMIERE' as never, unite: 'L', quantiteStock: '50000', seuilReappro: '5000',
    }));
    const pf = await prodRepo.save(prodRepo.create({
      refProduit: 'PF-JUS-330', designation: 'Jus ananas 330 ml', typeProduit: 'PRODUIT_FINI' as never, unite: 'U', quantiteStock: '0', seuilReappro: '500', dureeConservationJours: 180,
    }));
    const pompeEq = await eqRepo.findOne({ where: { codeEquipement: 'ABJ-POM-001' } });
    const ligneRepo = ds.getRepository(E.LigneProduction);
    await ligneRepo.save(ligneRepo.create({
      code: 'LIG-01', libelle: 'Ligne conditionnement 1', siteId: site.id, equipementId: pompeEq?.id ?? null,
    }));
    const nomRepo = ds.getRepository(E.Nomenclature);
    const nom = await nomRepo.save(nomRepo.create({ code: 'NOM-JUS-330', libelle: 'Nomenclature jus 330 ml', produitId: pf.id }));
    const nlRepo = ds.getRepository(E.NomenclatureLigne);
    await nlRepo.save(nlRepo.create({ nomenclatureId: nom.id, composantId: mp1.id, quantite: '0.035' }));
    await nlRepo.save(nlRepo.create({ nomenclatureId: nom.id, composantId: mp2.id, quantite: '0.300' }));
  }

  if (!(await prodRepo.findOne({ where: { refProduit: 'MP-001' } }))) {
    await prodRepo.save(prodRepo.create({
      refProduit: 'MP-001', designation: 'Graines oléagineuses', typeProduit: 'MATIERE_PREMIERE' as never,
      unite: 'kg', quantiteStock: '80000', seuilReappro: '10000',
    }));
    await prodRepo.save(prodRepo.create({
      refProduit: 'PF-001', designation: 'Huile brute', typeProduit: 'PRODUIT_FINI' as never,
      unite: 'kg', quantiteStock: '0', seuilReappro: '0', dureeConservationJours: 365, densiteReference: '0.9100',
    }));
    await prodRepo.save(prodRepo.create({
      refProduit: 'SP-TOU', designation: 'Tourteau', typeProduit: 'SOUS_PRODUIT' as never,
      unite: 'kg', quantiteStock: '0', seuilReappro: '0',
    }));
    await prodRepo.save(prodRepo.create({
      refProduit: 'SP-POU', designation: 'Poussière', typeProduit: 'SOUS_PRODUIT' as never,
      unite: 'kg', quantiteStock: '0', seuilReappro: '0',
    }));
    await prodRepo.save(prodRepo.create({
      refProduit: 'SP-COQ', designation: 'Coque', typeProduit: 'SOUS_PRODUIT' as never,
      unite: 'kg', quantiteStock: '0', seuilReappro: '0',
    }));
  }

  const ligneRepo = ds.getRepository(E.LigneProduction);
  if (!(await ligneRepo.findOne({ where: { code: 'LIG-TRI' } }))) {
    const pompeEq = await eqRepo.findOne({ where: { codeEquipement: 'ABJ-POM-001' } });
    await ligneRepo.save(ligneRepo.create({
      code: 'LIG-TRI', libelle: 'Ligne de trituration', siteId: site.id, equipementId: pompeEq?.id ?? null,
    }));
  }

  const huile = await prodRepo.findOne({ where: { refProduit: 'PF-001' } });
  const tankRepo = ds.getRepository(E.Tank);
  if (!(await tankRepo.findOne({ where: { code: 'TK-01' } }))) {
    await tankRepo.save(tankRepo.create({
      code: 'TK-01', libelle: 'Tank huile 1', produitId: huile?.id ?? null, siteId: site.id,
      capaciteLitres: '50000', stockLitres: '0', stockKg: '0',
      baremeJaugeage: [{ hauteurCm: 0, litres: 0 }, { hauteurCm: 400, litres: 50000 }],
    }));
    await tankRepo.save(tankRepo.create({
      code: 'TK-02', libelle: 'Tank huile 2', produitId: huile?.id ?? null, siteId: site.id,
      capaciteLitres: '50000', stockLitres: '0', stockKg: '0',
      baremeJaugeage: [{ hauteurCm: 0, litres: 0 }, { hauteurCm: 400, litres: 50000 }],
    }));
  }

  const clientRepo = ds.getRepository(E.Client);
  if (!(await clientRepo.findOne({ where: { code: 'CLI-001' } }))) {
    await clientRepo.save(clientRepo.create({
      code: 'CLI-001', raisonSociale: 'Export Côte d’Ivoire', pays: "Côte d'Ivoire",
      contact: 'Service achats', telephone: '+225 27 20 00 00 00', incoterm: 'FOB',
    }));
  }

  const ptRepo = ds.getRepository(E.PointPrelevement);
  for (const [code, libelle, type] of [
    ['PP-MP', 'Réception matière première', 'MP'],
    ['PP-PROC', 'Process fabrication', 'PROCESS'],
    ['PP-TANK', 'Stockage tank', 'TANK'],
    ['PP-CHAR', 'Empotage / chargement', 'CHARGEMENT'],
  ] as const) {
    if (!(await ptRepo.findOne({ where: { code } }))) {
      await ptRepo.save(ptRepo.create({ code, libelle, type }));
    }
  }

  const paRepo = ds.getRepository(E.ParametreAnalyse);
  const paramsLabo = [
    ['FFA', 'Acidité (FFA)', '%', 'ISO 660', 1],
    ['HUM', 'Humidité', '%', 'ISO 662', 2],
    ['DEN', 'Densité à 20 °C', '', 'ISO 6883', 3],
    ['COUL', 'Couleur', '', 'Lovibond', 4],
  ] as const;
  for (const [code, libelle, unite, methode, ordre] of paramsLabo) {
    if (!(await paRepo.findOne({ where: { code } }))) {
      await paRepo.save(paRepo.create({ code, libelle, unite, methode, ordreAffichage: ordre }));
    }
  }

  const specRepoLabo = ds.getRepository(E.Specification);
  if (huile && !(await specRepoLabo.findOne({ where: { produitId: huile.id } }))) {
    const ffa = await paRepo.findOne({ where: { code: 'FFA' } });
    const hum = await paRepo.findOne({ where: { code: 'HUM' } });
    const den = await paRepo.findOne({ where: { code: 'DEN' } });
    const aujourdHui = new Date().toISOString().slice(0, 10);
    if (ffa) await specRepoLabo.save(specRepoLabo.create({
      produitId: huile.id, parametreId: ffa.id, valeurMax: '2.0000', dateDebut: aujourdHui,
    }));
    if (hum) await specRepoLabo.save(specRepoLabo.create({
      produitId: huile.id, parametreId: hum.id, valeurMax: '0.2000', dateDebut: aujourdHui,
    }));
    if (den) await specRepoLabo.save(specRepoLabo.create({
      produitId: huile.id, parametreId: den.id, valeurMin: '0.9000', valeurMax: '0.9300', valeurCible: '0.9100', dateDebut: aujourdHui,
    }));
  }

  console.log('');
  console.log('Jeu de données initial chargé.');
  console.log('Comptes de démonstration (mot de passe commun : ChangeMoi@2026!)');
  console.log('  admin@usine.ci            Administrateur');
  console.log('  maintenance@usine.ci      Responsable maintenance');
  console.log('  planning@usine.ci         Planificateur');
  console.log('  technicien@usine.ci       Technicien (S011)');
  console.log('  magasin@usine.ci          Magasinier');
  console.log('  exploitation@usine.ci     Demandeur');
  console.log('  direction@usine.ci        Direction');
  console.log('  qhse@usine.ci             QHSE');
  console.log('  production@usine.ci       Responsable production');
  console.log('  operateur@usine.ci        Operateur');
  console.log('  qualite@usine.ci          Qualite');
  console.log('  produits@usine.ci         Responsable PF');
  console.log('  entrepot@usine.ci         Magasinier PF');
  console.log('  chefquart@usine.ci        Chef de quart');
  console.log('  labo@usine.ci             Responsable laboratoire');
  console.log('  usine@usine.ci            Chef d’usine');
  console.log('  magasinmp@usine.ci        Magasinier MP');
  console.log('  expedition@usine.ci       Agent d’expédition');
  await ds.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
