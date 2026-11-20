import { Body, Controller, Get, Post, Patch, Param, Query, Req, Inject } from '@nestjs/common';
import { RoutesService } from './routes.service';
@Controller()
export class RoutesController {
  constructor(@Inject(RoutesService) private service: RoutesService) {}
  @Get('routes') routes(@Query() q: any, @Req() r: any) {
    return this.service.list(q, r.user);
  }
  @Post('routes') createRoute(@Body() b: unknown, @Req() r: any) {
    return this.service.save(null, b, r.user);
  }
  @Patch('routes/:id') updateRoute(@Param('id') id: string, @Body() b: unknown, @Req() r: any) {
    return this.service.save(id, b, r.user);
  }
  @Post('routes/:id/:action') routeAction(
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() b: unknown,
    @Req() r: any,
  ) {
    return this.service.action(id, action, b, r.user);
  }
}
