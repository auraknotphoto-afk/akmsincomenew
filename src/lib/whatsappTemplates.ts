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

// Get the single reminder template from localStorage or default
export function getSingleTemplate(): string {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES.singleReminder;
  return localStorage.getItem('akms_whatsapp_single') || DEFAULT_TEMPLATES.singleReminder;
}

// Get the consolidated reminder template from localStorage or default
export function getConsolidatedTemplate(): string {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES.consolidatedReminder;
  return localStorage.getItem('akms_whatsapp_consolidated') || DEFAULT_TEMPLATES.consolidatedReminder;
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
  const template = getSingleTemplate();
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
