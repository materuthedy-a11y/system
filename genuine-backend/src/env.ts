import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  DATABASE_URL: z.string().url('Invalid database URL'),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_RESET_SECRET: z.string().min(32, 'JWT reset secret must be at least 32 characters'),
  JWT_ACCESS_EXPIRATION: z
    .string()
    .regex(/^\d+[smhd]$/, 'Use a JWT duration such as 15m')
    .default('15m'),
  JWT_REFRESH_EXPIRATION: z
    .string()
    .regex(/^\d+[smhd]$/, 'Use a JWT duration such as 30d')
    .default('30d'),
  SESSION_IDLE_TIMEOUT: z
    .string()
    .regex(/^\d+[smhd]$/, 'Use a session duration such as 7d')
    .default('7d'),
  SESSION_ABSOLUTE_TIMEOUT: z
    .string()
    .regex(/^\d+[smhd]$/, 'Use a session duration such as 30d')
    .default('30d'),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  NOTIFICATION_CONFIG_ENCRYPTION_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
  ALLOW_NEGATIVE_STOCK: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  DEFAULT_COSTING_METHOD: z.enum(['FIFO', 'WEIGHTED_AVERAGE']).default('WEIGHTED_AVERAGE'),
}).superRefine((env, context) => {
  if (env.NOTIFICATION_CONFIG_ENCRYPTION_KEY && env.NOTIFICATION_CONFIG_ENCRYPTION_KEY.length < 32) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['NOTIFICATION_CONFIG_ENCRYPTION_KEY'],
      message: 'Notification encryption key must be at least 32 characters',
    });
  }

  if (env.NODE_ENV !== 'production') return;

  const rejectPlaceholder = (key: string, value: string) => {
    if (/localhost|127\.0\.0\.1|your[-_. ]?(domain|url)|example\.com|placeholder|user:password@host/i.test(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} must contain the real production value, not a local or example URL`,
      });
    }
  };

  if (!/^postgres(?:ql)?:\/\//i.test(env.DATABASE_URL)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DATABASE_URL'],
      message: 'DATABASE_URL must be a PostgreSQL connection URL in production',
    });
  } else {
    rejectPlaceholder('DATABASE_URL', env.DATABASE_URL);
  }

  for (const origin of env.CORS_ORIGIN.split(',').map((value) => value.trim()).filter(Boolean)) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'https:') throw new Error('HTTPS required');
      rejectPlaceholder('CORS_ORIGIN', origin);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: 'CORS_ORIGIN must be a comma-separated list of real HTTPS frontend origins',
      });
    }
  }
  if (!env.CORS_ORIGIN.split(',').some((value) => value.trim())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CORS_ORIGIN'],
      message: 'Set at least one HTTPS frontend origin in CORS_ORIGIN',
    });
  }

  try {
    const frontend = new URL(env.FRONTEND_URL);
    if (frontend.protocol !== 'https:') throw new Error('HTTPS required');
    rejectPlaceholder('FRONTEND_URL', env.FRONTEND_URL);
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['FRONTEND_URL'],
      message: 'FRONTEND_URL must be the real HTTPS frontend URL',
    });
  }

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_RESET_SECRET'] as const) {
    if (/change[-_ ]?me|replace[-_ ]?with|example|placeholder|secret123/i.test(env[key])) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} must be a unique randomly generated production secret`,
      });
    }
  }
  if (new Set([env.JWT_SECRET, env.JWT_REFRESH_SECRET, env.JWT_RESET_SECRET]).size !== 3) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message: 'Use a different random secret for each JWT secret variable',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown> = process.env): Env {
  try {
    const env = envSchema.parse(config);
    const toSeconds = (value: string) => {
      const match = /^(\d+)([smhd])$/.exec(value);
      if (!match) return 0;
      const scale = { s: 1, m: 60, h: 3600, d: 86_400 }[match[2] as 's' | 'm' | 'h' | 'd'];
      return Number(match[1]) * scale;
    };
    if (toSeconds(env.SESSION_IDLE_TIMEOUT) >= toSeconds(env.SESSION_ABSOLUTE_TIMEOUT)) {
      throw new Error('SESSION_IDLE_TIMEOUT must be shorter than SESSION_ABSOLUTE_TIMEOUT');
    }
    if (toSeconds(env.JWT_REFRESH_EXPIRATION) < toSeconds(env.SESSION_ABSOLUTE_TIMEOUT)) {
      throw new Error('JWT_REFRESH_EXPIRATION must cover SESSION_ABSOLUTE_TIMEOUT');
    }
    return env;
  } catch (error) {
    console.error('Environment validation failed:', error);
    process.exit(1);
  }
}
