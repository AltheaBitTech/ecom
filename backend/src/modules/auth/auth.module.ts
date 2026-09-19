import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from '../../common/auth/token.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { RolesModule } from '../roles/roles.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';

@Module({
  imports: [JwtModule.register({}), TenantsModule, RolesModule, ReferralsModule, NotificationsModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, OAuthService],
  exports: [TokenService],
})
export class AuthModule {}
