import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:5173');

  // Security Headers Middleware with Content Security Policy tuned for Swagger UI
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
          scriptSrc: [`'self'`, `'unsafe-inline'`],
        },
      },
    }),
  );

  app.setGlobalPrefix('api/v1');

  // Centralized Sanitized Error Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Strict Request Payload Validation Pipeline
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.enableShutdownHooks();

  // Swagger OpenAPI Documentation Configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Inventory Receipts ERP API')
    .setDescription(
      'Enterprise ERP REST API for Goods Receipt Notes (GRN), Moving Weighted Average Costing, Inventory Ledger, and General Ledger (GL) Double-Entry Journal Posting.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT bearer token without the Bearer prefix',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'User authentication, company session, and credentials management')
    .addTag('Companies', 'Multi-tenant company profiles, warehouses, suppliers, and items catalog')
    .addTag('Receipts', 'Goods Receipt Notes (GRN) draft, update, line items, post, and void lifecycle')
    .addTag('Inventory', 'Stock balances, movement ledger, reconciliation, and item stock cards')
    .addTag('Accounting', 'Chart of accounts, inventory accounts config, journal entries, accounting periods, and trial balance')
    .addTag('Audit', 'Immutable enterprise security audit logs')
    .addTag('Health', 'Service and database connection health check')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Inventory Receipts ERP - Swagger API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      docExpansion: 'none',
    },
  });

  await app.listen(port);
  logger.log(`Backend application is listening on port ${port} with prefix /api/v1`);
  logger.log(`Swagger documentation is available at http://localhost:${port}/api/docs`);
}

void bootstrap();
