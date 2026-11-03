import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import { routeOf } from '../http/response.interceptor';
import { currentPrincipal, currentRequestId } from '../observability/request-context';

/**
 * Single exit point for every error. Renders a stable envelope —
 *   { "error": { code, message }, "meta": { request_id, method, route, status,
 *                                           principal, timestamp } }
 * — whose `meta` mirrors the success envelope (ResponseEnvelopeInterceptor), so
 * clients get ONE shape whether a call succeeds or fails. Known infrastructure
 * errors (Prisma) map to sensible codes; unknown errors are logged with their
 * stack and reported as an opaque 500, so internal details never leak.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, code, message } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} -> ${status} ${code}`, this.stackOf(exception));
    }

    const principal = currentPrincipal();
    res.status(status).json({
      error: { code, message },
      meta: {
        request_id: currentRequestId() ?? null,
        method: req.method,
        route: routeOf(req),
        status,
        principal: principal
          ? { kind: principal.kind, id: principal.id, tenant_id: principal.tenant_id }
          : null,
        timestamp: new Date(Date.now()).toISOString(),
      },
    });
  }

  private resolve(exception: unknown): { status: number; code: string; message: string } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        const body = response as Record<string, unknown>;
        // AppException shape.
        if (typeof body.code === 'string') {
          return { status, code: body.code, message: String(body.message ?? exception.message) };
        }
        // Nest ValidationPipe shape: { message: string[] , error, statusCode }.
        const raw = body.message;
        const message = Array.isArray(raw) ? raw.join('; ') : String(raw ?? exception.message);
        return { status, code: this.codeForStatus(status), message };
      }
      return { status, code: this.codeForStatus(status), message: exception.message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { status: HttpStatus.CONFLICT, code: 'conflict', message: 'That value is already taken.' };
      }
      if (exception.code === 'P2025') {
        return { status: HttpStatus.NOT_FOUND, code: 'not_found', message: 'Resource not found.' };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'internal_error',
      message: 'Something went wrong.',
    };
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'bad_request';
      case HttpStatus.UNAUTHORIZED:
        return 'unauthenticated';
      case HttpStatus.FORBIDDEN:
        return 'permission_denied';
      case HttpStatus.NOT_FOUND:
        return 'not_found';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'rate_limited';
      default:
        return 'error';
    }
  }

  private stackOf(exception: unknown): string | undefined {
    return exception instanceof Error ? exception.stack : undefined;
  }
}
