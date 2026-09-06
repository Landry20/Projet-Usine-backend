import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { DataSource } from 'typeorm';
import { resoudreCompartiments } from '../common/constants/enums';
import { Utilisateur } from '../database/entities';

export type UtilisateurReq = {
  id: number;
  email: string;
  roleCode: string;
  permissions: string[];
  compartiments: string[];
  siteId: number | null;
};

export function middlewareJwt(ds: DataSource) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const jeton = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!jeton) {
      res.status(401).json({ code: 'NON_AUTHENTIFIE', message: 'Jeton manquant.' });
      return;
    }
    try {
      const secret = process.env.JWT_ACCESS_SECRET;
      if (!secret) throw new Error('secret');
      const payload = jwt.verify(jeton, secret) as jwt.JwtPayload;
      const user = await ds.getRepository(Utilisateur).findOne({
        where: { id: Number(payload.sub), actif: true },
        relations: ['role', 'role.permissions', 'site'],
      });
      if (!user) {
        res.status(401).json({ code: 'COMPTE_INACTIF', message: 'Compte introuvable ou désactivé.' });
        return;
      }
      (req as Request & { user: UtilisateurReq }).user = {
        id: user.id,
        email: user.email,
        roleCode: user.role?.code,
        permissions: (user.role?.permissions ?? []).map((p) => p.code),
        compartiments: resoudreCompartiments({
          roleCode: user.role?.code,
          compartiments: user.compartiments,
        }) as unknown as string[],
        siteId: user.siteId ?? null,
      };
      next();
    } catch {
      res.status(401).json({ code: 'JETON_INVALIDE', message: 'Session expirée. Reconnectez-vous.' });
    }
  };
}

export function exigerPermissions(...codes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: UtilisateurReq }).user;
    if (!user) {
      res.status(401).json({ message: 'Authentification requise.' });
      return;
    }
    if (user.roleCode === 'ADMIN' || codes.length === 0) {
      next();
      return;
    }
    if (codes.every((c) => user.permissions.includes(c))) {
      next();
      return;
    }
    res.status(403).json({ code: 'ACCES_REFUSE', message: "Vous n'avez pas le droit d'effectuer cette action." });
  };
}

export function exigerUnePermission(...codes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: UtilisateurReq }).user;
    if (!user) {
      res.status(401).json({ message: 'Authentification requise.' });
      return;
    }
    if (user.roleCode === 'ADMIN' || codes.some((c) => user.permissions.includes(c))) {
      next();
      return;
    }
    res.status(403).json({ code: 'ACCES_REFUSE', message: "Vous n'avez pas le droit d'effectuer cette action." });
  };
}

export function utilisateurReq(req: Request): UtilisateurReq {
  return (req as Request & { user: UtilisateurReq }).user;
}
