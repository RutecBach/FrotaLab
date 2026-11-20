import 'reflect-metadata';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type Role = 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'DRIVER' | 'MECHANIC';
export const roles: Role[] = ['ADMIN', 'MANAGER', 'OPERATOR', 'DRIVER', 'MECHANIC'];
export class Base {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
@Entity('users')
export class User extends Base {
  @Column('varchar') name!: string;
  @Column('varchar', { unique: true }) email!: string;
  @Column('varchar', { select: false }) passwordHash!: string;
  @Column('varchar') role!: Role;
  @Column('boolean', { default: true }) active!: boolean;
  @Column('int', { default: 0 }) sessionVersion!: number;
}
@Entity('vehicles')
export class Vehicle extends Base {
  @Column('varchar', { unique: true }) plate!: string;
  @Column('varchar') model!: string;
  @Column('varchar') category!: string;
  @Column('int') capacityKg!: number;
  @Column('int') odometer!: number;
  @Column('date') registrationUntil!: string;
  @Column('date') insuranceUntil!: string;
  @Column('boolean', { default: true }) active!: boolean;
}
@Entity('drivers')
export class Driver extends Base {
  @Column('uuid', { unique: true }) userId!: string;
  @Column('varchar', { unique: true }) licenseNumber!: string;
  @Column('simple-array') categories!: string[];
  @Column('date') licenseUntil!: string;
  @Column('boolean', { default: true }) active!: boolean;
}
@Entity('centers')
export class Center extends Base {
  @Column('varchar') name!: string;
  @Column('varchar') address!: string;
  @Column('double precision') latitude!: number;
  @Column('double precision') longitude!: number;
  @Column('boolean', { default: true }) active!: boolean;
}
@Entity('routes')
export class Route extends Base {
  @Column('varchar') name!: string;
  @Column('uuid') centerId!: string;
  @Column('uuid', { nullable: true }) driverId!: string | null;
  @Column('uuid', { nullable: true }) vehicleId!: string | null;
  @Column('timestamptz') scheduledStart!: Date;
  @Column('timestamptz') scheduledEnd!: Date;
  @Column('varchar', { default: 'DRAFT' }) status!: string;
  @Column('timestamptz', { nullable: true }) startedAt!: Date | null;
  @Column('timestamptz', { nullable: true }) completedAt!: Date | null;
  @Column('int', { nullable: true }) startKm!: number | null;
  @Column('int', { nullable: true }) endKm!: number | null;
}
@Entity('deliveries')
export class Delivery extends Base {
  @Column('varchar', { unique: true }) reference!: string;
  @Column('varchar') recipient!: string;
  @Column('varchar') address!: string;
  @Column('double precision') latitude!: number;
  @Column('double precision') longitude!: number;
  @Column('int') weightKg!: number;
  @Column('timestamptz') deadline!: Date;
  @Column('varchar', { default: 'PENDING' }) status!: string;
  @Column('timestamptz', { nullable: true }) completedAt!: Date | null;
  @Column('timestamptz', { nullable: true }) cancelledAt!: Date | null;
  @Column('varchar', { nullable: true }) cancellationReason!: string | null;
}
@Entity('route_stops')
export class RouteStop extends Base {
  @Column('uuid') routeId!: string;
  @Column('uuid') deliveryId!: string;
  @Column('int') order!: number;
  @Column('boolean', { default: true }) active!: boolean;
}
@Entity('positions')
@Index(['routeId', 'createdAt'])
export class Position extends Base {
  @Column('uuid') routeId!: string;
  @Column('uuid') vehicleId!: string;
  @Column('uuid') driverId!: string;
  @Column('double precision') latitude!: number;
  @Column('double precision') longitude!: number;
  @Column('double precision') accuracy!: number;
  @Column('timestamptz') recordedAt!: Date;
  @Column('varchar') source!: 'device' | 'demo';
}
@Entity('fuel_records')
export class FuelRecord extends Base {
  @Column('uuid') routeId!: string;
  @Column('uuid') vehicleId!: string;
  @Column('uuid') driverId!: string;
  @Column('timestamptz') occurredAt!: Date;
  @Column('int') odometer!: number;
  @Column('double precision') liters!: number;
  @Column('int') totalCents!: number;
  @Column('varchar', { default: '' }) station!: string;
}
@Entity('maintenance_plans')
export class MaintenancePlan extends Base {
  @Column('boolean', { default: true }) active!: boolean;
  @Column('uuid') vehicleId!: string;
  @Column('varchar') description!: string;
  @Column('date', { nullable: true }) dueDate!: string | null;
  @Column('int', { nullable: true }) dueKm!: number | null;
  @Column('int', { nullable: true }) intervalDays!: number | null;
  @Column('int', { nullable: true }) intervalKm!: number | null;
}
@Entity('maintenance_orders')
export class MaintenanceOrder extends Base {
  @Column('uuid') vehicleId!: string;
  @Column('uuid', { nullable: true }) planId!: string | null;
  @Column('varchar') type!: 'PREVENTIVE' | 'CORRECTIVE';
  @Column('varchar') description!: string;
  @Column('varchar', { default: 'OPEN' }) status!: string;
  @Column('boolean', { default: true }) blocking!: boolean;
  @Column('uuid', { nullable: true }) mechanicId!: string | null;
  @Column('timestamptz', { nullable: true }) completedAt!: Date | null;
}
@Entity('maintenance_services')
export class MaintenanceServiceRecord extends Base {
  @Column('uuid') orderId!: string;
  @Column('uuid') mechanicId!: string;
  @Column('varchar') description!: string;
  @Column('varchar', { default: '' }) parts!: string;
  @Column('int') partsCents!: number;
  @Column('int') laborCents!: number;
  @Column('timestamptz') completedAt!: Date;
}
@Entity('documents')
export class Document extends Base {
  @Column('uuid', { nullable: true }) vehicleId!: string | null;
  @Column('uuid', { nullable: true }) driverId!: string | null;
  @Column('varchar') type!: string;
  @Column('date', { nullable: true }) validUntil!: string | null;
  @Column('varchar') storageKey!: string;
  @Column('varchar') originalName!: string;
  @Column('varchar') mimeType!: string;
  @Column('int') size!: number;
}
@Entity('integration_jobs')
export class IntegrationJob extends Base {
  @Column('varchar', { unique: true }) eventId!: string;
  @Column('jsonb') payload!: Record<string, unknown>;
  @Column('varchar', { default: 'PENDING' }) status!: string;
  @Column('int', { default: 0 }) attempts!: number;
  @Column('timestamptz', { nullable: true }) nextAttemptAt!: Date | null;
  @Column('varchar', { nullable: true }) result!: string | null;
}
@Entity('audit_events')
export class AuditEvent extends Base {
  @Column('uuid', { nullable: true }) actorId!: string | null;
  @Column('varchar') entity!: string;
  @Column('uuid', { nullable: true }) entityId!: string | null;
  @Column('varchar') action!: string;
  @Column('jsonb', { default: {} }) detail!: Record<string, unknown>;
}
export const entities = [
  User,
  Vehicle,
  Driver,
  Center,
  Route,
  Delivery,
  RouteStop,
  Position,
  FuelRecord,
  MaintenancePlan,
  MaintenanceOrder,
  MaintenanceServiceRecord,
  Document,
  IntegrationJob,
  AuditEvent,
];
