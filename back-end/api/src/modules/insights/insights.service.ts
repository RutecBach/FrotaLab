import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  User,
  Vehicle,
  Driver,
  Route,
  Delivery,
  Document,
  MaintenancePlan,
  MaintenanceOrder,
  MaintenanceServiceRecord,
  FuelRecord,
} from '../../persistence/entities';
import { permit, manage, date, parse } from '../../common';
import { today, expiryState, deliveryLate } from '../../rules';
@Injectable()
export class InsightsService {
  constructor(@Inject(DataSource) readonly ds: DataSource) {}
  async alerts(user: User) {
    permit(user, ['ADMIN', 'MANAGER', 'OPERATOR', 'MECHANIC']);
    const items: any[] = [];
    const add = (kind: string, entityId: string, label: string, valid: string) => {
      const state = expiryState(valid);
      if (state !== 'valid')
        items.push({ id: `${kind}:${entityId}`, entityId, kind, label, state, dueDate: valid });
    };
    const vehicles = await this.ds.getRepository(Vehicle).findBy({ active: true });
    const byId = new Map(vehicles.map((v) => [v.id, v]));
    for (const v of vehicles) {
      add('registration', v.id, `Documento · ${v.plate}`, v.registrationUntil);
      add('insurance', v.id, `Seguro · ${v.plate}`, v.insuranceUntil);
    }
    for (const d of await this.ds.getRepository(Driver).findBy({ active: true })) {
      const u = await this.ds.getRepository(User).findOneBy({ id: d.userId });
      add('license', d.id, `Habilitação · ${u?.name}`, d.licenseUntil);
    }
    for (const doc of await this.ds.getRepository(Document).find())
      if (doc.validUntil) add('document', doc.id, `Anexo · ${doc.originalName}`, doc.validUntil);
    for (const p of await this.ds.getRepository(MaintenancePlan).findBy({ active: true })) {
      const v = byId.get(p.vehicleId);
      if (!v) continue;
      const state = p.dueDate ? expiryState(p.dueDate) : 'valid';
      const km = p.dueKm != null ? p.dueKm - v.odometer : null;
      if (state !== 'valid' || (km != null && km <= 1000))
        items.push({
          id: `plan:${p.id}`,
          entityId: v.id,
          kind: 'maintenance',
          label: `${p.description} · ${v.plate}`,
          state: state === 'expired' || (km != null && km <= 0) ? 'expired' : 'due',
          dueDate: p.dueDate,
          remainingKm: km,
        });
    }
    items.sort((a, b) => Number(b.state === 'expired') - Number(a.state === 'expired'));
    return { items, total: items.length };
  }
  period(q: any) {
    const from = q.from ? parse(date, q.from) : `${today().slice(0, 7)}-01`;
    const to = q.to ? parse(date, q.to) : today();
    if (from > to) throw new BadRequestException('Período inválido: início posterior ao fim.');
    const start = new Date(`${from}T00:00:00-03:00`);
    const end = new Date(`${to}T00:00:00-03:00`);
    end.setUTCDate(end.getUTCDate() + 1);
    return { from, to, start, end };
  }
  async report(kind: string, q: any, user: User) {
    permit(user, manage);
    const p = this.period(q);
    const inside = (v: Date | null) => v != null && v >= p.start && v < p.end;
    const routes = await this.ds.getRepository(Route).find();
    const deliveries = await this.ds.getRepository(Delivery).find();
    if (kind === 'financial') {
      const fuel = (await this.ds.getRepository(FuelRecord).find()).filter((f) =>
        inside(f.occurredAt),
      );
      const services = (await this.ds.getRepository(MaintenanceServiceRecord).find()).filter((s) =>
        inside(s.completedAt),
      );
      const fuelCents = fuel.reduce((t, f) => t + f.totalCents, 0);
      const maintenanceCents = services.reduce((t, s) => t + s.partsCents + s.laborCents, 0);
      const distanceKm = routes
        .filter((r) => r.status === 'COMPLETED' && inside(r.completedAt))
        .reduce((t, r) => t + r.endKm! - r.startKm!, 0);
      return {
        period: { from: p.from, to: p.to },
        summary: {
          fuelCents,
          maintenanceCents,
          totalCents: fuelCents + maintenanceCents,
          distanceKm,
          costPerKmCents: distanceKm
            ? Math.round((fuelCents + maintenanceCents) / distanceKm)
            : null,
        },
        items: [
          ...fuel.map((f) => ({
            id: f.id,
            type: 'Abastecimento',
            date: f.occurredAt,
            description: f.station || 'Abastecimento',
            totalCents: f.totalCents,
          })),
          ...services.map((s) => ({
            id: s.id,
            type: 'Manutenção',
            date: s.completedAt,
            description: s.description,
            totalCents: s.partsCents + s.laborCents,
          })),
        ],
      };
    }
    if (kind === 'operational') {
      const done = deliveries.filter((d) => d.status === 'DELIVERED' && inside(d.completedAt));
      const cancelled = deliveries.filter((d) => d.status === 'CANCELLED' && inside(d.cancelledAt));
      const pending = deliveries.filter(
        (d) =>
          d.createdAt < p.end &&
          (!d.completedAt || d.completedAt >= p.end) &&
          (!d.cancelledAt || d.cancelledAt >= p.end),
      );
      const view = (d: Delivery, status = d.status) => {
        const snapshot = { ...d, status, completedAt: status === 'PENDING' ? null : d.completedAt };
        return {
          reference: snapshot.reference,
          recipient: snapshot.recipient,
          status: snapshot.status,
          deadline: snapshot.deadline,
          completedAt: snapshot.completedAt,
          late: deliveryLate(snapshot, new Date(p.end.getTime() - 1)),
        };
      };
      return {
        period: { from: p.from, to: p.to },
        summary: {
          routesStarted: routes.filter((r) => inside(r.startedAt)).length,
          delivered: done.length,
          late: done.filter((d) => deliveryLate(d)).length,
          cancelled: cancelled.length,
          pending: pending.length,
        },
        items: [
          ...done.map((d) => view(d)),
          ...cancelled.map((d) => view(d)),
          ...pending.map((d) => view(d, 'PENDING')),
        ],
      };
    }
    if (kind === 'productivity') {
      const items = await Promise.all(
        (await this.ds.getRepository(Driver).find()).map(async (d) => {
          const account = await this.ds.getRepository(User).findOneBy({ id: d.userId });
          const owned = routes.filter((r) => r.driverId === d.id);
          const completed = owned.filter((r) => r.status === 'COMPLETED' && inside(r.completedAt));
          const records = await this.ds.query(
            'SELECT d.* FROM deliveries d JOIN route_stops s ON s."deliveryId"=d.id JOIN routes r ON r.id=s."routeId" WHERE r."driverId"=$1 AND s.active AND d.status=$2 AND d."completedAt">=$3 AND d."completedAt"<$4',
            [d.id, 'DELIVERED', p.start, p.end],
          );
          const onTime = records.filter((x: any) => !deliveryLate(x)).length;
          return {
            driver: account?.name || 'Motorista',
            routes: completed.length,
            deliveries: records.length,
            onTimePercent: records.length ? Math.round((onTime / records.length) * 100) : null,
            distanceKm: completed.reduce((t, r) => t + r.endKm! - r.startKm!, 0),
            durationMinutes: completed.reduce(
              (t, r) => t + Math.round((r.completedAt!.getTime() - r.startedAt!.getTime()) / 60000),
              0,
            ),
          };
        }),
      );
      return {
        period: { from: p.from, to: p.to },
        summary: { drivers: items.length, deliveries: items.reduce((t, r) => t + r.deliveries, 0) },
        items,
      };
    }
    throw new NotFoundException('Relatório não encontrado.');
  }
  async dashboard(user: User) {
    const vehicles = await this.ds.getRepository(Vehicle).find();
    const routes = await this.ds.getRepository(Route).find();
    const deliveries = await this.ds.getRepository(Delivery).find();
    const completed = deliveries.filter((d) => d.status === 'DELIVERED');
    const alerts = ['ADMIN', 'MANAGER', 'OPERATOR', 'MECHANIC'].includes(user.role)
      ? (await this.alerts(user)).items
      : [];
    let personalRoutes: any[] = [];
    if (user.role === 'DRIVER') {
      const d = await this.ds.getRepository(Driver).findOneBy({ userId: user.id });
      personalRoutes = routes.filter((r) => r.driverId === d?.id);
      return {
        role: user.role,
        activeRoutes: personalRoutes.filter((r) => r.status === 'IN_PROGRESS').length,
        assignedRoutes: personalRoutes.filter((r) => r.status === 'ASSIGNED').length,
        alerts: [],
      };
    }
    const running = new Set(
      routes.filter((r) => r.status === 'IN_PROGRESS').map((r) => r.vehicleId),
    );
    const blocked = new Set(
      (await this.ds.getRepository(MaintenanceOrder).findBy({ blocking: true }))
        .filter((o) => ['OPEN', 'IN_PROGRESS'].includes(o.status))
        .map((o) => o.vehicleId),
    );
    return {
      role: user.role,
      totalVehicles: vehicles.length,
      availableVehicles: vehicles.filter(
        (v) =>
          v.active &&
          !running.has(v.id) &&
          !blocked.has(v.id) &&
          !alerts.some((a) => a.entityId === v.id && a.state === 'expired'),
      ).length,
      activeRoutes: running.size,
      delivered: completed.length,
      late: deliveries.filter((d) => deliveryLate(d)).length,
      onTimePercent: completed.length
        ? Math.round((completed.filter((d) => !deliveryLate(d)).length / completed.length) * 100)
        : null,
      alerts: alerts.slice(0, 6),
      recentRoutes: routes
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5),
    };
  }
}
