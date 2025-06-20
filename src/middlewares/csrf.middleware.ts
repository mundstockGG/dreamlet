import { Request, Response, NextFunction } from 'express';
import csurf from 'csurf';

export const csrfProtection = csurf({ cookie: true });

export function attachCsrfToken(req: Request, res: Response, next: NextFunction) {
  res.locals.csrfToken = req.csrfToken();
  next();
}
