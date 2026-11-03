import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { catchError, Observable, tap, throwError } from 'rxjs';

import { elapsedMs, routeOf } from '../http/response.interceptor';

import { currentPrincipal } from './request-context';

/**
 * One structured line per request recording who hit what and how it ended:
 * method, route, status, the acting principal, and duration. At `debug` level it
 * additionally prints the request payload (query, params, body) — the switch the
 * user asked for to "debug what's happening" — with obvious secrets redacted.
 * The persistent audit trail (AuditInterceptor) is separate; this is the log.
 */
@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('http');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const startedAt = process.hrtime.bigint();

    // Emitted before the handler runs, so debugging shows inputs even on a hang.
    this.logger.debug(
      `--> ${req.method} ${routeOf(req)} ${JSON.stringify({
        query: req.query,
        params: req.params,
        body: redact(req.body),
      })}`,
    );

    const finish = (status: number, errored: boolean): void => {
      const principal = currentPrincipal();
      const summary = `${errored ? 'ERR ' : ''}${req.method} ${routeOf(req)} -> ${status} (${elapsedMs(
        startedAt,
      ).toFixed(1)}ms)${principal ? ` by ${principal.kind}:${principal.id}` : ''}`;
      if (errored || status >= 500) this.logger.warn(summary);
      else this.logger.log(summary);
    };

    return next.handle().pipe(
      tap(() => finish(res.statusCode, false)),
      catchError((err: unknown) => {
        const status = typeof (err as { status?: number })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
        finish(status, true);
        return throwError(() => err);
      }),
    );
  }
}

const SENSITIVE = /pass(word)?|secret|token|api[_-]?key|authorization|cvv|card/i;

/** Shallow-redact obviously sensitive keys so payload logging is safe to enable. */
function redact(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    out[key] = SENSITIVE.test(key) ? '[redacted]' : value;
  }
  return out;
}
