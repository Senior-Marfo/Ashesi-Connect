import { Router, type CookieOptions, type Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { AuthError, type AuthService, type SessionTokens } from '../auth/service.js';
import { asyncHandler, authenticate, contextOf, requireCsrfHeader } from './middleware.js';

export const REFRESH_COOKIE = 'agt_refresh';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

const loginSchema = z.object({ identifier: z.string().trim().min(3).max(64), password: z.string().min(1).max(1024) });
const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(1024), newPassword: z.string().min(1).max(1024) });

export function authRoutes(config: AppConfig, auth: AuthService): Router {
  const router = Router();
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: config.refreshCookie.secure,
    sameSite: config.refreshCookie.sameSite,
    path: REFRESH_COOKIE_PATH
  };

  const sendSession = (res: Response, session: SessionTokens) => {
    res.cookie(REFRESH_COOKIE, session.refreshToken, { ...cookieOptions, expires: session.refreshExpiresAt });
    res.setHeader('cache-control', 'no-store');
    res.json({
      accessToken: session.accessToken,
      expiresIn: config.accessTokenTtlSeconds,
      role: session.role,
      passwordChangeRequired: session.passwordChangeRequired
    });
  };

  const loginLimiter = rateLimit({
    windowMs: config.loginRateLimit.windowMs,
    limit: config.loginRateLimit.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: req => {
      const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim().slice(0, 64) : '';
      return `${ipKeyGenerator(req.ip ?? '')}|${identifier}`;
    },
    handler: (_req, res) => { res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' }); }
  });

  router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    sendSession(res, await auth.login(parsed.data.identifier, parsed.data.password, contextOf(req)));
  }));

  router.post('/refresh', requireCsrfHeader(), asyncHandler(async (req, res) => {
    const token: unknown = req.cookies?.[REFRESH_COOKIE];
    if (typeof token !== 'string' || token.length === 0) {
      res.status(401).json({ error: 'INVALID_REFRESH_TOKEN' });
      return;
    }
    try {
      sendSession(res, await auth.refresh(token, contextOf(req)));
    } catch (error) {
      if (error instanceof AuthError) res.clearCookie(REFRESH_COOKIE, cookieOptions);
      throw error;
    }
  }));

  router.post('/logout', requireCsrfHeader(), asyncHandler(async (req, res) => {
    const token: unknown = req.cookies?.[REFRESH_COOKIE];
    await auth.logout(typeof token === 'string' ? token : undefined, contextOf(req));
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    res.status(204).end();
  }));

  router.post('/password', authenticate(config.accessTokenSecret), asyncHandler(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success || !req.auth) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    sendSession(res, await auth.changePassword(req.auth.sub, parsed.data.currentPassword, parsed.data.newPassword, contextOf(req)));
  }));

  return router;
}
