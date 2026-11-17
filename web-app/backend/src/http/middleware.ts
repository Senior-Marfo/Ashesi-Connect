import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { hasPermission, type Permission } from '../auth/permissions.js';
import { verifyAccessToken, type AccessClaims } from '../auth/tokens.js';
import type { RequestContext } from '../auth/service.js';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    auth?: AccessClaims;
  }
}

export const CSRF_HEADER = 'x-requested-with';

export function requestId(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.header('x-request-id');
    req.requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    res.setHeader('x-request-id', req.requestId);
    next();
  };
}

export function contextOf(req: Request): RequestContext {
  return { requestId: req.requestId, ip: req.ip };
}

export function authenticate(secret: string): RequestHandler {
  return (req, res, next) => {
    const token = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(req.header('authorization') ?? '')?.[1];
    const claims = token ? verifyAccessToken(token, secret) : undefined;
    if (!claims) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    req.auth = claims;
    next();
  };
}

/** Accounts with a temporary password may only change it or sign out. */
export function requirePasswordChanged(): RequestHandler {
  return (req, res, next) => {
    if (req.auth?.passwordChangeRequired) {
      res.status(403).json({ error: 'PASSWORD_CHANGE_REQUIRED' });
      return;
    }
    next();
  };
}

export function requirePermission(permission: Permission): RequestHandler {
  return (req, res, next) => {
    if (!req.auth || !hasPermission(req.auth.role, permission)) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
    next();
  };
}

/**
 * Cookie-authenticated endpoints require a custom header. Browsers cannot attach it
 * cross-origin without a CORS preflight, which the allow-list rejects.
 */
export function requireCsrfHeader(): RequestHandler {
  return (req, res, next) => {
    if (!req.header(CSRF_HEADER)) {
      res.status(403).json({ error: 'CSRF_HEADER_MISSING' });
      return;
    }
    next();
  };
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(handler: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
