import { Body, Controller, Get, Post, Patch, Param, Query, Req, Inject } from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
@Controller()
export class DeliveriesController {
  constructor(@Inject(DeliveriesService) private service: DeliveriesService) {}
  @Get('deliveries') deliveries(@Query() q: any, @Req() r: any) {
    return this.service.list(q, r.user);
  }
  @Post('deliveries') createDelivery(@Body() b: unknown, @Req() r: any) {
    return this.service.save(null, b, r.user);
  }
  @Patch('deliveries/:id') updateDelivery(
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() r: any,
  ) {
    return this.service.save(id, b, r.user);
  }
  @Post('deliveries/:id/:action') deliveryAction(
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() b: unknown,
    @Req() r: any,
  ) {
    return this.service.action(id, action, b, r.user);
  }
}
