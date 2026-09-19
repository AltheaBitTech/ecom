'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Mail, MessageCircle, Send, Smartphone, ShieldCheck, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import type { AudiencePreview, Campaign, CampaignAudience, CampaignChannel, Customer } from '@/lib/types';

const CHANNELS: { key: CampaignChannel; label: string; icon: typeof Mail }[] = [
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'sms', label: 'SMS', icon: Smartphone },
];

const AUDIENCES: { key: CampaignAudience; label: string; hint: string }[] = [
  { key: 'all', label: 'Everyone opted in', hint: 'All customers who agreed to hear from you.' },
  { key: 'buyers', label: 'Past buyers', hint: 'Opted-in customers with at least one paid order.' },
  { key: 'prospects', label: 'Never ordered', hint: 'Opted in, but no paid order yet.' },
  { key: 'selected', label: 'Pick customers', hint: 'Choose individually from your opted-in list.' },
];

export default function MarketingPage() {
  const { hasPermission } = useAuth();
  const canSend = hasPermission(PERMISSIONS.MARKETING_SEND);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [channels, setChannels] = useState<CampaignChannel[]>(['email']);
  const [audience, setAudience] = useState<CampaignAudience>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  // Keyed by the request that produced it, so a stale count never shows against new choices.
  const [preview, setPreview] = useState<{ key: string; data: AudiencePreview } | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const loadCampaigns = useCallback(() => {
    api<Campaign[]>('/marketing/campaigns').then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  useEffect(() => {
    loadCampaigns();
    api<Customer[]>('/customers').then(setCustomers).catch(() => setCustomers([]));
  }, [loadCampaigns]);

  const askable = channels.length > 0 && (audience !== 'selected' || selected.size > 0);
  const previewKey = JSON.stringify({ audience, channels, ids: [...selected] });

  // Recipient count follows the audience/channel choices so the reach is never a surprise.
  useEffect(() => {
    if (!askable) return;
    let active = true;
    api<AudiencePreview>('/marketing/campaigns/preview', {
      method: 'POST',
      body: { audience, channels, customerIds: [...selected] },
    })
      .then((data) => { if (active) setPreview({ key: previewKey, data }); })
      .catch(() => { if (active) setPreview(null); });
    return () => { active = false; };
  }, [askable, previewKey, audience, channels, selected]);

  const shown = askable && preview?.key === previewKey ? preview.data : null;

  // A campaign still sending updates its counts in the background.
  useEffect(() => {
    if (!campaigns?.some((c) => c.status === 'SENDING')) return;
    const timer = setTimeout(loadCampaigns, 4000);
    return () => clearTimeout(timer);
  }, [campaigns, loadCampaigns]);

  function toggleChannel(key: CampaignChannel) {
    setChannels((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  }

  const reach = shown?.recipients ?? 0;
  const ready = canSend && subject.trim() && body.trim() && channels.length > 0 && reach > 0;

  async function send() {
    setSending(true);
    try {
      await api('/marketing/campaigns', {
        method: 'POST',
        body: { subject: subject.trim(), body: body.trim(), channels, audience, customerIds: [...selected] },
      });
      toast.success(`Sending to ${reach} customer${reach === 1 ? '' : 's'}`);
      setSubject('');
      setBody('');
      setSelected(new Set());
      setConfirming(false);
      loadCampaigns();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send the campaign');
    } finally {
      setSending(false);
    }
  }

  const optedIn = shown?.optedIn ?? 0;
  const totalCustomers = shown?.totalCustomers ?? 0;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
        <p className="text-muted-foreground">Broadcast an update over email, WhatsApp, or SMS.</p>
      </div>

      {shown && optedIn === 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-amber-600 dark:text-amber-500" />
              Nobody has opted in yet
            </CardTitle>
            <CardDescription>
              {totalCustomers === 0
                ? 'Campaigns go to customers who tick the updates box at checkout. Once you have opted-in customers, they show up here.'
                : `You have ${totalCustomers} customer${totalCustomers === 1 ? '' : 's'}, but none have agreed to marketing. Only shoppers who tick the box at checkout can be messaged — existing customers are never opted in for you.`}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New campaign</CardTitle>
          <CardDescription>Only opted-in customers receive this. Every message carries an unsubscribe link.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="campaign-subject">Subject</Label>
            <Input id="campaign-subject" value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} placeholder="Weekend specials are live" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="campaign-body">Message</Label>
            <Textarea id="campaign-body" value={body} maxLength={2000} rows={5} onChange={(e) => setBody(e.target.value)} placeholder="Tell your customers what's new. Keep it short — this goes out on WhatsApp and SMS too." />
            <p className="text-xs text-muted-foreground">{body.length}/2000 · Greeting and unsubscribe line are added for you.</p>
          </div>

          <div className="grid gap-2">
            <Label>Channels</Label>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((c) => {
                const on = channels.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleChannel(c.key)}
                    className={`flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm transition-colors ${on ? 'border-primary bg-primary/10 font-medium' : 'text-muted-foreground hover:bg-accent'}`}
                  >
                    <c.icon className="size-4" />
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">A customer with both an email and a phone gets it on each channel you pick.</p>
          </div>

          <div className="grid gap-2">
            <Label>Audience</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  aria-pressed={audience === a.key}
                  onClick={() => setAudience(a.key)}
                  className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${audience === a.key ? 'border-primary bg-primary/10' : 'hover:bg-accent'}`}
                >
                  <span className="font-medium">{a.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{a.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {audience === 'selected' && (
            <div className="grid gap-2">
              <Label>Customers</Label>
              {!customers ? (
                <Skeleton className="h-24" />
              ) : customers.filter((c) => c.marketingOptIn && !c.unsubscribedAt).length === 0 ? (
                <p className="text-sm text-muted-foreground">No opted-in customers to choose from yet.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-lg border">
                  {customers.filter((c) => c.marketingOptIn && !c.unsubscribedAt).map((c) => (
                    <label key={c.id} className="flex min-h-11 items-center gap-3 border-b px-3 text-sm last:border-0">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => setSelected((prev) => { const next = new Set(prev); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); return next; })}
                      />
                      <span>
                        {c.name}
                        <span className="block text-xs text-muted-foreground">{c.email ?? c.phone ?? 'No contact details'}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
            <p className="flex items-center gap-2 text-sm">
              <Users className="size-4 text-muted-foreground" />
              {shown === null ? (
                <span className="text-muted-foreground">Choose a channel and audience to see the reach.</span>
              ) : (
                <span>
                  <strong>{reach}</strong> recipient{reach === 1 ? '' : 's'}
                  {shown.unreachable > 0 && (
                    <span className="text-muted-foreground"> · {shown.unreachable} skipped, no address on the chosen channel{channels.length === 1 ? '' : 's'}</span>
                  )}
                </span>
              )}
            </p>
            <Button disabled={!ready} onClick={() => setConfirming(true)}>
              <Send className="size-4" />
              Review and send
            </Button>
          </div>
          {!canSend && <p className="text-sm text-muted-foreground">Your role can view campaigns but not send them.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sent campaigns</CardTitle>
          <CardDescription>What has already gone out, and how it landed.</CardDescription>
        </CardHeader>
        <CardContent>
          {!campaigns ? (
            <Skeleton className="h-32 w-full" />
          ) : campaigns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No campaigns sent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.subject}</TableCell>
                    <TableCell className="text-muted-foreground">{c.channels.join(', ')}</TableCell>
                    <TableCell className="text-muted-foreground">{AUDIENCES.find((a) => a.key === c.audience)?.label ?? c.audience}</TableCell>
                    <TableCell className="text-right">
                      {c.status === 'SENDING' ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Sending…</span>
                      ) : (
                        <>
                          {c.sentCount}/{c.recipientCount}
                          {c.failedCount > 0 && <Badge variant="destructive" className="ml-2">{c.failedCount} failed</Badge>}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirming} onOpenChange={(open) => { if (!open) setConfirming(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send to {reach} customer{reach === 1 ? '' : 's'}?</DialogTitle>
            <DialogDescription>
              Going out over {channels.join(', ')}. This cannot be recalled once sent.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="font-medium">{subject}</p>
            <p className="mt-2 whitespace-pre-line text-muted-foreground">{body}</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Back to editing</Button>
            <Button disabled={sending} onClick={send}>
              {sending && <Loader2 className="size-4 animate-spin" />}
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
