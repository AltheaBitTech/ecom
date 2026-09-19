import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../common/config/env.validation';

/**
 * RazorpayX Payouts — sends a referral commission to a referrer's UPI VPA. Same auth as the
 * Payments module (RAZORPAY_KEY_ID/SECRET, Basic auth), plus the RazorpayX current account
 * number that funds payouts. Lazily built like every other external client in this codebase
 * (PaymentsService, notifications/*): unconfigured means send() throws, never blocks boot.
 *
 * ponytail: a new RazorpayX "contact" + "fund account" is created on every payout instead of
 * being cached/reused per referrer — correct, just wasteful of Razorpay's contact list.
 * Upgrade path: store the returned contact/fund_account ids on ReferralCode once created.
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  isConfigured(): boolean {
    return !!(
      this.config.get('RAZORPAY_KEY_ID', { infer: true }) &&
      this.config.get('RAZORPAY_KEY_SECRET', { infer: true }) &&
      this.config.get('RAZORPAYX_ACCOUNT_NUMBER', { infer: true })
    );
  }

  /** Pays `amountCents` to `vpa` for `referrerName`. Returns the RazorpayX payout id. Throws on any failure. */
  async payToVpa(params: { vpa: string; amountCents: number; referrerName: string; reference: string }): Promise<string> {
    const keyId = this.config.get('RAZORPAY_KEY_ID', { infer: true });
    const keySecret = this.config.get('RAZORPAY_KEY_SECRET', { infer: true });
    const accountNumber = this.config.get('RAZORPAYX_ACCOUNT_NUMBER', { infer: true });
    if (!keyId || !keySecret || !accountNumber) {
      throw new Error('RazorpayX payouts are not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAYX_ACCOUNT_NUMBER missing)');
    }
    const auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
    const json = (body: unknown) => JSON.stringify(body);
    const post = async (path: string, body: unknown) => {
      const res = await fetch(`https://api.razorpay.com/v1/${path}`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: json(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`RazorpayX ${path} failed: ${res.status} ${JSON.stringify(data)}`);
      return data as Record<string, unknown>;
    };

    const contact = await post('contacts', { name: params.referrerName, type: 'vendor', reference_id: params.reference });
    const fundAccount = await post('fund_accounts', {
      contact_id: contact.id,
      account_type: 'vpa',
      vpa: { address: params.vpa },
    });
    const payout = await post('payouts', {
      account_number: accountNumber,
      fund_account_id: fundAccount.id,
      amount: params.amountCents,
      currency: 'INR',
      mode: 'UPI',
      purpose: 'payout',
      reference_id: params.reference,
    });

    this.logger.log(`Paid ₹${(params.amountCents / 100).toFixed(2)} to ${params.vpa} (payout ${payout.id})`);
    return payout.id as string;
  }
}
