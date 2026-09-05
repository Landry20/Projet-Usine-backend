import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import { StatutDemandePiece, TypeMouvement } from '../../common/constants/enums';
import { paginer, PaginationDto } from '../../common/dto/pagination.dto';
import {  BadRequestException, NotFoundException  } from '../../common/http-error';
import {
  Article,
  CategorieArticle,
  DemandePiece,
  MouvementStock,
  Notification,
  OrdreTravail,
  OtPiece,
  Utilisateur,
} from '../../database/entities';

class ArticleDto {
  @IsString() refArticle: string;
  @IsString() designation: string;
  @IsOptional() @IsInt() categorieId?: number;
  @IsOptional() @IsString() unite?: string;
  @IsOptional() @IsNumber() seuilReappro?: number;
  @IsOptional() @IsNumber() prixUnitaireMoyen?: number;
  @IsOptional() @IsString() emplacementMagasin?: string;
  @IsOptional() pieceCritique?: boolean;
}

class MouvementDto {
  @IsInt() articleId: number;
  @IsEnum(TypeMouvement) typeMvt: TypeMouvement;
  @IsNumber() @Min(0.01) quantite: number;
  @IsOptional() @IsNumber() prixUnitaire?: number;
  @IsOptional() @IsInt() otId?: number;
  @IsOptional() @IsString() bonReference?: string;
  @IsOptional() @IsString() motif?: string;
}

class DemandePieceDto {
  @IsInt() articleId: number;
  @IsNumber() @Min(0.01) quantite: number;
  @IsOptional() @IsInt() demandePar?: number;
  @IsOptional() @IsString() clientUuid?: string;
}

export class StockController {
  constructor(
    private readonly articles: Repository<Article>,
    private readonly mvts: Repository<MouvementStock>,
    private readonly demandesPieces: Repository<DemandePiece>,
    private readonly otPieces: Repository<OtPiece>,
    private readonly ots: Repository<OrdreTravail>,
    private readonly notifs: Repository<Notification>,
    private readonly users: Repository<Utilisateur>,
    private readonly ds: DataSource,
  ) {}

  async listerArticles(q: PaginationDto & { recherche?: string; critique?: string }) {
    const page = Number(q.page ?? 1);
    const limite = Number(q.limite ?? 25);
    const qb = this.articles
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.categorie', 'c')
      .leftJoinAndSelect('a.fournisseurPrincipal', 'f')
      .where('a.deletedAt IS NULL')
      .orderBy('a.refArticle', 'ASC')
      .skip((page - 1) * limite)
      .take(limite);
    if (q.recherche) {
      qb.andWhere('(a.refArticle LIKE :r OR a.designation LIKE :r)', { r: `%${q.recherche}%` });
    }
    if (q.critique === '1') qb.andWhere('a.pieceCritique = true');
    const [donnees, total] = await qb.getManyAndCount();
    return paginer(donnees, total, page, limite);
  }

  critiques() {
    return this.articles
      .createQueryBuilder('a')
      .where('a.actif = true')
      .andWhere('a.quantiteStock <= a.seuilReappro')
      .orderBy('a.pieceCritique', 'DESC')
      .getMany();
  }

  async ficheArticle(id: number) {
    const a = await this.articles.findOne({
      where: { id },
      relations: ['categorie', 'fournisseurPrincipal'],
    });
    if (!a) throw new NotFoundException({ message: 'Article introuvable.' });
    const mouvements = await this.mvts.find({
      where: { articleId: id },
      order: { dateMvt: 'DESC' },
      take: 50,
      relations: ['utilisateur'],
    });
    return { ...a, mouvements };
  }

  creerArticle(dto: ArticleDto) {
    return this.articles.save(
      this.articles.create({
        ...dto,
        refArticle: dto.refArticle.toUpperCase(),
        quantiteStock: '0',
        seuilReappro: String(dto.seuilReappro ?? 0),
        prixUnitaireMoyen: String(dto.prixUnitaireMoyen ?? 0),
      }),
    );
  }

