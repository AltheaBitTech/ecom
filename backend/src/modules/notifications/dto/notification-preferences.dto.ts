import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class NotificationPreferencesDto {
  @ApiProperty({ example: true, description: 'Send the email/WhatsApp copy of admin alerts. In-app notifications are always delivered.' })
  @IsBoolean()
  emailNotifications!: boolean;
}
