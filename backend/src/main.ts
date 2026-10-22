import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:5173');

  // Security Headers Middleware
  app.use(helmet());

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

  await app.listen(port);
  logger.log(`Backend application is listening on port ${port} with prefix /api/v1`);
}

void bootstrap();
