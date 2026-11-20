import { Controller, Get, Post, Param, Req, Inject } from '@nestjs/common';
import { IntegrationService } from './integration.service';
@Controller('integrations')
export class IntegrationController {
  constructor(@Inject(IntegrationService) private service: IntegrationService) {}
  @Get() list(@Req() r: any) {
    return this.service.list(r.user);
  }
  @Post(':id/retry') retry(@Param('id') id: string, @Req() r: any) {
    return this.service.send(id, r.user);
  }
}
