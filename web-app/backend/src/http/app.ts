import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type ErrorRequestHandler, type Express } from 'express';
import helmet from 'helmet';
import { join, resolve } from 'node:path';
import type { AppConfig } from '../config.js';
import { AuthError, AuthService } from '../auth/service.js';
import type { Repositories } from '../repositories/types.js';
import { curriculumAdminRouter, curriculumStudentRouter } from '../routes/curriculum.js';
import { adminRoutes } from './admin-routes.js';
import { authRoutes } from './auth-routes.js';
import { authenticate, requestId, requirePasswordChanged, CSRF_HEADER } from './middleware.js';
import { studentRoutes } from './student-routes.js';

export interface AppDependencies {
  config: AppConfig;
  repositories: Repositories;
  isHealthy: () => boolean;
  /** Clock for term calculations; injectable for tests. */
  now?: () => Date;
}

const authErrorStatus: Record<AuthError['code'], number> = {
  INVALID_CREDENTIALS: 401,
  INVALID_REFRESH_TOKEN: 401,
  WEAK_PASSWORD: 422,
  USER_NOT_FOUND: 404
};

export function createApp({ config, repositories, isHealthy, now = () => new Date() }: AppDependencies): Express {
  const auth = new AuthService({ config, ...repositories });
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxyHops > 0 ? config.trustProxyHops : false);
  app.use(requestId());
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Next.js static export bootstraps hydration with inline scripts.
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"]
      }
    }
  }));
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
    allowedHeaders: ['authorization', 'content-type', CSRF_HEADER, 'x-request-id'],
    exposedHeaders: ['x-request-id']
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    const healthy = isHealthy();
    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'unavailable' });
  });

  const protectedRoutes = [authenticate(config.accessTokenSecret), requirePasswordChanged()];
  app.use('/api/v1/auth', authRoutes(config, auth));
  app.use('/api/v1/students', ...protectedRoutes, studentRoutes(repositories, now), curriculumStudentRouter);
  app.use('/api/v1/admin', ...protectedRoutes, adminRoutes(repositories, auth, now), curriculumAdminRouter);

  if (config.staticDir) serveWebClient(app, resolve(config.staticDir));

  app.use((_req, res) => { res.status(404).json({ error: 'NOT_FOUND' }); });

  const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    if (error instanceof AuthError) {
      res.status(authErrorStatus[error.code]).json({ error: error.code, message: error.code === 'WEAK_PASSWORD' ? error.message : undefined });
      return;
    }
    if (error?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    console.error(JSON.stringify({ level: 'error', requestId: req.requestId, message: error instanceof Error ? error.message : String(error) }));
    res.status(500).json({ error: 'INTERNAL_ERROR', requestId: req.requestId });
  };
  app.use(errorHandler);

  return app;
}

function serveWebClient(app: Express, root: string): void {
  app.use(express.static(root, {
    redirect: true,
    setHeaders: (res, path) => {
      res.setHeader('cache-control', path.includes(`${join('_next', 'static')}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
    }
  }));
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/') || req.path === '/health') {
      next();
      return;
    }
    res.status(404).sendFile(join(root, '404.html'), error => { if (error) next(); });
  });
}
