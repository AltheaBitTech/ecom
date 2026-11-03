import type { PaymentIntent } from './types';

/** Minimal shape of the Razorpay Checkout global we depend on. */
interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (arg: unknown) => void) => void;
}

type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/** Load the Razorpay Checkout script once, resolving when the global is ready. */
function loadScript(): Promise<RazorpayCtor> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const onReady = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay failed to load')));
    if (existing) {
      existing.addEventListener('load', onReady);
      existing.addEventListener('error', () => reject(new Error('Razorpay failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = onReady;
    script.onerror = () => reject(new Error('Razorpay failed to load'));
    document.body.appendChild(script);
  });
}

/**
 * Open the Razorpay Checkout modal for a payment intent. Resolves with the
 * gateway callback fields (to be verified server-side) on success, rejects if the
 * shopper dismisses the modal or payment fails.
 */
export async function openRazorpayCheckout(
  intent: PaymentIntent,
  opts: { name: string; prefill?: { email?: string; contact?: string } },
): Promise<{ provider_order_id: string; provider_payment_id: string; signature: string }> {
  const Razorpay = await loadScript();
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: intent.public_key,
      order_id: intent.provider_order_id,
      amount: intent.amount_cents,
      currency: intent.currency,
      name: opts.name,
      prefill: opts.prefill,
      handler: (response: unknown) => {
        const r = response as RazorpayResponse;
        resolve({
          provider_order_id: r.razorpay_order_id,
          provider_payment_id: r.razorpay_payment_id,
          signature: r.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => reject(new Error('Payment was cancelled.')),
      },
    });
    rzp.on('payment.failed', () => reject(new Error('Payment failed. Please try again.')));
    rzp.open();
  });
}
