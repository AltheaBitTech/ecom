'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { nameError } from '@/lib/form-validation';
import { isValidGstin, isValidPan } from '@/lib/tax-validation';

/** Second step of OAuth signup: the provider gave us an email, now collect the business details. */
export default function OnboardingPage() {
  const { status, tenant, reload } = useAuth();
  const router = useRouter();
  const [businessNameInput, setBusinessName] = useState<string | null>(null);
  const businessName = businessNameInput ?? tenant?.name ?? ''; // prefill with the current (possibly placeholder) name
  const [legalName, setLegalName] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
    else if (status === 'authenticated' && tenant?.legalName) router.replace('/admin');
  }, [status, tenant, router]);

  const errors = {
    businessName: nameError(businessName, 'Business name', 120),
    legalName: nameError(legalName, 'Legal name', 200),
    gstin: gstin && !isValidGstin(gstin) ? 'GSTIN format is invalid.' : null,
    pan: pan && !isValidPan(pan) ? 'PAN format is invalid.' : null,
  };
  const show = (k: keyof typeof errors) => (touched[k] ? errors[k] : null);
  const touch = (k: string) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (Object.values(errors).some(Boolean)) {
      setTouched({ businessName: true, legalName: true, gstin: true, pan: true });
      return;
    }
    setSaving(true);
    try {
      await api('/tenants/me/tax-info', {
        method: 'PATCH',
        body: { name: businessName.trim(), legalName: legalName.trim(), gstin: gstin || undefined, pan: pan || undefined },
      });
      await reload();
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  }

  if (status !== 'authenticated') return <Loader2 className="size-6 animate-spin text-muted-foreground" />;

  const field = (k: keyof typeof errors) => ({ onBlur: () => touch(k), 'aria-invalid': !!show(k) });
  const err = (k: keyof typeof errors) => (show(k) ? <p className="text-xs text-destructive">{show(k)}</p> : null);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Finish setting up</CardTitle>
        <CardDescription>Tell us about your business. You can update GST details later in Settings.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="businessName">Business name</Label>
            <Input id="businessName" placeholder="Acme Co" value={businessName} maxLength={120} required {...field('businessName')}
              onChange={(e) => { setBusinessName(e.target.value); touch('businessName'); }} />
            {err('businessName')}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="legalName">Legal name</Label>
            <Input id="legalName" placeholder="Acme Private Limited" value={legalName} maxLength={200} required {...field('legalName')}
              onChange={(e) => { setLegalName(e.target.value); touch('legalName'); }} />
            {err('legalName')}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gstin">GSTIN (optional)</Label>
            <Input id="gstin" placeholder="27ABCDE1234F1Z5" value={gstin} maxLength={15} {...field('gstin')}
              onChange={(e) => { setGstin(e.target.value.toUpperCase()); touch('gstin'); }} />
            {err('gstin')}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pan">PAN (optional)</Label>
            <Input id="pan" placeholder="ABCDE1234F" value={pan} maxLength={10} {...field('pan')}
              onChange={(e) => { setPan(e.target.value.toUpperCase()); touch('pan'); }} />
            {err('pan')}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="mt-2">
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Continue
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
