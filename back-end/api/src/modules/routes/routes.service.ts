import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { z } from 'zod';
import {
  User,
  Vehicle,
  Driver,
  Center,
  Route,
  Delivery,
  RouteStop,
  FuelRecord,
  MaintenanceOrder,
  MaintenancePlan,
  IntegrationJob,
} from '../../persistence/entities';
import {
  parse,
  text,
  uuid,
  instant,
  nonnegative,
  permit,
  dispatch,
  paging,
  identity,
  audit,
} from '../../common';
import { today, deliveryLate } from '../../rules';
const routeSchema = z
  .object({
    name: text,
    centerId: uuid,
    scheduledStart: instant,
    scheduledEnd: instant,
    deliveryIds: z.array(uuid).max(100).default([]),
  })
  .strict();
@Injectable()
export class RoutesService {
  constructor(@Inject(DataSource) readonly ds: DataSource) {}
  async driver(user: User, em: EntityManager = this.ds.manager) {
    return em.getRepository(Driver).findOneBy({ userId: user.id });
  }
  async own(user: User, route: Route, em: EntityManager = this.ds.manager) {
    if (user.role === 'DRIVER' && (await this.driver(user, em))?.id !== route.driverId)
      throw new ForbiddenException('Esta rota não pertence a você.');
  }
  async getRoute(em: EntityManager, id: string, lock = false) {
    identity(id);
    const row = await em.getRepository(Route).findOne({
      where: { id },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!row) throw new NotFoundException('Rota não encontrada.');
    return row;
  }
  async routeView(row: Route) {
    const stops = await this.ds
      .getRepository(RouteStop)
      .find({ where: { routeId: row.id }, order: { order: 'ASC' } });
    const deliveries = await Promise.all(
      stops.map(async (s) => ({
        ...(await this.ds.getRepository(Delivery).findOneByOrFail({ id: s.deliveryId })),
        stopOrder: s.order,
      })),
    );
    const driver = row.driverId
      ? await this.ds.getRepository(Driver).findOneBy({ id: row.driverId })
      : null;
    const account = driver
      ? await this.ds.getRepository(User).findOneBy({ id: driver.userId })
      : null;
    return {
      ...row,
      deliveries: deliveries.map((d) => ({ ...d, late: deliveryLate(d) })),
      driverName: account?.name,
      vehicle: row.vehicleId
        ? await this.ds.getRepository(Vehicle).findOneBy({ id: row.vehicleId })
        : null,
      center: await this.ds.getRepository(Center).findOneBy({ id: row.centerId }),
    };
  }
  async list(q: any, user: User) {
    permit(user, ['ADMIN', 'MANAGER', 'OPERATOR', 'DRIVER']);
    const { page, limit } = paging(q);
    const qb = this.ds.getRepository(Route).createQueryBuilder('r');
    if (user.role === 'DRIVER')
      qb.andWhere('r.driverId=:driverId', { driverId: (await this.driver(user))?.id || null });
    if (q.status) qb.andWhere('r.status=:status', { status: q.status });
    if (q.q) qb.andWhere('r.name ILIKE :q', { q: `%${String(q.q).slice(0, 100)}%` });
    const [rows, total] = await qb
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { items: await Promise.all(rows.map((r) => this.routeView(r))), total, page, limit };
  }
  async save(id: string | null, body: unknown, user: User) {
    permit(user, dispatch);
    const data = parse(routeSchema, body);
    if (new Date(data.scheduledEnd) <= new Date(data.scheduledStart))
      throw new BadRequestException('O fim deve ocorrer depois do início previsto.');
    if (new Set(data.deliveryIds).size !== data.deliveryIds.length)
      throw new BadRequestException('Uma entrega não pode aparecer duas vezes.');
    const saved = await this.ds.transaction(async (em) => {
      let row = id
        ? await this.getRoute(em, id, true)
        : em.getRepository(Route).create({ status: 'DRAFT' });
      if (!['DRAFT', 'ASSIGNED'].includes(row.status))
        throw new ConflictException('A rota já foi iniciada ou encerrada.');
      const center = await em.getRepository(Center).findOneBy({ id: data.centerId, active: true });
      if (!center) throw new ConflictException('Centro de distribuição indisponível.');
      const { deliveryIds, ...fields } = data;
      Object.assign(row, fields, {
        scheduledStart: new Date(data.scheduledStart),
        scheduledEnd: new Date(data.scheduledEnd),
      });
      if (row.status === 'ASSIGNED') await this.validateAssignment(em, row);
      await em.getRepository(Route).save(row);
      const deliveries = deliveryIds.length
        ? await em.getRepository(Delivery).findBy({ id: In(deliveryIds) })
        : [];
      if (
        deliveries.length !== deliveryIds.length ||
        deliveries.some((d) => d.status !== 'PENDING')
      )
        throw new ConflictException('Escolha somente entregas pendentes existentes.');
      await em.getRepository(RouteStop).delete({ routeId: row.id });
      if (deliveryIds.length)
        await em.getRepository(RouteStop).save(
          deliveryIds.map((deliveryId, i) => ({
            routeId: row.id,
            deliveryId,
            order: i + 1,
            active: true,
          })),
        );
      if (row.status === 'ASSIGNED') await this.validateAssignment(em, row);
      await audit(em, user, 'route', row.id, id ? 'UPDATE' : 'CREATE');
      return row;
    });
    return this.routeView(saved);
  }
  async validateAssignment(em: EntityManager, row: Route, startingOdometer?: number) {
    if (!row.vehicleId || !row.driverId)
      throw new ConflictException('Selecione veículo e motorista.');
    const v = await em
      .getRepository(Vehicle)
      .findOne({ where: { id: row.vehicleId }, lock: { mode: 'pessimistic_write' } });
    const d = await em
      .getRepository(Driver)
      .findOne({ where: { id: row.driverId }, lock: { mode: 'pessimistic_write' } });
    const u = d ? await em.getRepository(User).findOneBy({ id: d.userId, active: true }) : null;
    if (!v?.active || !d?.active || !u || u.role !== 'DRIVER')
      throw new ConflictException('Veículo ou motorista indisponível.');
    if (d.licenseUntil < today() || !d.categories.includes(v.category))
      throw new ConflictException('Habilitação vencida ou categoria incompatível.');
    if (v.registrationUntil < today() || v.insuranceUntil < today())
      throw new ConflictException('Documento ou seguro do veículo vencido.');
    const blocked = await em
      .getRepository(MaintenanceOrder)
      .count({ where: { vehicleId: v.id, blocking: true, status: In(['OPEN', 'IN_PROGRESS']) } });
    if (blocked) throw new ConflictException('Veículo indisponível para manutenção.');
    const plans = await em.getRepository(MaintenancePlan).findBy({ vehicleId: v.id, active: true });
    if (
      plans.some(
        (p) =>
          (p.dueDate && p.dueDate < today()) ||
          (p.dueKm != null && p.dueKm <= (startingOdometer ?? v.odometer)),
      )
    )
      throw new ConflictException('Veículo com revisão obrigatória vencida.');
    const conflict = await em
      .getRepository(Route)
      .createQueryBuilder('r')
      .where('r.id<>:id', { id: row.id })
      .andWhere('r.status IN (:...states)', { states: ['ASSIGNED', 'IN_PROGRESS'] })
      .andWhere('(r.vehicleId=:v OR r.driverId=:d)', { v: v.id, d: d.id })
      .andWhere('(r.status=:active OR (r."scheduledStart"<:end AND r."scheduledEnd">:start))', {
        active: 'IN_PROGRESS',
        end: row.scheduledEnd,
        start: row.scheduledStart,
      })
      .getCount();
    if (conflict) throw new ConflictException('Veículo ou motorista já reservado neste período.');
    const weight = await em
      .getRepository(RouteStop)
      .createQueryBuilder('s')
      .innerJoin(Delivery, 'd', 'd.id=s.deliveryId')
      .select('COALESCE(SUM(d.weightKg),0)', 'total')
      .where('s.routeId=:id AND s.active=true AND d.status<>:cancelled', {
        id: row.id,
        cancelled: 'CANCELLED',
      })
      .getRawOne();
    if (Number(weight.total) > v.capacityKg)
      throw new ConflictException('A carga excede a capacidade do veículo.');
    return { v, d };
  }
  async action(id: string, action: string, body: unknown, user: User) {
    const saved = await this.ds.transaction(async (em) => {
      const row = await this.getRoute(em, id, true);
      await this.own(user, row, em);
      let detail: Record<string, unknown> = {};
      if (action === 'assign') {
        permit(user, dispatch);
        if (!['DRAFT', 'ASSIGNED'].includes(row.status))
          throw new ConflictException('Somente rotas não iniciadas podem ser atribuídas.');
        Object.assign(row, parse(z.object({ vehicleId: uuid, driverId: uuid }).strict(), body));
        await this.validateAssignment(em, row);
        row.status = 'ASSIGNED';
      } else if (action === 'start') {
        permit(user, ['ADMIN', 'DRIVER']);
        const { odometer } = parse(z.object({ odometer: nonnegative }).strict(), body);
        if (row.status !== 'ASSIGNED')
          throw new ConflictException('A rota precisa estar atribuída.');
        const { v } = await this.validateAssignment(em, row, odometer);
        if (odometer < v.odometer)
          throw new ConflictException('Hodômetro inferior ao último registro.');
        row.status = 'IN_PROGRESS';
        row.startedAt = new Date();
        row.startKm = odometer;
        v.odometer = odometer;
        await em.getRepository(Vehicle).save(v);
      } else if (action === 'complete') {
        permit(user, ['ADMIN', 'DRIVER']);
        const { odometer } = parse(z.object({ odometer: nonnegative }).strict(), body);
        if (row.status !== 'IN_PROGRESS')
          throw new ConflictException('A rota não está em andamento.');
        const v = await em
          .getRepository(Vehicle)
          .findOne({ where: { id: row.vehicleId! }, lock: { mode: 'pessimistic_write' } });
        if (odometer < v!.odometer || odometer < row.startKm!)
          throw new ConflictException('Hodômetro final inferior ao último registro.');
        const pending = await em
          .getRepository(RouteStop)
          .createQueryBuilder('s')
          .innerJoin(Delivery, 'd', 'd.id=s.deliveryId')
          .where('s.routeId=:id AND d.status=:status', { id, status: 'PENDING' })
          .getCount();
        if (pending)
          throw new ConflictException('Conclua ou cancele todas as entregas antes de encerrar.');
        row.status = 'COMPLETED';
        row.completedAt = new Date();
        row.endKm = odometer;
        v!.odometer = odometer;
        await em.getRepository(Vehicle).save(v!);
        const fuel = await em.getRepository(FuelRecord).findBy({ routeId: row.id });
        await em.getRepository(IntegrationJob).save({
          eventId: `route.completed:${row.id}`,
          payload: {
            type: 'route.completed',
            routeId: row.id,
            name: row.name,
            completedAt: row.completedAt.toISOString(),
            distanceKm: odometer - row.startKm!,
            expenses: fuel.map((f) => ({
              id: f.id,
              totalCents: f.totalCents,
              occurredAt: f.occurredAt,
            })),
          },
          status: 'PENDING',
          attempts: 0,
          nextAttemptAt: new Date(),
        });
      } else if (action === 'cancel') {
        permit(user, dispatch);
        const { reason } = parse(z.object({ reason: text }).strict(), body);
        if (!['DRAFT', 'ASSIGNED'].includes(row.status))
          throw new ConflictException('Apenas rotas não iniciadas podem ser canceladas.');
        row.status = 'CANCELLED';
        await em.getRepository(RouteStop).update({ routeId: id }, { active: false });
        detail = { reason };
      } else throw new NotFoundException();
      await em.getRepository(Route).save(row);
      await audit(em, user, 'route', id, action.toUpperCase(), detail);
      return row;
    });
    return this.routeView(saved);
  }
}
