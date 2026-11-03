import { Global, Module } from '@nestjs/common';

import { PasswordService } from './password.service';
import { SecretBox } from './secret-box';
import { TokenHashService } from './token-hash.service';

/**
 * Cryptographic primitives shared across features. Global so any module can
 * inject {@link SecretBox}, {@link PasswordService} or {@link TokenHashService}
 * without re-importing.
 */
@Global()
@Module({
  providers: [SecretBox, PasswordService, TokenHashService],
  exports: [SecretBox, PasswordService, TokenHashService],
})
export class CryptoModule {}
