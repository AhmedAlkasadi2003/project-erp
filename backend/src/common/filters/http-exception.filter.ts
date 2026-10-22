import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponsePayload {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  correlationId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = request.correlationId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        error = exception.name;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;
        message = (body.message as string | string[]) || exception.message;
        error = (body.error as string) || exception.name;
      }
    } else if (exception instanceof Error) {
      // Avoid leaking Prisma database errors or internal details to the client
      const isPrismaError =
        exception.name.includes('Prisma') || exception.constructor.name.includes('Prisma');

      if (isPrismaError) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Database operation failed or violates data integrity constraint';
        error = 'DataIntegrityError';
      } else {
        message =
          process.env.NODE_ENV === 'development'
            ? exception.message
            : 'An unexpected error occurred';
      }

      this.logger.error(
        `[${correlationId || 'NO-CORRELATION'}] Unhandled Exception: ${exception.message}`,
        exception.stack,
      );
    }

    const payload: ErrorResponsePayload = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId,
    };

    response.status(status).json(payload);
  }
}
