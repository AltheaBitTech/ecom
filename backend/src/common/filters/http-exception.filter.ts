import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp ? exception.getResponse() : null;

    if (!isHttp) {
      // Never leak internals (stack traces, DB errors) to the client.
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    res.status(status).json(
      typeof body === 'object' && body !== null
        ? { statusCode: status, ...body }
        : { statusCode: status, message: isHttp ? body : 'Internal server error' },
    );
  }
}
