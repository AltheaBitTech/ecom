import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

import { AppConfig } from '../config/app-config';

/**
 * Password hashing with Argon2id + a server-side pepper.
 *
 *   * Argon2id is memory-hard — resistant to GPU/ASIC cracking.
 *   * The pepper is a secret mixed in before hashing. Unlike the per-hash salt
 *     (which Argon2 stores in the digest), the pepper lives only in the app's
 *     secret store, so a stolen database alone cannot be brute-forced offline.
 *   * The pepper is versioned: to rotate, add a new version and re-hash on next
 *     successful login. `passwordPepperVersion` on the user records which was used.
 */
@Injectable()
export class PasswordService {
  private readonly pepper: string;
  readonly pepperVersion: number;

  constructor(config: AppConfig) {
    this.pepper = config.passwordPepper;
    this.pepperVersion = config.passwordPepperVersion;
  }

  async hash(plain: string): Promise<string> {
    return argon2.hash(this.applyPepper(plain), {
      type: argon2.argon2id,
      memoryCost: 19_456, // 19 MiB — OWASP-recommended floor
      timeCost: 2,
      parallelism: 1,
    });
  }

  /**
   * Constant-time verification. `argon2.verify` returns false on mismatch and
   * throws only on a malformed digest, which we treat as a non-match.
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, this.applyPepper(plain));
    } catch {
      return false;
    }
  }

  /** True when a stored hash was made with an older pepper and should be re-hashed. */
  needsRehash(storedPepperVersion: number | null): boolean {
    return storedPepperVersion !== this.pepperVersion;
  }

  private applyPepper(plain: string): string {
    return plain + this.pepper;
  }
}
