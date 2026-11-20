import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { z } from 'zod';
import {
  User,
  Vehicle,
  Route,
  MaintenancePlan,
  MaintenanceOrder,
  MaintenanceServiceRecord,
} from '../../persistence/entities';
import {
  parse,
  text,
  uuid,
  date,
  nonnegative,
  permit,
  manage,
  paging,
  searchTerm,
  identity,
  audit,
} from '../../common';
import { today } from '../../rules';
const planFields = z
  .object({
    vehicleId: uuid,
    description: text,
    dueDate: date.nullable().optional(),
    dueKm: nonnegative.nullable().optional(),
    intervalDays: nonnegative.min(1).nullable().optional(),
    intervalKm: nonnegative.min(1).nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();
const planSchema = planFields.refine(
  (d) => d.dueDate || d.dueKm != null,
  'Informe data ou quilometragem da revisão.',
);
const orderSchema = z
  .object({
    vehicleId: uuid,
    planId: uuid.nullable().optional(),
    type: z.enum(['PREVENTIVE', 'CORRECTIVE']),
    description: text,
    blocking: z.boolean().default(true),
  })
  .strict();
@Injectable()
export class MaintenanceService {
  constructor(@Inject(DataSource) readonly ds: DataSource) {}
  async list(kind: string, q: any, user: User) {
    permit(user, ['ADMIN', 'MANAGER', 'MECHANIC', 'OPERATOR']);
    const { page, limit } = paging(q);
    const term = searchTerm(q);
    const where = term
      ? [
          { description: term },
          {
            vehicleId: In(
              (await this.ds.getRepository(Vehicle).findBy({ plate: term })).map((v) => v.id),
            ),
          },
        ]
      : {};
    if (kind === 'plans') {
      const [rows, total] = await this.ds.getRepository(MaintenancePlan).findAndCount({
        where,
        order: { createdAt: 'DESC' },
        take: limit,
        skip: (page - 1) * limit,
      });
      const items = await Promise.all(
        rows.map(async (p) => ({
          ...p,
          vehiclePlate: (await this.ds.getRepository(Vehicle).findOneBy({ id: p.vehicleId }))
            ?.plate,
        })),
      );
      return { items, total, page, limit };
    }
    const [rows, total] = await this.ds
      .getRepository(MaintenanceOrder)
      .findAndCount({ where, order: { createdAt: 'DESC' }, take: limit, skip: (page - 1) * limit });
    const items = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        vehicle: await this.ds.getRepository(Vehicle).findOneBy({ id: row.vehicleId }),
        services: await this.ds
          .getRepository(MaintenanceServiceRecord)
          .find({ where: { orderId: row.id }, order: { createdAt: 'ASC' } }),
      })),
    );
    return { items, total, page, limit };
  }
  async savePlan(id: string | null, body: unknown, user: User) {
    permit(user, manage);
    const data = parse(id ? planFields.partial() : planFields, body);
    return this.ds.transaction(async (em) => {
      const repo = em.getRepository(MaintenancePlan);
      const row = id
        ? await repo.findOne({ where: { id: identity(id) }, lock: { mode: 'pessimistic_write' } })
        : repo.create();
      if (!row) throw new NotFoundException();
      const existing = Object.fromEntries(
        Object.keys(planFields.shape).map((key) => [key, (row as any)[key]]),
      );
      Object.assign(row, parse(planSchema, { ...existing, ...data }));
      await repo.save(row);
      await audit(em, user, 'maintenance-plan', row.id, id ? 'UPDATE' : 'CREATE');
      return row;
    });
  }
  async createOrder(body: unknown, user: User) {
    permit(user, manage);
    const data = parse(orderSchema, body);
    return this.ds.transaction(async (em) => {
      const v = await em
        .getRepository(Vehicle)
        .findOne({ where: { id: data.vehicleId }, lock: { mode: 'pessimistic_write' } });
      if (!v) throw new NotFoundException('Veículo não encontrado.');
      if (
        data.blocking &&
        (await em.getRepository(Route).countBy({ vehicleId: v.id, status: 'IN_PROGRESS' }))
      )
        throw new ConflictException('Veículo em viagem; encerre a rota antes de imobilizar.');
      if (
        data.planId &&
        !(await em.getRepository(MaintenancePlan).findOneBy({ id: data.planId, vehicleId: v.id }))
      )
        throw new ConflictException('Plano de revisão incompatível.');
      const order = await em.getRepository(MaintenanceOrder).save({ ...data, status: 'OPEN' });
      await audit(em, user, 'maintenance-order', order.id, 'CREATE');
      return order;
    });
  }
  async action(id: string, action: string, body: unknown, user: User) {
    permit(user, ['ADMIN', 'MECHANIC']);
    return this.ds.transaction(async (em) => {
      const row = await em
        .getRepository(MaintenanceOrder)
        .findOne({ where: { id: identity(id) }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new NotFoundException();
      if (action === 'start') {
        if (row.status !== 'OPEN') throw new ConflictException('A ordem não está aberta.');
        await em
          .getRepository(Vehicle)
          .findOne({ where: { id: row.vehicleId }, lock: { mode: 'pessimistic_write' } });
        if (
          row.blocking &&
          (await em
            .getRepository(Route)
            .countBy({ vehicleId: row.vehicleId, status: 'IN_PROGRESS' }))
        )
          throw new ConflictException('Veículo em viagem.');
        row.status = 'IN_PROGRESS';
        row.mechanicId = user.id;
      } else {
        if (row.status !== 'IN_PROGRESS')
          throw new ConflictException('Inicie o serviço antes de registrar a execução.');
        if (user.role !== 'ADMIN' && row.mechanicId !== user.id)
          throw new ForbiddenException('Ordem atribuída a outro mecânico.');
        if (action === 'services') {
          const data = parse(
            z
              .object({
                description: text,
                parts: z.string().max(500).default(''),
                partsCents: nonnegative,
                laborCents: nonnegative,
              })
              .strict(),
            body,
          );
          const service = await em
            .getRepository(MaintenanceServiceRecord)
            .save({ ...data, orderId: id, mechanicId: user.id, completedAt: new Date() });
          await audit(em, user, 'maintenance-service', service.id, 'CREATE');
          return service;
        }
        if (action !== 'complete') throw new NotFoundException();
        if (!(await em.getRepository(MaintenanceServiceRecord).countBy({ orderId: id })))
          throw new ConflictException('Registre pelo menos um serviço realizado.');
        row.status = 'COMPLETED';
        row.completedAt = new Date();
        if (row.planId) {
          const plan = await em.getRepository(MaintenancePlan).findOneByOrFail({ id: row.planId });
          const v = await em.getRepository(Vehicle).findOneByOrFail({ id: row.vehicleId });
          if (!plan.intervalDays && !plan.intervalKm) plan.active = false;
          else {
            if (plan.intervalDays) {
              const next = new Date(`${today()}T12:00:00-03:00`);
              next.setUTCDate(next.getUTCDate() + plan.intervalDays);
              plan.dueDate = today(next);
            } else plan.dueDate = null;
            plan.dueKm = plan.intervalKm ? v.odometer + plan.intervalKm : null;
          }
          await em.getRepository(MaintenancePlan).save(plan);
        }
      }
      await em.getRepository(MaintenanceOrder).save(row);
      await audit(em, user, 'maintenance-order', id, action.toUpperCase());
      return row;
    });
  }
}
