import { Body, Controller, Get, Post, Req, Sse, Inject } from '@nestjs/common';
import { TrackingService } from './tracking.service';
@Controller('positions')
export class TrackingController {
  constructor(@Inject(TrackingService) private service: TrackingService) {}
  @Get() latest(@Req() r: any) {
    return this.service.latest(r.user);
  }
  @Post() post(@Body() b: unknown, @Req() r: any) {
    return this.service.post(b, r.user);
  }
  @Sse('stream') stream(@Req() r: any) {
    return this.service.stream(r);
  }
}
