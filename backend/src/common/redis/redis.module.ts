import { Global, Module } from '@nestjs/common';

import { RedisService } from './redis.service';

/** Global Redis access for ephemeral cross-instance state. */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
