// WhatsApp Message Template Utilities

// Default templates (fallback if no custom template set)
export const DEFAULT_TEMPLATES = {
  singleReminder: `Hi {customer_name},

This is a friendly reminder from *Aura Knot Photography* regarding your pending payment.

{service_icon} Service: {service_type}
📅 Date: {date}
💰 Total Amount: Rs.{total_amount}
✅ Amount Paid: Rs.{amount_paid}
⏳ *Balance Due: Rs.{balance}*

Please complete the payment at your earliest convenience.

Thank you for choosing us! 🙏

- Aura Knot Photography`,
  
  consolidatedReminder: `Hi {customer_name},

This is a friendly reminder from *Aura Knot Photography* regarding your pending payments.

📝 *Pending Services ({count}):*
{jobs_list}
━━━━━━━━━━━━━━━
💵 *TOTAL BALANCE DUE: Rs.{total_balance}*

Please complete the payment at your earliest convenience.

Thank you for choosing us! 🙏

- Aura Knot Photography`
};

// Default per-category single-job templates
export const DEFAULT_CATEGORY_TEMPLATES: Record<'EDITING'|'EXPOSING'|'OTHER', string> = {
  EDITING: `Hi {customer_name},

This is a reminder from *Aura Knot Photography* about your {service_type} (Editing).

{service_icon} Service: {service_type}
📅 Date: {date}
💰 Total Amount: Rs.{total_amount}
⏳ *Balance Due: Rs.{balance}*

Please complete payment or confirm details.

Thank you! - Aura Knot Photography`,
  EXPOSING: `Hi {customer_name},

Reminder from *Aura Knot Photography* for your {service_type} (Exposing).

{service_icon} Service: {service_type}
📅 Date: {date}
💰 Total Amount: Rs.{total_amount}
⏳ *Balance Due: Rs.{balance}*

Please get in touch to confirm the session.

Thank you! - Aura Knot Photography`,
  OTHER: `Hi {customer_name},

This is about your payment for {service_type} (Other).

{service_icon} Service: {service_type}
📅 Date: {date}
💰 Total Amount: Rs.{total_amount}
⏳ *Balance Due: Rs.{balance}*

Please complete the payment when convenient.

Thank you! - Aura Knot Photography`
};

// Default Job Status Templates
export const DEFAULT_JOB_STATUS_TEMPLATES = {
  PENDING: `Hi {customer_name},

Your {service_type} job has been *received* and is currently *PENDING*.

📋 *Job Details:*
{service_icon} Service: {service_type}
📅 Date: {date}

We will start working on it soon and keep you updated.

Thank you for choosing *Aura Knot Photography*! 🙏`,

  IN_PROGRESS: `Hi {customer_name},

Great news! Your {service_type} is now *IN PROGRESS*.

📋 *Job Details:*
{service_icon} Service: {service_type}
📅 Date: {date}

Our team is working on it. We'll notify you once completed.

Thank you for your patience! 🙏

- Aura Knot Photography`,

  COMPLETED: `Hi {customer_name},

🎉 Your {service_type} is now *COMPLETED*!

📋 *Job Details:*
{service_icon} Service: {service_type}
📅 Date: {date}

{balance_message}

Thank you for choosing *Aura Knot Photography*! 🙏

We hope you love the results! ❤️`
};

// Default Payment Status Templates
export const DEFAULT_PAYMENT_STATUS_TEMPLATES = {
  PENDING: `Hi {customer_name},

This is a reminder about your *PENDING PAYMENT*.

📋 *Payment Details:*
{service_icon} Service: {service_type}
📅 Date: {date}
💰 Total Amount: Rs.{total_amount}
⏳ *Balance Due: Rs.{balance}*

Please complete the payment at your earliest convenience.

Thank you! 🙏

- Aura Knot Photography`,

  PARTIAL: `Hi {customer_name},

Thank you for your partial payment! 🙏

📋 *Payment Details:*
{service_icon} Service: {service_type}
📅 Date: {date}
💰 Total Amount: Rs.{total_amount}
✅ Amount Paid: Rs.{amount_paid}
⏳ *Remaining Balance: Rs.{balance}*

Please clear the remaining balance when convenient.

Thank you for choosing *Aura Knot Photography*!`,

  COMPLETED: `Hi {customer_name},

✅ *PAYMENT RECEIVED*

Thank you for completing your payment!

📋 *Payment Details:*
{service_icon} Service: {service_type}
📅 Date: {date}
💰 Total Amount: Rs.{total_amount}
✅ *Fully Paid*

We appreciate your trust in *Aura Knot Photography*! 🙏

Thank you for choosing us! ❤️`
};

// Get the single reminder template from localStorage or default
export function getSingleTemplate(): string {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES.singleReminder;
  return localStorage.getItem('akms_whatsapp_single') || DEFAULT_TEMPLATES.singleReminder;
}

// Get single template by category (prefers per-category key, falls back to generic single template)
export function getSingleTemplateForCategory(category: string): string {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES.singleReminder;
  const catKey = `akms_whatsapp_single_${(category || 'OTHER').toString().toUpperCase()}`;
  const perCat = localStorage.getItem(catKey);
  if (perCat) return perCat;
  return getSingleTemplate();
}

// Get the consolidated reminder template from localStorage or default
export function getConsolidatedTemplate(): string {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES.consolidatedReminder;
  return localStorage.getItem('akms_whatsapp_consolidated') || DEFAULT_TEMPLATES.consolidatedReminder;
}

