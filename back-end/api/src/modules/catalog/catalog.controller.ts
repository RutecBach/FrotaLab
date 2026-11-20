import { Body, Controller, Get, Post, Patch, Param, Query, Req, Inject } from '@nestjs/common';
import { CatalogService } from './catalog.service';
@Controller()
export class CatalogController {
  constructor(@Inject(CatalogService) private catalog: CatalogService) {}
  @Get(':resource') list(@Param('resource') resource: string, @Query() q: any, @Req() req: any) {
    return this.catalog.list(resource, q, req.user);
  }
  @Post(':resource') create(
    @Param('resource') resource: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    return this.catalog.save(resource, null, body, req.user);
  }
  @Patch(':resource/:id') update(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    return this.catalog.save(resource, id, body, req.user);
  }
}
