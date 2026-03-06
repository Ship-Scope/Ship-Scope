import { type Request, type Response, type NextFunction } from 'express';

/**
 * Middleware that blocks mutating requests when DEMO_MODE is enabled.
 * GET requests pass through; POST/PUT/PATCH/DELETE are rejected with 403.
 */
export function demoGuard(req: Request, res: Response, next: NextFunction) {
  if (process.env.DEMO_MODE !== 'true') {
    return next();
  }

  // Allow all GET/HEAD/OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  res.status(403).json({
    error: 'This action is disabled in demo mode',
    code: 'DEMO_MODE_RESTRICTED',
    message: 'Self-host ShipScope to use your own data: https://github.com/Ship-Scope/Ship-Scope',
  });
}
