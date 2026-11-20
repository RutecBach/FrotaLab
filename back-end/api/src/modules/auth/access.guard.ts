import {
  Injectable,
  Inject,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../persistence/entities';
import { AuthService } from './auth.service';
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private auth: AuthService,
    @Inject(Reflector) private reflector: Reflector,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== process.env.APP_ORIGIN &&
      req.headers.origin !== 'http://127.0.0.1:3000'
    )
      throw new ForbiddenException('Origem de requisição não permitida.');
    if (this.reflector.getAllAndOverride('public', [ctx.getHandler(), ctx.getClass()])) return true;
    if (!req.cookies?.frotalab) throw new UnauthorizedException('Entre para acessar esta área.');
    const session = await this.auth.authenticate(req.cookies.frotalab);
    req.user = session.user;
    req.csrfToken = session.csrfToken;
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers['x-csrf-token'] !== session.csrfToken
    )
      throw new ForbiddenException('Token de segurança inválido. Atualize a página.');
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && !roles.includes(session.user.role))
      throw new ForbiddenException('Seu perfil não permite esta ação.');
    return true;
  }
}
