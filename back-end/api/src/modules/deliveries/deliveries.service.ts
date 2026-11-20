import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { User, Route, Delivery, RouteStop } from '../../persistence/entities';
import {
  parse,
  text,
  instant,
  nonnegative,
  coordinates,
  permit,
  dispatch,
  paging,
  identity,
  audit,
} from '../../common';
import { deliveryLate } from '../../rules';
import { RoutesService } from '../routes/routes.service';
const deliverySchema = z
  .object({
    reference: text,
    recipient: text,
    address: text,
    ...coordinates,
    weightKg: nonnegative.min(1),
    deadline: instant,
  })
  .strict();
@Injectable()
export class DeliveriesService {
  constructor(
    @Inject(DataSource) readonly ds: DataSource,
    @Inject(RoutesService) private routes: RoutesService,
  ) {}
  async list(q: any, user: User) {
    const { page, limit } = paging(q);
    const qb = this.ds.getRepository(Delivery).createQueryBuilder('d');
    if (user.role === 'DRIVER')
      qb.innerJoin(RouteStop, 's', 's.deliveryId=d.id AND s.active=true')
        .innerJoin(Route, 'r', 'r.id=s.routeId')
        .andWhere('r.driverId=:id', { id: (await this.routes.driver(user))?.id || null });
    if (q.status) qb.andWhere('d.status=:status', { status: q.status });
    if (q.available === 'true')
      qb.andWhere(
        'd.status=\'PENDING\' AND NOT EXISTS (SELECT 1 FROM route_stops s WHERE s."deliveryId"=d.id AND s.active)',
      );
    if (q.q)
      qb.andWhere('(d.reference ILIKE :q OR d.recipient ILIKE :q)', {
        q: `%${String(q.q).slice(0, 100)}%`,
      });
    const [items, total] = await qb
      .orderBy('d.deadline', 'ASC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    return { items: items.map((d) => ({ ...d, late: deliveryLate(d) })), total, page, limit };
  }
  async save(id: string | null, body: unknown, user: User) {
    permit(user, dispatch);
    const data = parse(deliverySchema, body);
    return this.ds.transaction(async (em) => {
      const repo = em.getRepository(Delivery);
      const row = id
        ? await repo.findOne({ where: { id: identity(id) }, lock: { mode: 'pessimistic_write' } })
        : repo.create({ status: 'PENDING' });
      if (!row) throw new NotFoundException();
      if (
        row.status !== 'PENDING' ||
        (id && (await em.getRepository(RouteStop).countBy({ deliveryId: id, active: true })))
      )
        throw new ConflictException('Entrega já atribuída ou encerrada.');
      Object.assign(row, data, { deadline: new Date(data.deadline) });
      await repo.save(row);
      await audit(em, user, 'delivery', row.id, id ? 'UPDATE' : 'CREATE');
      return { ...row, late: deliveryLate(row) };
    });
  }
  async action(id: string, action: string, body: unknown, user: User) {
    return this.ds.transaction(async (em) => {
      const row = await em
        .getRepository(Delivery)
        .findOne({ where: { id: identity(id) }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new NotFoundException();
      const stop = await em.getRepository(RouteStop).findOneBy({ deliveryId: id, active: true });
      const route = stop ? await this.routes.getRoute(em, stop.routeId, true) : null;
      if (user.role === 'DRIVER') {
        if (!route) throw new ForbiddenException();
        await this.routes.own(user, route, em);
        if (route.status !== 'IN_PROGRESS')
          throw new ConflictException('Inicie a rota antes de registrar entregas.');
      }
      permit(user, action === 'complete' ? ['ADMIN', 'DRIVER'] : ['ADMIN', 'OPERATOR', 'DRIVER']);
      if (row.status !== 'PENDING') throw new ConflictException('Entrega já encerrada.');
      if (action === 'complete') {
        if (!route || route.status !== 'IN_PROGRESS')
          throw new ConflictException('A rota precisa estar em andamento.');
        row.status = 'DELIVERED';
        row.completedAt = new Date();
      } else if (action === 'cancel') {
        row.cancellationReason = parse(z.object({ reason: text }).strict(), body).reason;
        row.cancelledAt = new Date();
        row.status = 'CANCELLED';
      } else throw new NotFoundException();
      await em.getRepository(Delivery).save(row);
      await audit(
        em,
        user,
        'delivery',
        id,
        action.toUpperCase(),
        action === 'cancel' ? { reason: row.cancellationReason } : {},
      );
      return { ...row, late: deliveryLate(row) };
    });
  }
}
