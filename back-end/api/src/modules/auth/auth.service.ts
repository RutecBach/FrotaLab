import { Injectable, Inject, UnauthorizedException, HttpException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../../persistence/entities';
import { parse, audit } from '../../common';
export function hashPassword(value: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(value, salt, 64).toString('hex')}`;
}
function validPassword(value: string, stored: string) {
  const [salt, digest] = stored.split(':');
  const hashed = scryptSync(value, salt, 64);
  const target = Buffer.from(digest, 'hex');
  return target.length === hashed.length && timingSafeEqual(target, hashed);
}
function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32 || value.startsWith('replace-'))
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres aleatórios.');
  return value;
}
@Injectable()
export class AuthService {
  private failures = new Map<string, { count: number; until: number }>();
  constructor(@Inject(DataSource) readonly ds: DataSource) {
    secret();
  }
  async authenticate(token: string) {
    try {
      const claims = jwt.verify(token, secret(), { algorithms: ['HS256'] }) as jwt.JwtPayload;
      const user = await this.ds.getRepository(User).findOneBy({ id: claims.sub!, active: true });
      if (!user || user.sessionVersion !== claims.v) throw new Error();
      return { user, csrfToken: claims.csrf as string };
    } catch {
      throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }
  }
  async login(body: unknown, ip: string) {
    const input = parse(
      z
        .object({
          email: z.email().transform((v) => v.toLowerCase()),
          password: z.string().min(1).max(200),
        })
        .strict(),
      body,
    );
    const key = `${ip}:${input.email}`;
    const attempt = this.failures.get(key);
    if (attempt && attempt.until > Date.now() && attempt.count >= 5)
      throw new HttpException('Muitas tentativas. Tente novamente em 15 minutos.', 429);
    const user = await this.ds
      .getRepository(User)
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email=:email', { email: input.email })
      .getOne();
    if (!user?.active || !validPassword(input.password, user.passwordHash)) {
      if (this.failures.size > 10000) this.failures.clear();
      this.failures.set(key, {
        count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1,
        until: Date.now() + 900000,
      });
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    this.failures.delete(key);
    const csrfToken = randomBytes(24).toString('hex');
    const token = jwt.sign({ sub: user.id, v: user.sessionVersion, csrf: csrfToken }, secret(), {
      expiresIn: '8h',
      algorithm: 'HS256',
    });
    const { passwordHash, ...safe } = user;
    await audit(this.ds, user, 'user', user.id, 'LOGIN');
    return { token, user: safe, csrfToken };
  }
}
