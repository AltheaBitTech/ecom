'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { Payment, PaymentStatus, Order } from '@/lib/types';

type PaymentRow = Payment & { order: Pick<Order, 'id' | 'createdAt'> & { customer: Order['customer'] } };

const statusVariant: Record<PaymentStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  PAID: 'default',
  FAILED: 'destructive',
  REFUNDED: 'outline',
};

function money(cents: number, currency: string) {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency });
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);

  useEffect(() => {
    api<PaymentRow[]>('/payments')
      .then(setPayments)
      .catch(() => toast.error('Failed to load payments'));
  }, []);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">Every payment attempt, verified straight from Razorpay webhooks.</p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Placed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments === null &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {payments?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No payments yet.
                </TableCell>
              </TableRow>
            )}
            {payments?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{p.order.id.slice(0, 8)}</TableCell>
                <TableCell className="font-medium">{p.order.customer.name}</TableCell>
                <TableCell>{money(p.amountCents, p.currency)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground capitalize">{p.provider}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(p.order.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
