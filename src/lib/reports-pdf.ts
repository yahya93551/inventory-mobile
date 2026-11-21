import type { ProductMetric, ReportFilter, Sale } from '@/hooks/use-reports';

type ReportPdfData = {
  filter: ReportFilter;
  generatedAt: string;
  revenue: number;
  orders: number;
  average: number;
  topProduct: string | null;
  latestSale: Date | null;
  perUser: { name: string; total: number }[];
  perProduct: { name: string; quantity: number; unit: string | null }[];
  metrics: ProductMetric[];
  sales: Sale[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(value: number) {
  const amount = Math.abs(value);
  return value < 0 ? `-$${amount.toFixed(2)}` : `$${amount.toFixed(2)}`;
}

function metricQuantity(metric: ProductMetric, field: 'started' | 'stock_loaded' | 'sold' | 'returned' | 'remaining') {
  const value = metric[field];
  if (value === null || value === undefined) return '—';
  const unit = field === 'sold' || field === 'returned' ? metric.sold_unit_mode : undefined;
  const suffix = unit === 'converted' ? metric.converted_unit : metric.base_unit;
  return `${Number(value).toFixed(2)}${suffix ? ` ${suffix}` : ''}`;
}

function transactionDate(sale: Sale) {
  if (!sale.created_at) return 'Date unavailable';
  const date = new Date(sale.created_at);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-US', { timeZone: 'Africa/Mogadishu' });
}

export function createReportsHtml(data: ReportPdfData) {
  const filterLabel = data.filter === 'all' ? 'All time' : `Last ${data.filter === '7d' ? '7 days' : '30 days'}`;
  const perUserRows = data.perUser.map((item) => `
    <tr><td>${escapeHtml(item.name)}</td><td class="number">${money(item.total)}</td></tr>
  `).join('');
  const perProductRows = data.perProduct.map((item) => `
    <tr><td>${escapeHtml(item.name)}</td><td class="number">${Number(item.quantity).toFixed(2)} ${escapeHtml(item.unit || 'units')}</td></tr>
  `).join('');
  const metricRows = data.metrics.map((metric) => `
    <tr>
      <td>${escapeHtml(metric.product_name)}</td>
      <td class="number">${metricQuantity(metric, 'started')}</td>
      <td class="number">${metricQuantity(metric, 'stock_loaded')}</td>
      <td class="number">${metricQuantity(metric, 'sold')}</td>
      <td class="number">${metricQuantity(metric, 'returned')}</td>
      <td class="number">${metricQuantity(metric, 'remaining')}</td>
    </tr>
  `).join('');
  const salesRows = data.sales.map((sale) => {
    const total = Number(sale.total || 0);
    const signedTotal = sale.type === 'return' ? -Math.abs(total) : total;
    return `
      <tr>
        <td>${sale.type === 'return' ? 'Return: ' : ''}${escapeHtml(sale.product_name || 'Unknown product')}</td>
        <td class="number">${Number(sale.quantity || 0)} ${escapeHtml(sale.quantity_unit || 'units')}</td>
        <td class="number">${money(signedTotal)}</td>
        <td>${escapeHtml(transactionDate(sale))}</td>
      </tr>
    `;
  }).join('');

  return `<!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page { margin: 18mm 12mm; }
          body { font-family: Arial, sans-serif; color: #172033; font-size: 10px; }
          h1 { font-size: 22px; margin: 0 0 4px; }
          h2 { font-size: 14px; margin: 22px 0 8px; }
          p { color: #596579; margin: 4px 0; }
          .summary { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
          .stat { border: 1px solid #d5dce7; border-radius: 6px; padding: 9px; min-width: 115px; }
          .label { color: #596579; font-size: 9px; }
          .value { font-size: 14px; font-weight: 700; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          th, td { padding: 6px 5px; border-bottom: 1px solid #e3e7ed; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
          th { background: #f2f5f9; }
          .number { text-align: right; white-space: nowrap; }
          .empty { color: #596579; font-style: italic; }
        </style>
      </head>
      <body>
        <h1>Inventory Sales Report</h1>
        <p>Period: ${escapeHtml(filterLabel)}</p>
        <p>Generated: ${escapeHtml(data.generatedAt)}</p>
        <div class="summary">
          <div class="stat"><div class="label">Net revenue</div><div class="value">${money(data.revenue)}</div></div>
          <div class="stat"><div class="label">Sales orders</div><div class="value">${data.orders}</div></div>
          <div class="stat"><div class="label">Average order</div><div class="value">${money(data.average)}</div></div>
          <div class="stat"><div class="label">Top product</div><div class="value">${escapeHtml(data.topProduct || 'No sales')}</div></div>
          <div class="stat"><div class="label">Latest sale</div><div class="value">${escapeHtml(data.latestSale ? data.latestSale.toLocaleString('en-US', { timeZone: 'Africa/Mogadishu' }) : 'No sales')}</div></div>
        </div>
        <h2>Sales per user</h2>
        ${perUserRows ? `<table><thead><tr><th>User</th><th class="number">Net sales</th></tr></thead><tbody>${perUserRows}</tbody></table>` : '<p class="empty">No sales recorded in this period.</p>'}
        <h2>Sales per product</h2>
        ${perProductRows ? `<table><thead><tr><th>Product</th><th class="number">Net quantity sold</th></tr></thead><tbody>${perProductRows}</tbody></table>` : '<p class="empty">No product sales in this period.</p>'}
        <h2>Product inventory metrics</h2>
        ${metricRows ? `<table><thead><tr><th>Product</th><th class="number">Started</th><th class="number">Added</th><th class="number">Sold</th><th class="number">Returned</th><th class="number">Remaining</th></tr></thead><tbody>${metricRows}</tbody></table>` : '<p class="empty">No product inventory metrics.</p>'}
        <h2>Recent sales and returns (up to 10)</h2>
        ${salesRows ? `<table><thead><tr><th>Product</th><th class="number">Quantity</th><th class="number">Net total</th><th>Date</th></tr></thead><tbody>${salesRows}</tbody></table>` : '<p class="empty">No sales recorded in this period.</p>'}
      </body>
    </html>`;
}
