import { db, Job, WhatsAppTemplate } from '@/lib/supabase';

export type TemplateCategory = 'EDITING' | 'EXPOSING' | 'OTHER';
export type TemplateType = 'JOB_STATUS' | 'PAYMENT_STATUS' | 'CUSTOMER_SUMMARY';

export const TEMPLATE_VARIABLES = [
  '{customer_name}',
  '{customer_phone}',
  '{category}',
  '{event_type}',
  '{type_of_work}',
  '{start_date}',
  '{total_price}',
  '{amount_paid}',
  '{balance}',
  '{entries_count}',
  '{entries_details}',
  '{job_status}',
  '{payment_status}',
];

function formatCurrency(value: number): string {
  return value.toLocaleString('en-IN');
}

function formatDate(value?: string): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN');
}

export function generateWhatsAppUrl(phone: string, message: string) {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function getDefaultTemplate(
  category: TemplateCategory,
  templateType: TemplateType,
  statusKey: string
) {
  if (templateType === 'CUSTOMER_SUMMARY') {
    return (
      `Hi {customer_name},\n` +
      `Here is your pending summary for ${category.toLowerCase()}:\n\n` +
      `{entries_details}\n\n` +
      `Total Entries: {entries_count}\n` +
      `Total Amount: Rs.{total_price}\n` +
      `Amount Paid: Rs.{amount_paid}\n` +
      `Total Balance Pending: Rs.{balance}`
    );
  }

  const label = statusKey
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
  if (templateType === 'JOB_STATUS') {
    return `Hi {customer_name}, your ${category.toLowerCase()} job status is ${label}. Event/Work: {event_type}. Date: {start_date}.`;
  }
  return `Hi {customer_name}, your payment status is ${label}. Total: Rs.{total_price}, Paid: Rs.{amount_paid}, Balance: Rs.{balance}.`;
}

export function applyTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{([a-z_]+)\}/gi, (_, key: string) => {
    return variables[key] ?? `{${key}}`;
  });
}

export function getStatusKeyForTemplate(
  category: TemplateCategory,
  updateType: 'job' | 'payment',
  selectedStatus: string
) {
  if (updateType === 'payment') return selectedStatus;
  if (category === 'EXPOSING') {
    return selectedStatus === 'COMPLETED' ? 'CANCELLED' : 'BOOKED';
  }
  return selectedStatus;
}

export function getStatusLabel(
  category: TemplateCategory,
  updateType: 'job' | 'payment',
  selectedStatus: string
) {
  if (updateType === 'payment') {
    if (selectedStatus === 'PENDING') return 'Pending';
    if (selectedStatus === 'PARTIAL') return 'Partial';
    if (selectedStatus === 'COMPLETED') return 'Completed';
    return selectedStatus;
  }

  if (category === 'EXPOSING') {
    return selectedStatus === 'COMPLETED' ? 'Cancelled' : 'Booked';
  }

  if (selectedStatus === 'PENDING') return 'Yet to Start';
  if (selectedStatus === 'IN_PROGRESS') return 'In Progress';
  if (selectedStatus === 'COMPLETED') return 'Completed';
  return selectedStatus;
}

export async function buildWhatsAppMessage(params: {
  userId: string;
  category: TemplateCategory;
  updateType: 'job' | 'payment';
  selectedJobStatus: string;
  selectedPaymentStatus: string;
  job: Job;
}) {
  const { userId, category, updateType, selectedJobStatus, selectedPaymentStatus, job } = params;
  const statusValue = updateType === 'job' ? selectedJobStatus : selectedPaymentStatus;
  const statusKey = getStatusKeyForTemplate(category, updateType, statusValue);
  const templateType: TemplateType = updateType === 'job' ? 'JOB_STATUS' : 'PAYMENT_STATUS';

  const templates = await db.getWhatsAppTemplates(userId, category);
  const matched = templates.find(
    (t: WhatsAppTemplate) =>
      t.template_type === templateType &&
      t.status_key === statusKey
  );

  const templateText = matched?.template_text || getDefaultTemplate(category, templateType, statusKey);
  const variables = {
    customer_name: job.customer_name || '',
    customer_phone: job.customer_phone || '',
    category: category,
    event_type: job.event_type || job.type_of_work || '',
    type_of_work: job.type_of_work || '',
    start_date: formatDate(job.start_date),
    total_price: formatCurrency(job.total_price || 0),
    amount_paid: formatCurrency(job.amount_paid || 0),
    balance: formatCurrency((job.total_price || 0) - (job.amount_paid || 0)),
    job_status: getStatusLabel(category, 'job', selectedJobStatus),
    payment_status: getStatusLabel(category, 'payment', selectedPaymentStatus),
  };

  return applyTemplate(templateText, variables);
}

export async function buildCustomerSummaryMessage(params: {
  userId: string;
  category: TemplateCategory;
  group: { name: string; phone: string; jobs: Job[] };
}) {
  const { userId, category, group } = params;

  const templates = await db.getWhatsAppTemplates(userId, category);
  const matched = templates.find(
    (t: WhatsAppTemplate) =>
      t.template_type === 'JOB_STATUS' &&
      t.status_key === 'CUSTOMER_SUMMARY'
  );

  const lines = group.jobs.map((j, idx) => {
    const bal = (j.total_price || 0) - (j.amount_paid || 0);
    const eventLabel = j.event_type || j.type_of_work || 'Service';
    return `${idx + 1}. ${eventLabel} (${formatDate(j.start_date)}) - Pending: Rs.${formatCurrency(bal)}`;
  });

  const totalAmount = group.jobs.reduce((s, j) => s + (j.total_price || 0), 0);
  const totalPaid = group.jobs.reduce((s, j) => s + (j.amount_paid || 0), 0);
  const totalPending = totalAmount - totalPaid;

  const templateText =
    matched?.template_text ||
    getDefaultTemplate(category, 'CUSTOMER_SUMMARY', 'CUSTOMER_SUMMARY');

  const variables = {
    customer_name: group.name || '',
    customer_phone: group.phone || '',
    category,
    event_type: '',
    type_of_work: '',
    start_date: '',
    total_price: formatCurrency(totalAmount),
    amount_paid: formatCurrency(totalPaid),
    balance: formatCurrency(totalPending),
    entries_count: String(group.jobs.length),
    entries_details: lines.join('\n'),
    job_status: '',
    payment_status: '',
  };

  return applyTemplate(templateText, variables);
}
