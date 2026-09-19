import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export type Channel = (typeof CHANNELS)[number];

/**
 * Who a campaign goes to. Every option is filtered down to opted-in customers afterwards —
 * these only narrow the audience further, they can never widen it past consent.
 */
export const AUDIENCES = ['all', 'buyers', 'prospects', 'selected'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const campaignSchema = z
  .object({
    subject: z.string().trim().min(1).max(150),
    body: z.string().trim().min(1).max(2000),
    channels: z.array(z.enum(CHANNELS)).min(1).max(3),
    audience: z.enum(AUDIENCES),
    customerIds: z.array(z.string().min(1)).max(1000).default([]),
  })
  .strict()
  .refine((v) => v.audience !== 'selected' || v.customerIds.length > 0, 'Select at least one customer');

export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return result.data;
}
