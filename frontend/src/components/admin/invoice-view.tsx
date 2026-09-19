import { useState } from 'react';
import { Download, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { apiDownload, ApiError } from '@/lib/api';
import type { Invoice, Order } from '@/lib/types';
import { money } from '@/lib/storefront';

// Print stays a browser print (window.print + print CSS) — the PDF button below is for a file
// to actually hand someone. The CSS trick (visibility:hidden everywhere but #invoice-print)
// hides surrounding app chrome without touching layout files.
// customerEmail: pass this from the public storefront order-tracking page (no admin session
// there) — swaps in the email-verified customer-facing PDF route instead of the admin one.
export function InvoiceView({ invoice, order, customerEmail }: { invoice: Invoice; order: Order; customerEmail?: string }) {
  const [downloading, setDownloading] = useState(false);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const path = customerEmail
        ? `/orders/public/${order.id}/invoice/pdf?email=${encodeURIComponent(customerEmail)}`
        : `/orders/${order.id}/invoice/pdf`;
      await apiDownload(path, `${invoice.number}.pdf`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to download invoice');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <style>{`@media print {
        body * { visibility: hidden; }
        #invoice-print, #invoice-print * { visibility: visible; }
        #invoice-print { position: absolute; inset: 0; padding: 2rem; }
      }`}</style>
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <button
          type="button"
          onClick={downloadPdf}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download PDF
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <Printer className="size-4" />
          Print invoice
        </button>
      </div>
      <div id="invoice-print" className="rounded-lg border bg-background p-8 text-sm">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Invoice {invoice.number}</h2>
            <p className="text-muted-foreground">Issued {new Date(invoice.issuedAt).toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Billed to</p>
            <p className="font-medium">{invoice.billedToName}</p>
            {invoice.billedToGstin && <p className="text-muted-foreground">GSTIN {invoice.billedToGstin}</p>}
          </div>
        </div>

        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Unit price</th>
              <th className="py-2 text-right font-medium">Line total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((line) => (
              <tr key={line.id} className="border-b">
                <td className="py-2">
                  {line.product.name}
                  {line.variantLabel && <span className="text-muted-foreground"> ({line.variantLabel})</span>}
                </td>
                <td className="py-2 text-right">{line.quantity}</td>
                <td className="py-2 text-right">{money(line.unitPriceCents, invoice.currency)}</td>
                <td className="py-2 text-right">{money(line.lineTotalCents, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 grid gap-1.5 self-end text-sm sm:ml-auto sm:w-64">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{money(invoice.subtotalCents, invoice.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tax</dt>
            <dd>{money(invoice.taxCents, invoice.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd>{invoice.shippingCents ? money(invoice.shippingCents, invoice.currency) : 'Free'}</dd>
          </div>
          <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>{money(invoice.totalCents, invoice.currency)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
