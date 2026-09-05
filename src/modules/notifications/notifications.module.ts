import { Repository } from 'typeorm';
import { Notification } from '../../database/entities';

export class NotificationsController {
  constructor(private readonly repo: Repository<Notification>) {}

  lister(user: { id: number }) {
    return this.repo.find({
      where: { destinataireId: user.id },
      order: { dateCreation: 'DESC' },
      take: 50,
    });
  }

  async lire(id: number, user: { id: number }) {
    await this.repo.update({ id: String(id), destinataireId: user.id }, { lu: true });
    return { message: 'Notification marquée comme lue.' };
  }
}

