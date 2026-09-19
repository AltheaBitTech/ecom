import { z } from 'zod';

// Fail fast at boot if required secrets/config are missing or malformed —
// never fall back to a hardcoded default for anything security-sensitive.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  CORS_ORIGINS: z.string().default(''),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  // Optional at boot (not every environment needs payments configured yet) — PaymentsService
  // fails loudly at the point of use, not silently, if these are missing. See its constructor.
  // An empty string (var present but unset in .env) is treated the same as unset.
  RAZORPAY_KEY_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  RAZORPAY_KEY_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  RAZORPAY_WEBHOOK_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  PLATFORM_JWT_SECRET: z.string().min(32, 'PLATFORM_JWT_SECRET must be at least 32 characters'),
  // Which tenant the public storefront (GET /storefront/*) serves. Unset = storefront routes
  // return 503 rather than guessing a tenant. See storefront.service.ts ponytail note.
  STOREFRONT_TENANT_SLUG: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),

  // Where the browser lands after a social login redirect round-trip.
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  // Base URL this API is reachable at — used to build each provider's callback URL.
  BACKEND_URL: z.string().url().default('http://localhost:4000'),

  // Social login: each provider is independently optional at boot (OAuthService rejects a
  // login attempt for a provider whose credentials aren't set, rather than crashing on boot —
  // same pattern as Razorpay above). Empty string is treated as unset.
  GOOGLE_CLIENT_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  FACEBOOK_CLIENT_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  FACEBOOK_CLIENT_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  MICROSOFT_CLIENT_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  MICROSOFT_CLIENT_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  TWITTER_CLIENT_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  TWITTER_CLIENT_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),

  // Notifications: all optional at boot, same lazy-client pattern as Razorpay above — each
  // service throws only when actually called unconfigured, and every call site swallows that.
  RESEND_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  RESEND_FROM_EMAIL: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  TWILIO_ACCOUNT_SID: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  TWILIO_AUTH_TOKEN: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  TWILIO_SMS_FROM: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  TWILIO_WHATSAPP_FROM: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  // RazorpayX Payouts — automatic referral commission payout. Same merchant key as RAZORPAY_KEY_ID/
  // SECRET works if RazorpayX is enabled on the account; the account number identifies which
  // RazorpayX current account funds the payout.
  RAZORPAYX_ACCOUNT_NUMBER: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  if (parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }
  return parsed.data;
}
