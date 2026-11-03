import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuditInterceptor } from './common/audit/audit.interceptor';
import { AuthModule } from './common/auth/auth.module';
import { AuthenticationGuard } from './common/auth/authentication.guard';
import { AuthorizationGuard } from './common/auth/authorization.guard';
import { AppConfig } from './common/config/app-config';
import { AppConfigModule } from './common/config/config.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { EmailModule } from './common/email/email.module';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/http/response.interceptor';
import { JwtModule } from './common/jwt/jwt.module';
import { AccessLogInterceptor } from './common/observability/access-log.interceptor';
import { ObservabilityModule } from './common/observability/observability.module';
import { RequestContextMiddleware } from './common/observability/request-context.middleware';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AdminModule } from './modules/admin/admin.module';
import { BillingModule } from './modules/billing/billing.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CustomersModule } from './modules/customers/customers.module';
import { HealthModule } from './modules/health/health.module';
import { MediaModule } from './modules/media/media.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { TokensModule } from './modules/tokens/tokens.module';

/**
 * Composition root.
 *
 * Request path (outermost first):
 *   RequestContextMiddleware — open the request_id scope
 *   guards  : Throttler -> Authentication (resolves principal) -> Authorization
 *   interceptors: AccessLog (log who-hit-what) -> ResponseEnvelope (uniform
 *                 { data, meta }) -> Audit (persist mutating actions)
 *   AllExceptionsFilter — uniform error envelope for everything
 *
 * Interceptor registration order is outermost-first: AccessLog wraps the whole
 * timing; Audit is innermost so it sees the handler's raw payload (the created
 * row's id) before the envelope wraps it.
 */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    CryptoModule,
    RedisModule,
    EmailModule,
    JwtModule,
    ObservabilityModule,
    AuthModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ ttl: 60_000, limit: config.rateLimitGeneralPerMinute }],
      }),
    }),
    HealthModule,
    MediaModule,
    BillingModule,
    CatalogModule,
    ShippingModule,
    OrdersModule,
    PromotionsModule,
    PaymentsModule,
    CustomersModule,
    TenantsModule,
    AdminModule,
    TokensModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
    { provide: APP_INTERCEPTOR, useClass: AccessLogInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
