import { Check, PackageX, Truck, HandHeart, CircleAlert, Clock } from 'lucide-react';
import type { OrderStatus } from '@/lib/types';

const STEPS = [
  { status: 'PENDING', label: 'Order\nPlaced', Icon: Clock },
  { status: 'CONFIRMED', label: 'Order\nConfirmed', Icon: Check },
  { status: 'SHIPPED', label: 'Order\nShipped', Icon: Truck },
  { status: 'FULFILLED', label: 'Out for\nDelivery', Icon: HandHeart },
] as const satisfies readonly { status: OrderStatus; label: string; Icon: typeof Check }[];

/**
 * Circular step tracker: each node is an icon in a ring, joined by a rail that fills as the
 * order advances. A cancelled order keeps the steps it actually reached and drops a red
 * "cancelled" node right after them, so the timeline still shows how far the order got.
 *
 * Plain Tailwind, no shadcn — it drops into admin and storefront pages alike.
 */
export function OrderTimeline({
  status,
  events,
  cancelReason,
}: {
  status: OrderStatus;
  events?: { status: OrderStatus }[];
  cancelReason?: string | null;
}) {
  const cancelled = status === 'CANCELLED';
  // Once cancelled, the status column no longer says how far the order got — the event history
  // does. Fall back to the first step when no history was passed.
  const reachedIdx = cancelled
    ? Math.max(0, ...(events ?? []).map((e) => STEPS.findIndex((s) => s.status === e.status)))
    : STEPS.findIndex((s) => s.status === status);
  const currentIdx = reachedIdx;

  return (
    <div>
      <ol className="flex items-start" aria-label={`Order status: ${cancelled ? 'cancelled' : STEPS[currentIdx]?.label.replace('\n', ' ')}`}>
        {STEPS.map((step, i) => {
          // A cancelled order has no live step, so the step it stopped on reads as completed
          // rather than as the one still in progress.
          const reached = i <= currentIdx;
          const current = i === currentIdx && !cancelled;
          const done = reached && !current;
          const Icon = done ? Check : step.Icon;
          return (
            <li key={step.status} className="flex flex-1 items-start last:flex-none">
              <div className="flex w-16 shrink-0 flex-col items-center gap-2 sm:w-20">
                <span
                  className={[
                    'flex size-11 items-center justify-center rounded-full border-2 transition-all duration-500 sm:size-12',
                    reached
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/25 bg-background text-muted-foreground/60',
                    current ? 'ring-4 ring-primary/20' : '',
                  ].join(' ')}
                >
                  {/* The live step breathes; completed steps sit still. */}
                  <Icon className={`size-5 ${current ? 'animate-pulse' : ''}`} strokeWidth={2.2} />
                </span>
                <span className={`whitespace-pre-line text-center text-[11px] leading-tight sm:text-xs ${reached ? 'font-semibold' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <span className="relative mt-5 flex h-0.5 flex-1 items-center sm:mt-6">
                  <span className="absolute inset-0 rounded-full bg-muted-foreground/20" />
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700 ease-out"
                    style={{ width: i < currentIdx ? '100%' : '0%' }}
                  />
                  {/* The cancellation marker interrupts the rail exactly where the order stopped. */}
                  {cancelled && i === currentIdx && (
                    <span className="absolute left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-destructive text-white shadow-sm">
                      <CircleAlert className="size-4" strokeWidth={2.5} />
                    </span>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {cancelled && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive text-white">
            <PackageX className="size-5" strokeWidth={2.2} />
          </span>
          <span>
            <strong className="block font-semibold text-destructive">Order cancelled</strong>
            <span className="text-muted-foreground">{cancelReason || 'This order was cancelled. Any deducted stock has been returned.'}</span>
          </span>
        </div>
      )}
    </div>
  );
}
