import { DataSource } from 'typeorm';
import {
  User,
  Vehicle,
  Driver,
  Center,
  Route,
  Delivery,
  RouteStop,
  FuelRecord,
  MaintenancePlan,
  MaintenanceOrder,
  MaintenanceServiceRecord,
  Position,
} from './entities';
import { hashPassword } from '../modules/auth/auth.service';
import { today } from '../rules';
export async function seed(ds: DataSource) {
  if ((await ds.getRepository(User).count()) > 0) return;
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 10)
    throw new Error('Configure SEED_PASSWORD com pelo menos 10 caracteres.');
  const hours = (n: number) => new Date(Date.now() + n * 3600000);
  const days = (n: number) => today(new Date(Date.now() + n * 86400000));
  await ds.transaction(async (em) => {
    const people = [
      ['admin', 'Ana Martins', 'ADMIN'],
      ['gestor', 'Marcos Oliveira', 'MANAGER'],
      ['operador', 'Beatriz Lima', 'OPERATOR'],
      ['motorista', 'João Santos', 'DRIVER'],
      ['motorista2', 'Carla Mendes', 'DRIVER'],
      ['vencido', 'Paulo Rocha', 'DRIVER'],
      ['mecanico', 'Rafael Costa', 'MECHANIC'],
    ] as const;
    const users: Record<string, User> = {};
    for (const [key, name, role] of people)
      users[key] = await em.getRepository(User).save({
        name,
        email: `${key}@frotalab.test`,
        role,
        passwordHash: hashPassword(password),
        active: true,
        sessionVersion: 0,
      });
    const driver = await em.getRepository(Driver).save({
      userId: users.motorista.id,
      licenseNumber: 'DEMO1000001',
      categories: ['B', 'C'],
      licenseUntil: '2035-12-31',
      active: true,
    });
    await em.getRepository(Driver).save({
      userId: users.motorista2.id,
      licenseNumber: 'DEMO1000002',
      categories: ['B', 'C', 'D'],
      licenseUntil: '2035-12-31',
      active: true,
    });
    await em.getRepository(Driver).save({
      userId: users.vencido.id,
      licenseNumber: 'DEMO1000003',
      categories: ['B'],
      licenseUntil: days(-10),
      active: true,
    });
    const centers = await em.getRepository(Center).save([
      {
        name: 'CD Santa Helena',
        address: 'Av. Brasil, Santa Helena - PR (endereço demonstrativo)',
        latitude: -24.8589,
        longitude: -54.3333,
        active: true,
      },
      {
        name: 'Base Toledo',
        address: 'Centro, Toledo - PR (endereço demonstrativo)',
        latitude: -24.7246,
        longitude: -53.7435,
        active: true,
      },
    ]);
    const vehicles = await em.getRepository(Vehicle).save([
      {
        plate: 'FLT1A01',
        model: 'Mercedes-Benz Sprinter',
        category: 'B',
        capacityKg: 1800,
        odometer: 12540,
        registrationUntil: days(180),
        insuranceUntil: days(120),
        active: true,
      },
      {
        plate: 'FLT2B02',
        model: 'Volkswagen Delivery 9.170',
        category: 'C',
        capacityKg: 4500,
        odometer: 46320,
        registrationUntil: days(220),
        insuranceUntil: days(15),
        active: true,
      },
      {
        plate: 'FLT3C03',
        model: 'Fiat Fiorino',
        category: 'B',
        capacityKg: 650,
        odometer: 68400,
        registrationUntil: days(120),
        insuranceUntil: days(180),
        active: true,
      },
      {
        plate: 'FLT4D04',
        model: 'Iveco Daily',
        category: 'C',
        capacityKg: 3500,
        odometer: 98300,
        registrationUntil: days(-3),
        insuranceUntil: days(75),
        active: false,
      },
    ]);
    const completed = await em.getRepository(Route).save({
      name: 'Rota Oeste · concluída',
      centerId: centers[0].id,
      driverId: driver.id,
      vehicleId: vehicles[0].id,
      scheduledStart: hours(-30),
      scheduledEnd: hours(-24),
      status: 'COMPLETED',
      startedAt: hours(-30),
      completedAt: hours(-25),
      startKm: 12420,
      endKm: 12540,
    });
    const assigned = await em.getRepository(Route).save({
      name: 'Entregas Santa Helena',
      centerId: centers[0].id,
      driverId: driver.id,
      vehicleId: vehicles[0].id,
      scheduledStart: hours(-1),
      scheduledEnd: hours(4),
      status: 'ASSIGNED',
    });
    await em.getRepository(Route).save({
      name: 'Distribuição Toledo · planejamento',
      centerId: centers[1].id,
      scheduledStart: hours(24),
      scheduledEnd: hours(30),
      status: 'DRAFT',
    });
    const data = [
      {
        reference: 'ENT-1001',
        recipient: 'Mercado Aurora (fictício)',
        address: 'Centro, Santa Helena - PR',
        latitude: -24.856,
        longitude: -54.332,
        weightKg: 120,
        deadline: hours(-26),
        status: 'DELIVERED',
        completedAt: hours(-27),
      },
      {
        reference: 'ENT-1002',
        recipient: 'Papelaria Horizonte (fictícia)',
        address: 'Centro, Santa Helena - PR',
        latitude: -24.862,
        longitude: -54.328,
        weightKg: 80,
        deadline: hours(-28),
        status: 'DELIVERED',
        completedAt: hours(-26),
      },
      {
        reference: 'ENT-1003',
        recipient: 'Cooperativa Modelo (fictícia)',
        address: 'Santa Helena - PR',
        latitude: -24.849,
        longitude: -54.34,
        weightKg: 200,
        deadline: hours(2),
        status: 'PENDING',
      },
      {
        reference: 'ENT-1004',
        recipient: 'Loja Central (fictícia)',
        address: 'Santa Helena - PR',
        latitude: -24.864,
        longitude: -54.325,
        weightKg: 100,
        deadline: hours(-1),
        status: 'PENDING',
      },
      {
        reference: 'ENT-1005',
        recipient: 'Armazém Sul (fictício)',
        address: 'Toledo - PR',
        latitude: -24.725,
        longitude: -53.746,
        weightKg: 250,
        deadline: hours(28),
        status: 'PENDING',
      },
      {
        reference: 'ENT-1006',
        recipient: 'Distribuidora Vale (fictícia)',
        address: 'Toledo - PR',
        latitude: -24.73,
        longitude: -53.74,
        weightKg: 300,
        deadline: hours(29),
        status: 'PENDING',
      },
    ];
    const deliveries = await em.getRepository(Delivery).save(data);
    await em.getRepository(RouteStop).save([
      { routeId: completed.id, deliveryId: deliveries[0].id, order: 1, active: true },
      { routeId: completed.id, deliveryId: deliveries[1].id, order: 2, active: true },
      { routeId: assigned.id, deliveryId: deliveries[2].id, order: 1, active: true },
      { routeId: assigned.id, deliveryId: deliveries[3].id, order: 2, active: true },
    ]);
    await em.getRepository(FuelRecord).save({
      routeId: completed.id,
      vehicleId: vehicles[0].id,
      driverId: driver.id,
      occurredAt: hours(-28),
      odometer: 12480,
      liters: 45,
      totalCents: 27900,
      station: 'Posto Demonstração',
    });
    const plan = await em.getRepository(MaintenancePlan).save({
      vehicleId: vehicles[2].id,
      description: 'Revisão de óleo e filtros',
      dueDate: days(-2),
      dueKm: 68000,
      intervalDays: 180,
      intervalKm: 10000,
    });
    await em.getRepository(MaintenancePlan).save({
      vehicleId: vehicles[1].id,
      description: 'Inspeção preventiva',
      dueDate: days(20),
      dueKm: 47000,
      intervalDays: 90,
      intervalKm: 5000,
    });
    await em.getRepository(MaintenanceOrder).save({
      vehicleId: vehicles[2].id,
      planId: plan.id,
      type: 'PREVENTIVE',
      description: 'Revisão preventiva programada',
      status: 'OPEN',
      blocking: true,
    });
    const order = await em.getRepository(MaintenanceOrder).save({
      vehicleId: vehicles[1].id,
      type: 'CORRECTIVE',
      description: 'Ajuste do sistema elétrico',
      status: 'COMPLETED',
      blocking: false,
      mechanicId: users.mecanico.id,
      completedAt: hours(-20),
    });
    await em.getRepository(MaintenanceServiceRecord).save({
      orderId: order.id,
      mechanicId: users.mecanico.id,
      description: 'Substituição de conectores e inspeção',
      parts: 'Conectores',
      partsCents: 5000,
      laborCents: 8000,
      completedAt: hours(-20),
    });
    await em.getRepository(Position).save({
      routeId: completed.id,
      vehicleId: vehicles[0].id,
      driverId: driver.id,
      latitude: -24.8589,
      longitude: -54.3333,
      accuracy: 10,
      recordedAt: hours(-25),
      source: 'demo',
    });
  });
}
