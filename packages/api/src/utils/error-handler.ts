import { TRPCError } from "@trpc/server";

export class ApiError extends TRPCError {
  constructor(code: TRPCError['code'], message: string, cause?: unknown) {
    super({ code, message, cause });
  }

  static notFound(resource: string) {
    return new ApiError('NOT_FOUND', `${resource} not found`);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError('FORBIDDEN', message);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError('UNAUTHORIZED', message);
  }

  static badRequest(message: string) {
    return new ApiError('BAD_REQUEST', message);
  }

  static internal(message = 'Internal server error', cause?: unknown) {
    return new ApiError('INTERNAL_SERVER_ERROR', message, cause);
  }
}

/**
 * Wrap async functions to handle errors consistently
 */
export function handleErrors<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      // If it's already a TRPC error, re-throw it
      if (error instanceof TRPCError) {
        throw error;
      }
      
      // Log unexpected errors with full details
      console.error('[handleErrors] Unexpected error:', error);
      console.error('[handleErrors] Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('[handleErrors] Error details:', JSON.stringify(error, null, 2));
      
      // Wrap unknown errors
      throw ApiError.internal('An unexpected error occurred', error);
    }
  }) as T;
}