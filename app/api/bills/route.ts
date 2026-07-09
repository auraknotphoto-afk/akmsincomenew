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
  notes: string | null;
  items: BillItemInput[] | null;
  discount_percent: number;
  tax_percent: number;
  advance_amount: number;
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

function normalizeBillPayload(body: Record<string, unknown>, userId: string) {
  const billDate = normalizeDate(body.billDate);
  const completionDate = normalizeDate(body.completionDate);

  if (
    typeof body.billNumber !== 'string' ||
    typeof body.customerName !== 'string' ||
    !billDate ||
    !completionDate
  ) {
    return null;
  }

  const items = Array.isArray(body.items) ? body.items : [];

  const balanceAmount = Number(body.balanceAmount) || 0;
  const completionStatus =
    body.completionStatus === 'COMPLETED' || body.completionStatus === 'NOT_COMPLETED'
      ? (body.completionStatus as BillCompletionStatus)
      : balanceAmount <= 0
        ? 'COMPLETED'
        : 'NOT_COMPLETED';

  return {
    user_id: userId,
    bill_number: body.billNumber,
    bill_date: billDate,
    completion_date: completionDate,
    business_name: String(body.businessName || ''),
    business_phone: body.businessPhone ? String(body.businessPhone) : null,
    business_email: body.businessEmail ? String(body.businessEmail) : null,
    business_address: body.businessAddress ? String(body.businessAddress) : null,
    customer_name: body.customerName,
    customer_phone: body.customerPhone ? String(body.customerPhone) : null,
    customer_address: body.customerAddress ? String(body.customerAddress) : null,
    customer_gst_no: body.customerGstNo ? String(body.customerGstNo) : null,
    notes: body.notes ? String(body.notes) : null,
    items: items.map((item) => {
      const typed = (item || {}) as BillItemInput;
      return {
        id: typed.id || undefined,
        description: String(typed.description || ''),
        quantity: Number(typed.quantity) || 0,
        rate: Number(typed.rate) || 0,
      };
    }),
    discount_percent: Number(body.discountPercent) || 0,
    tax_percent: Number(body.taxPercent) || 0,
    advance_amount: Number(body.advanceAmount) || 0,
    subtotal: Number(body.subtotal) || 0,
    discount_amount: Number(body.discountAmount) || 0,
    taxable_amount: Number(body.taxableAmount) || 0,
    tax_amount: Number(body.taxAmount) || 0,
    grand_total: Number(body.grandTotal) || 0,
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
    notes: row.notes,
    items: Array.isArray(row.items) ? row.items : [],
    discountPercent: row.discount_percent,
    taxPercent: row.tax_percent,
    advanceAmount: row.advance_amount,
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

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customer = req.nextUrl.searchParams.get('customer')?.trim();
    const search = req.nextUrl.searchParams.get('search')?.trim();
    const supabase = getServerSupabase();

    let query = supabase
      .from('bills')
      .select('*')
      .eq('user_id', userId)
      .order('bill_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (customer) {
      query = query.eq('customer_name', customer);
    }

    if (search) {
      query = query.or(
        `bill_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json(((data || []) as BillRow[]).map(mapBillRow));
  } catch (error) {
    console.error('Error fetching bills:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch bills';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const payload = normalizeBillPayload(body, userId);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid bill payload' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('bills')
      .upsert(payload, {
        onConflict: 'user_id,bill_number',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(mapBillRow(data as BillRow), { status: 201 });
  } catch (error) {
    console.error('Error saving bill:', error);
    const message = error instanceof Error ? error.message : 'Failed to save bill';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
