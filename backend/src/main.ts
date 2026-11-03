import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AppConfig } from './common/config/app-config';
import { createLogger, enabledLevels } from './common/observability/json-logger.service';

async function bootstrap(): Promise<void> {
  // rawBody: preserve the exact bytes of incoming requests so payment webhooks
  // can verify their HMAC signature over the untouched payload.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  const config = app.get(AppConfig);

  // Swap Nest's default logger for the level-aware, request-correlated logger.
  app.useLogger(createLogger(config.logFormat, enabledLevels(config.logLevel)));
  app.flushLogs();

  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigins.length ? config.corsOrigins : true,
    credentials: true,
  });

  // Version everything except infra probes and the well-known JWKS document
  // (external verifiers expect it at the unversioned /.well-known/jwks.json).
  app.setGlobalPrefix(config.apiPrefix, {
    exclude: ['healthz', 'readyz', '.well-known/jwks.json'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  if (!config.isProduction) {
    const doc = new DocumentBuilder()
      .setTitle('ecom backend')
      .setDescription('Category-agnostic multi-tenant commerce API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-Internal-Key', in: 'header' }, 'internal')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  }

  await app.listen(config.port);
  // eslint-disable-next-line no-console
  console.warn(`ecom backend listening on :${config.port} (${config.appEnv})`);
}

void bootstrap();
