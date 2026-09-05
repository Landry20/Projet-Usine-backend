import { Repository } from 'typeorm';
import { BadRequestException } from '../../common/http-error';
import { PieceJointe } from '../../database/entities';

export class UploadsController {
  constructor(private readonly repo: Repository<PieceJointe>) {}

  async joindreOt(
    id: number,
    fichier: Express.Multer.File,
    user: { id: number },
  ) {
    if (!fichier) throw new BadRequestException({ message: 'Fichier manquant.' });
    return this.repo.save(
      this.repo.create({
        entite: 'OT',
        entiteId: id,
        typeDocument: 'PHOTO',
        nomFichier: fichier.originalname,
        url: `/v1/fichiers/${fichier.filename}`,
        tailleKo: Math.round(fichier.size / 1024),
        ajoutePar: user.id,
      }),
    );
  }

  lister(id: number) {
    return this.repo.find({ where: { entite: 'OT', entiteId: id }, order: { dateAjout: 'DESC' } });
  }
}

