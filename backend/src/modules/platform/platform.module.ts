import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformAnalyticsController, PlatformAuthController, PlatformTenantsController } from './platform.controller';
import { PlatformAuthGuard } from './platform-auth.guard';
import { PlatformTokenService } from './platform-token.service';
import { PlatformService } from './platform.service';

@Module({
  imports: [JwtModule.register({}), NotificationsModule],
  controllers: [PlatformAuthController, PlatformTenantsController, PlatformAnalyticsController],
  providers: [PlatformService, PlatformTokenService, PlatformAuthGuard],
  exports: [PlatformTokenService, PlatformAuthGuard],
})
export class PlatformModule {}
