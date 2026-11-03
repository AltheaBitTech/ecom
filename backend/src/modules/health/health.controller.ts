import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/auth/decorators';
import { NoEnvelope } from '../../common/http/response.interceptor';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

/** Liveness/readiness probes. Version-less (excluded from the global prefix). */
@ApiTags('health')
@Controller()
@NoEnvelope()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('healthz')
  @Public()
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('readyz')
  @Public()
  async readiness(): Promise<{ status: 'ready' | 'degraded'; database: boolean; redis: boolean }> {
    const [database, redis] = await Promise.all([
      this.prisma
        .$queryRaw`SELECT 1`.then(() => true)
        .catch(() => false),
      this.redis.ping().catch(() => false),
    ]);
    return { status: database && redis ? 'ready' : 'degraded', database, redis };
  }
}
