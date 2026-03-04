import type { Request, Response, NextFunction } from 'express';

/**
 * Strip HTML tags from all string fields in request body and query.
 * ShipScope content is plain text — no HTML needed.
 */
export function sanitizeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query as Record<string, unknown>);
  }
  next();
}

function sanitizeObject(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'string') {
      obj[key] = stripHtml(value);
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === 'string') {
          value[i] = stripHtml(value[i]);
        } else if (typeof value[i] === 'object' && value[i] !== null) {
          sanitizeObject(value[i] as Record<string, unknown>);
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitizeObject(value as Record<string, unknown>);
    }
  }
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}
