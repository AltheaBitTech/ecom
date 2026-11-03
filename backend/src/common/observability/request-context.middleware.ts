import { randomUUID } from 'node:crypto';

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { runWithRequestContext } from './request-context';

/**
 * The first thing every request hits. It opens an AsyncLocalStorage scope
 * carrying a `request_id` — reused from an inbound `X-Request-Id` (so a trace
 * survives across services) or freshly minted — and echoes it back on the
 * response so a client/log line can be correlated. Everything downstream
 * (logger, access log, audit, envelope) reads this one id.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.header('x-request-id');
    const requestId = inbound && inbound.length <= 200 ? inbound : randomUUID();

    res.setHeader('x-request-id', requestId);
    runWithRequestContext({ requestId }, () => next());
  }
}
