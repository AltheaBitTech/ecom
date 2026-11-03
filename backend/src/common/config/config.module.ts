import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { AppConfig } from './app-config';
import { validateEnv } from './env.validation';

/**
 * Global config: validates the environment once at boot and exposes the typed
 * `AppConfig` everywhere. Importing this is what makes `process.env` off-limits
 * to feature code.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
  ],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}
