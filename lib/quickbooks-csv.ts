// QuickBooks Online CSV export helpers.
//
// QBO's "Import Data" wizard accepts plain CSVs for Customers, Invoices, and
// (separately) for received Payments via the Bank Deposit / Sales Receipt
// flow. This module produces those CSVs from the FCM database.
//
// Schema reference: QBO Help → "Import multiple invoices at once" and
// "Import customers from a CSV". We stick to the lowest common denominator
// columns so the import works on both QBO Simple Start and Plus.

export interface CustomerRow {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export interface InvoiceRow {
  invoice_number: string;
  customer_name: string;
  invoice_date: string; // YYYY-MM-DD
  due_date: string | null;
  line_description: string;
  line_amount: number;
  line_qty: number | null;
  status: string;
}

export interface PaymentRow {
  customer_name: string;
  invoice_number: string;
  payment_date: string; // YYYY-MM-DD
  amount: number;
  method: string;
  reference: string | null;
}

function escapeCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  // RFC 4180 — escape if contains comma, quote, newline
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(headers: string[], rows: (string | number | null)[][]) {
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(r.map(escapeCell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export function customersToCsv(customers: CustomerRow[]): string {
  const headers = [
    "Name",
    "Email",
    "Phone",
    "Billing Address Line 1",
    "Billing City",
    "Billing State",
    "Billing ZIP",
  ];
  return rowsToCsv(
    headers,
    customers.map((c) => [
      c.name,
      c.email ?? "",
      c.phone ?? "",
      c.address ?? "",
      c.city ?? "",
      c.state ?? "",
      c.zip ?? "",
    ])
  );
}

export function invoicesToCsv(invoices: InvoiceRow[]): string {
  // QBO multi-line invoice import expects one row per line item.
  const headers = [
    "InvoiceNo",
    "Customer",
    "InvoiceDate",
    "DueDate",
    "ItemDescription",
    "ItemQuantity",
    "ItemAmount",
    "Status",
  ];
  return rowsToCsv(
    headers,
    invoices.map((i) => [
      i.invoice_number,
      i.customer_name,
      i.invoice_date,
      i.due_date ?? "",
      i.line_description,
      i.line_qty ?? 1,
      i.line_amount.toFixed(2),
      i.status,
    ])
  );
}

export function paymentsToCsv(payments: PaymentRow[]): string {
  // QBO's Bank Deposit import: one row per payment received.
  const headers = [
    "Customer",
    "InvoiceNo",
    "PaymentDate",
    "Amount",
    "PaymentMethod",
    "ReferenceNo",
  ];
  return rowsToCsv(
    headers,
    payments.map((p) => [
      p.customer_name,
      p.invoice_number,
      p.payment_date,
      p.amount.toFixed(2),
      p.method,
      p.reference ?? "",
    ])
  );
}
