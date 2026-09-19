'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordChecklist } from '@/components/password-checklist';
import { api, ApiError } from '@/lib/api';
import { passwordError } from '@/lib/form-validation';

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const token = useSearchParams().get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pwError = passwordError(password);
  const mismatch = confirm && confirm !== password ? 'Passwords do not match.' : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pwError || confirm !== password) return setTouched(true);
    setLoading(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!token || done) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{done ? 'Password updated' : 'Invalid reset link'}</CardTitle>
          <CardDescription>
            {done ? 'You were signed out everywhere. Sign in with your new password.' : 'This link is missing its token. Request a new one.'}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href={done ? '/login' : '/forgot-password'} className="text-sm font-medium underline-offset-4 hover:underline">
            {done ? 'Go to sign in' : 'Request a new link'}
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Choose a new password</CardTitle>
        <CardDescription>You&apos;ll be signed out of all devices.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setTouched(true); }} autoComplete="new-password" maxLength={128} aria-invalid={touched && !!pwError} required />
            <PasswordChecklist password={password} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" aria-invalid={!!mismatch} required />
            {mismatch && <p className="text-xs text-destructive">{mismatch}</p>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="mt-2 flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Update password
          </Button>
          {error && <Link href="/forgot-password" className="text-sm underline-offset-4 hover:underline">Request a new link</Link>}
        </CardFooter>
      </form>
    </Card>
  );
}
