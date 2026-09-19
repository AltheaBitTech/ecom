import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../common/config/env.validation';

@Injectable()
export class EmailService {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  /** POSTs to Resend. Throws if unconfigured or the API rejects the send — callers must not let this fail their main flow. */
  async send(params: { to: string; subject: string; html: string }): Promise<void> {
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true });
    const from = this.config.get('RESEND_FROM_EMAIL', { infer: true });
    if (!apiKey || !from) throw new Error('Email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL missing)');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: params.to, subject: params.subject, html: params.html }),
    });
    if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
}
