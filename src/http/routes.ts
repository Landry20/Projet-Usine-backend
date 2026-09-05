import { Express, NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { DataSource } from 'typeorm';
import { PERMISSIONS as P } from '../common/constants/enums';
import { BadRequestException } from '../common/http-error';
import { extraireIp } from '../common/utils/numero.util';
import { dossierUploads } from '../common/utils/uploads.util';
import * as E from '../database/entities';
import { AuthController } from '../modules/auth/auth.controller';
import { AuthService } from '../modules/auth/auth.service';
import { AuditController } from '../modules/audit/audit.module';
import { DashboardController } from '../modules/dashboard/dashboard.module';
import { DemandesController } from '../modules/demandes/demandes.module';
import { EquipementsController } from '../modules/equipements/equipements.module';
import { LaboratoireController } from '../modules/laboratoire/laboratoire.module';
import { NotificationsController } from '../modules/notifications/notifications.module';
import { OrdresTravailController } from '../modules/ordres-travail/ordres-travail.module';
import { ProductionController } from '../modules/production/production.module';
import { QuartController } from '../modules/quart/quart.module';
import { ReferentielsController } from '../modules/referentiels/referentiels.module';
import { SitesController } from '../modules/sites/sites.module';
import { StockController } from '../modules/stock/stock.module';
import { TanksController } from '../modules/tanks/tanks.module';
import { TechniciensController } from '../modules/techniciens/techniciens.module';
import { UploadsController } from '../modules/uploads/uploads.module';
import { UtilisateursController } from '../modules/utilisateurs/utilisateurs.controller';
import { UtilisateursService } from '../modules/utilisateurs/utilisateurs.service';
import { exigerPermissions, exigerUnePermission, middlewareJwt, utilisateurReq } from './auth.middleware';

function asyncRoute(fn: (req: Request, res: Response) => Promise<unknown> | unknown) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res))
      .then((data) => {
        if (res.headersSent) return;
        res.json(data);
      })
      .catch(next);
  };
}

const id = (req: Request, cle = 'id') => Number(req.params[cle]);
const u = (req: Request) => utilisateurReq(req);

