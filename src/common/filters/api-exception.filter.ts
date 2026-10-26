import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  CacheUnavailableError,
  ExternalServiceError,
  InvalidExternalPayloadError,
  InvalidPostalCodeError,
  PostalCodeNotFoundError,
} from '../errors';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = mapException(exception);
    response.status(mapped.statusCode).json({
      statusCode: mapped.statusCode,
      message: mapped.message,
    });
  }
}

function mapException(exception: unknown): {
  statusCode: number;
  message: string;
} {
  if (exception instanceof InvalidPostalCodeError) {
    return { statusCode: HttpStatus.BAD_REQUEST, message: exception.message };
  }

  if (exception instanceof PostalCodeNotFoundError) {
    return { statusCode: HttpStatus.NOT_FOUND, message: exception.message };
  }

  if (
    exception instanceof ExternalServiceError ||
    exception instanceof InvalidExternalPayloadError ||
    exception instanceof CacheUnavailableError
  ) {
    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: exception.message,
    };
  }

  if (exception instanceof HttpException) {
    return {
      statusCode: exception.getStatus(),
      message: messageOf(exception),
    };
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
  };
}

function messageOf(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === 'string') {
    return body;
  }

  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = body.message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.filter((item) => typeof item === 'string').join(', ');
    }
  }

  return exception.message;
}
