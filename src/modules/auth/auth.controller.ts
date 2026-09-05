import { extraireIp } from '../../common/utils/numero.util';
import { AuthService } from './auth.service';
import { ChangerMotDePasseDto, ConnexionDto, ProfilDto, RafraichirDto } from './auth.dto';

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /v1/auth/login — limitation stricte anti-brute-force. */
  connexion(dto: ConnexionDto, req: { headers: Record<string, unknown>; ip?: string }) {
    return this.auth.connexion(dto, req);
  }

  rafraichir(dto: RafraichirDto) {
    return this.auth.rafraichir(dto.refreshToken);
  }

  deconnexion(
    dto: Partial<RafraichirDto>,
    user: { id: number },
    req: { headers: Record<string, unknown>; ip?: string },
  ) {
    return this.auth.deconnexion(dto.refreshToken, user.id, extraireIp(req));
  }

  moi(user: { id: number }) {
    return this.auth.profil(user.id);
  }

  majProfil(user: { id: number }, dto: ProfilDto) {
    return this.auth.mettreAJourProfil(user.id, dto);
  }

  changer(user: { id: number }, dto: ChangerMotDePasseDto) {
    return this.auth.changerMotDePasse(user.id, dto);
  }
}
