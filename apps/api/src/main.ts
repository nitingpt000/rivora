import 'reflect-metadata';

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';
import { buildOpenApiDocument } from './swagger';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api', { exclude: ['docs', 'docs-json'] });

  /**
   * URI versioning from the start.
   *
   * Adding a version to a shipped API is a breaking change for every client;
   * starting with one costs nothing and means `/api/v2` can exist later
   * without a migration deadline.
   */
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  /**
   * `contentSecurityPolicy` is relaxed only enough for Swagger UI, which
   * renders inline. Turned off entirely when the docs are disabled, which is
   * the expected production posture.
   */
  app.use(
    helmet({
      contentSecurityPolicy: config.swaggerEnabled
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
            },
          }
        : undefined,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      /**
       * Strips unknown keys and rejects the request if any were sent. A client
       * posting a field the API does not read is either out of date or
       * confused, and silently ignoring it hides both.
       */
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      // Validation messages describe the field, never echo the value — an
      // error page is not the place to reflect an attacker's payload back.
      disableErrorMessages: false,
    }),
  );

  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    allowedHeaders: ['content-type', 'accept', 'authorization', 'x-api-key', 'idempotency-key', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
    maxAge: 600,
  });

  // Lets the container stop cleanly: Nest runs `onModuleDestroy`, which closes
  // the Prisma connection pool, instead of the process dying mid-query.
  app.enableShutdownHooks();

  if (config.swaggerEnabled) {
    SwaggerModule.setup('docs', app, buildOpenApiDocument(app), {
      swaggerOptions: { persistAuthorization: true, docExpansion: 'none', tagsSorter: 'alpha' },
      customSiteTitle: 'Rivora Protocol API',
    });
  }

  await app.listen(config.port, '0.0.0.0');

  logger.log(`API listening on http://localhost:${config.port}/api/v1`);
  logger.log(`Environment: ${config.nodeEnv}`);
  if (config.swaggerEnabled) {
    logger.log(`Swagger UI at http://localhost:${config.port}/docs`);
    if (config.isProduction) {
      logger.warn('Swagger is enabled in production. Set SWAGGER_ENABLED=false to disable it.');
    }
  }
}

void bootstrap();
