import { Controller, Get, Param, Query, Req, Res, Inject } from '@nestjs/common';
import { csvCell } from '../../rules';
import { InsightsService } from './insights.service';
@Controller()
export class InsightsController {
  constructor(@Inject(InsightsService) private service: InsightsService) {}
  @Get('alerts') alerts(@Req() r: any) {
    return this.service.alerts(r.user);
  }
  @Get('dashboard') dashboard(@Req() r: any) {
    return this.service.dashboard(r.user);
  }
  @Get('reports/:kind') async report(
    @Param('kind') kind: string,
    @Query() q: any,
    @Req() r: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const csv = kind.endsWith('.csv');
    const result = await this.service.report(kind.replace(/\.csv$/, ''), q, r.user);
    if (!csv) return result;
    const columns = result.items.length
      ? Object.keys(result.items[0])
      : Object.keys(result.summary);
    const rows = result.items.length ? result.items : [result.summary];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${kind}"`);
    return (
      '\ufeff' +
      [
        columns.map(csvCell).join(';'),
        ...rows.map((row: any) => columns.map((k) => csvCell(row[k])).join(';')),
      ].join('\r\n')
    );
  }
}
