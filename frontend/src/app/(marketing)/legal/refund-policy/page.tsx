import type { Metadata } from 'next';
import { LegalPage } from '../_components/legal-page';

export const metadata: Metadata = {
  title: 'Refund & Returns Policy',
};

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund & Returns Policy">
      <section>
        <h2>1. Return window</h2>
        <p>
          Most items can be returned within [X] days of delivery. To start a return, contact us at{' '}
          <a href="mailto:support@altheabit.com" className="text-foreground underline underline-offset-2">
            support@altheabit.com
          </a>{' '}
          with your order number and reason for return.
        </p>
      </section>

      <section>
        <h2>2. Condition requirements</h2>
        <ul>
          <li>Items must be unused, unworn, and in their original packaging with tags attached.</li>
          <li>Proof of purchase (order confirmation or order number) is required.</li>
          <li>Items that show signs of use, damage not caused by us, or missing packaging may be refused.</li>
        </ul>
      </section>

      <section>
        <h2>3. Non-returnable items</h2>
        <p>The following are not eligible for return unless defective or damaged on arrival:</p>
        <ul>
          <li>Perishable, personal-care, or hygiene-sensitive items.</li>
          <li>Items marked as final sale or clearance at the time of purchase.</li>
          <li>Gift cards.</li>
        </ul>
      </section>

      <section>
        <h2>4. Damaged, defective, or wrong items</h2>
        <p>
          If an item arrives damaged, defective, or different from what you ordered, contact us within [X]
          days of delivery with photos of the item and packaging. We will arrange a replacement, exchange,
          or full refund at no extra cost to you.
        </p>
      </section>

      <section>
        <h2>5. How refunds are processed</h2>
        <ul>
          <li>Once we receive and inspect a return, we will notify you whether it has been approved.</li>
          <li>
            Approved refunds are issued to the original payment method through our payment processor
            (Razorpay), typically within [X] business days of approval. It may take a few additional
            business days for the refund to appear, depending on your bank or card issuer.
          </li>
          <li>Original shipping charges are non-refundable unless the return is due to our error.</li>
          <li>Return shipping costs are the customer&apos;s responsibility unless the item was damaged, defective, or incorrect.</li>
        </ul>
      </section>

      <section>
        <h2>6. Exchanges</h2>
        <p>
          If you need a different size, color, or variant, the fastest option is usually to return the
          original item for a refund and place a new order. Contact us if you would like help arranging an
          exchange instead.
        </p>
      </section>

      <section>
        <h2>7. Disputes</h2>
        <p>
          If you are not satisfied with how a return or refund was handled, contact us first at{' '}
          <a href="mailto:support@altheabit.com" className="text-foreground underline underline-offset-2">
            support@altheabit.com
          </a>{' '}
          so we can try to resolve it directly. This policy does not limit any rights you have under
          applicable consumer protection law.
        </p>
      </section>

      <section>
        <h2>8. Contact</h2>
        <p>Business: [Business legal name], [Registered address].</p>
      </section>
    </LegalPage>
  );
}
