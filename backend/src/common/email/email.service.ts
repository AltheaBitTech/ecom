import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

import { AppConfig } from '../config/app-config';

interface Message {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Transactional email delivery for security flows: email verification, password
 * reset, and staff invitations. Links point at `APP_BASE_URL` by default, but
 * every method accepts an optional `origin` so tenant-scoped flows can send the
 * shopper to their own storefront (subdomain / custom domain) instead of the
 * platform default — closing the non-tenant-scoped verify-URL gap.
 *
 * Two transports (EMAIL_TRANSPORT):
 *   * `console` — logs the full message so local/dev flows can copy the link
 *      without a mail provider.
 *   * `smtp`    — real delivery via the SMTP_* connection.
 *
 * Secret tokens are delivered here and are never returned in API responses.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly baseUrl: string;
  private readonly consoleMode: boolean;

  constructor(config: AppConfig) {
    this.from = config.emailFrom;
    this.baseUrl = config.appBaseUrl.replace(/\/+$/, '');
    this.consoleMode = config.emailTransport === 'console';
    this.transporter = this.consoleMode
      ? null
      : createTransport({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpSecure,
          auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword } : undefined,
        });
  }

  async sendEmailVerification(to: string, token: string, origin?: string): Promise<void> {
    const url = this.link('/verify-email', token, origin);
    await this.send({
      to,
      subject: 'Verify your email address',
      text: `Confirm your email address by opening this link:\n${url}\n\nIf you did not create an account, you can ignore this message.`,
      html: this.wrap('Verify your email', 'Confirm your email address to activate your account.', 'Verify email', url),
    });
  }

  async sendPasswordReset(to: string, token: string, origin?: string): Promise<void> {
    const url = this.link('/reset-password', token, origin);
    await this.send({
      to,
      subject: 'Reset your password',
      text: `Reset your password using this link (valid for a limited time):\n${url}\n\nIf you did not request this, no action is needed.`,
      html: this.wrap('Reset your password', 'We received a request to reset your password.', 'Reset password', url),
    });
  }

  async sendStaffInvite(to: string, token: string, tenantName: string, origin?: string): Promise<void> {
    const url = this.link('/accept-invite', token, origin);
    await this.send({
      to,
      subject: `You've been invited to ${tenantName}`,
      text: `You have been invited to join ${tenantName}. Accept your invitation:\n${url}`,
      html: this.wrap(`Join ${tenantName}`, `You have been invited to join ${tenantName}.`, 'Accept invitation', url),
    });
  }

  // --- Internals -------------------------------------------------------------
  private link(path: string, token: string, origin?: string): string {
    const base = (origin ?? this.baseUrl).replace(/\/+$/, '');
    return `${base}${path}?token=${encodeURIComponent(token)}`;
  }

  private async send(msg: Message): Promise<void> {
    if (this.consoleMode || !this.transporter) {
      this.logger.warn(`[email:console] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, ...msg });
  }

  private wrap(heading: string, intro: string, cta: string, url: string): string {
    return `<div style="font-family:sans-serif;max-width:480px;margin:auto">
  <h2>${heading}</h2>
  <p>${intro}</p>
  <p><a href="${url}" style="background:#2ea44f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${cta}</a></p>
  <p style="color:#666;font-size:12px">If the button doesn't work, paste this URL into your browser:<br>${url}</p>
</div>`;
  }
}
