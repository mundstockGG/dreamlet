import { Request, Response, NextFunction } from 'express';
import sanitizeHtml from 'sanitize-html';

export function sanitizeBody(req: Request, res: Response, next: NextFunction) {
  function sanitize(obj: any): any {
    if (typeof obj === 'string') {
      return sanitizeHtml(obj, {
        allowedTags:   [],   
        allowedAttributes: {}
      }).trim();
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const out: any = {};
      for (const key of Object.keys(obj)) {
        out[key] = sanitize(obj[key]);
      }
      return out;
    }
    return obj;
  }

  if (req.body) {
    req.body = sanitize(req.body);
  }
  next();
}
