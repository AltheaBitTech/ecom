import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../common/config/env.validation';
import { sendTwilioMessage } from './twilio.util';

@Injectable()
export class WhatsAppService {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  async send(params: { to: string; body: string }): Promise<void> {
    const accountSid = this.config.get('TWILIO_ACCOUNT_SID', { infer: true });
    const authToken = this.config.get('TWILIO_AUTH_TOKEN', { infer: true });
    const from = this.config.get('TWILIO_WHATSAPP_FROM', { infer: true });
    if (!accountSid || !authToken || !from) {
      throw new Error('WhatsApp is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM missing)');
    }
    await sendTwilioMessage({ accountSid, authToken, from: `whatsapp:${from}`, to: `whatsapp:${params.to}`, body: params.body });
  }
}
