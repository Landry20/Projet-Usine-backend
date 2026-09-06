import jwt from 'jsonwebtoken';
import { MoreThan, Repository } from 'typeorm';
import { JournalAudit, RefreshToken, Utilisateur } from '../../database/entities';
import {  UnauthorizedException, ForbiddenException  } from '../../common/http-error';
import {
  genererJetonAleatoire,
  hasherJeton,
  hasherMotDePasse,
  validerComplexiteMotDePasse,
  verifierMotDePasse,
} from '../../common/utils/crypto.util';
import { extraireIp } from '../../common/utils/numero.util';
import { resoudreCompartiments } from '../../common/constants/enums';
import { ChangerMotDePasseDto, ConnexionDto, ProfilDto } from './auth.dto';

export class AuthService {
  constructor(
    private readonly users: Repository<Utilisateur>,
    private readonly tokens: Repository<RefreshToken>,
    private readonly audit: Repository<JournalAudit>,
  ) {}

  private signerAcces(user: { id: number; email: string; role: { code: string } }) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('JWT_ACCESS_SECRET manquant');
    return jwt.sign(
      { sub: user.id, email: user.email, role: user.role.code },
      secret,
      { expiresIn: (process.env.JWT_ACCESS_TTL ?? '900s') as jwt.SignOptions['expiresIn'] },
    );
  }

  /**
   * Authentification : vérifie le hash, le verrouillage, l'activation.
   * Ne révèle jamais si l'e-mail existe (message unique).
   */
  async connexion(dto: ConnexionDto, req: { headers: Record<string, unknown>; ip?: string }) {
    const max = Number(process.env.MAX_LOGIN_TENTATIVES ?? 5);
    const minutes = Number(process.env.VERROUILLAGE_MINUTES ?? 15);
    const ip = extraireIp(req);

    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.motDePasse')
      .leftJoinAndSelect('u.role', 'role')
      .leftJoinAndSelect('role.permissions', 'perm')
      .leftJoinAndSelect('u.site', 'site')
      .where('u.email = :email', { email: dto.email.toLowerCase().trim() })
      .andWhere('u.deletedAt IS NULL')
      .getOne();

    const messageGenerique = 'Identifiants incorrects.';

    if (!user || !user.actif) {
      await this.journaliser(user?.id ?? null, 'LOGIN_ECHEC', ip);
      throw new UnauthorizedException({ code: 'IDENTIFIANTS_INVALIDES', message: messageGenerique });
    }

    if (user.bloqueJusqua && user.bloqueJusqua > new Date()) {
      throw new ForbiddenException({
        code: 'COMPTE_VERROUILLE',
        message: `Compte temporairement verrouillé suite à trop de tentatives. Réessayez plus tard.`,
      });
    }

    const ok = await verifierMotDePasse(user.motDePasse, dto.motDePasse);
    if (!ok) {
      user.tentativesEchec += 1;
      if (user.tentativesEchec >= max) {
        user.bloqueJusqua = new Date(Date.now() + minutes * 60_000);
        user.tentativesEchec = 0;
      }
      await this.users.save(user);
      await this.journaliser(user.id, 'LOGIN_ECHEC', ip);
      throw new UnauthorizedException({ code: 'IDENTIFIANTS_INVALIDES', message: messageGenerique });
    }

    user.tentativesEchec = 0;
    user.bloqueJusqua = null;
    user.derniereConnexion = new Date();
    await this.users.save(user);
    await this.journaliser(user.id, 'LOGIN', ip);

    const access = this.signerAcces(user);
    const refreshBrut = genererJetonAleatoire();
    const expireLe = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.tokens.save(
      this.tokens.create({
        utilisateurId: user.id,
        jetonHash: hasherJeton(refreshBrut),
        adresseIp: ip,
        userAgent: String(req.headers['user-agent'] ?? '').slice(0, 255),
        expireLe,
      }),
    );

    return {
      accessToken: access,
      refreshToken: refreshBrut,
      expireDans: 900,
      doitChangerMdp: user.doitChangerMdp,
      utilisateur: this.serializer(user),
    };
  }

  async rafraichir(refreshToken: string) {
    const hash = hasherJeton(refreshToken);
    const ligne = await this.tokens.findOne({
      where: { jetonHash: hash, revoque: false },
      relations: ['utilisateur', 'utilisateur.role', 'utilisateur.role.permissions'],
    });
    if (!ligne || ligne.expireLe < new Date() || !ligne.utilisateur?.actif) {
      throw new UnauthorizedException({
        code: 'REFRESH_INVALIDE',
        message: 'Jeton de rafraîchissement invalide ou expiré.',
      });
    }
    const access = this.signerAcces(ligne.utilisateur);
    return { accessToken: access, expireDans: 900 };
  }

  async deconnexion(refreshToken: string | undefined, utilisateurId: number, ip: string) {
    if (refreshToken) {
      await this.tokens.update({ jetonHash: hasherJeton(refreshToken) }, { revoque: true });
    } else {
      await this.tokens.update({ utilisateurId, revoque: false }, { revoque: true });
    }
    await this.journaliser(utilisateurId, 'LOGOUT', ip);
    return { message: 'Déconnexion effectuée.' };
  }

  async changerMotDePasse(utilisateurId: number, dto: ChangerMotDePasseDto) {
    const erreur = validerComplexiteMotDePasse(dto.nouveauMotDePasse);
    if (erreur) {
      throw new ForbiddenException({ code: 'MOT_DE_PASSE_FAIBLE', message: erreur });
    }
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.motDePasse')
      .where('u.id = :id', { id: utilisateurId })
      .getOne();
    if (!user) throw new UnauthorizedException();
    const ok = await verifierMotDePasse(user.motDePasse, dto.ancienMotDePasse);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'ANCIEN_MDP_INVALIDE',
        message: 'L\'ancien mot de passe est incorrect.',
      });
    }
    user.motDePasse = await hasherMotDePasse(dto.nouveauMotDePasse);
    user.doitChangerMdp = false;
    await this.users.save(user);
    await this.tokens.update({ utilisateurId, revoque: false }, { revoque: true });
    return { message: 'Mot de passe modifié. Veuillez vous reconnecter.' };
  }

  async mettreAJourProfil(utilisateurId: number, dto: ProfilDto) {
    const user = await this.users.findOne({ where: { id: utilisateurId } });
    if (!user) throw new UnauthorizedException();
    user.nom = dto.nom.trim();
    user.prenom = dto.prenom?.trim() || null;
    user.telephone = dto.telephone?.trim() || null;
    await this.users.save(user);
    return this.profil(utilisateurId);
  }

  async profil(utilisateurId: number) {
    const user = await this.users.findOne({
      where: { id: utilisateurId },
      relations: ['role', 'role.permissions', 'site'],
    });
    if (!user) throw new UnauthorizedException();
    return this.serializer(user);
  }

  async sessionsActives(utilisateurId: number) {
    return this.tokens.find({
      where: { utilisateurId, revoque: false, expireLe: MoreThan(new Date()) },
      select: ['id', 'adresseIp', 'userAgent', 'expireLe', 'createdAt'],
    });
  }

  private serializer(user: Utilisateur) {
    return {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      telephone: user.telephone,
      role: user.role
        ? { id: user.role.id, code: user.role.code, libelle: user.role.libelle }
        : null,
      siteId: user.siteId,
      site: user.site ? { id: user.site.id, code: user.site.code, libelle: user.site.libelle } : null,
      doitChangerMdp: user.doitChangerMdp,
      permissions: (user.role?.permissions ?? []).map((p) => p.code),
      compartiments: resoudreCompartiments({ roleCode: user.role?.code, compartiments: user.compartiments }),
    };
  }

  async choisirSite(utilisateurId: number, siteId: number | null) {
    const user = await this.users.findOne({ where: { id: utilisateurId }, relations: ['role'] });
    if (!user) throw new UnauthorizedException();
    if (!['ADMIN', 'DIRECTION_GENERALE'].includes(user.role?.code ?? '')) {
      throw new ForbiddenException({ message: 'Vous ne pouvez pas changer d’usine.' });
    }
    user.siteId = siteId;
    await this.users.save(user);
    return this.profil(utilisateurId);
  }

  private async journaliser(utilisateurId: number | null, action: string, ip: string) {
    await this.audit.save({
      utilisateurId,
      action,
      tableConcernee: 'utilisateur',
      adresseIp: ip,
    });
  }
}
