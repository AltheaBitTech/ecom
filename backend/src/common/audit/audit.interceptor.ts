import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

import { routeOf } from '../http/response.interceptor';
import { currentPrincipal, currentRequestId } from '../observability/request-context';

import { AuditService } from './audit.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SENSITIVE = /pass(word)?|secret|token|api[_-]?key|authorization|cvv|card/i;

/**
 * Persists an audit row for every successful state-changing request, attributed
 * to the resolved principal. Reads (GET/HEAD) and unauthenticated/tenant-less
 * calls are skipped — the access log already covers those. This is automatic and
 * uniform; security-sensitive actions may additionally call AuditService.record
 * directly with a richer diff.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if (!MUTATING.has(req.method)) return next.handle();

    return next.handle().pipe(
      tap((payload) => {
        // Only record on success; the exception filter path is not audited here.
        if (res.statusCode >= 400) return;

        const principal = currentPrincipal();
        const tenantId = principal?.tenant_id ?? (req.params?.tenantId as string | undefined);
        if (!tenantId) return; // platform/tenant-less writes are not tenant-audited

        void this.audit.record({
          tenantId,
          actorKind: principal?.kind ?? 'system',
          actorId: principal?.id ?? null,
          action: `${req.method} ${routeOf(req)}`,
          target: targetOf(req, payload),
          method: req.method,
          route: routeOf(req),
          statusCode: res.statusCode,
          requestId: currentRequestId() ?? null,
          ipAddress: req.ip ?? null,
          metadata: { params: req.params, body: redact(req.body) },
        });
      }),
    );
  }
}

/** The affected resource id: a route `:id` param, else the created row's id. */
function targetOf(req: Request, payload: unknown): string | null {
  const paramId = (req.params?.id ?? req.params?.orderId) as string | undefined;
  if (paramId) return paramId;
  if (payload && typeof payload === 'object' && typeof (payload as { id?: unknown }).id === 'string') {
    return (payload as { id: string }).id;
  }
  return null;
}

function redact(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    out[key] = SENSITIVE.test(key) ? '[redacted]' : value;
  }
  return out;
}
