import { Body, Controller, Get, Post, Req, Res, Inject } from '@nestjs/common';
import { User } from '../../persistence/entities';
import { Public } from '../../common';
import { AuthService } from './auth.service';
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private auth: AuthService) {}
  @Public() @Post('login') async login(
    @Body() body: unknown,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const { token, ...data } = await this.auth.login(body, req.ip);
    res.cookie('frotalab', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.APP_ORIGIN?.startsWith('https:'),
      maxAge: 8 * 3600000,
      path: '/',
    });
    return data;
  }
  @Get('me') me(@Req() req: any) {
    return { user: req.user, csrfToken: req.csrfToken };
  }
  @Post('logout') async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    await this.auth.ds.getRepository(User).increment({ id: req.user.id }, 'sessionVersion', 1);
    res.clearCookie('frotalab', { path: '/' });
    return { message: 'Sessão encerrada.' };
  }
}
