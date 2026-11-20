import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1761955200000 implements MigrationInterface {
  async up(q: QueryRunner) {
    const base =
      'id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()';
    const tables: Record<string, string> = {
      users: `name varchar NOT NULL, email varchar UNIQUE NOT NULL, "passwordHash" varchar NOT NULL, role varchar NOT NULL CHECK(role IN ('ADMIN','MANAGER','OPERATOR','DRIVER','MECHANIC')), active boolean NOT NULL DEFAULT true, "sessionVersion" integer NOT NULL DEFAULT 0`,
      vehicles: `plate varchar UNIQUE NOT NULL, model varchar NOT NULL, category varchar NOT NULL, "capacityKg" integer NOT NULL CHECK("capacityKg">0), odometer integer NOT NULL CHECK(odometer>=0), "registrationUntil" date NOT NULL, "insuranceUntil" date NOT NULL, active boolean NOT NULL DEFAULT true`,
      drivers: `"userId" uuid UNIQUE NOT NULL REFERENCES users(id), "licenseNumber" varchar UNIQUE NOT NULL, categories text NOT NULL, "licenseUntil" date NOT NULL, active boolean NOT NULL DEFAULT true`,
      centers: `name varchar NOT NULL, address varchar NOT NULL, latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90), longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180), active boolean NOT NULL DEFAULT true`,
      routes: `name varchar NOT NULL, "centerId" uuid NOT NULL REFERENCES centers(id), "driverId" uuid REFERENCES drivers(id), "vehicleId" uuid REFERENCES vehicles(id), "scheduledStart" timestamptz NOT NULL, "scheduledEnd" timestamptz NOT NULL, status varchar NOT NULL DEFAULT 'DRAFT', "startedAt" timestamptz, "completedAt" timestamptz, "startKm" integer, "endKm" integer, CHECK("scheduledEnd">"scheduledStart")`,
      deliveries: `reference varchar UNIQUE NOT NULL, recipient varchar NOT NULL, address varchar NOT NULL, latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90), longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180), "weightKg" integer NOT NULL CHECK("weightKg">0), deadline timestamptz NOT NULL, status varchar NOT NULL DEFAULT 'PENDING', "completedAt" timestamptz, "cancelledAt" timestamptz, "cancellationReason" varchar`,
      route_stops: `"routeId" uuid NOT NULL REFERENCES routes(id), "deliveryId" uuid NOT NULL REFERENCES deliveries(id), "order" integer NOT NULL, active boolean NOT NULL DEFAULT true`,
      positions: `"routeId" uuid NOT NULL REFERENCES routes(id), "vehicleId" uuid NOT NULL REFERENCES vehicles(id), "driverId" uuid NOT NULL REFERENCES drivers(id), latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90), longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180), accuracy double precision NOT NULL CHECK(accuracy>=0), "recordedAt" timestamptz NOT NULL, source varchar NOT NULL CHECK(source IN ('device','demo'))`,
      fuel_records: `"routeId" uuid NOT NULL REFERENCES routes(id), "vehicleId" uuid NOT NULL REFERENCES vehicles(id), "driverId" uuid NOT NULL REFERENCES drivers(id), "occurredAt" timestamptz NOT NULL, odometer integer NOT NULL CHECK(odometer>=0), liters double precision NOT NULL CHECK(liters>0), "totalCents" integer NOT NULL CHECK("totalCents">0), station varchar NOT NULL DEFAULT ''`,
      maintenance_plans: `"vehicleId" uuid NOT NULL REFERENCES vehicles(id), description varchar NOT NULL, "dueDate" date, "dueKm" integer, "intervalDays" integer, "intervalKm" integer, CHECK("dueDate" IS NOT NULL OR "dueKm" IS NOT NULL)`,
      maintenance_orders: `"vehicleId" uuid NOT NULL REFERENCES vehicles(id), "planId" uuid REFERENCES maintenance_plans(id), type varchar NOT NULL, description varchar NOT NULL, status varchar NOT NULL DEFAULT 'OPEN', blocking boolean NOT NULL DEFAULT true, "mechanicId" uuid REFERENCES users(id), "completedAt" timestamptz`,
      maintenance_services: `"orderId" uuid NOT NULL REFERENCES maintenance_orders(id), "mechanicId" uuid NOT NULL REFERENCES users(id), description varchar NOT NULL, parts varchar NOT NULL DEFAULT '', "partsCents" integer NOT NULL CHECK("partsCents">=0), "laborCents" integer NOT NULL CHECK("laborCents">=0), "completedAt" timestamptz NOT NULL`,
      documents: `"vehicleId" uuid REFERENCES vehicles(id), "driverId" uuid REFERENCES drivers(id), type varchar NOT NULL, "validUntil" date, "storageKey" varchar NOT NULL, "originalName" varchar NOT NULL, "mimeType" varchar NOT NULL, size integer NOT NULL CHECK(size>0 AND size<=10485760), CHECK(("vehicleId" IS NULL) <> ("driverId" IS NULL))`,
      integration_jobs: `"eventId" varchar UNIQUE NOT NULL, payload jsonb NOT NULL, status varchar NOT NULL DEFAULT 'PENDING', attempts integer NOT NULL DEFAULT 0, "nextAttemptAt" timestamptz, result varchar`,
      audit_events: `"actorId" uuid REFERENCES users(id), entity varchar NOT NULL, "entityId" uuid, action varchar NOT NULL, detail jsonb NOT NULL DEFAULT '{}'::jsonb`,
    };
    for (const [name, columns] of Object.entries(tables))
      await q.query(`CREATE TABLE "${name}" (${base}, ${columns})`);
    await q.query(
      'CREATE UNIQUE INDEX one_active_delivery ON route_stops ("deliveryId") WHERE active',
    );
    await q.query('CREATE UNIQUE INDEX route_stop_order ON route_stops ("routeId", "order")');
    await q.query(
      'CREATE UNIQUE INDEX one_running_vehicle ON routes ("vehicleId") WHERE status=\'IN_PROGRESS\'',
    );
    await q.query(
      'CREATE UNIQUE INDEX one_running_driver ON routes ("driverId") WHERE status=\'IN_PROGRESS\'',
    );
    await q.query('CREATE INDEX latest_position ON positions ("routeId", "createdAt" DESC)');
  }
  async down() {
    throw new Error(
      'Rollback inicial destrutivo desabilitado. Restaure uma cópia explícita do banco.',
    );
  }
}
export class MaintenancePlanActive1762041600000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query('ALTER TABLE maintenance_plans ADD COLUMN active boolean NOT NULL DEFAULT true');
  }
  async down(q: QueryRunner) {
    await q.query('ALTER TABLE maintenance_plans DROP COLUMN active');
  }
}
