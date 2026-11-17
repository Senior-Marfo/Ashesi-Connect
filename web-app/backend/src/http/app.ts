import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type ErrorRequestHandler, type Express } from 'express';
import helmet from 'helmet';
import type { AppConfig } from '../config.js';
import { AuthError, AuthService } from '../auth/service.js';
import type { Repositories } from '../repositories/types.js';
import { adminRoutes } from './admin-routes.js';
import { authRoutes } from './auth-routes.js';
import { authenticate, requestId, requirePasswordChanged, CSRF_HEADER } from './middleware.js';
import { studentRoutes } from './student-routes.js';

export interface AppDependencies {
  config: AppConfig;
  repositories: Repositories;
  isHealthy: () => boolean;
}

const authErrorStatus: Record<AuthError['code'], number> = {
  INVALID_CREDENTIALS: 401,
  INVALID_REFRESH_TOKEN: 401,
  WEAK_PASSWORD: 422,
  USER_NOT_FOUND: 404
};

export function createApp({ config, repositories, isHealthy }: AppDependencies): Express {
  const auth = new AuthService({ config, ...repositories });
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.env === 'production' ? 1 : false);
  app.use(requestId());
  app.use(helmet());
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
  app.use('/api/v1/students', ...protectedRoutes, studentRoutes(repositories));
  app.use('/api/v1/admin', ...protectedRoutes, adminRoutes(repositories, auth));

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