// Get job status templates from localStorage or default
export function getJobStatusTemplates(): typeof DEFAULT_JOB_STATUS_TEMPLATES {
  if (typeof window === 'undefined') return DEFAULT_JOB_STATUS_TEMPLATES;
  const saved = localStorage.getItem('akms_job_status_templates');
  return saved ? JSON.parse(saved) : DEFAULT_JOB_STATUS_TEMPLATES;
}

// Get payment status templates from localStorage or default
export function getPaymentStatusTemplates(): typeof DEFAULT_PAYMENT_STATUS_TEMPLATES {
  if (typeof window === 'undefined') return DEFAULT_PAYMENT_STATUS_TEMPLATES;
  const saved = localStorage.getItem('akms_payment_status_templates');
  return saved ? JSON.parse(saved) : DEFAULT_PAYMENT_STATUS_TEMPLATES;
}

// Get service icon based on category
export function getServiceIcon(category: string): string {
  switch (category?.toUpperCase()) {
    case 'EDITING':
      return '✨';
    case 'EXPOSING':
      return '📷';
    case 'OTHER':
      return '📋';
    default:
      return '📌';
  }
}

// Format a single job reminder message
export function formatSingleReminder(job: {
  customer_name: string;
  event_type?: string;
  service_type?: string;
  start_date: string;
  total_price: number;
  amount_paid: number;
  category: string;
}): string {
  const template = getSingleTemplateForCategory(job.category || 'OTHER');
  const balance = job.total_price - job.amount_paid;
  
  return template
    .replace(/{customer_name}/g, job.customer_name)
    .replace(/{service_type}/g, job.event_type || job.service_type || 'Service')
    .replace(/{service_icon}/g, getServiceIcon(job.category))
    .replace(/{date}/g, new Date(job.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))
    .replace(/{total_amount}/g, job.total_price.toLocaleString('en-IN'))
    .replace(/{amount_paid}/g, job.amount_paid.toLocaleString('en-IN'))
    .replace(/{balance}/g, balance.toLocaleString('en-IN'));
}

// Format a consolidated reminder message for multiple jobs
export function formatConsolidatedReminder(
  customerName: string,
  jobs: Array<{
    event_type?: string;
    service_type?: string;
    start_date: string;
    total_price: number;
    amount_paid: number;
    category: string;
  }>
): string {
  const template = getConsolidatedTemplate();
  
  // Build jobs list
  const jobsList = jobs.map((job, index) => {
    const balance = job.total_price - job.amount_paid;
    const date = new Date(job.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `${index + 1}. ${getServiceIcon(job.category)} ${job.event_type || job.service_type || 'Service'} (${date})\n   Balance: Rs.${balance.toLocaleString('en-IN')}`;
  }).join('\n\n');
  
  // Calculate total balance
  const totalBalance = jobs.reduce((sum, job) => sum + (job.total_price - job.amount_paid), 0);
  
  return template
    .replace(/{customer_name}/g, customerName)
    .replace(/{count}/g, jobs.length.toString())
    .replace(/{jobs_list}/g, jobsList)
    .replace(/{total_balance}/g, totalBalance.toLocaleString('en-IN'));
}

// Generate WhatsApp URL with message
export function generateWhatsAppUrl(phone: string, message: string): string {
  // Clean phone number - remove spaces, dashes, and ensure it has country code
  let cleanPhone = phone.replace(/[\s-]/g, '');
  if (!cleanPhone.startsWith('+') && !cleanPhone.startsWith('91')) {
    cleanPhone = '91' + cleanPhone; // Default to India country code
  }
  cleanPhone = cleanPhone.replace('+', '');
  
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

// Format a job status message
export function formatJobStatusMessage(
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED',
  job: {
    customer_name: string;
    event_type?: string;
    service_type?: string;
    type_of_work?: string;
    start_date: string;
    total_price: number;
    amount_paid: number;
    category: string;
  }
): string {
  const templates = getJobStatusTemplates();
  const template = templates[status];
  const balance = job.total_price - job.amount_paid;
  const balanceMessage = balance > 0 
    ? `💰 Pending Balance: Rs.${balance.toLocaleString('en-IN')}`
    : '✅ All payments are complete.';
  
  return template
    .replace(/{customer_name}/g, job.customer_name)
    .replace(/{service_type}/g, job.event_type || job.service_type || job.type_of_work || 'Service')
    .replace(/{service_icon}/g, getServiceIcon(job.category))
    .replace(/{date}/g, new Date(job.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))
    .replace(/{total_amount}/g, job.total_price.toLocaleString('en-IN'))
    .replace(/{amount_paid}/g, job.amount_paid.toLocaleString('en-IN'))
    .replace(/{balance}/g, balance.toLocaleString('en-IN'))
    .replace(/{balance_message}/g, balanceMessage);
}

// Format a payment status message
export function formatPaymentStatusMessage(
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED',
  job: {
    customer_name: string;
    event_type?: string;
    service_type?: string;
    type_of_work?: string;
    start_date: string;
    total_price: number;
    amount_paid: number;
    category: string;
  }
): string {
  const templates = getPaymentStatusTemplates();
  const template = templates[status];
  const balance = job.total_price - job.amount_paid;
  
  return template
    .replace(/{customer_name}/g, job.customer_name)
    .replace(/{service_type}/g, job.event_type || job.service_type || job.type_of_work || 'Service')
    .replace(/{service_icon}/g, getServiceIcon(job.category))
    .replace(/{date}/g, new Date(job.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))
    .replace(/{total_amount}/g, job.total_price.toLocaleString('en-IN'))
    .replace(/{amount_paid}/g, job.amount_paid.toLocaleString('en-IN'))
    .replace(/{balance}/g, balance.toLocaleString('en-IN'));
}
