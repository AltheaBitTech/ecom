import { Module } from '@nestjs/common';

import { PlatformService } from './platform.service';

/**
 * Platform-operator console surface: global user directory, cross-tenant audit
 * log, and headline stats. Controllers are wired in by the integrator; this
 * module just provides and exports the service.
 */
@Module({
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
