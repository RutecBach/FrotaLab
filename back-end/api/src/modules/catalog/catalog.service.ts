import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { z } from 'zod';
import {
  User,
  Vehicle,
  Driver,
  Center,
  Route,
  AuditEvent,
  roles,
} from '../../persistence/entities';
import {
  parse,
  text,
  date,
  nonnegative,
  coordinates,
  permit,
  manage,
  paging,
  identity,
  audit,
} from '../../common';
import { hashPassword } from '../auth/auth.service';
const schemas: Record<string, z.ZodObject<any>> = {
  users: z.object({
    name: text,
    email: z.email().transform((v) => v.toLowerCase()),
    password: z.string().min(10).max(128),
    role: z.enum(roles),
    active: z.boolean().optional(),
  }),
  vehicles: z.object({
    plate: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{6,10}$/),
    model: text,
    category: z.enum(['A', 'B', 'C', 'D', 'E']),
    capacityKg: nonnegative.min(1),
    odometer: nonnegative,
    registrationUntil: date,
    insuranceUntil: date,
    active: z.boolean().optional(),
  }),
  drivers: z.object({
    name: text,
    email: z.email().transform((v) => v.toLowerCase()),
    password: z.string().min(10).max(128),
    licenseNumber: z.string().trim().min(5).max(30),
    categories: z.array(z.enum(['A', 'B', 'C', 'D', 'E'])).min(1),
    licenseUntil: date,
    active: z.boolean().optional(),
  }),
  centers: z.object({ name: text, address: text, ...coordinates, active: z.boolean().optional() }),
};
const entityMap: any = { users: User, vehicles: Vehicle, drivers: Driver, centers: Center };
@Injectable()
export class CatalogService {
  constructor(@Inject(DataSource) readonly ds: DataSource) {}
  entity(resource: string) {
    if (!entityMap[resource]) throw new NotFoundException('Cadastro não encontrado.');
    return entityMap[resource];
  }
  async list(resource: string, q: any, user: User) {
    if (resource === 'audit') {
      permit(user, ['ADMIN']);
      const { page, limit } = paging(q);
      const [items, total] = await this.ds
        .getRepository(AuditEvent)
        .findAndCount({ order: { createdAt: 'DESC' }, take: limit, skip: (page - 1) * limit });
      return { items, total, page, limit };
    }
    const entity = this.entity(resource);
    if (resource === 'users') permit(user, ['ADMIN']);
    const { page, limit } = paging(q);
    const repo = this.ds.getRepository(entity);
    const qb = repo.createQueryBuilder('r');
    if (q.active === 'true') qb.andWhere('r.active=true');
    if (resource === 'drivers' && user.role === 'DRIVER')
      qb.andWhere('r.userId=:userId', { userId: user.id });
    if (q.q && resource === 'drivers')
      qb.innerJoin(User, 'u', 'u.id=r.userId').andWhere(
        '(u.name ILIKE :q OR u.email ILIKE :q OR r.licenseNumber ILIKE :q)',
        { q: `%${String(q.q).slice(0, 100)}%` },
      );
    if (q.q && ['vehicles', 'centers', 'users'].includes(resource)) {
      const fields =
        resource === 'vehicles'
          ? ['plate', 'model']
          : resource === 'users'
            ? ['name', 'email']
            : ['name', 'address'];
      qb.andWhere(`(${fields.map((c) => `r.${c} ILIKE :q`).join(' OR ')})`, {
        q: `%${String(q.q).slice(0, 100)}%`,
      });
    }
    const [records, total] = await qb
      .orderBy('r.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    const items =
      resource === 'drivers'
        ? await Promise.all(
            records.map(async (d: any) => ({ ...d, ...(await this.driverUser(d.userId)) })),
          )
        : records;
    return { items, total, page, limit };
  }
  async driverUser(id: string) {
    const u = await this.ds.getRepository(User).findOneByOrFail({ id });
    return { name: u.name, email: u.email };
  }
  async save(resource: string, id: string | null, body: unknown, user: User) {
    const entity = this.entity(resource);
    permit(user, resource === 'users' ? ['ADMIN'] : manage);
    const schema = id ? schemas[resource].partial().strict() : schemas[resource].strict();
    const data: any = parse(schema, body);
    if (id) identity(id);
    return this.ds.transaction(async (em) => {
      const repo = em.getRepository(entity);
      let row: any = id
        ? await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } })
        : repo.create();
      if (!row) throw new NotFoundException('Registro não encontrado.');
      if (resource === 'vehicles' && id && data.odometer != null && data.odometer < row.odometer)
        throw new BadRequestException('O hodômetro não pode diminuir.');
      if (
        id &&
        (data.active === false || (resource === 'users' && data.role && data.role !== row.role)) &&
        ['vehicles', 'drivers', 'users'].includes(resource)
      ) {
        const linkedDriver =
          resource === 'users' ? await em.getRepository(Driver).findOneBy({ userId: id }) : null;
        const filter =
          resource === 'vehicles'
            ? { vehicleId: id }
            : resource === 'drivers'
              ? { driverId: id }
              : linkedDriver
                ? { driverId: linkedDriver.id }
                : null;
        if (
          filter &&
          (await em
            .getRepository(Route)
            .countBy({ ...filter, status: In(['ASSIGNED', 'IN_PROGRESS']) }))
        )
          throw new ConflictException(
            'Remaneje ou encerre as rotas atribuídas antes de desativar ou alterar o perfil.',
          );
        if (resource === 'users' && id === user.id)
          throw new ConflictException('Você não pode desativar sua própria conta.');
      }
      if (resource === 'drivers') {
        const { name, email, password, ...driver } = data;
        let account = id
          ? await em.getRepository(User).findOneOrFail({
              where: { id: row.userId },
              lock: { mode: 'pessimistic_write' },
            })
          : em.getRepository(User).create({
              role: 'DRIVER',
              name,
              email,
              passwordHash: hashPassword(password),
              active: true,
              sessionVersion: 0,
            });
        if (account.role !== 'DRIVER')
          throw new ForbiddenException(
            'A conta vinculada possui outro perfil e deve ser gerenciada na área de usuários.',
          );
        if (name != null) account.name = name;
        if (email != null) account.email = email;
        if (password) account.passwordHash = hashPassword(password);
        if (data.active != null) {
          account.active = data.active;
        }
        if (password || data.active != null) account.sessionVersion++;
        await em.getRepository(User).save(account);
        Object.assign(row, driver, { userId: account.id });
      } else if (resource === 'users') {
        const { password, ...safe } = data;
        if (password) row.passwordHash = hashPassword(password);
        const revoked =
          (data.role != null && data.role !== row.role) ||
          (data.active != null && data.active !== row.active);
        if (id && (password || revoked)) row.sessionVersion++;
        if (id && data.active != null)
          await em.getRepository(Driver).update({ userId: id }, { active: data.active });
        Object.assign(row, safe);
      } else Object.assign(row, data);
      await repo.save(row);
      await audit(em, user, resource, row.id, id ? 'UPDATE' : 'CREATE', {
        fields: Object.keys(data).filter((k) => k !== 'password'),
      });
      const { passwordHash, ...safe } = row;
      if (resource === 'drivers')
        return { ...safe, ...(await this.driverUserWith(em, row.userId)) };
      return safe;
    });
  }
  async driverUserWith(em: EntityManager, id: string) {
    const u = await em.getRepository(User).findOneByOrFail({ id });
    return { name: u.name, email: u.email };
  }
}
