'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import { ArrowLeft, CheckCircle2, Download, FileText, FolderOpen, Plus, Save, Trash2, UserRound } from 'lucide-react';
import { db, Job } from '@/lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type BillItem = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
};

type CustomerSuggestion = {
  name: string;
  phone: string;
  eventDetails: string;
  address: string;
  gstNo: string;
  source: 'bill' | 'job';
  lastBillNumber?: string;
};

type BillForm = {
  billNumber: string;
  billDate: string;
  completionDate: string;
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerGstNo: string;
  notes: string;
  discountPercent: number;
  taxPercent: number;
  advanceAmount: number;
  completionStatus: 'COMPLETED' | 'NOT_COMPLETED';
};

type SavedBillRecord = BillForm & {
  id: string;
  items: BillItem[];
};

type BillNumberRecord = {
  id: string;
  billNumber: string;
  billDate: string;
};

function createItem(): BillItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    quantity: 1,
    rate: 0,
  };
}

function getFiscalYearParts(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    startShort: String(startYear).slice(-2),
    endShort: String(endYear).slice(-2),
  };
}

function buildBillNumber(dateValue: string, sequence: number) {
  const { startShort, endShort } = getFiscalYearParts(dateValue);
  return `AKP/BILL/${startShort}-${endShort}/${String(sequence).padStart(3, '0')}`;
}

