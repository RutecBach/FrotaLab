import { Injectable, Inject, ConflictException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Observable, Subject } from 'rxjs';
import { z } from 'zod';
import { Position, User } from '../../persistence/entities';
import { parse, uuid, instant, coordinates, permit } from '../../common';
import { RoutesService } from '../routes/routes.service';
import { AuthService } from '../auth/auth.service';
@Injectable()
export class TrackingService {
  readonly events = new Subject<any>();
  constructor(
    @Inject(DataSource) readonly ds: DataSource,
    @Inject(RoutesService) private routes: RoutesService,
    @Inject(AuthService) private auth: AuthService,
  ) {}
  async latest(user: User) {
    permit(user, ['ADMIN', 'MANAGER', 'OPERATOR']);
    const rows = await this.ds
      .getRepository(Position)
      .createQueryBuilder('p')
      .distinctOn(['p.vehicleId'])
      .orderBy('p.vehicleId')
      .addOrderBy('p.createdAt', 'DESC')
      .getMany();
    const vehicles = await this.ds.query('SELECT id,plate,model FROM vehicles');
    return {
      items: rows.map((p) => ({
        ...p,
        vehicle: vehicles.find((v: any) => v.id === p.vehicleId),
        stale: Date.now() - p.createdAt.getTime() > 60000,
      })),
      total: rows.length,
    };
  }
  async post(body: unknown, user: User) {
    permit(user, ['DRIVER', 'ADMIN']);
    const data = parse(
      z
        .object({
          routeId: uuid,
          ...coordinates,
          accuracy: z.number().min(0).max(100000),
          recordedAt: instant,
          source: z.enum(['device', 'demo']).default('device'),
        })
        .strict(),
      body,
    );
    const recordedAt = new Date(data.recordedAt);
    if (
      Math.abs(recordedAt.getTime() - Date.now()) > 600000 ||
      recordedAt.getTime() > Date.now() + 60000
    )
      throw new BadRequestException('Horário da posição inválido.');
    const row = await this.ds.transaction(async (em) => {
      const route = await this.routes.getRoute(em, data.routeId, true);
      await this.routes.own(user, route, em);
      if (route.status !== 'IN_PROGRESS')
        throw new ConflictException('Inicie a rota para compartilhar localização.');
      const last = await em
        .getRepository(Position)
        .findOne({ where: { routeId: route.id }, order: { createdAt: 'DESC' } });
      if (last && (Date.now() - last.createdAt.getTime() < 5000 || recordedAt <= last.recordedAt))
        throw new ConflictException('Aguarde cinco segundos e envie uma posição mais recente.');
      return em
        .getRepository(Position)
        .save({ ...data, recordedAt, vehicleId: route.vehicleId!, driverId: route.driverId! });
    });
    this.events.next({ type: 'position', data: row });
    return row;
  }
  stream(req: any) {
    permit(req.user, ['ADMIN', 'MANAGER', 'OPERATOR']);
    return new Observable<any>((subscriber) => {
      let ended = false;
      this.latest(req.user)
        .then((data) => {
          if (!ended) subscriber.next({ type: 'snapshot', data });
        })
        .catch(() => subscriber.complete());
      const subscription = this.events.subscribe((event) => subscriber.next(event));
      const interval = setInterval(async () => {
        try {
          await this.auth.authenticate(req.cookies.frotalab);
          subscriber.next({ type: 'heartbeat', data: { at: new Date().toISOString() } });
        } catch {
          subscriber.next({ type: 'session-expired', data: { message: 'Sessão encerrada.' } });
          subscriber.complete();
        }
      }, 5000);
      return () => {
        ended = true;
        clearInterval(interval);
        subscription.unsubscribe();
      };
    });
  }
}
