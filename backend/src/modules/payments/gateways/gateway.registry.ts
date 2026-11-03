import { Injectable } from '@nestjs/common';

import { AppException } from '../../../common/errors/app-exception';

import { ManualGateway } from './manual.gateway';
import type { PaymentGateway } from './payment-gateway';
import { RazorpayGateway } from './razorpay.gateway';

/**
 * Resolves a provider name to its adapter. Adding a gateway is one line here plus
 * the adapter class — no changes to the service that uses it.
 */
@Injectable()
export class PaymentGatewayRegistry {
  private readonly gateways: Map<string, PaymentGateway>;

  constructor(razorpay: RazorpayGateway, manual: ManualGateway) {
    this.gateways = new Map([razorpay, manual].map((g) => [g.provider, g]));
  }

  /** The set of provider names a tenant may configure. */
  supported(): string[] {
    return [...this.gateways.keys()];
  }

  isSupported(provider: string): boolean {
    return this.gateways.has(provider);
  }

  get(provider: string): PaymentGateway {
    const gateway = this.gateways.get(provider);
    if (!gateway) {
      throw AppException.validation(`Unsupported payment provider "${provider}".`);
    }
    return gateway;
  }
}
