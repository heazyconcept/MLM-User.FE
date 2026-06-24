import { jsPDF } from 'jspdf';
import type { ReceiptResponse } from '../../services/invoice.service';

const MARGIN = 16;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function formatCurrency(amount: number, currency: 'NGN' | 'USD'): string {
  const symbol = currency === 'USD' ? '$' : 'NGN ';
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${symbol}${formatted}`;
}

function formatDate(iso: string, withTime = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-NG', {
    day: 'numeric',
    month: withTime ? 'short' : 'long',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

function getItemTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    ACTIVATION: 'Activation',
    UPGRADE: 'Upgrade',
    MERCHANT_REGISTRATION: 'Merchant',
    PRODUCT_PURCHASE: 'Product',
  };
  return labels[type] ?? type;
}

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (y + needed <= pageHeight - MARGIN) {
    return y;
  }
  pdf.addPage();
  return MARGIN;
}

function addLabelValueRow(
  pdf: jsPDF,
  y: number,
  label: string,
  value: string,
  valueBold = false,
): number {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(120, 120, 120);
  pdf.text(label, MARGIN, y);

  pdf.setFont('helvetica', valueBold ? 'bold' : 'normal');
  pdf.setTextColor(30, 30, 30);
  const lines = pdf.splitTextToSize(value, CONTENT_WIDTH * 0.58);
  pdf.text(lines, PAGE_WIDTH - MARGIN, y, { align: 'right' });

  return y + Math.max(6, lines.length * 5);
}

/** Build and save a receipt PDF from API data (no DOM capture required). */
export function downloadReceiptPdf(receipt: ReceiptResponse, filename: string): void {
  const pdf = new jsPDF('p', 'mm', 'a4');
  let y = MARGIN;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(30, 30, 30);
  pdf.text(receipt.company.name, MARGIN, y);
  y += 7;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(130, 130, 130);
  pdf.text('TRANSACTION RECEIPT', MARGIN, y);
  y += 8;

  pdf.setDrawColor(230, 230, 230);
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 10;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(30, 30, 30);
  pdf.text('Invoice', PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += 6;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(80, 80, 80);
  pdf.text(receipt.invoice.invoiceNumber, PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += 5;
  pdf.text(formatDate(receipt.invoice.date), PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += 5;
  pdf.text(`Status: ${receipt.invoice.status}`, PAGE_WIDTH - MARGIN, y, { align: 'right' });
  y += 10;

  if (receipt.company.address) {
    pdf.text(receipt.company.address, MARGIN, y);
    y += 5;
  }
  if (receipt.company.email) {
    pdf.text(receipt.company.email, MARGIN, y);
    y += 8;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(130, 130, 130);
  pdf.text('BILLED TO', MARGIN, y);
  y += 6;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(30, 30, 30);
  pdf.text(receipt.payer.name, MARGIN, y);
  y += 5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(80, 80, 80);
  pdf.text(receipt.payer.email, MARGIN, y);
  y += 5;
  if (receipt.payer.phone) {
    pdf.text(receipt.payer.phone, MARGIN, y);
    y += 5;
  }
  y += 4;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(130, 130, 130);
  pdf.text('PAYMENT DETAILS', MARGIN, y);
  y += 6;

  y = addLabelValueRow(pdf, y, 'Method', receipt.payment.method);
  y = addLabelValueRow(pdf, y, 'Reference', receipt.payment.reference);
  y = addLabelValueRow(pdf, y, 'Provider', receipt.payment.provider);
  if (receipt.payment.paidAt) {
    y = addLabelValueRow(pdf, y, 'Paid at', formatDate(receipt.payment.paidAt, true));
  }
  y += 4;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(130, 130, 130);
  pdf.text('ITEMS', MARGIN, y);
  y += 6;

  pdf.setDrawColor(230, 230, 230);
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 5;

  for (const item of receipt.items) {
    y = ensureSpace(pdf, y, 18);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(30, 30, 30);
    const descLines = pdf.splitTextToSize(item.description, CONTENT_WIDTH * 0.62);
    pdf.text(descLines, MARGIN, y);

    pdf.setFont('helvetica', 'bold');
    pdf.text(formatCurrency(item.totalPrice, receipt.totals.currency), PAGE_WIDTH - MARGIN, y, {
      align: 'right',
    });
    y += descLines.length * 5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text(
      `${getItemTypeLabel(item.type)} · Qty ${item.quantity} · ${formatCurrency(item.unitPrice, receipt.totals.currency)} each`,
      MARGIN,
      y,
    );
    y += 7;
  }

  y = ensureSpace(pdf, y, 24);
  pdf.setDrawColor(230, 230, 230);
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 7;

  y = addLabelValueRow(
    pdf,
    y,
    'Subtotal',
    formatCurrency(receipt.totals.subtotal, receipt.totals.currency),
  );

  if (receipt.totals.tax != null) {
    y = addLabelValueRow(pdf, y, 'Tax', formatCurrency(receipt.totals.tax, receipt.totals.currency));
  }
  if (receipt.totals.deliveryFee != null) {
    y = addLabelValueRow(
      pdf,
      y,
      'Delivery',
      formatCurrency(receipt.totals.deliveryFee, receipt.totals.currency),
    );
  }
  if (receipt.totals.discount != null) {
    y = addLabelValueRow(
      pdf,
      y,
      'Discount',
      `-${formatCurrency(receipt.totals.discount, receipt.totals.currency)}`,
    );
  }

  y += 2;
  pdf.setDrawColor(30, 30, 30);
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 7;
  y = addLabelValueRow(
    pdf,
    y,
    'Total',
    formatCurrency(receipt.totals.total, receipt.totals.currency),
    true,
  );

  y = ensureSpace(pdf, y, 16);
  y += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Thank you for your purchase!', PAGE_WIDTH / 2, y, { align: 'center' });
  y += 5;
  pdf.setFontSize(9);
  pdf.text('Keep this receipt for your records.', PAGE_WIDTH / 2, y, { align: 'center' });

  if (receipt.company.email) {
    y += 5;
    pdf.text(`Questions? Contact ${receipt.company.email}`, PAGE_WIDTH / 2, y, { align: 'center' });
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
