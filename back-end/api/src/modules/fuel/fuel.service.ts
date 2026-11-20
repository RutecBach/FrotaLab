import { Injectable, Inject, ConflictException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { User, Vehicle, FuelRecord } from '../../persistence/entities';
import { parse, uuid, instant, nonnegative, permit, paging, searchTerm, audit } from '../../common';
import { RoutesService } from '../routes/routes.service';
@Injectable()
export class FuelService {
  constructor(
    @Inject(DataSource) readonly ds: DataSource,
    @Inject(RoutesService) private routes: RoutesService,
  ) {}
  async create(body: unknown, user: User) {
    permit(user, ['ADMIN', 'DRIVER']);
    const data = parse(
      z
        .object({
          routeId: uuid,
          occurredAt: instant,
          odometer: nonnegative,
          liters: z.number().positive().max(10000),
          totalCents: nonnegative.min(1),
          station: z.string().max(200).default(''),
        })
        .strict(),
      body,
    );
    return this.ds.transaction(async (em) => {
      const route = await this.routes.getRoute(em, data.routeId, true);
      await this.routes.own(user, route, em);
      if (route.status !== 'IN_PROGRESS')
        throw new ConflictException('Abastecimento exige rota em andamento.');
      const v = await em
        .getRepository(Vehicle)
        .findOne({ where: { id: route.vehicleId! }, lock: { mode: 'pessimistic_write' } });
      if (data.odometer < v!.odometer)
        throw new ConflictException('Hodômetro inferior ao último registro.');
      const occurredAt = new Date(data.occurredAt);
      if (occurredAt < route.startedAt! || occurredAt.getTime() > Date.now() + 60000)
        throw new BadRequestException('Data fora do período da viagem.');
      const row = await em
        .getRepository(FuelRecord)
        .save({ ...data, occurredAt, vehicleId: route.vehicleId!, driverId: route.driverId! });
      v!.odometer = data.odometer;
      await em.getRepository(Vehicle).save(v!);
      await audit(em, user, 'fuel', row.id, 'CREATE');
      return row;
    });
  }
  async list(q: any, user: User) {
    const { page, limit } = paging(q);
    const station = searchTerm(q);
    const where = {
      ...(user.role === 'DRIVER'
        ? {
            driverId:
              (await this.routes.driver(user))?.id || '00000000-0000-0000-0000-000000000000',
          }
        : {}),
      ...(station ? { station } : {}),
    };
    const [items, total] = await this.ds.getRepository(FuelRecord).findAndCount({
      where,
      order: { occurredAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return { items, total, page, limit };
  }
}
