import { readFileSync } from 'node:fs';

import { z } from 'zod';

/**
 * Boot-time environment validation. The process refuses to start on a missing
 * or malformed value — configuration errors surface at deploy, never as a
 * confusing runtime failure mid-request.
 */
const csv = (value: string): string[] =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const booleanString = z.enum(['true', 'false']).transform((v) => v === 'true');

/** Read a PEM key from a file path, failing boot with a clear message if absent. */
function readKeyFile(path: string | undefined, name: string): string {
  if (!path) {
    throw new Error(`Either ${name} or ${name}_FILE must be set`);
  }
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new Error(`Could not read ${name}_FILE at "${path}"`);
  }
}

export const envSchema = z
  .object({
    APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().int().positive().default(4001),
    API_PREFIX: z.string().default('v1'),
    CORS_ORIGINS: z.string().default('').transform(csv),

    // Minimum log level (verbose < debug < log < warn < error < fatal). At
    // `debug` the access log prints request payloads. `pretty` is human console
    // (local dev); `json` is one structured line per event (staging/prod).
    LOG_LEVEL: z.enum(['verbose', 'debug', 'log', 'warn', 'error', 'fatal']).default('log'),
    LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),

    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),
    // Optional: without it, ephemeral auth state lives in process memory (see RedisService).
    REDIS_URL: z.string().url().optional(),

    S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
    S3_REGION: z.string().min(1).default('us-east-1'),
    S3_BUCKET: z.string().min(3).default('ecom-media'),
    S3_ACCESS_KEY: z.string().min(1).default('ecom-local'),
    S3_SECRET_KEY: z.string().min(8).default('ecom-local-secret'),
    S3_FORCE_PATH_STYLE: booleanString.default('true'),

    // Master key for encrypting per-tenant secrets at rest (payment gateway keys,
    // webhook secrets). Base64 of exactly 32 random bytes. Generate with:
    //   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
    APP_ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, 'base64').length === 32, {
        message: 'APP_ENCRYPTION_KEY must be base64 of exactly 32 bytes (a 256-bit key).',
      }),

    // --- Native identity: RS256 signing keys ---------------------------------
    // ecom signs its own access tokens and serves its own JWKS. Provide each key
    // inline (JWT_*_KEY) or via a file path (JWT_*_KEY_FILE); exactly one of each.
    JWT_PRIVATE_KEY: z.string().optional(),
    JWT_PRIVATE_KEY_FILE: z.string().optional(),
    JWT_PUBLIC_KEY: z.string().optional(),
    JWT_PUBLIC_KEY_FILE: z.string().optional(),
    JWT_KEY_ID: z.string().min(1).default('ecom-dev-1'),
    JWT_ISSUER: z.string().min(1).default('ecom'),
    JWT_AUDIENCE: z.string().min(1).default('ecom'),
    ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(2_592_000),

    // Argon2id server-side pepper + version (for rotation). See PasswordService.
    PASSWORD_PEPPER: z
      .string()
      .min(16, 'PASSWORD_PEPPER must be at least 16 chars')
      .default('change-me-to-a-long-random-string-in-every-environment'),
    PASSWORD_PEPPER_VERSION: z.coerce.number().int().positive().default(1),

    // Keyed HMAC secret for hashing high-entropy opaque tokens (e.g. internal keys).
    API_KEY_HASH_SECRET: z
      .string()
      .min(16, 'API_KEY_HASH_SECRET must be at least 16 chars')
      .default('change-me-api-key-hash-secret-please'),

    // Shared secret for trusted server-to-server calls via the X-Internal-Key header.
    INTERNAL_API_KEY: z.string().min(16).default('change-me-internal-api-key-please-rotate'),

    // Cookie attributes for staff/customer session cookies set by the backend.
    COOKIE_DOMAIN: z.string().default('localhost'),
    COOKIE_SECURE: booleanString.default('false'),

    // --- Transactional email -------------------------------------------------
    // `console` prints the message (dev — grab links from logs); `smtp` sends via
    // the SMTP_* transport. Links point at APP_BASE_URL (the storefront/frontend).
    EMAIL_TRANSPORT: z.enum(['console', 'smtp']).default('console'),
    EMAIL_FROM: z.string().default('ecom <no-reply@localhost>'),
    APP_BASE_URL: z.string().url().default('http://localhost:3000'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: booleanString.default('false'),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),

    RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_GENERAL_PER_MINUTE: z.coerce.number().int().positive().default(120),
    RATE_LIMIT_CHECKOUT_PER_MINUTE: z.coerce.number().int().positive().default(20),
    RATE_LIMIT_TENANT_PER_MINUTE: z.coerce.number().int().positive().default(600),
  })
  .transform((env) => {
    // Resolve signing keys from inline value or file path. Deferred here (not in
    // the field schema) so a file is read only once, after all fields parse.
    const jwtPrivateKey = env.JWT_PRIVATE_KEY ?? readKeyFile(env.JWT_PRIVATE_KEY_FILE, 'JWT_PRIVATE_KEY');
    const jwtPublicKey = env.JWT_PUBLIC_KEY ?? readKeyFile(env.JWT_PUBLIC_KEY_FILE, 'JWT_PUBLIC_KEY');
    return { ...env, jwtPrivateKey, jwtPublicKey };
  })
  .superRefine((env, ctx) => {
    // A production deploy must not ship an all-zero (placeholder) encryption key.
    if (env.APP_ENV === 'production' && Buffer.from(env.APP_ENCRYPTION_KEY, 'base64').every((b) => b === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_ENCRYPTION_KEY'],
        message: 'Refusing to boot in production with a placeholder (all-zero) APP_ENCRYPTION_KEY.',
      });
    }

    // Native-identity production safety rails: refuse to boot with any secret
    // still at its dev default, an insecure cookie, or the console mailer.
    if (env.APP_ENV === 'production') {
      if (!env.COOKIE_SECURE) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['COOKIE_SECURE'], message: 'COOKIE_SECURE must be true in production' });
      }
      if (env.PASSWORD_PEPPER.startsWith('change-me')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['PASSWORD_PEPPER'], message: 'PASSWORD_PEPPER is still the default value' });
      }
      if (env.API_KEY_HASH_SECRET.startsWith('change-me')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['API_KEY_HASH_SECRET'], message: 'API_KEY_HASH_SECRET is still the default value' });
      }
      if (env.INTERNAL_API_KEY.startsWith('change-me')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['INTERNAL_API_KEY'], message: 'INTERNAL_API_KEY is still the default value' });
      }
      if (env.EMAIL_TRANSPORT === 'console') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['EMAIL_TRANSPORT'], message: 'EMAIL_TRANSPORT must be "smtp" in production' });
      }
      if (env.S3_ACCESS_KEY === 'ecom-local' || env.S3_SECRET_KEY === 'ecom-local-secret') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['S3_ACCESS_KEY'], message: 'S3 credentials are still development defaults' });
      }
    }

    // SMTP host is required whenever the SMTP transport is selected.
    if (env.EMAIL_TRANSPORT === 'smtp' && !env.SMTP_HOST) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SMTP_HOST'], message: 'SMTP_HOST is required when EMAIL_TRANSPORT=smtp' });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}
