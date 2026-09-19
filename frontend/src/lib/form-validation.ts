// Mirrors backend RegisterTenantDto / AuthService.assertPasswordStrength — keep in sync.
export const PASSWORD_RULES = [
  { label: 'At least 12 characters', test: (v: string) => v.length >= 12 },
  { label: 'Lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'Uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Digit', test: (v: string) => /\d/.test(v) },
  { label: 'Symbol', test: (v: string) => /[^a-zA-Z0-9]/.test(v) },
];

export function passwordError(v: string) {
  if (v.length < 12) return 'Use at least 12 characters.';
  if (v.length > 128) return 'Use at most 128 characters.';
  if (PASSWORD_RULES.slice(1).filter((r) => r.test(v)).length < 3) return 'Include at least 3 of: lowercase, uppercase, digit, symbol.';
  return null;
}

export function nameError(v: string, label: string, max: number) {
  const t = v.trim();
  if (!t) return `${label} is required.`;
  if (t.length < 2) return `${label} must be at least 2 characters.`;
  if (t.length > max) return `${label} must be at most ${max} characters.`;
  return null;
}
