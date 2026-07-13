import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/lib/auth-config';

type BackupJob = Record<string, unknown>;
type BackupTemplate = Record<string, unknown>;
type BackupBill = Record<string, unknown>;

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

function normalizeJob(userId: string, job: BackupJob) {
  return {
    id: String(job.id || crypto.randomUUID()),
    user_id: userId,
    category:
      String(job.category || 'ADDON') === 'OTHER'
        ? 'ADDON'
        : String(job.category || 'ADDON'),
    customer_name: String(job.customer_name || ''),
    customer_phone: job.customer_phone ? String(job.customer_phone) : null,
    event_details: job.event_details ? String(job.event_details) : null,
    client_name: job.client_name ? String(job.client_name) : null,
    studio_name: job.studio_name ? String(job.studio_name) : null,
    event_type: job.event_type ? String(job.event_type) : null,
    event_location: job.event_location ? String(job.event_location) : null,
    start_date: String(job.start_date || new Date().toISOString().slice(0, 10)),
    end_date: job.end_date ? String(job.end_date) : null,
    estimated_due_date: job.estimated_due_date ? String(job.estimated_due_date) : null,
    priority: job.priority ? String(job.priority) : null,
    session_type: job.session_type ? String(job.session_type) : null,
    exposure_type: job.exposure_type ? String(job.exposure_type) : null,
    expose_type: job.expose_type ? String(job.expose_type) : null,
    number_of_cameras:
      typeof job.number_of_cameras === 'number' ? job.number_of_cameras : null,
    camera_type: job.camera_type ? String(job.camera_type) : null,
    duration_hours: typeof job.duration_hours === 'number' ? job.duration_hours : null,
    rate_per_hour: typeof job.rate_per_hour === 'number' ? job.rate_per_hour : null,
    type_of_work: job.type_of_work ? String(job.type_of_work) : null,
    additional_work_type: job.additional_work_type ? String(job.additional_work_type) : null,
    additional_work_custom: job.additional_work_custom ? String(job.additional_work_custom) : null,
    additional_work_rate:
      typeof job.additional_work_rate === 'number' ? job.additional_work_rate : null,
    expense: typeof job.expense === 'number' ? job.expense : Number(job.expense || 0),
    total_price: Number(job.total_price || 0),
    amount_paid: Number(job.amount_paid || 0),
    payment_status: String(job.payment_status || 'PENDING'),
    payment_date: job.payment_date ? String(job.payment_date) : null,
    status: String(job.status || 'PENDING'),
    notes: job.notes ? String(job.notes) : null,
    is_deleted: Boolean(job.is_deleted),
    deleted_at: job.deleted_at ? String(job.deleted_at) : null,
    created_at: job.created_at ? String(job.created_at) : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function normalizeTemplate(userId: string, template: BackupTemplate) {
  return {
    user_id: userId,
    category:
      String(template.category || 'EXPOSING') === 'OTHER'
        ? 'ADDON'
        : String(template.category || 'EXPOSING'),
    template_type: String(template.template_type || 'JOB_STATUS'),
    status_key: String(template.status_key || 'PENDING'),
    template_text: String(template.template_text || ''),
    updated_at: new Date().toISOString(),
  };
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeDateString(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function normalizePaymentMode(value: unknown) {
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

function stripExtendedBillFields<T extends Record<string, unknown>>(bill: T) {
  const {
    event_type,
    event_dates,
    payment_mode,
    payment_date,
    transaction_reference,
    paper_size,
    show_payment_details,
    show_terms_and_notes,
    ...legacyBill
  } = bill;
  void event_type;
  void event_dates;
  void payment_mode;
  void payment_date;
  void transaction_reference;
  void paper_size;
  void show_payment_details;
  void show_terms_and_notes;
  return legacyBill;
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

function normalizeBill(userId: string, bill: BackupBill) {
  const balanceAmount = Number(bill.balance_amount ?? bill.balanceAmount ?? 0);
  return {
    id: String(bill.id || crypto.randomUUID()),
    user_id: userId,
    bill_number: String(bill.bill_number || bill.billNumber || `BILL-${Date.now()}`),
    bill_date: String(bill.bill_date || bill.billDate || new Date().toISOString().slice(0, 10)),
    completion_date: String(
      bill.completion_date || bill.completionDate || new Date().toISOString().slice(0, 10)
    ),
    business_name: String(bill.business_name || bill.businessName || 'Aura Knot Photography'),
    business_phone: bill.business_phone ? String(bill.business_phone) : bill.businessPhone ? String(bill.businessPhone) : null,
    business_email: bill.business_email ? String(bill.business_email) : bill.businessEmail ? String(bill.businessEmail) : null,
    business_address: bill.business_address ? String(bill.business_address) : bill.businessAddress ? String(bill.businessAddress) : null,
    customer_name: String(bill.customer_name || bill.customerName || ''),
    customer_phone: bill.customer_phone ? String(bill.customer_phone) : bill.customerPhone ? String(bill.customerPhone) : null,
    customer_address: bill.customer_address ? String(bill.customer_address) : bill.customerAddress ? String(bill.customerAddress) : null,
    customer_gst_no: bill.customer_gst_no ? String(bill.customer_gst_no) : bill.customerGstNo ? String(bill.customerGstNo) : null,
    event_type: normalizeOptionalString(bill.event_type ?? bill.eventType ?? null),
    event_dates: normalizeOptionalString(bill.event_dates ?? bill.eventDates ?? null),
    notes: normalizeOptionalString(bill.notes ?? null),
    items: Array.isArray(bill.items) ? bill.items : [],
    discount_percent: Number(bill.discount_percent ?? bill.discountPercent ?? 0),
    tax_percent: Number(bill.tax_percent ?? bill.taxPercent ?? 0),
    advance_amount: Number(bill.advance_amount ?? bill.advanceAmount ?? 0),
    payment_mode: normalizePaymentMode(bill.payment_mode ?? bill.paymentMode ?? null),
    payment_date: normalizeDateString(bill.payment_date ?? bill.paymentDate ?? null),
    transaction_reference: normalizeOptionalString(
      bill.transaction_reference ?? bill.transactionReference ?? null
    ),
    paper_size:
      bill.paper_size === 'A4' || bill.paper_size === 'A5'
        ? bill.paper_size
        : bill.paperSize === 'A4' || bill.paperSize === 'A5'
          ? bill.paperSize
          : null,
    show_payment_details: normalizeBoolean(
      bill.show_payment_details ?? bill.showPaymentDetails ?? false
    ),
    show_terms_and_notes: normalizeBoolean(
      bill.show_terms_and_notes ?? bill.showTermsAndNotes ?? false
    ),
    subtotal: Number(bill.subtotal || 0),
    discount_amount: Number(bill.discount_amount ?? bill.discountAmount ?? 0),
    taxable_amount: Number(bill.taxable_amount ?? bill.taxableAmount ?? 0),
    tax_amount: Number(bill.tax_amount ?? bill.taxAmount ?? 0),
    grand_total: Number(bill.grand_total ?? bill.grandTotal ?? 0),
    balance_amount: balanceAmount,
    completion_status:
      bill.completion_status === 'COMPLETED' || bill.completionStatus === 'COMPLETED'
        ? 'COMPLETED'
        : bill.completion_status === 'NOT_COMPLETED' || bill.completionStatus === 'NOT_COMPLETED'
          ? 'NOT_COMPLETED'
          : balanceAmount <= 0
            ? 'COMPLETED'
            : 'NOT_COMPLETED',
    created_at: bill.created_at ? String(bill.created_at) : bill.createdAt ? String(bill.createdAt) : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const backup = body?.backup;
    const mode = body?.mode === 'replace' ? 'replace' : 'merge';

    if (!backup || typeof backup !== 'object') {
      return NextResponse.json({ error: 'Invalid backup file' }, { status: 400 });
    }

    const jobs = Array.isArray(backup.jobs) ? backup.jobs : [];
    const bills = Array.isArray(backup.bills) ? backup.bills : [];
    const templates = Array.isArray(backup.whatsapp_templates)
      ? backup.whatsapp_templates
      : [];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase env is missing on server' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (mode === 'replace') {
      const deleteJobsRes = await supabase.from('jobs').delete().eq('user_id', userId);
      if (deleteJobsRes.error) {
        return NextResponse.json(
          { error: `Failed to clear jobs: ${deleteJobsRes.error.message}` },
          { status: 500 }
        );
      }

      const deleteTemplatesRes = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('user_id', userId);

      if (deleteTemplatesRes.error && deleteTemplatesRes.error.code !== '42P01') {
        return NextResponse.json(
          { error: `Failed to clear templates: ${deleteTemplatesRes.error.message}` },
          { status: 500 }
        );
      }

      const deleteBillsRes = await supabase.from('bills').delete().eq('user_id', userId);
      if (deleteBillsRes.error && deleteBillsRes.error.code !== '42P01') {
        return NextResponse.json(
          { error: `Failed to clear bills: ${deleteBillsRes.error.message}` },
          { status: 500 }
        );
      }
    }

    if (jobs.length) {
      const normalizedJobs = (jobs as BackupJob[]).map((job) => normalizeJob(userId, job));
      const jobsUpsertRes = await supabase.from('jobs').upsert(normalizedJobs, {
        onConflict: 'id',
      });

      if (jobsUpsertRes.error) {
        return NextResponse.json(
          { error: `Failed to restore jobs: ${jobsUpsertRes.error.message}` },
          { status: 500 }
        );
      }
    }

    if (templates.length) {
      const normalizedTemplates = (templates as BackupTemplate[]).map((template) =>
        normalizeTemplate(userId, template)
      );

      const templatesUpsertRes = await supabase.from('whatsapp_templates').upsert(
        normalizedTemplates,
        {
          onConflict: 'user_id,category,template_type,status_key',
        }
      );

      if (templatesUpsertRes.error && templatesUpsertRes.error.code !== '42P01') {
        return NextResponse.json(
          { error: `Failed to restore templates: ${templatesUpsertRes.error.message}` },
          { status: 500 }
        );
      }
    }

    if (bills.length) {
      const normalizedBills = (bills as BackupBill[]).map((bill) => normalizeBill(userId, bill));
      let billsUpsertRes = await supabase.from('bills').upsert(normalizedBills, {
        onConflict: 'id',
      });

      if (billsUpsertRes.error && isExtendedBillColumnError(billsUpsertRes.error)) {
        billsUpsertRes = await supabase
          .from('bills')
          .upsert(normalizedBills.map((bill) => stripExtendedBillFields(bill)), {
            onConflict: 'id',
          });
      }

      if (billsUpsertRes.error && billsUpsertRes.error.code !== '42P01') {
        return NextResponse.json(
          { error: `Failed to restore bills: ${billsUpsertRes.error.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: mode === 'replace' ? 'Backup restored with replace mode' : 'Backup merged successfully',
      counts: {
        jobs: jobs.length,
        bills: bills.length,
        templates: templates.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Backup restore error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