export function monterRoutes(app: Express, ds: DataSource) {
  const r = ds.getRepository.bind(ds);
  const auth = new AuthController(new AuthService(r(E.Utilisateur), r(E.RefreshToken), r(E.JournalAudit)));
  const users = new UtilisateursController(new UtilisateursService(r(E.Utilisateur), r(E.Role), r(E.Permission)));
  const sites = new SitesController(r(E.Site), r(E.Localisation));
  const refs = new ReferentielsController(
    r(E.Specialite), r(E.CauseDefaillance), r(E.FamilleEquipement), r(E.CategorieArticle),
    r(E.Fournisseur), r(E.Parametre), r(E.ChampPersonnalise),
  );
  const dash = new DashboardController(
    r(E.OrdreTravail), r(E.DemandeIntervention), r(E.Article), r(E.DemandePiece),
    r(E.Equipement), r(E.Technicien), r(E.Utilisateur),
  );
  const eq = new EquipementsController(
    r(E.Equipement), r(E.FamilleEquipement), r(E.Localisation), r(E.Site),
    r(E.CompteurReleve), r(E.OrdreTravail), r(E.ImportLot),
  );
  const di = new DemandesController(r(E.DemandeIntervention), r(E.Equipement), r(E.OrdreTravail), r(E.Notification), ds);
  const ot = new OrdresTravailController(
    r(E.OrdreTravail), r(E.Equipement), r(E.OtMainOeuvre), r(E.OtOperation), r(E.Technicien), r(E.JournalAudit), ds,
  );
  const stock = new StockController(
    r(E.Article), r(E.MouvementStock), r(E.DemandePiece), r(E.OtPiece), r(E.OrdreTravail), r(E.Notification), r(E.Utilisateur), ds,
  );
  const prod = new ProductionController(
    r(E.Produit), r(E.LigneProduction), r(E.Nomenclature), r(E.NomenclatureLigne),
    r(E.OrdreFabrication), r(E.LotProduit), r(E.MouvementProduit), r(E.Equipement), ds,
  );
  const tanks = new TanksController(
    r(E.Tank), r(E.TankMouvement), r(E.Jaugeage), r(E.Client), r(E.CommandeClient),
    r(E.Expedition), r(E.Chargement), r(E.BulletinAnalyse), ds,
  );
  const quart = new QuartController(
    r(E.DemandeMatiere), r(E.JournalQuart), r(E.JournalEntree), r(E.JournalSortie), r(E.JournalArret),
    r(E.Produit), r(E.LigneProduction), r(E.Parametre), ds,
  );
  const labo = new LaboratoireController(
    r(E.PointPrelevement), r(E.ParametreAnalyse), r(E.Specification), r(E.Echantillon),
    r(E.AnalyseResultat), r(E.BulletinAnalyse), r(E.NonConformite), r(E.JournalQuart), r(E.Tank), r(E.Equipement), ds,
  );
  const techs = new TechniciensController(r(E.Technicien));
  const uploads = new UploadsController(r(E.PieceJointe));
  const notifs = new NotificationsController(r(E.Notification));
  const auditC = new AuditController(r(E.JournalAudit));

  const jwt = middlewareJwt(ds);
  const loginLimit = rateLimit({ windowMs: 60_000, limit: 8, keyGenerator: (req) => extraireIp(req) });
  const mimeAutorises = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
  const fichier = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, dossierUploads()),
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^\w.\-]/g, '_')}`),
    }),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!mimeAutorises.has(file.mimetype)) {
        cb(new BadRequestException({ message: 'Type de fichier non autorisé (JPEG, PNG, WEBP, PDF).' }));
        return;
      }
      cb(null, true);
    },
  });

  const api = Router();
  app.use('/v1', api);

  api.get('/sante', (_req, res) => res.json({ ok: true, nom: 'ManuPro' }));
  api.get('/docs', (_req, res) => res.json({ nom: 'ManuPro API', prefixe: '/v1', sante: '/v1/sante' }));

  api.post('/auth/login', loginLimit, asyncRoute((req) => auth.connexion(req.body, req)));
  api.post('/auth/refresh', asyncRoute((req) => auth.rafraichir(req.body)));
  api.post('/auth/logout', jwt, asyncRoute((req) => auth.deconnexion(req.body, u(req), req)));
  api.get('/auth/me', jwt, asyncRoute((req) => auth.moi(u(req))));
  api.patch('/auth/profil', jwt, asyncRoute((req) => auth.majProfil(u(req), req.body)));
  api.post('/auth/changer-mot-de-passe', jwt, asyncRoute((req) => auth.changer(u(req), req.body)));

  api.get('/sites', jwt, exigerPermissions(P.REFERENTIEL_LIRE), asyncRoute(() => sites.lister()));
  api.post('/sites', jwt, exigerPermissions(P.REFERENTIEL_GERER), asyncRoute((req) => sites.creer(req.body)));
  api.patch('/sites/:id', jwt, exigerPermissions(P.REFERENTIEL_GERER), asyncRoute((req) => sites.modifier(id(req), req.body)));
  api.get('/localisations', jwt, exigerPermissions(P.REFERENTIEL_LIRE), asyncRoute(() => sites.listerLoc()));
  api.post('/localisations', jwt, exigerPermissions(P.REFERENTIEL_GERER), asyncRoute((req) => sites.creerLoc(req.body)));
  api.delete('/localisations/:id', jwt, exigerPermissions(P.REFERENTIEL_GERER), asyncRoute((req) => sites.supprimerLoc(id(req))));

  api.get('/specialites', jwt, exigerPermissions(P.REFERENTIEL_LIRE), asyncRoute(() => refs.specialitesListe()));
  api.post('/specialites', jwt, exigerPermissions(P.REFERENTIEL_GERER), asyncRoute((req) => refs.creerSpecialite(req.body)));
  api.get('/causes', jwt, exigerPermissions(P.REFERENTIEL_LIRE), asyncRoute(() => refs.causesListe()));
  api.post('/causes', jwt, exigerPermissions(P.REFERENTIEL_GERER), asyncRoute((req) => refs.creerCause(req.body)));
  api.get('/familles', jwt, exigerPermissions(P.REFERENTIEL_LIRE), asyncRoute(() => refs.famillesListe()));
  api.post('/familles', jwt, exigerPermissions(P.REFERENTIEL_GERER), asyncRoute((req) => refs.creerFamille(req.body)));
  api.get('/categories-articles', jwt, exigerPermissions(P.REFERENTIEL_LIRE), asyncRoute(() => refs.cats()));
  api.post('/categories-articles', jwt, exigerPermissions(P.REFERENTIEL_GERER), asyncRoute((req) => refs.creerCat(req.body)));
  api.get('/fournisseurs', jwt, exigerPermissions(P.REFERENTIEL_LIRE), asyncRoute(() => refs.fourns()));
  api.post('/fournisseurs', jwt, exigerPermissions(P.REFERENTIEL_GERER), asyncRoute((req) => refs.creerFourn(req.body)));
  api.get('/parametres', jwt, asyncRoute(() => refs.parametres()));
  api.patch('/parametres/:cle', jwt, exigerPermissions(P.REFERENTIEL_GERER), asyncRoute((req) => refs.majParam(String(req.params.cle), req.body.valeur)));
  api.get('/champs-personnalises', jwt, exigerPermissions(P.REFERENTIEL_LIRE), asyncRoute(() => refs.champsListe()));
  api.post('/champs-personnalises', jwt, exigerPermissions(P.REFERENTIEL_GERER), asyncRoute((req) => refs.creerChamp(req.body)));
  api.get('/familles/:id/champs', jwt, exigerPermissions(P.REFERENTIEL_LIRE), asyncRoute((req) => refs.champsFamille(id(req))));

  api.get('/dashboard', jwt, asyncRoute((req) => dash.accueil(u(req))));

  api.get('/equipements', jwt, exigerPermissions(P.EQUIPEMENT_LIRE), asyncRoute((req) => eq.lister(req.query as never)));
  api.get('/equipements/qr/:code', jwt, exigerPermissions(P.EQUIPEMENT_LIRE), asyncRoute((req) => eq.parQr(String(req.params.code))));
  api.get('/equipements/:id', jwt, exigerPermissions(P.EQUIPEMENT_LIRE), asyncRoute((req) => eq.fiche(id(req))));
  api.post('/equipements', jwt, exigerPermissions(P.EQUIPEMENT_CREER), asyncRoute((req) => eq.creer(req.body, u(req))));
  api.post('/equipements/:id/dupliquer', jwt, exigerPermissions(P.EQUIPEMENT_CREER), asyncRoute((req) => eq.dupliquer(id(req))));
  api.patch('/equipements/:id', jwt, exigerPermissions(P.EQUIPEMENT_MODIFIER), asyncRoute((req) => eq.modifier(id(req), req.body)));
  api.delete('/equipements/:id', jwt, exigerPermissions(P.EQUIPEMENT_SUPPRIMER), asyncRoute((req) => eq.supprimer(id(req))));
  api.post('/compteurs', jwt, asyncRoute((req) => (eq.releve as Function)(req.body, u(req))));

  api.get('/demandes', jwt, exigerPermissions(P.DEMANDE_LIRE), asyncRoute((req) => di.lister(req.query as never, u(req))));
  api.get('/demandes/:id', jwt, exigerPermissions(P.DEMANDE_LIRE), asyncRoute((req) => di.fiche(id(req))));
  api.post('/demandes', jwt, exigerPermissions(P.DEMANDE_CREER), asyncRoute((req) => di.creer(req.body, u(req))));
  api.post('/demandes/:id/convertir', jwt, exigerPermissions(P.DEMANDE_VALIDER), asyncRoute((req) => (di.convertir as Function)(id(req), req.body, u(req))));
  api.post('/demandes/:id/rejeter', jwt, exigerPermissions(P.DEMANDE_VALIDER), asyncRoute((req) => (di.rejeter as Function)(id(req), req.body, u(req))));

  api.get('/ordres-travail', jwt, exigerPermissions(P.OT_LIRE), asyncRoute((req) => ot.lister(req.query as never, u(req))));
  api.get('/ordres-travail/:id', jwt, exigerPermissions(P.OT_LIRE), asyncRoute((req) => ot.fiche(id(req))));
  api.post('/ordres-travail', jwt, exigerPermissions(P.OT_CREER), asyncRoute((req) => ot.creer(req.body, u(req))));
  api.patch('/ordres-travail/:id', jwt, asyncRoute((req) => (ot.planifier as Function)(id(req), req.body, u(req))));
  api.patch('/ordres-travail/:id/statut', jwt, asyncRoute((req) => (ot.changerStatut as Function)(id(req), req.body, u(req))));
  api.post('/ordres-travail/:id/rouvrir', jwt, asyncRoute((req) => (ot.rouvrir as Function)(id(req), req.body, u(req))));
  api.post('/ordres-travail/:id/main-oeuvre', jwt, asyncRoute((req) => (ot.pointer as Function)(id(req), req.body, u(req))));
  api.patch('/ordres-travail/:id/rapport', jwt, asyncRoute((req) => (ot.rapport as Function)(id(req), req.body, u(req))));
  api.patch('/ordres-travail/:otId/operations/:opId', jwt, asyncRoute((req) => (ot.majOperation as Function)(Number(req.params.otId), Number(req.params.opId), req.body)));
  api.post('/ordres-travail/:id/operations', jwt, asyncRoute((req) => (ot.ajouterOperation as Function)(id(req), req.body)));
  api.post('/ordres-travail/:id/pieces-jointes', jwt, fichier.single('fichier'), asyncRoute((req) => uploads.joindreOt(id(req), req.file as Express.Multer.File, u(req))));
  api.get('/ordres-travail/:id/pieces-jointes', jwt, asyncRoute((req) => uploads.lister(id(req))));

  api.get('/articles', jwt, exigerPermissions(P.STOCK_LIRE), asyncRoute((req) => stock.listerArticles(req.query as never)));
  api.get('/articles/critiques', jwt, exigerPermissions(P.STOCK_LIRE), asyncRoute(() => stock.critiques()));
  api.get('/articles/:id', jwt, exigerPermissions(P.STOCK_LIRE), asyncRoute((req) => stock.ficheArticle(id(req))));
  api.post('/articles', jwt, exigerPermissions(P.STOCK_ENTRER), asyncRoute((req) => stock.creerArticle(req.body)));
  api.post('/mouvements-stock', jwt, asyncRoute((req) => stock.mouvement(req.body, u(req))));
  api.get('/mouvements-stock', jwt, exigerPermissions(P.STOCK_LIRE), asyncRoute((req) => stock.listerMvts(req.query as never)));
  api.get('/demandes-pieces', jwt, asyncRoute((req) => stock.listerDemandes(req.query.statut as never)));
  api.post('/ordres-travail/:id/pieces', jwt, asyncRoute((req) => (stock.demanderPiece as Function)(id(req), req.body, u(req))));
  api.post('/demandes-pieces/:id/valider', jwt, asyncRoute((req) => stock.valider(id(req), u(req))));
  api.post('/demandes-pieces/:id/refuser', jwt, asyncRoute((req) => (stock.refuser as Function)(id(req), req.body, u(req))));

  api.get('/produits', jwt, exigerUnePermission(P.PRODUCTION_LIRE, P.PF_LIRE), asyncRoute((req) => prod.listerProduits(req.query as never)));
  api.post('/produits', jwt, asyncRoute((req) => prod.creerProduit(req.body, u(req))));
  api.get('/lignes-production', jwt, exigerPermissions(P.PRODUCTION_LIRE), asyncRoute(() => prod.lignesListe()));
  api.post('/lignes-production', jwt, exigerPermissions(P.PRODUCTION_GERER), asyncRoute((req) => prod.creerLigne(req.body)));
  api.get('/nomenclatures', jwt, exigerPermissions(P.PRODUCTION_LIRE), asyncRoute(() => prod.noms()));
  api.post('/nomenclatures', jwt, exigerPermissions(P.PRODUCTION_GERER), asyncRoute((req) => prod.creerNom(req.body)));
  api.get('/ordres-fabrication', jwt, asyncRoute((req) => prod.listerOf(req.query as never)));
  api.get('/ordres-fabrication/:id', jwt, asyncRoute((req) => prod.ficheOf(id(req))));
  api.post('/ordres-fabrication', jwt, asyncRoute((req) => prod.creerOf(req.body, u(req))));
  api.patch('/ordres-fabrication/:id/statut', jwt, asyncRoute((req) => (prod.statutOf as Function)(id(req), req.body, u(req))));
  api.post('/ordres-fabrication/:id/controle', jwt, asyncRoute((req) => prod.controle(id(req), req.body, u(req))));
  api.get('/lots', jwt, asyncRoute((req) => prod.listerLots(req.query as never)));
  api.post('/lots/:id/expedier', jwt, asyncRoute((req) => prod.expedier(id(req), req.body.quantite, u(req))));
  api.get('/mouvements-produits', jwt, asyncRoute((req) => prod.mvtsListe(req.query as never)));
  api.get('/dashboard/production', jwt, asyncRoute(() => prod.dashProd()));
  api.get('/dashboard/produits-finis', jwt, asyncRoute(() => prod.dashPf()));

  api.get('/tanks', jwt, exigerUnePermission(P.TANK_LIRE, P.QUART_LIRE), asyncRoute(() => tanks.lister()));
  api.get('/tanks/:id', jwt, asyncRoute((req) => tanks.fiche(id(req))));
  api.post('/tanks', jwt, asyncRoute((req) => tanks.creer(req.body)));
  api.get('/tanks/:id/mouvements', jwt, asyncRoute((req) => tanks.mouvements(id(req), req.query as never)));
  api.post('/tanks/:id/jaugeages', jwt, asyncRoute((req) => (tanks.jauger as Function)(id(req), req.body, u(req))));
  api.get('/clients', jwt, asyncRoute(() => tanks.listerClients()));
  api.post('/clients', jwt, asyncRoute((req) => tanks.creerClient(req.body)));
  api.get('/commandes-clients', jwt, asyncRoute(() => tanks.commandesListe()));
  api.post('/commandes-clients', jwt, asyncRoute((req) => tanks.creerCommande(req.body)));
  api.get('/expeditions', jwt, asyncRoute((req) => tanks.listerExp(req.query as never)));
  api.get('/expeditions/:id', jwt, asyncRoute((req) => tanks.ficheExp(id(req))));
  api.post('/expeditions', jwt, asyncRoute((req) => tanks.creerExp(req.body)));
  api.post('/expeditions/:id/chargements', jwt, asyncRoute((req) => (tanks.ajouterChargement as Function)(id(req), req.body)));
  api.patch('/expeditions/:id/chargements/:cid/pesee', jwt, asyncRoute((req) => (tanks.pesee as Function)(id(req), Number(req.params.cid), req.body)));
  api.post('/expeditions/:id/cloturer', jwt, asyncRoute((req) => tanks.cloturer(id(req))));

  api.get('/demandes-matiere', jwt, asyncRoute((req) => quart.listerDm(req.query as never)));
  api.post('/demandes-matiere', jwt, asyncRoute((req) => quart.creerDm(req.body, u(req))));
  api.post('/demandes-matiere/:id/servir', jwt, asyncRoute((req) => (quart.servirDm as Function)(id(req), req.body, u(req))));
  api.post('/demandes-matiere/:id/refuser', jwt, asyncRoute((req) => quart.refuserDm(id(req), req.body.motif)));
  api.get('/journaux-quart', jwt, asyncRoute((req) => quart.listerJournaux(req.query as never)));
  api.get('/journaux-quart/:id', jwt, asyncRoute((req) => quart.ficheJournal(id(req))));
  api.post('/journaux-quart', jwt, asyncRoute((req) => quart.creerJournal(req.body, u(req))));
  api.post('/journaux-quart/:id/entrees', jwt, asyncRoute((req) => quart.ajouterEntree(id(req), req.body)));
  api.post('/journaux-quart/:id/sorties', jwt, asyncRoute((req) => quart.ajouterSortie(id(req), req.body)));
  api.post('/journaux-quart/:id/arrets', jwt, asyncRoute((req) => (quart.ajouterArret as Function)(id(req), req.body, u(req))));
  api.post('/journaux-quart/:id/soumettre', jwt, asyncRoute((req) => quart.soumettre(id(req), req.body, u(req))));
  api.post('/journaux-quart/:id/verifier', jwt, asyncRoute((req) => quart.verifier(id(req), u(req))));
  api.post('/journaux-quart/:id/approuver', jwt, asyncRoute((req) => quart.approuver(id(req), u(req))));
  api.post('/journaux-quart/:id/retourner', jwt, asyncRoute((req) => quart.retourner(id(req), req.body.motif)));
  api.post('/journaux-quart/:id/rectificatif', jwt, asyncRoute((req) => quart.rectificatif(id(req), u(req))));

  api.get('/points-prelevement', jwt, exigerPermissions(P.LABO_LIRE), asyncRoute(() => labo.pointsListe()));
  api.get('/parametres-analyse', jwt, exigerPermissions(P.LABO_LIRE), asyncRoute(() => labo.paramsListe()));
  api.get('/echantillons', jwt, exigerPermissions(P.LABO_LIRE), asyncRoute((req) => labo.listerEch(req.query as never)));
  api.get('/echantillons/:id', jwt, exigerPermissions(P.LABO_LIRE), asyncRoute((req) => labo.ficheEch(id(req))));
  api.post('/echantillons', jwt, asyncRoute((req) => labo.creerEch(req.body, u(req))));
  api.post('/echantillons/:id/analyses', jwt, asyncRoute((req) => (labo.saisirAnalyse as Function)(id(req), req.body, u(req))));
  api.get('/bulletins', jwt, asyncRoute((req) => labo.listerBa(req.query as never)));
  api.get('/bulletins/:id', jwt, asyncRoute((req) => labo.ficheBa(id(req))));
  api.post('/bulletins', jwt, asyncRoute((req) => labo.creerBa(req.body, u(req))));
  api.post('/bulletins/:id/soumettre', jwt, asyncRoute((req) => labo.soumettreBa(id(req), u(req))));
  api.post('/bulletins/:id/verifier', jwt, asyncRoute((req) => labo.verifierBa(id(req), u(req))));
  api.post('/bulletins/:id/approuver', jwt, asyncRoute((req) => (labo.approuverBa as Function)(id(req), req.body, u(req))));
  api.get('/non-conformites', jwt, asyncRoute((req) => labo.listerNc(req.query as never)));
  api.post('/non-conformites', jwt, asyncRoute((req) => labo.creerNc(req.body)));
  api.post('/non-conformites/:id/decision', jwt, asyncRoute((req) => (labo.decisionNc as Function)(id(req), req.body, u(req))));
  api.get('/dashboard/laboratoire', jwt, asyncRoute(() => labo.dashLabo()));
  api.get('/dashboard/direction', jwt, asyncRoute(() => labo.dashDirection()));

  api.get('/techniciens', jwt, exigerPermissions(P.REFERENTIEL_LIRE), asyncRoute(() => techs.lister()));
  api.get('/techniciens/:id', jwt, exigerPermissions(P.REFERENTIEL_LIRE), asyncRoute((req) => techs.fiche(id(req))));
  api.post('/techniciens', jwt, exigerPermissions(P.REFERENTIEL_GERER), asyncRoute((req) => techs.creer(req.body)));
  api.patch('/techniciens/:id', jwt, exigerPermissions(P.REFERENTIEL_GERER), asyncRoute((req) => techs.modifier(id(req), req.body)));

  api.get('/utilisateurs', jwt, exigerPermissions(P.UTILISATEUR_GERER), asyncRoute((req) => users.lister(req.query as never)));
  api.post('/utilisateurs', jwt, exigerPermissions(P.UTILISATEUR_GERER), asyncRoute((req) => users.creer(req.body)));
  api.get('/utilisateurs/:id', jwt, exigerPermissions(P.UTILISATEUR_GERER), asyncRoute((req) => users.trouver(id(req))));
  api.patch('/utilisateurs/:id', jwt, exigerPermissions(P.UTILISATEUR_GERER), asyncRoute((req) => users.modifier(id(req), req.body)));
  api.delete('/utilisateurs/:id', jwt, exigerPermissions(P.UTILISATEUR_GERER), asyncRoute((req) => users.desactiver(id(req))));
  api.get('/roles', jwt, exigerPermissions(P.UTILISATEUR_GERER), asyncRoute(() => users.roles()));
  api.get('/permissions', jwt, exigerPermissions(P.UTILISATEUR_GERER), asyncRoute(() => users.permissions()));
  api.patch('/roles/:id/permissions', jwt, exigerPermissions(P.UTILISATEUR_GERER), asyncRoute((req) => users.majPerms(id(req), req.body.permissionIds)));

  api.get('/notifications', jwt, asyncRoute((req) => notifs.lister(u(req))));
  api.patch('/notifications/:id/lire', jwt, asyncRoute((req) => notifs.lire(id(req), u(req))));
  api.get('/audit', jwt, exigerPermissions(P.AUDIT_LIRE), asyncRoute((req) => auditC.lister(req.query as never)));
}
