import { PaginationDto } from '../../common/dto/pagination.dto';
import { CreerUtilisateurDto, ModifierUtilisateurDto, UtilisateursService } from './utilisateurs.service';

export class UtilisateursController {
  constructor(private readonly svc: UtilisateursService) {}

  lister(q: PaginationDto) {
    return this.svc.lister(q);
  }

  creer(dto: CreerUtilisateurDto) {
    return this.svc.creer(dto);
  }

  trouver(id: number) {
    return this.svc.trouver(id);
  }

  modifier(id: number, dto: ModifierUtilisateurDto) {
    return this.svc.modifier(id, dto);
  }

  desactiver(id: number) {
    return this.svc.desactiver(id);
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
