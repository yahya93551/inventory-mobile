import type { BusinessSettings, Sale } from '@/hooks/use-sales';

export type ReceiptLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
};

export type ReceiptData = {
  business: BusinessSettings;
  invoiceNumber: string;
  date: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  items: ReceiptLine[];
};

export function receiptDataForSales(business: BusinessSettings, sales: Sale[]): ReceiptData {
  const firstSale = sales[0];
  if (!firstSale) {
    throw new Error('No sale items are available to create a receipt.');
  }

  const items = sales.map((sale) => {
    const quantity = Number(sale.quantity || 0);
    const total = Math.abs(Number(sale.total || 0));
    return {
      description: sale.product_name || 'Unknown product',
      quantity,
      unit: sale.quantity_unit || (sale.unit === 'converted' ? 'converted unit' : 'unit'),
      unitPrice: quantity > 0 ? total / quantity : 0,
      total,
    };
  });

  return {
    business,
    invoiceNumber: firstSale.order_id || '—',
    date: firstSale.created_at
      ? new Date(firstSale.created_at).toLocaleString('en-US', { timeZone: 'Africa/Mogadishu' })
      : 'Date unavailable',
    customerName: firstSale.customer_name,
    customerPhone: firstSale.customer_phone,
    customerAddress: firstSale.customer_address,
    items,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createReceiptHtml(receipt: ReceiptData) {
  const businessName = escapeHtml(receipt.business.business_name?.trim() || 'Business');
  const businessAddress = receipt.business.business_address?.trim();
  const businessContact =
    receipt.business.business_contact_phone?.trim() ||
    receipt.business.business_contact_email?.trim();
  const rows = receipt.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.description)}</td>
      <td>${item.quantity} ${escapeHtml(item.unit)}</td>
      <td class="number">$${item.unitPrice.toFixed(2)}</td>
      <td class="number">$${item.total.toFixed(2)}</td>
    </tr>
  `).join('');
  const grandTotal = receipt.items.reduce((sum, item) => sum + item.total, 0);

  return `<!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page { size: 80mm auto; margin: 3mm; }
          body { font-family: Arial, sans-serif; color: #111; width: 72mm; max-width: 100%; margin: 0 auto; font-size: 11px; }
          h1 { font-size: 17px; text-align: center; margin: 0 0 8px; }
          p { margin: 4px 0; overflow-wrap: anywhere; }
          .center { text-align: center; }
          .divider { border-top: 1px dashed #888; margin: 9px 0; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { padding: 5px 2px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
          th { border-bottom: 1px solid #888; }
          .number { text-align: right; }
          tfoot td { border-top: 1px solid #888; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>${businessName}</h1>
        ${businessAddress ? `<p class="center">${escapeHtml(businessAddress)}</p>` : ''}
        ${businessContact ? `<p class="center">${escapeHtml(businessContact)}</p>` : ''}
        <div class="divider"></div>
        <p><strong>Invoice:</strong> ${escapeHtml(receipt.invoiceNumber)}</p>
        <p><strong>Date:</strong> ${escapeHtml(receipt.date)}</p>
        <p><strong>Customer:</strong> ${escapeHtml(receipt.customerName?.trim() || 'Walk-in customer')}</p>
        ${receipt.customerPhone ? `<p><strong>Phone:</strong> ${escapeHtml(receipt.customerPhone)}</p>` : ''}
        ${receipt.customerAddress ? `<p><strong>Address:</strong> ${escapeHtml(receipt.customerAddress)}</p>` : ''}
        <div class="divider"></div>
        <table>
          <thead><tr><th>#</th><th>Item</th><th>Qty</th><th class="number">Price</th><th class="number">Total</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="4">Grand total</td><td class="number">$${grandTotal.toFixed(2)}</td></tr></tfoot>
        </table>
      </body>
    </html>`;
}
