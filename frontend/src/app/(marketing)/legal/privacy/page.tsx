import type { Metadata } from 'next';
import { LegalPage } from '../_components/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <section>
        <h2>1. What this policy covers</h2>
        <p>
          This policy describes how altheabit.com collects, uses, and shares information when you browse the
          Site, create an account, or place an order — as a guest or a registered customer.
        </p>
      </section>

      <section>
        <h2>2. Information we collect</h2>
        <ul>
          <li>
            <strong>Account information:</strong> name, email address, and password (stored as a hash, not
            in plain text) if you register.
          </li>
          <li>
            <strong>Order information:</strong> shipping and billing address, phone number, items ordered,
            and order history.
          </li>
          <li>
            <strong>Payment metadata:</strong> payment status, transaction ID, and payment method type. We
            do not collect or store your full card number, CVV, or bank credentials — payments are handled
            directly by our payment processor (Razorpay), which is subject to its own privacy and security
            practices.
          </li>
          <li>
            <strong>Usage data:</strong> basic technical information such as IP address, browser type, and
            pages visited, collected automatically when you use the Site.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. How we use this information</h2>
        <ul>
          <li>To process and fulfil your orders, including shipping and customer support.</li>
          <li>To create and manage your account, if you choose to register.</li>
          <li>To communicate with you about orders, account activity, or support requests.</li>
          <li>To detect and prevent fraud, abuse, and technical issues.</li>
          <li>To improve the Site and understand how it is used.</li>
        </ul>
      </section>

      <section>
        <h2>4. Who we share it with</h2>
        <p>We share information only with service providers who help us run the Site, including:</p>
        <ul>
          <li>A payment processor, to process payments and prevent fraud.</li>
          <li>A hosting and infrastructure provider, to store data and run the Site.</li>
          <li>A shipping or logistics partner, to deliver your order.</li>
        </ul>
        <p>
          We do not sell your personal information. We may disclose information if required by law or to
          protect our rights, users, or the public.
        </p>
      </section>

      <section>
        <h2>5. Cookies</h2>
        <p>
          The Site uses cookies and similar technologies to keep you signed in, remember your cart, and
          understand how the Site is used. You can control cookies through your browser settings; disabling
          them may affect features like staying logged in or keeping items in your cart.
        </p>
      </section>

      <section>
        <h2>6. Data retention</h2>
        <p>
          We keep account and order information for as long as your account is active or as needed to
          fulfil orders, meet legal and tax obligations, resolve disputes, and enforce our agreements. When
          information is no longer needed for these purposes, we take reasonable steps to delete or
          anonymize it.
        </p>
      </section>

      <section>
        <h2>7. Your rights</h2>
        <p>
          You can ask us to access, correct, or delete the personal information we hold about you, or ask
          questions about how it is used, by contacting us using the details below. We will respond to
          reasonable requests within a reasonable time.
        </p>
      </section>

      <section>
        <h2>8. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Changes take effect once posted on this page, and the
          &quot;Last updated&quot; date above will reflect the most recent revision.
        </p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>
          Questions about this policy can be sent to{' '}
          <a href="mailto:support@altheabit.com" className="text-foreground underline underline-offset-2">
            support@altheabit.com
          </a>
          .
        </p>
        <p>Business: [Business legal name], [Registered address].</p>
      </section>
    </LegalPage>
  );
}
