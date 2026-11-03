import { Injectable } from '@nestjs/common';

import { AppException } from '../../../common/errors/app-exception';

import { ManualShippingCarrier } from './manual.carrier';
import { ShipmojoCarrier } from './shipmojo.carrier';
import type { ShippingCarrier } from './shipping-carrier';
import { ShiprocketCarrier } from './shiprocket.carrier';

/**
 * Resolves a provider name to its carrier adapter. Adding a carrier is one line
 * here plus the adapter class — nothing else in the app changes.
 */
@Injectable()
export class CarrierRegistry {
  private readonly carriers: Map<string, ShippingCarrier>;

  constructor(shiprocket: ShiprocketCarrier, shipmojo: ShipmojoCarrier, manual: ManualShippingCarrier) {
    this.carriers = new Map([shiprocket, shipmojo, manual].map((c) => [c.provider, c]));
  }

  supported(): string[] {
    return [...this.carriers.keys()];
  }

  isSupported(provider: string): boolean {
    return this.carriers.has(provider);
  }

  get(provider: string): ShippingCarrier {
    const carrier = this.carriers.get(provider);
    if (!carrier) throw AppException.validation(`Unsupported shipping provider "${provider}".`);
    return carrier;
  }
}
