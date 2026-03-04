export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const NotFound = (resource: string) =>
  new AppError(404, `${resource} not found`, 'NOT_FOUND');
export const BadRequest = (msg: string, details?: Record<string, unknown>) =>
  new AppError(400, msg, 'BAD_REQUEST', details);
export const Unauthorized = (msg = 'Unauthorized') => new AppError(401, msg, 'UNAUTHORIZED');
export const Conflict = (msg: string) => new AppError(409, msg, 'CONFLICT');
export const TooLarge = (msg: string) => new AppError(413, msg, 'TOO_LARGE');
export const RateLimited = () => new AppError(429, 'Rate limit exceeded', 'RATE_LIMITED');
