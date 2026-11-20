import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  SetMetadata,
  ForbiddenException,
} from '@nestjs/common';
import { QueryFailedError, DataSource, EntityManager, ILike } from 'typeorm';
import { z } from 'zod';
import { AuditEvent, Role, User } from './persistence/entities';
z.config(z.locales.pt());
export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
export const manage: Role[] = ['ADMIN', 'MANAGER'];
export const dispatch: Role[] = ['ADMIN', 'OPERATOR'];
export function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues.map((i) => `${i.path.join('.') || 'dados'}: ${i.message}`).join('; '),
    );
  return result.data;
}
export const uuid = z.uuid();
export const text = z.string().trim().min(1).max(300);
export const date = z.iso.date();
export const instant = z.iso.datetime({ offset: true });
export const nonnegative = z.number().int().min(0).max(2_000_000_000);
export const coordinates = {
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
};
export const identity = (id: string) => parse(uuid, id);
export function permit(user: User, allowed: Role[]) {
  if (!allowed.includes(user.role))
    throw new ForbiddenException('Seu perfil não permite esta ação.');
}
export async function audit(
  db: DataSource | EntityManager,
  user: User | null,
  entity: string,
  entityId: string | null,
  action: string,
  detail: Record<string, unknown> = {},
) {
  await db
    .getRepository(AuditEvent)
    .save({ actorId: user?.id || null, entity, entityId, action, detail });
}
export function paging(q: any) {
  const page = Math.max(1, Number(q.page || 1));
  const limit = Math.min(200, Math.max(1, Number(q.limit || 50)));
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit))
    throw new BadRequestException('Paginação inválida.');
  return { page, limit };
}
export const searchTerm = (q: any) => (q.q ? ILike(`%${String(q.q).slice(0, 100)}%`) : undefined);
@Catch()
export class ApiErrors implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    let statusCode = error instanceof HttpException ? error.getStatus() : 500;
    let message =
      error instanceof HttpException ? error.message : 'Não foi possível concluir a operação.';
    if (error instanceof QueryFailedError) {
      const code = (error as any).driverError?.code;
      if (code === '23505') {
        statusCode = 409;
        message = 'Já existe um registro com estes dados ou recurso já reservado.';
      }
      if (code === '23503') {
        statusCode = 409;
        message = 'Registro relacionado inexistente ou ainda em uso.';
      }
      if (['23514', '22P02', '22007', '22008'].includes(code)) {
        statusCode = 400;
        message = 'Dados inválidos para esta operação.';
      }
    }
    if (statusCode === 413) message = 'Envie um arquivo de até 10 MB.';
    if (statusCode === 500) console.error('Falha interna:', error.name, error.message);
    response.status(statusCode).json({ statusCode, message });
  }
}
