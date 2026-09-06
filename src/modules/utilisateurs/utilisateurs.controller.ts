import { PaginationDto } from '../../common/dto/pagination.dto';
import { CreerUtilisateurDto, ModifierUtilisateurDto, UtilisateursService } from './utilisateurs.service';

type Acteur = { id: number; roleCode?: string; siteId?: number | null };

export class UtilisateursController {
  constructor(private readonly svc: UtilisateursService) {}

  lister(q: PaginationDto, acteur: Acteur, usineId?: number | null) {
    return this.svc.lister(q, acteur, usineId);
  }

  creer(dto: CreerUtilisateurDto, acteur: Acteur, usineId?: number | null) {
    return this.svc.creer(dto, acteur, usineId);
  }

  trouver(id: number) {
    return this.svc.trouver(id);
  }

  modifier(id: number, dto: ModifierUtilisateurDto, acteur: Acteur) {
    return this.svc.modifier(id, dto, acteur);
  }

  desactiver(id: number, acteur: Acteur) {
    return this.svc.desactiver(id, acteur);
  }

  roles() {
    return this.svc.listerRoles();
  }

  permissions() {
    return this.svc.listerPermissions();
  }

  majPerms(id: number, ids: number[]) {
    return this.svc.definirPermissionsRole(id, ids);
  }
}
