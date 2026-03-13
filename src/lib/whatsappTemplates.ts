import { db, Job, WhatsAppTemplate } from '@/lib/supabase';

export type TemplateCategory = 'EDITING' | 'EXPOSING' | 'OTHER';
export type TemplateType = 'JOB_STATUS' | 'PAYMENT_STATUS' | 'CUSTOMER_SUMMARY';

const COMMON_VARIABLES = [
  '{customer_name}',
  '{customer_phone}',
  '{category}',
  '{event_type}',
  '{event_details}',
  '{start_date}',
  '{end_date}',
  '{estimated_due_date}',
  '{total_price}',
  '{amount_paid}',
  '{balance}',
  '{notes}',
  '{job_status}',
  '{payment_status}',
  '{entries_count}',
  '{entries_details}',
];

const EXPOSING_VARIABLES = [
  '{studio_name}',
  '{event_location}',
  '{session_type}',
  '{exposure_type}',
  '{expose_type}',
  '{camera_type}',
];

const EDITING_VARIABLES = [
  '{client_name}',
  '{number_of_cameras}',
  '{camera_type}',
  '{duration_hours}',
  '{rate_per_hour}',
  '{additional_work_type}',
  '{additional_work_custom}',
  '{additional_work_rate}',
  '{priority}',
];

const OTHER_VARIABLES = [
  '{type_of_work}',
  '{expense}',
  '{profit}',
];

export function getTemplateVariables(category: TemplateCategory) {
  if (category === 'EXPOSING') return [...COMMON_VARIABLES, ...EXPOSING_VARIABLES];
  if (category === 'EDITING') return [...COMMON_VARIABLES, ...EDITING_VARIABLES];
  return [...COMMON_VARIABLES, ...OTHER_VARIABLES];
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-IN');
}

function formatDate(value?: string): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN');
}

function buildEventDetails(job: Job, category: TemplateCategory): string {
  const parts: string[] = [];
  const push = (label: string, value?: string) => {
    const v = (value || '').toString().trim();
    parts.push(`${label}: ${v || '-'}`);
  };

  if (category === 'EXPOSING') {
    push('Event', job.event_type || '');
    push('Studio', job.studio_name || '');
    push('Location', job.event_location || '');
    push('Session', job.session_type || '');
    push('Exposure', job.exposure_type || '');
    push('Expose Type', job.expose_type || '');
    push('Camera', job.camera_type || '');
  } else if (category === 'EDITING') {
    push('Event', job.event_type || '');
    push('Client', job.client_name || '');
    push('Cameras', job.number_of_cameras ? String(job.number_of_cameras) : '');
    push('Camera', job.camera_type || '');
    push('Duration', job.duration_hours ? `${job.duration_hours} hrs` : '');
    push('Rate', job.rate_per_hour ? `Rs.${formatCurrency(job.rate_per_hour)}` : '');
    push('Add Work', job.additional_work_type || job.additional_work_custom || '');
    push('Add Rate', job.additional_work_rate ? `Rs.${formatCurrency(job.additional_work_rate)}` : '');
  } else {
    push('Work', job.type_of_work || '');
    push('Expense', `Rs.${formatCurrency(job.expense || 0)}`);
    push('Profit', `Rs.${formatCurrency((job.total_price || 0) - (job.expense || 0))}`);
  }

  const start = formatDate(job.start_date);
  const end = formatDate(job.end_date);
  parts.push(`Start Date: ${start || '-'}`);
  parts.push(`End Date: ${end || '-'}`);
  parts.push(`Estimated Due: ${formatDate(job.estimated_due_date) || '-'}`);

  return parts.join(' | ');
}

export function generateWhatsAppUrl(phone: string, message: string) {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function openWhatsAppUrl(url: string) {
  if (!url || typeof window === 'undefined') return;
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua);
  if (isMobile) {
    window.location.href = url;
    return;
  }
  window.open(url, '_blank');
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
    return `Hi {customer_name}, your ${category.toLowerCase()} job status is ${label}.\nEvent Details: {event_details}`;
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
    event_details: buildEventDetails(job, category),
    client_name: job.client_name || '',
    number_of_cameras: job.number_of_cameras ? String(job.number_of_cameras) : '',
    duration_hours: job.duration_hours ? String(job.duration_hours) : '',
    rate_per_hour: job.rate_per_hour ? String(job.rate_per_hour) : '',
    additional_work_type: job.additional_work_type || '',
    additional_work_custom: job.additional_work_custom || '',
    additional_work_rate: job.additional_work_rate ? String(job.additional_work_rate) : '',
    priority: job.priority || '',
    studio_name: job.studio_name || '',
    event_location: job.event_location || '',
    session_type: job.session_type || '',
    exposure_type: job.exposure_type || '',
    expose_type: job.expose_type || '',
    camera_type: job.camera_type || '',
    type_of_work: job.type_of_work || '',
    start_date: formatDate(job.start_date),
    end_date: formatDate(job.end_date),
    estimated_due_date: formatDate(job.estimated_due_date),
    total_price: formatCurrency(job.total_price || 0),
    amount_paid: formatCurrency(job.amount_paid || 0),
    balance: formatCurrency((job.total_price || 0) - (job.amount_paid || 0)),
    expense: formatCurrency(job.expense || 0),
    profit: formatCurrency((job.total_price || 0) - (job.expense || 0)),
    notes: job.notes || '',
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
    event_details: '',
    client_name: '',
    number_of_cameras: '',
    duration_hours: '',
    rate_per_hour: '',
    additional_work_type: '',
    additional_work_custom: '',
    additional_work_rate: '',
    priority: '',
    studio_name: '',
    event_location: '',
    session_type: '',
    exposure_type: '',
    expose_type: '',
    camera_type: '',
    type_of_work: '',
    start_date: '',
    end_date: '',
    estimated_due_date: '',
    total_price: formatCurrency(totalAmount),
    amount_paid: formatCurrency(totalPaid),
    balance: formatCurrency(totalPending),
    expense: '',
    profit: '',
    notes: '',
    entries_count: String(group.jobs.length),
    entries_details: lines.join('\n'),
    job_status: '',
    payment_status: '',
  };

  return applyTemplate(templateText, variables);
}
