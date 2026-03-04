import type { Request, Response, NextFunction } from 'express';

export function httpsRedirect(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const proto = req.headers['x-forwarded-proto'];
  if (proto === 'http') {
    const httpsUrl = `https://${req.hostname}${req.originalUrl}`;
    res.redirect(301, httpsUrl);
    return;
  }

  next();
}
