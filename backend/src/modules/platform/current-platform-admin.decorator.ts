import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PlatformAuthContext } from './platform-request-context';

export const CurrentPlatformAdmin = createParamDecorator((_data: unknown, ctx: ExecutionContext): PlatformAuthContext => {
  const req = ctx.switchToHttp().getRequest();
  return req.platformAuth as PlatformAuthContext;
});
