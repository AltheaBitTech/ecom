import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import type { AuthContext } from '../../common/auth/request-context';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto';
import { InboxService } from './inbox.service';

/**
 * The signed-in user's own notification inbox. @RequirePermissions() with no arguments means
 * "authenticated, no specific permission" — routes are deny-by-default, and every route here is
 * already scoped to the caller's own userId, so there is nothing a finer permission could gate.
 * A user can only ever see and clear their own rows.
 */
@ApiTags('notifications')
@ApiBearerAuth('access-token')
@RequirePermissions()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  @ApiOperation({ summary: 'List the caller\'s notifications, newest first, with the unread count' })
  list(@CurrentUser() user: AuthContext, @Query('limit') limit?: string) {
    return this.inbox.list(user.tenantId, user.userId, Number(limit) || 20);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification read' })
  read(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.inbox.markRead(user.tenantId, user.userId, id);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'The caller\'s notification preferences' })
  preferences(@CurrentUser() user: AuthContext) {
    return this.inbox.getPreferences(user.tenantId, user.userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Turn the emailed copy of admin alerts on or off for the caller' })
  savePreferences(@CurrentUser() user: AuthContext, @Body() dto: NotificationPreferencesDto) {
    return this.inbox.setPreferences(user.tenantId, user.userId, dto.emailNotifications);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark every unread notification read' })
  readAll(@CurrentUser() user: AuthContext) {
    return this.inbox.markAllRead(user.tenantId, user.userId);
  }
}
