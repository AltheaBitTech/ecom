import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { map, Observable } from 'rxjs';

import { currentPrincipal, currentRequestId } from '../observability/request-context';

/** Opt a handler/controller out of the envelope (e.g. health probes). */
export const SKIP_ENVELOPE_KEY = 'response:skip-envelope';
export const NoEnvelope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_ENVELOPE_KEY, true);

/**
 * The uniform success envelope. Every JSON response a handler returns is wrapped
 * as:
 *
 *   { "data": <payload>, "meta": { request_id, method, route, status,
 *                                  principal, duration_ms, timestamp } }
 *
 * `meta` is identical in shape across every route (the error path in
 * AllExceptionsFilter mirrors it), so clients and logs get one predictable
 * structure. `principal` records who invoked the route, when the caller is
 * identified. The payload itself is unchanged — a paginated payload keeps its
 * `{ data, next_cursor, has_more }` shape nested under the envelope's `data`.
 */
export interface ResponseMeta {
  request_id: string | null;
  method: string;
  route: string;
  status: number;
  principal: { kind: string; id: string; tenant_id?: string } | null;
  duration_ms: number;
  timestamp: string;
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const startedAt = process.hrtime.bigint();

    return next.handle().pipe(
      map((data) => {
        const principal = currentPrincipal();
        const meta: ResponseMeta = {
          request_id: currentRequestId() ?? null,
          method: req.method,
          route: routeOf(req),
          status: res.statusCode,
          principal: principal
            ? { kind: principal.kind, id: principal.id, tenant_id: principal.tenant_id }
            : null,
          duration_ms: elapsedMs(startedAt),
          timestamp: nowIso(),
        };
        return { data: data ?? null, meta };
      }),
    );
  }
}

/** The matched route template (`/v1/tenants/:tenantId/products`), not the raw url. */
export function routeOf(req: Request): string {
  const base = (req.baseUrl ?? '') as string;
  const path = (req.route?.path as string | undefined) ?? req.path;
  return `${base}${path}` || req.originalUrl.split('?')[0];
}

export function elapsedMs(startedAt: bigint): number {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

// `new Date()` with no args is unavailable in some sandboxes; hrtime-safe clock.
function nowIso(): string {
  return new Date(Date.now()).toISOString();
}
