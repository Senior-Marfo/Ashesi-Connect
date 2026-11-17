import { z } from 'zod';

const durationSeconds = z.coerce.number().int().positive();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).optional(),
  CORS_ORIGINS: z.string().default(''),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: durationSeconds.default(15 * 60),
  REFRESH_TOKEN_TTL: durationSeconds.default(7 * 24 * 60 * 60),
  REFRESH_COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).optional(),
  STUDENT_ID_REGEX: z.string().default('^\\d{8}$'),
  STAFF_ID_REGEX: z.string().default('^STF-\\d{4,6}$'),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: durationSeconds.default(15 * 60),
  LOCKOUT_THRESHOLD: z.coerce.number().int().positive().default(5),
  LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  STATIC_DIR: z.string().min(1).optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).optional(),
  SEED_ADMIN_STAFF_ID: z.string().trim().min(1).optional(),
  SEED_ADMIN_PASSWORD: z.string().min(1).optional()
});

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  mongodbUri?: string;
  corsOrigins: string[];
  accessTokenSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  refreshCookie: { secure: boolean; sameSite: 'strict' | 'lax' | 'none' };
  studentIdPattern: RegExp;
  staffIdPattern: RegExp;
  loginRateLimit: { max: number; windowMs: number };
  lockout: { threshold: number; durationMs: number };
  /** Built web client served from the API origin, so the refresh cookie stays first-party. */
  staticDir?: string;
  trustProxyHops: number;
  bootstrapAdmin?: { identifier: string; password: string };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Blank values (e.g. `KEY=` in .env or an empty dashboard field) mean "use the default".
  const parsed = envSchema.parse(Object.fromEntries(Object.entries(env).filter(([, value]) => value !== '')));
  const production = parsed.NODE_ENV === 'production';
  const sameSite = parsed.REFRESH_COOKIE_SAMESITE ?? 'strict';
  if (production && !parsed.MONGODB_URI) throw new Error('MONGODB_URI is required in production');
  if (Boolean(parsed.SEED_ADMIN_STAFF_ID) !== Boolean(parsed.SEED_ADMIN_PASSWORD)) {
    throw new Error('Set both SEED_ADMIN_STAFF_ID and SEED_ADMIN_PASSWORD, or neither');
  }
  return {
    env: parsed.NODE_ENV,
    port: parsed.PORT,
    mongodbUri: parsed.MONGODB_URI,
    corsOrigins: parsed.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean),
    accessTokenSecret: parsed.JWT_ACCESS_SECRET,
    accessTokenTtlSeconds: parsed.ACCESS_TOKEN_TTL,
    refreshTokenTtlSeconds: parsed.REFRESH_TOKEN_TTL,
    refreshCookie: { secure: production || sameSite === 'none', sameSite },
    studentIdPattern: new RegExp(parsed.STUDENT_ID_REGEX),
    staffIdPattern: new RegExp(parsed.STAFF_ID_REGEX),
    loginRateLimit: { max: parsed.LOGIN_RATE_LIMIT_MAX, windowMs: parsed.LOGIN_RATE_LIMIT_WINDOW_SECONDS * 1000 },
    lockout: { threshold: parsed.LOCKOUT_THRESHOLD, durationMs: parsed.LOCKOUT_MINUTES * 60_000 },
    staticDir: parsed.STATIC_DIR,
    trustProxyHops: parsed.TRUST_PROXY_HOPS ?? (production ? 1 : 0),
    bootstrapAdmin: parsed.SEED_ADMIN_STAFF_ID && parsed.SEED_ADMIN_PASSWORD
      ? { identifier: parsed.SEED_ADMIN_STAFF_ID, password: parsed.SEED_ADMIN_PASSWORD }
      : undefined
  };
}
