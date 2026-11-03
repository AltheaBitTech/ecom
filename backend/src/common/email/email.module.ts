import { Global, Module } from '@nestjs/common';

import { EmailService } from './email.service';

/** Global transactional email delivery (verification, reset, invites). */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
