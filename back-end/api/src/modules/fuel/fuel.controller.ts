import { Body, Controller, Get, Post, Query, Req, Inject } from '@nestjs/common';
import { FuelService } from './fuel.service';
@Controller()
export class FuelController {
  constructor(@Inject(FuelService) private service: FuelService) {}
  @Get('fuel') fuel(@Query() q: any, @Req() r: any) {
    return this.service.list(q, r.user);
  }
  @Post('fuel') createFuel(@Body() b: unknown, @Req() r: any) {
    return this.service.create(b, r.user);
  }
}
