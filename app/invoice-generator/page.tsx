'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import { ArrowLeft, Download, FileText, Plus, Trash2, UserRound } from 'lucide-react';
import { db, Job } from '@/lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
};

type CustomerSuggestion = {
  name: string;
  phone: string;
  eventDetails: string;
};

type InvoiceForm = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes: string;
  discountPercent: number;
  taxPercent: number;
  amountPaid: number;
};

function createItem(): InvoiceItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    quantity: 1,
    rate: 0,
  };
}

function createInitialInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const stamp = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  return `INV-${year}${month}${day}-${stamp}`;
}

function formatCurrency(value: number) {
  return `Rs.${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function InvoiceGeneratorPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingPdf, setSavingPdf] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [form, setForm] = useState<InvoiceForm>(() => {
    const today = new Date().toISOString().split('T')[0];
    const due = new Date();
    due.setDate(due.getDate() + 7);
    return {
      invoiceNumber: createInitialInvoiceNumber(),
      invoiceDate: today,
      dueDate: due.toISOString().split('T')[0],
      businessName: 'Aura Knot Photography',
      businessPhone: '+91 8610 100 885',
      businessEmail: 'auraknot.photo@gmail.com',
      businessAddress: 'Perundurai, Erode',
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      notes: 'Thank you for your business.',
      discountPercent: 0,
      taxPercent: 0,
      amountPaid: 0,
    };
  });
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: crypto.randomUUID(),
      description: 'Photography / Videography Service',
      quantity: 1,
      rate: 0,
    },
  ]);

  useEffect(() => {
    if (!authLoading && !user?.id) {
      router.push('/auth/login');
      return;
    }

    if (user?.id) {
      void fetchInvoiceData(user.id);
    }
  }, [authLoading, user?.id, router]);

  async function fetchInvoiceData(userId: string) {
    setLoading(true);
    try {
      const allJobs = await db.getJobs(userId);
      setJobs(allJobs);

      const uniqueCustomers = new Map<string, CustomerSuggestion>();
      allJobs.forEach((job) => {
        const name = (job.customer_name || '').trim();
        const phone = (job.customer_phone || '').trim();
        if (!name) return;
        const key = `${name.toLowerCase()}-${phone}`;
        if (!uniqueCustomers.has(key)) {
          uniqueCustomers.set(key, {
            name,
            phone,
            eventDetails: job.event_details || job.type_of_work || job.event_type || '',
          });
        }
      });

      setCustomerSuggestions(Array.from(uniqueCustomers.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Failed to load invoice data:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredSuggestions = useMemo(() => {
    const query = form.customerName.trim().toLowerCase();
    if (!query) return [];
    return customerSuggestions
      .filter((customer) => customer.name.toLowerCase().includes(query) || customer.phone.includes(query))
      .slice(0, 6);
  }, [customerSuggestions, form.customerName]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0), 0),
    [items]
  );
  const discountAmount = subtotal * ((Number(form.discountPercent) || 0) / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * ((Number(form.taxPercent) || 0) / 100);
  const grandTotal = taxableAmount + taxAmount;
  const balance = grandTotal - (Number(form.amountPaid) || 0);

  function setFormField<K extends keyof InvoiceForm>(field: K, value: InvoiceForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateItem(id: string, field: keyof InvoiceItem, value: string | number) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, createItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== id)));
  }

  function applyCustomer(customer: CustomerSuggestion) {
    setForm((prev) => ({
      ...prev,
      customerName: customer.name,
      customerPhone: customer.phone,
      notes: prev.notes === 'Thank you for your business.' && customer.eventDetails
        ? `Work Details: ${customer.eventDetails}\n\nThank you for your business.`
        : prev.notes,
    }));
    setShowSuggestions(false);
  }

  async function exportInvoicePdf() {
    if (!form.customerName.trim()) {
      alert('Please enter a customer name before exporting the invoice.');
      return;
    }

    setSavingPdf(true);
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 16;

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(10, 10, pageWidth - 20, 24, 4, 4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(form.businessName || 'Invoice', 16, 21);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(form.businessPhone || '-', 16, 27);
      doc.text(form.businessEmail || '-', 16, 31);
      doc.text('INVOICE', pageWidth - 16, 21, { align: 'right' });
      doc.text(`No: ${form.invoiceNumber}`, pageWidth - 16, 27, { align: 'right' });
      doc.text(`Date: ${form.invoiceDate}`, pageWidth - 16, 31, { align: 'right' });

      y = 44;
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('From', 14, y);
      doc.text('Bill To', 110, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const fromLines = [form.businessName, form.businessAddress, form.businessPhone, form.businessEmail].filter(Boolean);
      const toLines = [form.customerName, form.customerAddress, form.customerPhone].filter(Boolean);
      fromLines.forEach((line, index) => doc.text(line, 14, y + 6 + index * 5));
      toLines.forEach((line, index) => doc.text(line, 110, y + 6 + index * 5));
      doc.text(`Due Date: ${form.dueDate || '-'}`, 110, y + 24);

      y = 84;
      doc.setFillColor(241, 245, 249);
      doc.rect(10, y, pageWidth - 20, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('Description', 14, y + 6.5);
      doc.text('Qty', 128, y + 6.5, { align: 'right' });
      doc.text('Rate', 154, y + 6.5, { align: 'right' });
      doc.text('Amount', pageWidth - 14, y + 6.5, { align: 'right' });

      y += 14;
      doc.setFont('helvetica', 'normal');
      items.forEach((item) => {
        const amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
        const wrapped = doc.splitTextToSize(item.description || '-', 95);
        const rowHeight = Math.max(8, wrapped.length * 5);
        doc.text(wrapped, 14, y);
        doc.text(String(item.quantity || 0), 128, y, { align: 'right' });
        doc.text(formatCurrency(item.rate || 0), 154, y, { align: 'right' });
        doc.text(formatCurrency(amount), pageWidth - 14, y, { align: 'right' });
        y += rowHeight;
      });

      y += 4;
      const summaryX = 122;
      const summaryRows: Array<[string, number]> = [
        ['Subtotal', subtotal],
        ['Discount', discountAmount],
        ['Tax', taxAmount],
        ['Amount Paid', Number(form.amountPaid) || 0],
        ['Balance Due', balance],
      ];

      doc.setDrawColor(226, 232, 240);
      doc.line(summaryX - 6, y, pageWidth - 12, y);
      y += 8;

      summaryRows.forEach(([label, value]) => {
        doc.setFont('helvetica', label === 'Balance Due' ? 'bold' : 'normal');
        doc.text(label, summaryX, y);
        doc.text(formatCurrency(value), pageWidth - 14, y, { align: 'right' });
        y += 7;
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Grand Total', summaryX, y + 2);
      doc.text(formatCurrency(grandTotal), pageWidth - 14, y + 2, { align: 'right' });

      y += 14;
      if (form.notes.trim()) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Notes', 14, y);
        doc.setFont('helvetica', 'normal');
        const notesLines = doc.splitTextToSize(form.notes.trim(), pageWidth - 28);
        doc.text(notesLines, 14, y + 6);
      }

      const safeName = form.customerName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'customer';
      doc.save(`${form.invoiceNumber}-${safeName}.pdf`);
    } finally {
      setSavingPdf(false);
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-slate-300 mt-4">Preparing invoice workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white transition-all active:scale-95"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-white">Invoice Generator</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">Create polished invoices from your existing customer data.</p>
            </div>
          </div>
          <button
            onClick={exportInvoicePdf}
            disabled={savingPdf}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm hover:shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-95 disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            {savingPdf ? 'Preparing PDF...' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4 sm:gap-6">
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-white">Invoice Details</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-xs text-slate-400">Invoice Number</span>
                <input value={form.invoiceNumber} onChange={(e) => setFormField('invoiceNumber', e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white" />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Invoice Date</span>
                <input type="date" value={form.invoiceDate} onChange={(e) => setFormField('invoiceDate', e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white" />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Due Date</span>
                <input type="date" value={form.dueDate} onChange={(e) => setFormField('dueDate', e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white" />
              </label>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">From</h2>
                <div className="space-y-3">
                  <input value={form.businessName} onChange={(e) => setFormField('businessName', e.target.value)} placeholder="Business name" className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400" />
                  <input value={form.businessPhone} onChange={(e) => setFormField('businessPhone', e.target.value)} placeholder="Phone" className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400" />
                  <input value={form.businessEmail} onChange={(e) => setFormField('businessEmail', e.target.value)} placeholder="Email" className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400" />
                  <textarea value={form.businessAddress} onChange={(e) => setFormField('businessAddress', e.target.value)} placeholder="Business address" rows={3} className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <UserRound className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-semibold text-white">Bill To</h2>
                  <span className="text-xs text-slate-400">{jobs.length} jobs scanned</span>
                </div>
                <div className="space-y-3 relative">
                  <div className="relative">
                    <input
                      value={form.customerName}
                      onFocus={() => setShowSuggestions(true)}
                      onChange={(e) => {
                        setFormField('customerName', e.target.value);
                        setShowSuggestions(true);
                      }}
                      placeholder="Customer name"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400"
                    />
                    {showSuggestions && filteredSuggestions.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 shadow-xl overflow-hidden">
                        {filteredSuggestions.map((customer) => (
                          <button
                            key={`${customer.name}-${customer.phone}`}
                            type="button"
                            onClick={() => applyCustomer(customer)}
                            className="w-full text-left px-3 py-2.5 hover:bg-slate-800 transition-colors"
                          >
                            <p className="text-sm text-white font-medium">{customer.name}</p>
                            <p className="text-xs text-slate-400">{customer.phone || 'No phone'}{customer.eventDetails ? ` | ${customer.eventDetails}` : ''}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input value={form.customerPhone} onChange={(e) => setFormField('customerPhone', e.target.value)} placeholder="Customer phone" className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400" />
                  <textarea value={form.customerAddress} onChange={(e) => setFormField('customerAddress', e.target.value)} placeholder="Customer address" rows={3} className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Line Items</h2>
              <button onClick={addItem} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 transition-colors">
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[1fr_90px_120px_48px] gap-3 bg-slate-900/40 rounded-xl p-3">
                  <input value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} placeholder={`Service ${index + 1}`} className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400" />
                  <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))} className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white" />
                  <input type="number" min="0" value={item.rate} onChange={(e) => updateItem(item.id, 'rate', Number(e.target.value))} className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white" />
                  <button onClick={() => removeItem(item.id)} className="inline-flex items-center justify-center rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 transition-colors" title="Remove item">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Notes & Settlement</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <textarea value={form.notes} onChange={(e) => setFormField('notes', e.target.value)} rows={6} placeholder="Invoice notes" className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
                <label className="block">
                  <span className="text-xs text-slate-400">Discount %</span>
                  <input type="number" min="0" value={form.discountPercent} onChange={(e) => setFormField('discountPercent', Number(e.target.value))} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white" />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-400">Tax %</span>
                  <input type="number" min="0" value={form.taxPercent} onChange={(e) => setFormField('taxPercent', Number(e.target.value))} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs text-slate-400">Amount Paid</span>
                  <input type="number" min="0" value={form.amountPaid} onChange={(e) => setFormField('amountPaid', Number(e.target.value))} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white" />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 sticky top-24">
            <h2 className="text-lg font-semibold text-white mb-4">Invoice Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-slate-300">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-300">
                <span>Discount</span>
                <span>{formatCurrency(discountAmount)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-300">
                <span>Tax</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-300">
                <span>Amount Paid</span>
                <span>{formatCurrency(Number(form.amountPaid) || 0)}</span>
              </div>
              <div className="h-px bg-slate-700/60 my-2" />
              <div className="flex justify-between text-lg font-semibold text-white">
                <span>Grand Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold text-amber-300">
                <span>Balance Due</span>
                <span>{formatCurrency(balance)}</span>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-slate-900/40 border border-slate-700/50">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Preview</p>
              <p className="text-white font-semibold">{form.customerName || 'Customer name'}</p>
              <p className="text-slate-400 text-sm mt-1">{form.customerPhone || 'Phone number'}</p>
              <p className="text-slate-300 text-sm mt-3">Invoice #{form.invoiceNumber}</p>
              <p className="text-slate-400 text-xs mt-1">Due on {form.dueDate || '-'}</p>
            </div>

            <button
              onClick={exportInvoicePdf}
              disabled={savingPdf}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-95 disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {savingPdf ? 'Preparing PDF...' : 'Download Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
