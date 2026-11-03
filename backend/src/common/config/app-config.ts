import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from './env.validation';

/**
 * Typed, injectable view over the validated environment. Feature code depends
 * on this — never on `process.env` directly — so every consumer gets a checked,
 * strongly-typed value.
 */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get appEnv(): Env['APP_ENV'] {
    return this.get('APP_ENV');
  }
  get isProduction(): boolean {
    return this.appEnv === 'production';
  }
  get port(): number {
    return this.get('PORT');
  }
  get apiPrefix(): string {
    return this.get('API_PREFIX');
  }
  get corsOrigins(): string[] {
    return this.get('CORS_ORIGINS');
  }

  get logLevel(): Env['LOG_LEVEL'] {
    return this.get('LOG_LEVEL');
  }
  get logFormat(): Env['LOG_FORMAT'] {
    return this.get('LOG_FORMAT');
  }

  get databaseUrl(): string {
    return this.get('DATABASE_URL');
  }
  get directUrl(): string {
    return this.get('DIRECT_URL');
  }
  get redisUrl(): string {
    return this.get('REDIS_URL');
  }
  get s3Endpoint(): string { return this.get('S3_ENDPOINT'); }
  get s3Region(): string { return this.get('S3_REGION'); }
  get s3Bucket(): string { return this.get('S3_BUCKET'); }
  get s3AccessKey(): string { return this.get('S3_ACCESS_KEY'); }
  get s3SecretKey(): string { return this.get('S3_SECRET_KEY'); }
  get s3ForcePathStyle(): boolean { return this.get('S3_FORCE_PATH_STYLE'); }

  get encryptionKey(): string {
    return this.get('APP_ENCRYPTION_KEY');
  }

  // --- Native identity: RS256 signing + token TTLs -------------------------
  get jwtPrivateKey(): string {
    return this.get('jwtPrivateKey');
  }
  get jwtPublicKey(): string {
    return this.get('jwtPublicKey');
  }
  get jwtKeyId(): string {
    return this.get('JWT_KEY_ID');
  }
  get jwtIssuer(): string {
    return this.get('JWT_ISSUER');
  }
  get jwtAudience(): string {
    return this.get('JWT_AUDIENCE');
  }
  get accessTokenTtl(): number {
    return this.get('ACCESS_TOKEN_TTL');
  }
  get refreshTokenTtl(): number {
    return this.get('REFRESH_TOKEN_TTL');
  }

  get passwordPepper(): string {
    return this.get('PASSWORD_PEPPER');
  }
  get passwordPepperVersion(): number {
    return this.get('PASSWORD_PEPPER_VERSION');
  }
  get apiKeyHashSecret(): string {
    return this.get('API_KEY_HASH_SECRET');
  }
  get internalApiKey(): string {
    return this.get('INTERNAL_API_KEY');
  }

  get cookieDomain(): string {
    return this.get('COOKIE_DOMAIN');
  }
  get cookieSecure(): boolean {
    return this.get('COOKIE_SECURE');
  }

  // --- Transactional email -------------------------------------------------
  get emailTransport(): Env['EMAIL_TRANSPORT'] {
    return this.get('EMAIL_TRANSPORT');
  }
  get emailFrom(): string {
    return this.get('EMAIL_FROM');
  }
  get appBaseUrl(): string {
    return this.get('APP_BASE_URL');
  }
  get smtpHost(): string | undefined {
    return this.get('SMTP_HOST');
  }
  get smtpPort(): number {
    return this.get('SMTP_PORT');
  }
  get smtpSecure(): boolean {
    return this.get('SMTP_SECURE');
  }
  get smtpUser(): string | undefined {
    return this.get('SMTP_USER');
  }
  get smtpPassword(): string | undefined {
    return this.get('SMTP_PASSWORD');
  }

  get rateLimitAuthPerMinute(): number {
    return this.get('RATE_LIMIT_AUTH_PER_MINUTE');
  }
  get rateLimitGeneralPerMinute(): number {
    return this.get('RATE_LIMIT_GENERAL_PER_MINUTE');
  }
  get rateLimitCheckoutPerMinute(): number {
    return this.get('RATE_LIMIT_CHECKOUT_PER_MINUTE');
  }
  get rateLimitTenantPerMinute(): number {
    return this.get('RATE_LIMIT_TENANT_PER_MINUTE');
  }
}
