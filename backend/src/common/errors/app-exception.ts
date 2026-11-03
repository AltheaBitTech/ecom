import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * A domain error with a stable machine-readable `code`. Clients (and tests)
 * branch on `error.code`, never on human-facing message text.
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, status);
  }

  static notFound(message = 'Resource not found'): AppException {
    return new AppException('not_found', message, HttpStatus.NOT_FOUND);
  }

  static validation(message = 'The request is invalid'): AppException {
    return new AppException('validation', message, HttpStatus.BAD_REQUEST);
  }

  static unauthenticated(message = 'Authentication required'): AppException {
    return new AppException('unauthenticated', message, HttpStatus.UNAUTHORIZED);
  }

  static permissionDenied(message = 'You do not have permission to do that'): AppException {
    return new AppException('permission_denied', message, HttpStatus.FORBIDDEN);
  }

  static tenantBoundary(message = 'Cross-tenant access is not allowed'): AppException {
    return new AppException('tenant_boundary_violation', message, HttpStatus.FORBIDDEN);
  }

  static conflict(code: string, message: string): AppException {
    return new AppException(code, message, HttpStatus.CONFLICT);
  }

  static featureNotInPlan(message = "Your plan doesn't include this feature"): AppException {
    return new AppException('feature_not_in_plan', message, HttpStatus.FORBIDDEN);
  }

  static limitExceeded(message = 'Plan limit reached'): AppException {
    return new AppException('plan_limit_exceeded', message, HttpStatus.FORBIDDEN);
  }
}
