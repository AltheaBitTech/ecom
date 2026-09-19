import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

// UPI VPA: <handle>@<psp>, e.g. jane@okhdfcbank — format-only, no bank-side verification.
const VPA_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{2,64}$/;

export class SetPayoutVpaDto {
  @ApiProperty({
    required: false,
    example: 'jane@okhdfcbank',
    description: 'UPI VPA referral commissions should be paid out to. Omit/null to clear it.',
  })
  @IsOptional()
  @Matches(VPA_REGEX, { message: 'payoutVpa must be a valid UPI VPA, e.g. name@bank' })
  payoutVpa?: string | null;
}
