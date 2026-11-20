import 'reflect-metadata';
import { Module, Controller, Get } from '@nestjs/common';
import { NestFactory, APP_GUARD } from '@nestjs/core';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AccessGuard } from './modules/auth/access.guard';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { CatalogController } from './modules/catalog/catalog.controller';
import { CatalogService } from './modules/catalog/catalog.service';
import { DeliveriesController } from './modules/deliveries/deliveries.controller';
import { DeliveriesService } from './modules/deliveries/deliveries.service';
import { DocumentsController } from './modules/documents/documents.controller';
import { DocumentsService } from './modules/documents/documents.service';
import { FuelController } from './modules/fuel/fuel.controller';
import { FuelService } from './modules/fuel/fuel.service';
import { InsightsController } from './modules/insights/insights.controller';
import { InsightsService } from './modules/insights/insights.service';
import { IntegrationController } from './modules/integration/integration.controller';
import { IntegrationService } from './modules/integration/integration.service';
import { MaintenanceController } from './modules/maintenance/maintenance.controller';
import { MaintenanceService } from './modules/maintenance/maintenance.service';
import { RoutesController } from './modules/routes/routes.controller';
import { RoutesService } from './modules/routes/routes.service';
import { TrackingController } from './modules/tracking/tracking.controller';
import { TrackingService } from './modules/tracking/tracking.service';
import { ApiErrors, Public } from './common';
@Controller()
class HealthController {
  @Public() @Get('health') health() {
    return { status: 'ok', application: 'FrotaLab' };
  }
}
export async function createApplication(ds: DataSource, logging = true) {
  @Module({
    controllers: [
      HealthController,
      AuthController,
      RoutesController,
      DeliveriesController,
      FuelController,
      MaintenanceController,
      DocumentsController,
      TrackingController,
      InsightsController,
      IntegrationController,
      CatalogController,
    ],
    providers: [
      { provide: DataSource, useValue: ds },
      AuthService,
      CatalogService,
      RoutesService,
      DeliveriesService,
      FuelService,
      MaintenanceService,
      InsightsService,
      DocumentsService,
      TrackingService,
      IntegrationService,
      { provide: APP_GUARD, useClass: AccessGuard },
    ],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, {
    logger: logging ? ['log', 'warn', 'error'] : false,
  });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalFilters(new ApiErrors());
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  const config = new DocumentBuilder()
    .setTitle('FrotaLab API')
    .setDescription(
      'API acadêmica de frotas. Login em /api/auth/login retorna cookie HttpOnly e csrfToken. Alterações exigem X-CSRF-Token. Perfis e contratos detalhados em docs/projeto/contratos-api.md.',
    )
    .setVersion('1.0')
    .addCookieAuth('frotalab')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  app.enableShutdownHooks();
  return app;
}
