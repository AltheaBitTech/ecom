import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

function money(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** Whole rupees/dollars to words, Indian grouping (lakh/crore) — matches how Indian tax invoices print "Amount in Words". */
function numberToWords(n: number): string {
  const two = (v: number): string => (v < 20 ? ONES[v] : TENS[Math.floor(v / 10)] + (v % 10 ? '-' + ONES[v % 10] : ''));
  const three = (v: number): string => {
    const hundred = Math.floor(v / 100);
    const rest = v % 100;
    return (hundred ? `${ONES[hundred]} Hundred${rest ? ' ' : ''}` : '') + (rest ? two(rest) : '');
  };
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const rest = n % 1e3;
  return [crore && `${three(crore)} Crore`, lakh && `${three(lakh)} Lakh`, thousand && `${three(thousand)} Thousand`, rest && three(rest)]
    .filter(Boolean)
    .join(' ');
}

function amountInWords(cents: number, currency: string): string {
  const rupees = Math.floor(cents / 100);
  const paise = cents % 100;
  const words = numberToWords(rupees) || 'Zero';
  return paise ? `${currency} ${words} and ${numberToWords(paise)} Paise only` : `${currency} ${words} only`;
}

/** Tenant.billingAddress is a free-form JSON blob (no fixed shape enforced at write time) — render whatever string fields it has. */
function addressLines(addr: unknown): string[] {
  if (!addr || typeof addr !== 'object') return [];
  return Object.values(addr as Record<string, unknown>).filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

/**
 * India GST place-of-supply: same state as the seller → CGST+SGST (split evenly), different
 * state → IGST (full rate). Falls back to a single flat "GST" line when either state is
 * unknown — most tenants haven't set Tenant.state or an order shipped without one yet.
 */
type GstType = 'CGST+SGST' | 'IGST' | 'GST';
function resolveGstType(homeState: string | null | undefined, shipState: string | null | undefined): GstType {
  if (!homeState?.trim() || !shipState?.trim()) return 'GST';
  return homeState.trim().toLowerCase() === shipState.trim().toLowerCase() ? 'CGST+SGST' : 'IGST';
}
function gstRateLabel(gstType: GstType, gstRateBps: number): string {
  const rate = gstRateBps / 100;
  return gstType === 'CGST+SGST' ? `${(rate / 2).toFixed(1)}+${(rate / 2).toFixed(1)}%` : `${rate.toFixed(1)}%`;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Best-effort fetch of a tenant's logo for the invoice header — any failure (timeout, 404, non-image) just means no logo, not a broken invoice. */
  private async fetchLogo(url: string): Promise<Buffer | null> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  async findByOrder(tenantId: string, orderId: string) {
    const invoice = await this.prisma.forTenant(tenantId).invoice.findFirst({ where: { orderId } });
    if (!invoice) throw new NotFoundException('No invoice for this order yet');
    return invoice;
  }

  /** Idempotent: a second call for the same order (e.g. on-demand after auto-generation on fulfillment) returns the existing invoice. */
  async generateForOrder(tenantId: string, orderId: string) {
    const scoped = this.prisma.forTenant(tenantId);
    const existing = await scoped.invoice.findFirst({ where: { orderId } });
    if (existing) return existing;

    const order = await scoped.order.findFirst({ where: { id: orderId }, include: { customer: true } });
    if (!order) throw new NotFoundException('Order not found');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
    const tenantTag = tenant?.slug ?? tenantId.slice(0, 8);

    // Numbering is race-free: pg_advisory_xact_lock takes a per-tenant lock (hashtext of the
    // tenant id) for the life of this transaction, so a second concurrent generateForOrder call
    // for the same tenant blocks here until the first commits — it then re-checks for an
    // existing invoice (in case the concurrent call was for the same order) before computing its
    // own count()+1, so numbers can never collide and idempotency holds even under a race.
    const invoice = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;
      const raced = await tx.invoice.findFirst({ where: { orderId } });
      if (raced) return raced;
      const seq = (await tx.invoice.count({ where: { tenantId } })) + 1;
      const number = `INV-${tenantTag}-${String(seq).padStart(5, '0')}`;
      return tx.invoice.create({
        data: {
          tenantId,
          orderId: order.id,
          number,
          billedToName: order.customer.name,
          billedToGstin: null,
          subtotalCents: order.subtotalCents,
          taxCents: order.taxCents,
          shippingCents: order.shippingCents,
          totalCents: order.totalCents,
          currency: order.currency,
        },
      });
    });

    void this.notifications.notifyInvoiceReady(order, invoice);
    return invoice;
  }

  /**
   * Customer-facing equivalent of renderPdf: same trust model as OrdersService.findForCustomer —
   * the order id plus the email it was placed under is enough to prove ownership, no shopper
   * account system to check against. Resolves tenantId from the order, then delegates.
   */
  async renderPdfForCustomer(orderId: string, email: string): Promise<{ pdf: Buffer; number: string }> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customer: { email: { equals: email, mode: 'insensitive' } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    const invoice = await this.findByOrder(order.tenantId, orderId);
    const pdf = await this.renderPdf(order.tenantId, orderId);
    return { pdf, number: invoice.number };
  }

  /** Renders the order's invoice as a PDF buffer — logo mark, tenant/customer addresses, a bordered line-item table with per-line GST, amount in words, and a signatory block. */
  async renderPdf(tenantId: string, orderId: string): Promise<Buffer> {
    const invoice = await this.findByOrder(tenantId, orderId);
    const scoped = this.prisma.forTenant(tenantId);
    const [order, tenant] = await Promise.all([
      scoped.order.findFirst({ where: { id: orderId }, include: { items: { include: { product: true } }, customer: true } }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, legalName: true, gstin: true, pan: true, billingAddress: true, logoUrl: true, state: true },
      }),
    ]);
    if (!order) throw new NotFoundException('Order not found');

    // Best-effort: a broken or slow logo URL shouldn't fail invoice generation — fall back to the lettermark badge.
    const logoBuffer = tenant?.logoUrl ? await this.fetchLogo(tenant.logoUrl) : null;
    const shipState = (order.delivery as { state?: string } | null)?.state ?? null;
    const gstType = resolveGstType(tenant?.state, shipState);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = doc.x;
      const right = doc.page.width - doc.page.margins.right;
      const tenantName = tenant?.legalName ?? tenant?.name ?? 'Invoice';

      // Two side-by-side columns can't share doc's single y-cursor (each .text() call would clobber
      // the other column's position), so each column tracks its own y explicitly off a shared top.
      const headerTop = doc.y;
      let leftY = headerTop;
      let rightY = headerTop;

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, left, headerTop, { fit: [40, 40] });
        } catch {
          // Fetched fine but pdfkit couldn't decode it (unsupported format, corrupt bytes) — fall back to the badge.
          doc.roundedRect(left, headerTop, 40, 40, 6).fillAndStroke('#111827', '#111827');
          doc.fontSize(18).fillColor('#fff').text(tenantName.slice(0, 1).toUpperCase(), left, headerTop + 11, { width: 40, align: 'center' });
        }
      } else {
        doc.roundedRect(left, headerTop, 40, 40, 6).fillAndStroke('#111827', '#111827');
        doc.fontSize(18).fillColor('#fff').text(tenantName.slice(0, 1).toUpperCase(), left, headerTop + 11, { width: 40, align: 'center' });
      }

      doc.fillColor('#000').fontSize(16).text(tenantName, left + 50, leftY, { width: 260 });
      leftY = doc.y;
      doc.fontSize(8).fillColor('#555');
      for (const line of addressLines(tenant?.billingAddress)) {
        doc.text(line, left + 50, leftY, { width: 260 });
        leftY = doc.y;
      }
      if (tenant?.gstin) { doc.text(`GSTIN: ${tenant.gstin}`, left + 50, leftY, { width: 260 }); leftY = doc.y; }
      if (tenant?.pan) { doc.text(`PAN: ${tenant.pan}`, left + 50, leftY, { width: 260 }); leftY = doc.y; }
      leftY = Math.max(leftY, headerTop + 44); // clear the badge even with no address on file

      doc.fillColor('#000').font('Helvetica-Bold').fontSize(14).text('TAX INVOICE', left, rightY, { width: right - left, align: 'right' });
      rightY = doc.y;
      doc.font('Helvetica').fontSize(9).fillColor('#555');
      doc.text(`Invoice #: ${invoice.number}`, left, rightY, { width: right - left, align: 'right' });
      rightY = doc.y;
      doc.text(`Invoice Date: ${invoice.issuedAt.toLocaleDateString()}`, left, rightY, { width: right - left, align: 'right' });
      rightY = doc.y;
      doc.text(`Order #: ${order.id.slice(0, 8)}`, left, rightY, { width: right - left, align: 'right' });
      rightY = doc.y;

      doc.y = Math.max(leftY, rightY);
      doc.moveDown(1.5);

      const billTop = doc.y;
      let billLeftY = billTop;
      let billRightY = billTop;

      doc.fillColor('#000').font('Helvetica-Bold').fontSize(9).text('Billed to', left, billLeftY);
      billLeftY = doc.y;
      doc.font('Helvetica').text(invoice.billedToName, left, billLeftY);
      billLeftY = doc.y;
      if (order.customer.email) { doc.text(order.customer.email, left, billLeftY); billLeftY = doc.y; }
      if (order.customer.phone) { doc.text(order.customer.phone, left, billLeftY); billLeftY = doc.y; }
      if (invoice.billedToGstin) { doc.text(`GSTIN: ${invoice.billedToGstin}`, left, billLeftY); billLeftY = doc.y; }

      const delivery = order.delivery as { line?: string; city?: string; postalCode?: string } | null;
      if (delivery?.line) {
        doc.font('Helvetica-Bold').fontSize(9).text('Ship to', right - 200, billRightY, { width: 200 });
        billRightY = doc.y;
        doc.font('Helvetica').text(delivery.line, right - 200, billRightY, { width: 200 });
        billRightY = doc.y;
        doc.text([delivery.city, delivery.postalCode].filter(Boolean).join(' - '), right - 200, billRightY, { width: 200 });
        billRightY = doc.y;
      }

      doc.y = Math.max(billLeftY, billRightY);
      doc.moveDown();

      const cols = { sl: 20, item: 120, hsn: 40, qty: 25, unit: 55, rate: 50, type: 60, tax: 55, total: 70 };
      const tableWidth = Object.values(cols).reduce((a, b) => a + b, 0);
      const colX = (key: keyof typeof cols) => {
        const keys = Object.keys(cols) as (keyof typeof cols)[];
        return left + keys.slice(0, keys.indexOf(key)).reduce((sum, k) => sum + cols[k], 0);
      };
      const rowHeight = 24;
      const drawRow = (cells: string[], opts?: { bold?: boolean; header?: boolean }) => {
        const y = doc.y;
        if (opts?.header) doc.rect(left, y, tableWidth, rowHeight).fill('#f3f4f6').fillColor('#000');
        doc.font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor('#000');
        const keys = Object.keys(cols) as (keyof typeof cols)[];
        keys.forEach((key, i) => {
          const align = i === 1 ? 'left' : 'right';
          doc.text(cells[i], colX(key) + 4, y + 6, { width: cols[key] - (i === 1 ? 4 : 8), align });
        });
        doc.rect(left, y, tableWidth, rowHeight).stroke('#d1d5db');
        keys.forEach((key) => doc.moveTo(colX(key), y).lineTo(colX(key), y + rowHeight).stroke('#d1d5db'));
        doc.y = y + rowHeight;
      };

      drawRow(['#', 'Item', 'HSN', 'Qty', 'Unit price', 'Rate', 'Type', 'Tax', 'Total'], { header: true, bold: true });
      order.items.forEach((line, i) => {
        const name = line.variantLabel ? `${line.product.name} (${line.variantLabel})` : line.product.name;
        const gstRateBps = line.product.gstRateBps ?? 0;
        const taxCents = Math.round((line.lineTotalCents * gstRateBps) / 10000);
        drawRow([
          String(i + 1),
          name,
          line.product.hsnCode ?? '-',
          String(line.quantity),
          money(line.unitPriceCents, invoice.currency),
          gstRateLabel(gstType, gstRateBps),
          gstType,
          money(taxCents, invoice.currency),
          money(line.lineTotalCents + taxCents, invoice.currency),
        ]);
      });

      doc.moveDown();
      const totalsX = left + tableWidth - 220;
      const totalsWidth = 220;
      const totalRow = (label: string, value: string, opts?: { bold?: boolean }) => {
        doc.font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts?.bold ? 11 : 9);
        doc.text(label, totalsX, doc.y, { continued: true, width: totalsWidth - 90 });
        doc.text(value, { width: 90, align: 'right' });
      };
      totalRow('Subtotal', money(invoice.subtotalCents, invoice.currency));
      if (gstType === 'CGST+SGST') {
        // Split evenly; give the odd cent (if any) to CGST so the two lines always add back to invoice.taxCents.
        const half = Math.floor(invoice.taxCents / 2);
        totalRow('CGST', money(invoice.taxCents - half, invoice.currency));
        totalRow('SGST', money(half, invoice.currency));
      } else {
        totalRow(gstType === 'IGST' ? 'IGST' : 'Tax (GST)', money(invoice.taxCents, invoice.currency));
      }
      totalRow('Shipping', invoice.shippingCents ? money(invoice.shippingCents, invoice.currency) : 'Free');
      doc.moveTo(totalsX, doc.y).lineTo(totalsX + totalsWidth, doc.y).stroke();
      doc.moveDown(0.3);
      totalRow('Total', money(invoice.totalCents, invoice.currency), { bold: true });

      doc.moveDown(1.5);
      doc.font('Helvetica-Bold').fontSize(8).text('Amount in words:', left);
      doc.font('Helvetica').text(amountInWords(invoice.totalCents, invoice.currency), left);

      doc.moveDown(2);
      const sigY = doc.y;
      doc.fontSize(9).text(`For ${tenantName}`, right - 200, sigY, { width: 200, align: 'right' });
      doc.moveDown(2.5);
      doc.text('Authorized Signatory', right - 200, doc.y, { width: 200, align: 'right' });

      doc.end();
    });
  }
}
