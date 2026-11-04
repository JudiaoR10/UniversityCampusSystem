import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4100),
  API_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  NOTIFICATIONS_API_URL: z.string().default(''),
  NOTIFICATIONS_API_TOKEN: z.string().default(''),
  NOTIFICATIONS_TIMEOUT_MS: z.coerce.number().int().min(1).max(30000).default(5000),
  NOTIFICATIONS_POLL_INTERVAL_MS: z.coerce.number().int().min(1).max(3600000).default(30000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().default(200),
});

export type Env = z.infer<typeof envSchema>;

/** Aceita host Render (ex.: app.onrender.com) além de URL completa. */
export function normalizeCorsOrigin(origin: string): string {
  const trimmed = origin.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function normalizeCorsOrigins(origins: string): string {
  return origins
    .split(',')
    .map(normalizeCorsOrigin)
    .filter(Boolean)
    .join(',');
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const merged: NodeJS.ProcessEnv = { ...source };
  if (!merged.API_PORT && merged.PORT) {
    merged.API_PORT = merged.PORT;
  }
  const parsed = envSchema.safeParse(merged);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuração inválida: ${details}`);
  }
  return {
    ...parsed.data,
    CORS_ORIGIN: normalizeCorsOrigins(parsed.data.CORS_ORIGIN),
  };
}

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = loadEnv();
  }
  return cachedEnv;
}
