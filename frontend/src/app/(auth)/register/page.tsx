'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth, ApiError } from '@/lib/auth-context';
import { isValidGstin, isValidPan } from '@/lib/tax-validation';
import { nameError, passwordError } from '@/lib/form-validation';
import { PasswordChecklist } from '@/components/password-checklist';
import { OAuthButtons } from '@/components/oauth-buttons';

// Mirrors backend RegisterTenantDto / AuthService.assertPasswordStrength — keep in sync.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function FieldError({ message }: { message: string | null }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref') ?? undefined;
  const [businessName, setBusinessName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gstin, setGstin] = useState('');
  const [legalName, setLegalName] = useState('');
  const [pan, setPan] = useState('');
  const [error, setError] = useState<string | null>(searchParams.get('error'));
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const errors = {
    businessName: nameError(businessName, 'Business name', 120),
    ownerEmail: !ownerEmail.trim() ? 'Email is required.' : EMAIL_RE.test(ownerEmail.trim()) ? null : 'Enter a valid email address.',
    password: passwordError(password),
    legalName: nameError(legalName, 'Legal name', 200),
    gstin: gstin && !isValidGstin(gstin) ? 'GSTIN format is invalid.' : null,
    pan: pan && !isValidPan(pan) ? 'PAN format is invalid.' : null,
  };
  // Show an error once the field has been typed in or left.
  const show = (k: keyof typeof errors) => (touched[k] ? errors[k] : null);
  const invalid = (k: keyof typeof errors) => !!show(k);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (Object.values(errors).some(Boolean)) {
      setTouched({ businessName: true, ownerEmail: true, password: true, legalName: true, gstin: true, pan: true });
      return;
    }
    setLoading(true);
    try {
      await register({
        businessName: businessName.trim(),
        ownerEmail: ownerEmail.trim(),
        password,
        gstin: gstin || undefined,
        legalName: legalName.trim(),
        pan: pan || undefined,
        referralCode,
      });
      router.push('/admin');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Create your workspace</CardTitle>
        <CardDescription>You&apos;ll become the Tenant Owner of a new, isolated workspace.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              placeholder="Acme Co"
              value={businessName}
              onChange={(e) => { setBusinessName(e.target.value); touch('businessName'); }}
              onBlur={() => touch('businessName')}
              aria-invalid={invalid('businessName')}
              autoComplete="organization"
              maxLength={120}
              required
            />
            <FieldError message={show('businessName')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ownerEmail">Your email</Label>
            <Input
              id="ownerEmail"
              type="email"
              placeholder="you@company.com"
              value={ownerEmail}
              onChange={(e) => { setOwnerEmail(e.target.value); touch('ownerEmail'); }}
              onBlur={() => touch('ownerEmail')}
              aria-invalid={invalid('ownerEmail')}
              autoComplete="email"
              required
            />
            <FieldError message={show('ownerEmail')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); touch('password'); }}
              onBlur={() => touch('password')}
              aria-invalid={invalid('password')}
              autoComplete="new-password"
              maxLength={128}
              required
            />
            <PasswordChecklist password={password} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="legalName">Legal name</Label>
            <Input
              id="legalName"
              placeholder="Acme Private Limited"
              value={legalName}
              onChange={(e) => { setLegalName(e.target.value); touch('legalName'); }}
              onBlur={() => touch('legalName')}
              aria-invalid={invalid('legalName')}
              maxLength={200}
              required
            />
            <FieldError message={show('legalName')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gstin">GSTIN (optional)</Label>
            <Input
              id="gstin"
              placeholder="27ABCDE1234F1Z5"
              value={gstin}
              onChange={(e) => { setGstin(e.target.value.toUpperCase()); touch('gstin'); }}
              onBlur={() => touch('gstin')}
              aria-invalid={invalid('gstin')}
              maxLength={15}
            />
            <FieldError message={show('gstin')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pan">PAN (optional)</Label>
            <Input
              id="pan"
              placeholder="ABCDE1234F"
              value={pan}
              onChange={(e) => { setPan(e.target.value.toUpperCase()); touch('pan'); }}
              onBlur={() => touch('pan')}
              aria-invalid={invalid('pan')}
              maxLength={10}
            />
            <FieldError message={show('pan')} />
            <p className="text-xs text-muted-foreground">You can add or update these later in Settings.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="mt-2 flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Create workspace
          </Button>
          <div className="flex w-full items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or sign up with
            <span className="h-px flex-1 bg-border" />
          </div>
          <OAuthButtons mode="register" />
          <p className="-mt-2 text-center text-xs text-muted-foreground">
            You&apos;ll add your business, legal name and GST details next. Sign in later with the same provider.
          </p>

          <p className="text-center text-sm text-muted-foreground">
            Already have one?{' '}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
