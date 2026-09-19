'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { Tenant, Plan, Subscription, ReferralSummary } from '@/lib/types';
import { isValidGstin, isValidPan } from '@/lib/tax-validation';

function money(cents: number, currency: string) {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency });
}

export default function SettingsPage() {
  const { tenant, user, logout } = useAuth();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Workspace and account details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Editing workspace details isn&apos;t available yet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" value={tenant?.name} />
          <Field label="Slug" value={tenant?.slug} />
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant="secondary" className="mt-1">
              {tenant?.status.replace(/_/g, ' ')}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <NotificationPreferencesCard />

      <TaxInfoCard tenant={tenant} />

      <BillingCard />

      <ReferralsCard />

      <Card>
        <CardHeader>
          <CardTitle>Storefront</CardTitle>
          <CardDescription>
            The public storefront your customers see and buy from. One store per deployment today —
            it isn&apos;t scoped by your store slug in the URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" nativeButton={false} render={<Link href="/store" target="_blank" rel="noreferrer" />}>
            <ExternalLink className="size-4" />
            Visit storefront
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Email" value={user?.email} />
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-sm text-muted-foreground">End your session on this device.</p>
            </div>
            <Button variant="outline" onClick={() => logout()}>
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TaxInfoCard({ tenant }: { tenant: Tenant | null }) {
  const [legalName, setLegalName] = useState(tenant?.legalName ?? '');
  const [gstin, setGstin] = useState(tenant?.gstin ?? '');
  const [pan, setPan] = useState(tenant?.pan ?? '');
  const [logoUrl, setLogoUrl] = useState(tenant?.logoUrl ?? '');
  const [state, setState] = useState(tenant?.state ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (gstin && !isValidGstin(gstin)) return setError('GSTIN format is invalid.');
    if (pan && !isValidPan(pan)) return setError('PAN format is invalid.');
    if (logoUrl && !logoUrl.startsWith('https://')) return setError('Logo must be an HTTPS image URL.');
    setSaving(true);
    try {
      await api('/tenants/me/tax-info', {
        method: 'PATCH',
        body: { legalName: legalName || undefined, gstin: gstin || undefined, pan: pan || undefined, logoUrl: logoUrl || undefined, state: state || undefined },
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax / GST details</CardTitle>
        <CardDescription>Used on invoices. Fill these in whenever you have them — none are required to start selling.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="legalName">Legal name</Label>
            <Input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} maxLength={200} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gstin">GSTIN</Label>
            <Input id="gstin" value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} placeholder="27ABCDE1234F1Z5" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pan">PAN</Label>
            <Input id="pan" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} maxLength={10} placeholder="ABCDE1234F" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="state">Home state</Label>
            <Input id="state" value={state} onChange={(e) => setState(e.target.value)} maxLength={80} placeholder="Karnataka" />
            <p className="text-xs text-muted-foreground">Used to split invoice tax into CGST+SGST vs IGST.</p>
          </div>
          <div className="grid gap-2 sm:col-span-3">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input id="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
            <p className="text-xs text-muted-foreground">HTTPS image URL, printed in the header of generated invoices.</p>
          </div>
          {error && <p className="text-sm text-destructive sm:col-span-3">{error}</p>}
          {saved && <p className="text-sm text-muted-foreground sm:col-span-3">Saved.</p>}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function BillingCard() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null | undefined>(undefined);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [changingPlan, setChangingPlan] = useState(false);

  useEffect(() => {
    api<Plan[]>('/billing/plans').then(setPlans).catch(() => toast.error('Failed to load plans'));
    api<Subscription | null>('/billing/subscription')
      .then(setSubscription)
      .catch(() => setSubscription(null));
  }, []);

  async function subscribe(planId: string) {
    setSubscribing(planId);
    try {
      const result = await api<{ subscription: Subscription }>('/billing/subscribe', { method: 'POST', body: { planId } });
      setSubscription(result.subscription);
      toast.success('Subscribed');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to subscribe');
    } finally {
      setSubscribing(null);
    }
  }

  async function changePlan(planId: string) {
    setSubscribing(planId);
    try {
      const result = await api<{ subscription: Subscription }>('/billing/change-plan', { method: 'POST', body: { planId } });
      setSubscription(result.subscription);
      setChangingPlan(false);
      toast.success('Plan changed');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to change plan');
    } finally {
      setSubscribing(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>Your workspace subscription plan.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {subscription && (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{subscription.plan.name}</p>
              <p className="text-sm text-muted-foreground">
                {money(subscription.plan.priceCents, subscription.plan.currency)} / {subscription.plan.intervalDays}d
                {subscription.currentPeriodEnd && ` · renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={subscription.status === 'ACTIVE' ? 'default' : 'secondary'}>{subscription.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => setChangingPlan((v) => !v)}>
                {changingPlan ? 'Cancel' : 'Change plan'}
              </Button>
            </div>
          </div>
        )}
        {(!subscription || changingPlan) && (
          <div className="grid gap-3 sm:grid-cols-3">
            {plans === null && <Skeleton className="h-32 w-full sm:col-span-3" />}
            {plans
              ?.filter((p) => !subscription || p.id !== subscription.plan.id)
              .map((p) => (
                <div key={p.id} className="flex flex-col gap-3 rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground">{money(p.priceCents, p.currency)} / {p.intervalDays}d</p>
                  </div>
                  <ul className="flex-1 text-sm text-muted-foreground">
                    {p.features.map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                  <Button size="sm" disabled={subscribing !== null} onClick={() => (subscription ? changePlan(p.id) : subscribe(p.id))}>
                    {subscribing === p.id && <Loader2 className="size-4 animate-spin" />}
                    {subscription ? 'Switch to this plan' : 'Subscribe'}
                  </Button>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReferralsCard() {
  const [summary, setSummary] = useState<ReferralSummary | null | undefined>(undefined);
  const [issuing, setIssuing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [vpa, setVpa] = useState('');
  const [savingVpa, setSavingVpa] = useState(false);

  useEffect(() => {
    api<ReferralSummary | null>('/referrals/me')
      .then((s) => {
        setSummary(s);
        setVpa(s?.payoutVpa ?? '');
      })
      .catch(() => setSummary(null));
  }, []);

  async function savePayoutVpa() {
    setSavingVpa(true);
    try {
      await api('/referrals/payout-vpa', { method: 'PATCH', body: JSON.stringify({ payoutVpa: vpa || null }) });
      toast.success('Payout VPA saved');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save payout VPA');
    } finally {
      setSavingVpa(false);
    }
  }

  async function issueCode() {
    setIssuing(true);
    try {
      await api('/referrals/code', { method: 'POST' });
      setSummary(await api<ReferralSummary>('/referrals/me'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create referral code');
    } finally {
      setIssuing(false);
    }
  }

  const link = summary && typeof window !== 'undefined' ? `${window.location.origin}/register?ref=${summary.code}` : '';

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Refer &amp; earn</CardTitle>
        <CardDescription>Share your link — earn a commission when a workspace you refer subscribes.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {summary === undefined && <Skeleton className="h-9 w-full" />}
        {summary === null && (
          <Button size="sm" disabled={issuing} onClick={issueCode} className="w-fit">
            {issuing && <Loader2 className="size-4 animate-spin" />}
            Get my referral link
          </Button>
        )}
        {summary && (
          <>
            <div className="flex gap-2">
              <Input readOnly value={link} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copy link">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Earned" value={money(summary.totalEarnedCents, 'INR')} />
              <Field label="Paid out" value={money(summary.totalPaidCents, 'INR')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payoutVpa">Payout UPI VPA</Label>
              <p className="text-xs text-muted-foreground">
                Optional — commissions still get recorded without one, just settled manually. Set this to get paid automatically.
              </p>
              <div className="flex gap-2">
                <Input id="payoutVpa" placeholder="name@bank" value={vpa} onChange={(e) => setVpa(e.target.value)} className="max-w-xs" />
                <Button variant="outline" size="sm" disabled={savingVpa} onClick={savePayoutVpa}>
                  {savingVpa && <Loader2 className="size-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referred workspace</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Commissions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.referrals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                        No referrals yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {summary.referrals.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.refereeTenant.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.status}</Badge>
                      </TableCell>
                      <TableCell>{money(r.commissions.reduce((sum, c) => sum + c.amountCents, 0), 'INR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function NotificationPreferencesCard() {
  const [emailNotifications, setEmailNotifications] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ emailNotifications: boolean }>('/notifications/preferences')
      .then((p) => setEmailNotifications(p.emailNotifications))
      .catch(() => setEmailNotifications(true));
  }, []);

  async function save(next: boolean) {
    const previous = emailNotifications;
    setEmailNotifications(next);
    setSaving(true);
    try {
      await api('/notifications/preferences', { method: 'PATCH', body: { emailNotifications: next } });
      toast.success(next ? 'Email alerts on' : 'Email alerts off — the bell still shows everything');
    } catch {
      setEmailNotifications(previous);
      toast.error('Could not save your preference');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          You are alerted about orders, payments, and returns your role gives you access to.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={emailNotifications ?? true}
            disabled={emailNotifications === null || saving}
            onChange={(e) => save(e.target.checked)}
          />
          <span>
            <span className="font-medium">Also email me</span>
            <span className="block text-muted-foreground">
              Turn this off to keep alerts in the dashboard bell only. Nothing is lost either way.
            </span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
