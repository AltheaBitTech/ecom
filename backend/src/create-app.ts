import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { EnvConfig } from './common/config/env.validation';

/**
 * Builds and configures the Nest app without calling `listen()`. Shared by `main.ts`
 * (a normal long-running server) and `api/index.ts` (the Vercel serverless entrypoint,
 * which passes its own Express instance so it can hand requests to it directly instead
 * of binding a port).
 */
export async function createApp(expressInstance?: Express): Promise<NestExpressApplication> {
  // rawBody: true — the Razorpay webhook needs the exact request bytes to verify its signature.
  const app = expressInstance
    ? await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(expressInstance), { rawBody: true })
    : await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService<EnvConfig, true>);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }).split(',').filter(Boolean),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ponytail: docs are dev/test only — no unauthenticated schema/route disclosure in prod.
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const doc = new DocumentBuilder()
      .setTitle('Stallwart API')
      .setDescription('Multi-tenant FMCG e-commerce backend — auth, RBAC, tenant management')
      .setVersion('0.1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  }

  return app;
}
