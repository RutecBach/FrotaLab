import { Body, Controller, Get, Post, Patch, Param, Query, Req, Inject } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
@Controller()
export class MaintenanceController {
  constructor(@Inject(MaintenanceService) private service: MaintenanceService) {}
  @Get('maintenance-plans') plans(@Query() q: any, @Req() r: any) {
    return this.service.list('plans', q, r.user);
  }
  @Post('maintenance-plans') createPlan(@Body() b: unknown, @Req() r: any) {
    return this.service.savePlan(null, b, r.user);
  }
  @Patch('maintenance-plans/:id') updatePlan(
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() r: any,
  ) {
    return this.service.savePlan(id, b, r.user);
  }
  @Get('maintenance-orders') orders(@Query() q: any, @Req() r: any) {
    return this.service.list('orders', q, r.user);
  }
  @Post('maintenance-orders') createOrder(@Body() b: unknown, @Req() r: any) {
    return this.service.createOrder(b, r.user);
  }
  @Post('maintenance-orders/:id/:action') action(
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() b: unknown,
    @Req() r: any,
  ) {
    return this.service.action(id, action, b, r.user);
  }
}