  /**
   * POST /v1/mouvements-stock
   * Le stock n'est jamais modifié par un PATCH de quantité (RG-03 / RG-04).
   */
  async mouvement(dto: MouvementDto, user: { id: number }) {
    return this.executerMouvement(dto, user.id);
  }

  async listerMvts(q: PaginationDto & { articleId?: string; type?: TypeMouvement }) {
    const page = Number(q.page ?? 1);
    const limite = Number(q.limite ?? 25);
    const qb = this.mvts
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.article', 'a')
      .leftJoinAndSelect('m.utilisateur', 'u')
      .orderBy('m.dateMvt', 'DESC')
      .skip((page - 1) * limite)
      .take(limite);
    if (q.articleId) qb.andWhere('m.articleId = :aid', { aid: Number(q.articleId) });
    if (q.type) qb.andWhere('m.typeMvt = :t', { t: q.type });
    const [donnees, total] = await qb.getManyAndCount();
    return paginer(donnees, total, page, limite);
  }

  listerDemandes(statut?: StatutDemandePiece) {
    return this.demandesPieces.find({
      where: statut ? { statut } : {},
      relations: ['article', 'ordreTravail', 'ordreTravail.equipement'],
      order: { dateDemande: 'DESC' },
    });
  }

  /** Le technicien demande une pièce : pas de décrément stock (RG-26). */
  async demanderPiece(
    otId: number,
    dto: DemandePieceDto,
    user: { id: number; roleCode: string },
  ) {
    const ot = await this.ots.findOne({ where: { id: otId } });
    if (!ot) throw new NotFoundException({ message: 'Ordre de travail introuvable.' });
    if (dto.clientUuid) {
      const doublon = await this.demandesPieces.findOne({ where: { clientUuid: dto.clientUuid } });
      if (doublon) return doublon;
    }
    const dp = await this.demandesPieces.save(
      this.demandesPieces.create({
        otId,
        articleId: dto.articleId,
        quantite: String(dto.quantite),
        demandePar: dto.demandePar ?? null,
        clientUuid: dto.clientUuid ?? null,
      }),
    );
    // Un magasinier ou admin peut valider immédiatement s'il a le droit de sortie.
    if (user.roleCode === 'MAGASIN' || user.roleCode === 'ADMIN') {
      return this.validerDemande(dp.id, user);
    }
    return this.demandesPieces.findOne({ where: { id: dp.id }, relations: ['article', 'ordreTravail'] });
  }

  valider(id: number, user: { id: number }) {
    return this.validerDemande(id, user);
  }

  async refuser(
    id: number,
    motif: string,
    user: { id: number },
  ) {
    const dp = await this.demandesPieces.findOne({ where: { id } });
    if (!dp) throw new NotFoundException({ message: 'Demande de pièce introuvable.' });
    dp.statut = StatutDemandePiece.REFUSEE;
    dp.motifRefus = motif ?? 'Refus magasin';
    dp.traitePar = user.id;
    dp.dateTraitement = new Date();
    return this.demandesPieces.save(dp);
  }

  private async validerDemande(id: number, user: { id: number }) {
    const dp = await this.demandesPieces.findOne({ where: { id }, relations: ['article'] });
    if (!dp) throw new NotFoundException({ message: 'Demande de pièce introuvable.' });
    if (dp.statut !== StatutDemandePiece.EN_ATTENTE) {
      throw new BadRequestException({ message: 'Cette demande a déjà été traitée.' });
    }
    const mvt = await this.executerMouvement(
      {
        articleId: dp.articleId,
        typeMvt: TypeMouvement.SORTIE,
        quantite: Number(dp.quantite),
        otId: dp.otId,
        motif: `Sortie sur OT`,
      },
      user.id,
    );
    const article = await this.articles.findOne({ where: { id: dp.articleId } });
    const otPiece = await this.otPieces.save(
      this.otPieces.create({
        otId: dp.otId,
        articleId: dp.articleId,
        quantite: dp.quantite,
        prixUnitaire: article?.prixUnitaireMoyen ?? '0',
        montant: (Number(dp.quantite) * Number(article?.prixUnitaireMoyen ?? 0)).toFixed(2),
        delivrePar: user.id,
        mouvementId: String(mvt.id),
      }),
    );
    await this.recalculerCoutPieces(dp.otId);
    dp.statut = StatutDemandePiece.VALIDEE;
    dp.traitePar = user.id;
    dp.dateTraitement = new Date();
    dp.otPieceId = otPiece.id;
    await this.demandesPieces.save(dp);
    return { demande: dp, mouvement: mvt, otPiece };
  }

