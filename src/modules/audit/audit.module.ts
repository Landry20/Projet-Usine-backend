import { Repository } from 'typeorm';
import { paginer, PaginationDto } from '../../common/dto/pagination.dto';
import { JournalAudit } from '../../database/entities';

export class AuditController {
  constructor(private readonly repo: Repository<JournalAudit>) {}

  /** Lecture seule : aucun UPDATE/DELETE n'est exposé. */
  async lister(q: PaginationDto & { action?: string }) {
    const page = Number(q.page ?? 1);
    const limite = Number(q.limite ?? 25);
    const qb = this.repo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.utilisateur', 'u')
      .orderBy('a.dateAction', 'DESC')
      .skip((page - 1) * limite)
      .take(limite);
    if (q.action) qb.andWhere('a.action = :ac', { ac: q.action });
    const [donnees, total] = await qb.getManyAndCount();
    return paginer(donnees, total, page, limite);
  }
}

