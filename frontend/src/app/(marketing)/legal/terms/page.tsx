import type { Metadata } from 'next';
import { LegalPage } from '../_components/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <section>
        <h2>1. Acceptance of terms</h2>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your use of altheabit.com (the &quot;Site&quot;) and
          any purchase you make through it. By browsing the Site or placing an order, you agree to these
          Terms. If you do not agree, please do not use the Site.
        </p>
      </section>

      <section>
        <h2>2. Use of the Site</h2>
        <p>
          You may use the Site only for lawful purposes and in accordance with these Terms. You agree not to
          misuse the Site, attempt to gain unauthorized access to our systems, or interfere with its normal
          operation.
        </p>
      </section>

      <section>
        <h2>3. Orders, pricing, and availability</h2>
        <ul>
          <li>All prices are shown in the currency stated at checkout and may change without notice.</li>
          <li>
            Placing an order is an offer to buy; we may accept, decline, or cancel an order at our
            discretion — for example if an item is out of stock, priced in error, or payment cannot be
            verified.
          </li>
          <li>We will notify you if an order is cancelled or changed, and refund any amount already charged.</li>
          <li>
            Payments are processed by a third-party payment processor (Razorpay). We do not store your full
            card, UPI, or bank details on our servers.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Accounts</h2>
        <p>
          You may check out as a guest or create an account. If you create an account, you are responsible
          for keeping your login credentials confidential and for all activity that happens under your
          account. Tell us immediately if you suspect unauthorized use.
        </p>
      </section>

      <section>
        <h2>5. Shipping and risk of loss</h2>
        <p>
          Estimated delivery times shown at checkout are estimates, not guarantees. Risk of loss and title
          for items pass to you once an order is handed to the carrier, except where consumer protection law
          says otherwise.
        </p>
      </section>

      <section>
        <h2>6. Returns and refunds</h2>
        <p>
          Returns, exchanges, and refunds are handled under our{' '}
          <a href="/legal/refund-policy" className="text-foreground underline underline-offset-2">
            Refund &amp; Returns Policy
          </a>
          , which forms part of these Terms.
        </p>
      </section>

      <section>
        <h2>7. Limitation of liability</h2>
        <p>
          To the extent permitted by law, [Business legal name] is not liable for any indirect, incidental,
          or consequential damages arising from your use of the Site or purchase of products, and our total
          liability for any claim is limited to the amount you paid for the order giving rise to the claim.
          Nothing in these Terms excludes liability that cannot be excluded under applicable law.
        </p>
      </section>

      <section>
        <h2>8. Governing law</h2>
        <p>
          These Terms are governed by the laws of India, without regard to conflict-of-law principles.
          Disputes will be subject to the exclusive jurisdiction of the courts located at [Registered
          address / jurisdiction].
        </p>
      </section>

      <section>
        <h2>9. Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. Changes take effect once posted on this page, and the
          &quot;Last updated&quot; date above will reflect the most recent revision. Continuing to use the
          Site after a change means you accept the updated Terms.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>
          Questions about these Terms can be sent to{' '}
          <a href="mailto:support@altheabit.com" className="text-foreground underline underline-offset-2">
            support@altheabit.com
          </a>
          .
        </p>
        <p>
          Business: [Business legal name], [Registered address].
        </p>
      </section>
    </LegalPage>
  );
}
