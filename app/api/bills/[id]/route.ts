import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/lib/auth-config';

type BillItemInput = {
  id?: string;
  description?: string;
  quantity?: number;
  rate?: number;
};

type BillCompletionStatus = 'COMPLETED' | 'NOT_COMPLETED';
type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHERS';

type BillRow = {
  id: string;
  user_id: string;
  bill_number: string;
  bill_date: string;
  completion_date: string;
  business_name: string;
  business_phone: string | null;
  business_email: string | null;
  business_address: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  customer_gst_no: string | null;
  event_type?: string | null;
  event_dates?: string | null;
  notes: string | null;
  items: BillItemInput[] | null;
  discount_percent: number;
  tax_percent: number;
  advance_amount: number;
  payment_mode?: PaymentMode | null;
  payment_date?: string | null;
  transaction_reference?: string | null;
  paper_size?: 'A4' | 'A5' | null;
  show_payment_details?: boolean | null;
  show_terms_and_notes?: boolean | null;
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  tax_amount: number;
  grand_total: number;
  balance_amount: number;
  completion_status: BillCompletionStatus | null;
  created_at: string;
  updated_at: string;
};

type BillPayload = ReturnType<typeof normalizeBillPayload>;

const EXTENDED_BILL_COLUMNS = [
  'event_type',
  'event_dates',
  'payment_mode',
  'payment_date',
  'transaction_reference',
  'paper_size',
  'show_payment_details',
  'show_terms_and_notes',
] as const;

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase env is missing on server');
  }

  return createClient(supabaseUrl, supabaseKey);
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function pickValue<T>(body: Record<string, unknown>, key: string, fallback: T): unknown {
  return hasOwn(body, key) ? body[key] : fallback;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizePaymentMode(value: unknown): PaymentMode | null {
  return value === 'CASH' ||
    value === 'UPI' ||
    value === 'BANK_TRANSFER' ||
    value === 'CHEQUE' ||
    value === 'OTHERS'
    ? value
    : null;
}

function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function isExtendedBillColumnError(error: { code?: string; message?: string; details?: string } | null) {
  if (!error) return false;
  const text = `${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    EXTENDED_BILL_COLUMNS.some((column) => text.includes(column))
  );
}

function stripExtendedBillFields(payload: NonNullable<BillPayload>) {
  const {
    event_type,
    event_dates,
    payment_mode,
    payment_date,
    transaction_reference,
    paper_size,
    show_payment_details,
    show_terms_and_notes,
    ...legacyPayload
  } = payload;
  void event_type;
  void event_dates;
  void payment_mode;
  void payment_date;
  void transaction_reference;
  void paper_size;
  void show_payment_details;
  void show_terms_and_notes;
  return legacyPayload;
}

function normalizeBillPayload(body: Record<string, unknown>, fallback?: Partial<BillRow>) {
  const billNumber = pickValue(body, 'billNumber', fallback?.bill_number);
  const customerName = pickValue(body, 'customerName', fallback?.customer_name);
  const billDate = normalizeDate(pickValue(body, 'billDate', fallback?.bill_date));
  const completionDate = normalizeDate(pickValue(body, 'completionDate', fallback?.completion_date));

  if (
    typeof billNumber !== 'string' ||
    typeof customerName !== 'string' ||
    !billDate ||
    !completionDate
  ) {
    return null;
  }

  const items = Array.isArray(pickValue(body, 'items', fallback?.items || []))
    ? (pickValue(body, 'items', fallback?.items || []) as unknown[])
    : [];

  const balanceAmount = Number(pickValue(body, 'balanceAmount', fallback?.balance_amount ?? 0)) || 0;
  const completionStatus =
    pickValue(body, 'completionStatus', fallback?.completion_status) === 'COMPLETED' ||
    pickValue(body, 'completionStatus', fallback?.completion_status) === 'NOT_COMPLETED'
      ? (pickValue(body, 'completionStatus', fallback?.completion_status) as BillCompletionStatus)
      : balanceAmount <= 0
        ? 'COMPLETED'
        : 'NOT_COMPLETED';
  const paymentDate = normalizeDate(pickValue(body, 'paymentDate', fallback?.payment_date));
  const paperSize = pickValue(body, 'paperSize', fallback?.paper_size);
  const showPaymentDetails = normalizeBoolean(
    pickValue(body, 'showPaymentDetails', fallback?.show_payment_details ?? false)
  );
  const showTermsAndNotes = normalizeBoolean(
    pickValue(body, 'showTermsAndNotes', fallback?.show_terms_and_notes ?? false)
  );

  return {
    bill_number: billNumber,
    bill_date: billDate,
    completion_date: completionDate,
    business_name: String(pickValue(body, 'businessName', fallback?.business_name || '')),
    business_phone: normalizeOptionalString(
      pickValue(body, 'businessPhone', fallback?.business_phone ?? null)
    ),
    business_email: normalizeOptionalString(
      pickValue(body, 'businessEmail', fallback?.business_email ?? null)
    ),
    business_address: normalizeOptionalString(
      pickValue(body, 'businessAddress', fallback?.business_address ?? null)
    ),
    customer_name: customerName,
    customer_phone: normalizeOptionalString(
      pickValue(body, 'customerPhone', fallback?.customer_phone ?? null)
    ),
    customer_address: normalizeOptionalString(
      pickValue(body, 'customerAddress', fallback?.customer_address ?? null)
    ),
    customer_gst_no: normalizeOptionalString(
      pickValue(body, 'customerGstNo', fallback?.customer_gst_no ?? null)
    ),
    event_type: normalizeOptionalString(pickValue(body, 'eventType', fallback?.event_type ?? null)),
    event_dates: normalizeOptionalString(
      pickValue(body, 'eventDates', fallback?.event_dates ?? null)
    ),
    notes: normalizeOptionalString(pickValue(body, 'notes', fallback?.notes ?? null)),
    items: items.map((item) => {
      const typed = (item || {}) as BillItemInput;
      return {
        id: typed.id || undefined,
        description: String(typed.description || ''),
        quantity: Number(typed.quantity) || 0,
        rate: Number(typed.rate) || 0,
      };
    }),
    discount_percent: Number(
      pickValue(body, 'discountPercent', fallback?.discount_percent ?? 0)
    ) || 0,
    tax_percent: Number(pickValue(body, 'taxPercent', fallback?.tax_percent ?? 0)) || 0,
    advance_amount: Number(pickValue(body, 'advanceAmount', fallback?.advance_amount ?? 0)) || 0,
    payment_mode: normalizePaymentMode(
      pickValue(body, 'paymentMode', fallback?.payment_mode ?? null)
    ),
    payment_date: paymentDate,
    transaction_reference: normalizeOptionalString(
      pickValue(body, 'transactionReference', fallback?.transaction_reference ?? null)
    ),
    paper_size: paperSize === 'A4' || paperSize === 'A5' ? paperSize : null,
    show_payment_details: showPaymentDetails,
    show_terms_and_notes: showTermsAndNotes,
    subtotal: Number(pickValue(body, 'subtotal', fallback?.subtotal ?? 0)) || 0,
    discount_amount: Number(
      pickValue(body, 'discountAmount', fallback?.discount_amount ?? 0)
    ) || 0,
    taxable_amount: Number(pickValue(body, 'taxableAmount', fallback?.taxable_amount ?? 0)) || 0,
    tax_amount: Number(pickValue(body, 'taxAmount', fallback?.tax_amount ?? 0)) || 0,
    grand_total: Number(pickValue(body, 'grandTotal', fallback?.grand_total ?? 0)) || 0,
    balance_amount: balanceAmount,
    completion_status: completionStatus,
    updated_at: new Date().toISOString(),
  };
}

function mapBillRow(row: BillRow) {
  return {
    id: row.id,
    userId: row.user_id,
    billNumber: row.bill_number,
    billDate: row.bill_date,
    completionDate: row.completion_date,
    businessName: row.business_name,
    businessPhone: row.business_phone,
    businessEmail: row.business_email,
    businessAddress: row.business_address,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerAddress: row.customer_address,
    customerGstNo: row.customer_gst_no,
    eventType: row.event_type || '',
    eventDates: row.event_dates || '',
    notes: row.notes,
    items: Array.isArray(row.items) ? row.items : [],
    discountPercent: row.discount_percent,
    taxPercent: row.tax_percent,
    advanceAmount: row.advance_amount,
    paymentMode: row.payment_mode || 'CASH',
    paymentDate: row.payment_date || '',
    transactionReference: row.transaction_reference || '',
    paperSize: row.paper_size || 'A4',
    showPaymentDetails: row.show_payment_details ?? false,
    showTermsAndNotes: row.show_terms_and_notes ?? false,
    subtotal: row.subtotal,
    discountAmount: row.discount_amount,
    taxableAmount: row.taxable_amount,
    taxAmount: row.tax_amount,
    grandTotal: row.grand_total,
    balanceAmount: row.balance_amount,
    completionStatus:
      row.completion_status || (Number(row.balance_amount) <= 0 ? 'COMPLETED' : 'NOT_COMPLETED'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id;
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(mapBillRow(data as BillRow));
  } catch (error) {
    console.error('Error fetching bill:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch bill';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = (await req.json()) as Record<string, unknown>;
    const supabase = getServerSupabase();
    const { data: existingBill, error: existingBillError } = await supabase
      .from('bills')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (existingBillError) {
      throw existingBillError;
    }

    const payload = normalizeBillPayload(body, existingBill as BillRow);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid bill payload' }, { status: 400 });
    }

    let result = await supabase
      .from('bills')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (result.error && isExtendedBillColumnError(result.error)) {
      result = await supabase
        .from('bills')
        .update(stripExtendedBillFields(payload))
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .single();
    }

    if (result.error) {
      throw result.error;
    }

    return NextResponse.json(mapBillRow(result.data as BillRow));
  } catch (error) {
    console.error('Error updating bill:', error);
    const message = error instanceof Error ? error.message : 'Failed to update bill';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getServerSupabase();
    const { error } = await supabase.from('bills').delete().eq('id', id).eq('user_id', userId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bill:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete bill';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