function getBillSequenceForDate(dateValue: string, bills: BillNumberRecord[], currentBillId?: string | null) {
  const { startShort, endShort } = getFiscalYearParts(dateValue);
  const yearSegment = `AKP/BILL/${startShort}-${endShort}/`;
  const sameYearBills = bills.filter((bill) => {
    if (currentBillId && bill.id === currentBillId) return false;
    return bill.billNumber.startsWith(yearSegment);
  });

  const maxSequence = sameYearBills.reduce((max, bill) => {
    const lastPart = bill.billNumber.split('/').pop() || '0';
    const sequence = Number(lastPart);
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return maxSequence + 1;
}

function formatCurrency(value: number) {
  return `Rs.${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function convertBelowThousand(value: number): string {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (value < 20) return ones[value];
  if (value < 100) {
    return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ''}`.trim();
  }

  return `${ones[Math.floor(value / 100)]} Hundred${value % 100 ? ` ${convertBelowThousand(value % 100)}` : ''}`.trim();
}

function numberToWords(value: number): string {
  if (!Number.isFinite(value) || value < 0) return 'Zero Rupees Only';
  if (value === 0) return 'Zero Rupees Only';

  const rounded = Math.round(value);
  const crore = Math.floor(rounded / 10000000);
  const lakh = Math.floor((rounded % 10000000) / 100000);
  const thousand = Math.floor((rounded % 100000) / 1000);
  const remainder = rounded % 1000;
  const parts = [
    crore ? `${convertBelowThousand(crore)} Crore` : '',
    lakh ? `${convertBelowThousand(lakh)} Lakh` : '',
    thousand ? `${convertBelowThousand(thousand)} Thousand` : '',
    remainder ? convertBelowThousand(remainder) : '',
  ].filter(Boolean);

  return `${parts.join(' ')} Rupees Only`;
}

const BILL_LOGO_WIDTH = 907;
const BILL_LOGO_HEIGHT = 126;
const BILL_LOGO_RATIO = BILL_LOGO_WIDTH / BILL_LOGO_HEIGHT;

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadBillLogo() {
  try {
    const response = await fetch('/ak-logo-final.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

export default function BillGeneratorPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingPdf, setSavingPdf] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [savedBills, setSavedBills] = useState<BillNumberRecord[]>([]);
  const [billNumberTouched, setBillNumberTouched] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [rememberedCustomers, setRememberedCustomers] = useState<CustomerSuggestion[]>([]);
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [form, setForm] = useState<BillForm>(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      billNumber: buildBillNumber(today, 1),
      billDate: today,
      completionDate: today,
      businessName: 'Aura Knot Photography',
      businessPhone: '+91 8610 100 885',
      businessEmail: 'auraknot.photo@gmail.com',
      businessAddress: 'Perundurai, Erode',
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      customerGstNo: '',
      notes: '',
      discountPercent: 0,
      taxPercent: 0,
      advanceAmount: 0,
      completionStatus: 'NOT_COMPLETED',
    };
  });
  const [items, setItems] = useState<BillItem[]>([
    {
      id: crypto.randomUUID(),
      description: '',
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
      void fetchBillData(user.id);
    }
  }, [authLoading, user?.id, router]);

  useEffect(() => {
    if (authLoading || !user?.id || typeof window === 'undefined') return;
    const editId = new URLSearchParams(window.location.search).get('editId');
    if (editId) {
      void loadBillForEdit(editId);
    }
  }, [authLoading, user?.id]);

  async function fetchBillData(userId: string) {
    setLoading(true);
    try {
      const [allJobs, billsResponse] = await Promise.all([
        db.getJobs(userId),
        fetch('/api/bills', { cache: 'no-store' }),
      ]);
      setJobs(allJobs);

      const billsData = await billsResponse.json().catch(() => []);
      const latestCustomers = new Map<string, CustomerSuggestion>();

      if (billsResponse.ok && Array.isArray(billsData)) {
        setSavedBills(
          billsData.map((bill) => ({
            id: String(bill.id),
            billNumber: String(bill.billNumber || ''),
            billDate: String(bill.billDate || ''),
          }))
        );

        billsData.forEach((bill) => {
          const name = String(bill.customerName || '').trim();
          const phone = String(bill.customerPhone || '').trim();
          if (!name) return;

          const key = `${name.toLowerCase()}-${phone}`;
          if (!latestCustomers.has(key)) {
            latestCustomers.set(key, {
              name,
              phone,
              eventDetails: '',
              address: String(bill.customerAddress || '').trim(),
              gstNo: String(bill.customerGstNo || '').trim(),
              source: 'bill',
              lastBillNumber: String(bill.billNumber || ''),
            });
          }
        });
      }

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
            address: '',
            gstNo: '',
            source: 'job',
          });
        }
      });

      latestCustomers.forEach((customer, key) => {
        uniqueCustomers.set(key, customer);
      });

      const mergedCustomers = Array.from(uniqueCustomers.values()).sort((a, b) => {
        if (a.source !== b.source) {
          return a.source === 'bill' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      setRememberedCustomers(
        mergedCustomers.filter((customer) => customer.source === 'bill').slice(0, 6)
      );
      setCustomerSuggestions(mergedCustomers);
    } catch (error) {
      console.error('Failed to load bill data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (editingBillId || billNumberTouched || savedBills.length === 0) return;

    const nextSequence = getBillSequenceForDate(form.billDate, savedBills, editingBillId);
    const nextBillNumber = buildBillNumber(form.billDate, nextSequence);

    setForm((prev) => (
      prev.billNumber === nextBillNumber ? prev : { ...prev, billNumber: nextBillNumber }
    ));
  }, [billNumberTouched, editingBillId, form.billDate, savedBills]);

  async function loadBillForEdit(editId: string) {
    try {
      const response = await fetch(`/api/bills/${editId}`, { cache: 'no-store' });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load bill');
      }

      const bill = data as SavedBillRecord;
      setEditingBillId(bill.id);
      setForm({
        billNumber: bill.billNumber,
        billDate: bill.billDate,
        completionDate: bill.completionDate,
        businessName: bill.businessName || 'Aura Knot Photography',
        businessPhone: bill.businessPhone || '',
        businessEmail: bill.businessEmail || '',
        businessAddress: bill.businessAddress || '',
        customerName: bill.customerName || '',
        customerPhone: bill.customerPhone || '',
        customerAddress: bill.customerAddress || '',
        customerGstNo: bill.customerGstNo || '',
        notes: bill.notes || '',
        discountPercent: Number(bill.discountPercent) || 0,
        taxPercent: Number(bill.taxPercent) || 0,
        advanceAmount: Number(bill.advanceAmount) || 0,
        completionStatus: bill.completionStatus || 'NOT_COMPLETED',
      });
      setItems(
        Array.isArray(bill.items) && bill.items.length > 0
          ? bill.items.map((item) => ({
              id: item.id || crypto.randomUUID(),
              description: item.description || '',
              quantity: Number(item.quantity) || 1,
              rate: Number(item.rate) || 0,
            }))
          : [createItem()]
      );
      setBillNumberTouched(true);
      setSaveMessage(`Editing saved bill ${bill.billNumber}.`);
    } catch (error) {
      console.error('Failed to load bill for edit:', error);
      const message = error instanceof Error ? error.message : 'Failed to load bill';
      alert(message);
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
  const advanceAmount = Number(form.advanceAmount) || 0;
  const balance = grandTotal - advanceAmount;

  function setFormField<K extends keyof BillForm>(field: K, value: BillForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateItem(id: string, field: keyof BillItem, value: string | number) {
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
      customerAddress: customer.address || prev.customerAddress,
      customerGstNo: customer.gstNo || prev.customerGstNo,
      notes: prev.notes,
    }));
    setShowSuggestions(false);
  }

  function buildBillPayload() {
    return {
      id: editingBillId,
      ...form,
      items,
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      grandTotal,
      balanceAmount: balance,
    };
  }

  async function saveBillRecord(options?: { silent?: boolean }) {
    if (!form.customerName.trim()) {
      alert('Please enter a customer name before saving the bill.');
      return false;
    }

    setSavingRecord(true);
    if (!options?.silent) {
      setSaveMessage(null);
    }

    try {
      const response = await fetch(editingBillId ? `/api/bills/${editingBillId}` : '/api/bills', {
        method: editingBillId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildBillPayload()),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save bill');
      }

      if (!options?.silent) {
        setSaveMessage(
          `${editingBillId ? 'Updated' : 'Saved'} bill ${form.billNumber} for ${form.customerName}.`
        );
      }

      return true;
    } catch (error) {
      console.error('Failed to save bill:', error);
      const message = error instanceof Error ? error.message : 'Failed to save bill';
      alert(message);
      return false;
    } finally {
      setSavingRecord(false);
    }
  }

  async function exportBillPdf() {
    if (!form.customerName.trim()) {
      alert('Please enter a customer name before exporting the bill.');
      return;
    }

    const saved = await saveBillRecord({ silent: true });
    if (!saved) return;

    setSavingPdf(true);
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const left = 14;
      const right = pageWidth - 14;
      let y = 18;
      const logoDataUrl = await loadBillLogo();

      doc.setFillColor(250, 247, 242);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      if (logoDataUrl) {
        const logoWidth = 82;
        const logoHeight = logoWidth / BILL_LOGO_RATIO;
        doc.addImage(logoDataUrl, 'PNG', left, y - 2, logoWidth, logoHeight);
      }

      doc.setTextColor(58, 42, 26);
      doc.setFont('times', 'bold');
      doc.setFontSize(24);
      doc.text('BILL', right, y + 3, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(95, 78, 59);
      doc.text(`Bill No: ${form.billNumber}`, right, y + 10, { align: 'right' });
      doc.text(`Bill Date: ${form.billDate}`, right, y + 15, { align: 'right' });
      doc.text(`Completed On: ${form.completionDate}`, right, y + 20, { align: 'right' });

      y = 48;

      doc.setFillColor(255, 252, 247);
      doc.roundedRect(left - 2, y - 5, 84, 28, 2, 2, 'F');
      doc.roundedRect(110, y - 5, 84, 28, 2, 2, 'F');
      doc.setDrawColor(232, 223, 207);
      doc.roundedRect(left - 2, y - 5, 84, 28, 2, 2);
      doc.roundedRect(110, y - 5, 84, 28, 2, 2);

      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(58, 42, 26);
      doc.text('From', left, y);
      doc.text('Billed To', 112, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(64, 64, 64);
      const fromLines = [form.businessName, form.businessAddress, form.businessPhone, form.businessEmail].filter(Boolean);
      const toLines = [
        form.customerName,
        form.customerAddress,
        form.customerPhone,
        form.customerGstNo ? `GST No: ${form.customerGstNo}` : '',
      ].filter(Boolean);
      fromLines.forEach((line, index) => doc.text(line, left, y + 6 + index * 5));
      toLines.forEach((line, index) => doc.text(line, 112, y + 6 + index * 5));

      const fromHeight = fromLines.length * 5;
      const toHeight = toLines.length * 5;
      y += Math.max(fromHeight, toHeight) + 14;

      doc.setFillColor(91, 67, 43);
      doc.rect(left, y, pageWidth - 28, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Description', left + 49, y + 6, { align: 'center' });
      doc.text('Qty', 128, y + 6, { align: 'right' });
      doc.text('Rate', 154, y + 6, { align: 'right' });
      doc.text('Amount', right - 2, y + 6, { align: 'right' });

      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(45, 45, 45);
      items.forEach((item, index) => {
        const amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
        const wrapped = doc.splitTextToSize(item.description || '-', 92);
        const rowHeight = Math.max(8, wrapped.length * 5 + 2);
        if (index % 2 === 0) {
          doc.setFillColor(255, 252, 247);
          doc.rect(left, y - 4, pageWidth - 28, rowHeight, 'F');
        }
        doc.text(wrapped, left + 3, y);
        doc.text(String(item.quantity || 0), 128, y, { align: 'right' });
        doc.text(formatCurrency(item.rate || 0), 154, y, { align: 'right' });
        doc.text(formatCurrency(amount), right - 2, y, { align: 'right' });
        y += rowHeight;
        doc.setDrawColor(236, 228, 213);
        doc.line(left, y - 4, right, y - 4);
      });

      y += 4;
      const summaryBoxX = 118;
      const summaryBoxWidth = pageWidth - summaryBoxX - 14;
      const summaryRows: Array<[string, number]> = [
        ['Subtotal', subtotal],
        ['Discount', discountAmount],
        ['Tax', taxAmount],
        ['Advance', advanceAmount],
        ['Balance', balance],
      ];
      const summaryBoxHeight = 42;

      doc.setFillColor(255, 252, 247);
      doc.roundedRect(summaryBoxX, y - 2, summaryBoxWidth, summaryBoxHeight, 3, 3, 'F');
      doc.setDrawColor(219, 206, 182);
      doc.roundedRect(summaryBoxX, y - 2, summaryBoxWidth, summaryBoxHeight, 3, 3);

      let summaryY = y + 4;
      summaryRows.forEach(([label, value]) => {
        doc.setFont('helvetica', label === 'Balance' ? 'bold' : 'normal');
        doc.setFontSize(9);
        doc.setTextColor(70, 70, 70);
        doc.text(label, summaryBoxX + 4, summaryY);
        doc.text(formatCurrency(value), summaryBoxX + summaryBoxWidth - 4, summaryY, { align: 'right' });
        summaryY += 5.2;
      });

      doc.setDrawColor(214, 198, 168);
      doc.line(summaryBoxX + 4, summaryY, summaryBoxX + summaryBoxWidth - 4, summaryY);
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(58, 42, 26);
      doc.text('Total', summaryBoxX + 4, summaryY + 6.5);
      doc.text(formatCurrency(grandTotal), summaryBoxX + summaryBoxWidth - 4, summaryY + 6.5, { align: 'right' });

      if (form.notes.trim()) {
        y = Math.max(y + 48, summaryY + 16);
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text('Notes', left, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(64, 64, 64);
        const notesLines = doc.splitTextToSize(form.notes.trim(), 92);
        doc.roundedRect(left, y + 4, 92, Math.max(20, notesLines.length * 5 + 6), 2, 2);
        doc.text(notesLines, left + 4, y + 11);
      }

      const amountWordsY = pageHeight - 22;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(58, 42, 26);
      doc.text(`Amount in Words: ${numberToWords(grandTotal)}`, left, amountWordsY);

      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(58, 42, 26);
      doc.text('Authorised Signature', right, pageHeight - 16, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(108, 92, 76);
      doc.text('This is a computer-generated final bill.', left, pageHeight - 14);

      const safeName = form.customerName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'customer';
      doc.save(`${form.billNumber}-${safeName}.pdf`);
      setSaveMessage(`Saved bill ${form.billNumber} and downloaded the PDF.`);
    } finally {
      setSavingPdf(false);
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-slate-300 mt-4">Preparing bill workspace...</p>
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
              <h1 className="text-xl sm:text-3xl font-bold text-white">{editingBillId ? 'Edit Saved Bill' : 'Bill Generator'}</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                {editingBillId ? 'Update the saved bill and export the latest PDF version.' : 'Create final bills for completed work with clean PDF export.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/saved-bills')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-600/70 bg-slate-800/70 text-slate-100 font-semibold text-sm hover:bg-slate-700/80 transition-all active:scale-95"
            >
              <FolderOpen className="w-4 h-4" />
              Saved Bills
            </button>
            <button
              onClick={() => void saveBillRecord()}
              disabled={savingRecord || savingPdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-100 font-semibold text-sm hover:bg-emerald-500/25 transition-all active:scale-95 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {savingRecord ? 'Saving...' : editingBillId ? 'Update Bill' : 'Save Bill'}
            </button>
            <button
              onClick={exportBillPdf}
              disabled={savingPdf || savingRecord}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold text-sm hover:shadow-lg hover:shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {savingPdf ? 'Preparing PDF...' : 'Export PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4 sm:gap-6">
        <div className="space-y-4 sm:space-y-6">
          {saveMessage && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              <p className="text-sm">{saveMessage}</p>
            </div>
          )}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Bill Details</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs text-slate-400">Bill Number</span>
                <input
                  value={form.billNumber}
                  onChange={(e) => {
                    setBillNumberTouched(true);
                    setFormField('billNumber', e.target.value);
                  }}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Bill Date</span>
                <input type="date" value={form.billDate} onChange={(e) => setFormField('billDate', e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs text-slate-400">Work Completed Date</span>
                <input type="date" value={form.completionDate} onChange={(e) => setFormField('completionDate', e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white" />
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
                  <UserRound className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-semibold text-white">Billed To</h2>
                  <span className="text-xs text-slate-400">{jobs.length} jobs scanned</span>
                </div>
                {rememberedCustomers.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Remembered Customers</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {rememberedCustomers.map((customer) => (
                        <button
                          key={`${customer.name}-${customer.phone}-remembered`}
                          type="button"
                          onClick={() => applyCustomer(customer)}
                          className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-left hover:bg-slate-800/70 transition-colors"
                        >
                          <p className="text-sm font-medium text-white truncate">{customer.name}</p>
                          <p className="text-xs text-slate-400 truncate">
                            {customer.phone || 'No phone'}
                            {customer.lastBillNumber ? ` | ${customer.lastBillNumber}` : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                            <p className="text-xs text-slate-400">
                              {customer.phone || 'No phone'}
                              {customer.gstNo ? ` | GST ${customer.gstNo}` : ''}
                              {customer.lastBillNumber ? ` | ${customer.lastBillNumber}` : ''}
                              {!customer.lastBillNumber && customer.eventDetails ? ` | ${customer.eventDetails}` : ''}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input value={form.customerPhone} onChange={(e) => setFormField('customerPhone', e.target.value)} placeholder="Customer phone" className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400" />
                  <input value={form.customerGstNo} onChange={(e) => setFormField('customerGstNo', e.target.value)} placeholder="GST No" className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400" />
                  <textarea value={form.customerAddress} onChange={(e) => setFormField('customerAddress', e.target.value)} placeholder="Customer address" rows={3} className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Bill Items</h2>
              <button onClick={addItem} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 transition-colors">
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[1fr_90px_120px_48px] gap-3 bg-slate-900/40 rounded-xl p-3">
                  <input value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} placeholder={`Item ${index + 1}`} className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400" />
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
              <textarea value={form.notes} onChange={(e) => setFormField('notes', e.target.value)} rows={6} placeholder="Bill notes" className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400" />
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
                  <span className="text-xs text-slate-400">Advance Amount</span>
                  <input type="number" min="0" value={form.advanceAmount} onChange={(e) => setFormField('advanceAmount', Number(e.target.value))} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white" />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 sticky top-24">
            <h2 className="text-lg font-semibold text-white mb-4">Bill Summary</h2>
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
                <span>Advance</span>
                <span>{formatCurrency(advanceAmount)}</span>
              </div>
              <div className="h-px bg-slate-700/60 my-2" />
              <div className="flex justify-between text-lg font-semibold text-white">
                <span>Bill Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold text-amber-300">
                <span>Balance</span>
                <span>{formatCurrency(balance)}</span>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-slate-900/40 border border-slate-700/50">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Preview</p>
              <p className="text-white font-semibold">{form.customerName || 'Customer name'}</p>
              <p className="text-slate-400 text-sm mt-1">{form.customerPhone || 'Phone number'}</p>
              <p className="text-slate-400 text-sm mt-1">{form.customerGstNo || 'GST No'}</p>
              <p className="text-slate-300 text-sm mt-3">Bill #{form.billNumber}</p>
              {editingBillId && <p className="text-cyan-300 text-xs mt-1">Editing saved record</p>}
              <p className="text-slate-400 text-xs mt-1">Completed on {form.completionDate || '-'}</p>
            </div>

            <button
              onClick={exportBillPdf}
              disabled={savingPdf}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold hover:shadow-lg hover:shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {savingPdf ? 'Preparing PDF...' : 'Download Bill'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