  private async executerMouvement(dto: MouvementDto, utilisateurId: number) {
    if (dto.typeMvt === TypeMouvement.AJUSTEMENT && !dto.motif) {
      throw new BadRequestException({ message: 'Un ajustement de stock doit être motivé (RG-04).' });
    }
    return this.ds.transaction(async (manager) => {
      const article = await manager.findOne(Article, { where: { id: dto.articleId }, lock: { mode: 'pessimistic_write' } });
      if (!article) throw new NotFoundException({ message: 'Article introuvable.' });
      const avant = Number(article.quantiteStock);
      let apres = avant;
      if (dto.typeMvt === TypeMouvement.ENTREE || dto.typeMvt === TypeMouvement.RETOUR) {
        apres = avant + dto.quantite;
        if (dto.typeMvt === TypeMouvement.ENTREE && dto.prixUnitaire != null) {
          const valeur = avant * Number(article.prixUnitaireMoyen) + dto.quantite * dto.prixUnitaire;
          article.prixUnitaireMoyen = (valeur / (apres || 1)).toFixed(2);
        }
      } else if (dto.typeMvt === TypeMouvement.SORTIE) {
        if (avant < dto.quantite) {
          throw new BadRequestException({
            code: 'STOCK_INSUFFISANT',
            message: `Stock insuffisant pour l'article ${article.refArticle} (disponible : ${avant}, demandé : ${dto.quantite}).`,
          });
        }
        apres = avant - dto.quantite;
      } else if (dto.typeMvt === TypeMouvement.AJUSTEMENT || dto.typeMvt === TypeMouvement.INVENTAIRE) {
        apres = dto.quantite;
        dto.quantite = Math.abs(apres - avant) || 0.01;
      }
      article.quantiteStock = apres.toFixed(2);
      await manager.save(article);
      const pu = dto.prixUnitaire ?? Number(article.prixUnitaireMoyen);
      const mvt = await manager.save(
        manager.create(MouvementStock, {
          articleId: article.id,
          typeMvt: dto.typeMvt,
          quantite: String(dto.quantite),
          prixUnitaire: String(pu),
          montant: (dto.quantite * pu).toFixed(2),
          dateMvt: new Date(),
          otId: dto.otId ?? null,
          bonReference: dto.bonReference ?? null,
          motif: dto.motif ?? null,
          stockAvant: avant.toFixed(2),
          stockApres: apres.toFixed(2),
          utilisateurId,
        }),
      );
      if (apres <= Number(article.seuilReappro)) {
        await this.alerterSeuil(article, apres);
      }
      return mvt;
    });
  }

  private async alerterSeuil(article: Article, stock: number) {
    const destinataires = await this.users
      .createQueryBuilder('u')
      .leftJoin('u.role', 'r')
      .where('r.code IN (:...codes)', { codes: ['MAGASIN', 'RESP_MAINT'] })
      .andWhere('u.actif = true')
      .getMany();
    for (const d of destinataires) {
      await this.notifs.save(
        this.notifs.create({
          destinataireId: d.id,
          type: article.pieceCritique ? 'STOCK_CRITIQUE' : 'STOCK_SEUIL',
          titre: `Stock bas : ${article.refArticle}`,
          message: `${article.designation} : ${stock} (seuil ${article.seuilReappro})`,
          lien: `/articles/${article.id}`,
        }),
      );
    }
  }

  private async recalculerCoutPieces(otId: number) {
    const lignes = await this.otPieces.find({ where: { otId } });
    const total = lignes.reduce((s, l) => s + Number(l.montant), 0);
    await this.ots.update({ id: otId }, { coutPieces: total.toFixed(2) });
  }
}

