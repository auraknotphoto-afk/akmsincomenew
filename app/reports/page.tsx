'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import { ArrowLeft, Calendar, Download, FileSpreadsheet, FileText, TrendingUp, Filter, PieChart } from 'lucide-react';
import { db, Job } from '@/lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type TimePeriod = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'six_months' | 'this_year' | 'last_year' | 'all_time' | 'custom';

type CategorySummary = {
  category: string;
  totalJobs: number;
  totalIncome: number;
  totalPaid: number;
  totalPending: number;
  totalProfit: number;
  icon: string;
  color: string;
};

type PdfReportType = 'financial' | 'customer';

const REPORT_MARGIN = 4;
const REPORT_LOGO_WIDTH = 907;
const REPORT_LOGO_HEIGHT = 126;
const REPORT_LOGO_RATIO = REPORT_LOGO_WIDTH / REPORT_LOGO_HEIGHT;
const REPORT_THEME = {
  gold: [219, 161, 52] as const,
  black: [255, 255, 255] as const,
  text: [35, 35, 35] as const,
  muted: [102, 102, 102] as const,
  border: [222, 198, 140] as const,
  soft: [252, 248, 239] as const,
  paper: [255, 252, 247] as const,
};

function getDateRange(period: TimePeriod): { start: Date; end: Date; label: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3);

  switch (period) {
    case 'this_month':
      return {
        start: new Date(currentYear, currentMonth, 1),
        end: new Date(currentYear, currentMonth + 1, 0),
        label: 'This Month',
      };
    case 'last_month':
      return {
        start: new Date(currentYear, currentMonth - 1, 1),
        end: new Date(currentYear, currentMonth, 0),
        label: 'Last Month',
      };
    case 'this_quarter':
      return {
        start: new Date(currentYear, currentQuarter * 3, 1),
        end: new Date(currentYear, (currentQuarter + 1) * 3, 0),
        label: `Q${currentQuarter + 1} ${currentYear}`,
      };
    case 'last_quarter':
      const lastQ = currentQuarter === 0 ? 3 : currentQuarter - 1;
      const lastQYear = currentQuarter === 0 ? currentYear - 1 : currentYear;
      return {
        start: new Date(lastQYear, lastQ * 3, 1),
        end: new Date(lastQYear, (lastQ + 1) * 3, 0),
        label: `Q${lastQ + 1} ${lastQYear}`,
      };
    case 'six_months':
      return {
        start: new Date(currentYear, currentMonth - 5, 1),
        end: new Date(currentYear, currentMonth + 1, 0),
        label: 'Last 6 Months',
      };
    case 'this_year':
      return {
        start: new Date(currentYear, 0, 1),
        end: new Date(currentYear, 11, 31),
        label: `Year ${currentYear}`,
      };
    case 'last_year':
      return {
        start: new Date(currentYear - 1, 0, 1),
        end: new Date(currentYear - 1, 11, 31),
        label: `Year ${currentYear - 1}`,
      };
    case 'all_time':
    default:
      return {
        start: new Date(2000, 0, 1),
        end: new Date(currentYear + 10, 11, 31),
        label: 'All Time',
      };
  }
}

function getMonthlyBreakdown(jobs: Job[]): { month: string; income: number; paid: number; pending: number }[] {
  const monthlyData: Record<string, { income: number; paid: number; pending: number }> = {};
  
  jobs.forEach(job => {
    const dateStr = job.end_date || job.start_date;
    if (!dateStr) return;
    const [year, month] = dateStr.split('-').map(Number);
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, paid: 0, pending: 0 };
    }
    
    monthlyData[monthKey].income += job.total_price;
    monthlyData[monthKey].paid += job.amount_paid;
    monthlyData[monthKey].pending += (job.total_price - job.amount_paid);
  });
  
  return Object.entries(monthlyData)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, data]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      ...data,
    }));
}

function formatCurrency(value: number) {
  return `Rs.${value.toLocaleString('en-IN')}`;
}

function formatDisplayDate(value?: string) {
  if (!value) return '-';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN');
}

function getDateRows(job: Job) {
  return [
    { label: 'Start', value: formatDisplayDate(job.start_date) },
    { label: 'End', value: formatDisplayDate(job.end_date) },
    { label: 'Due', value: formatDisplayDate(job.estimated_due_date) },
    { label: 'Payment', value: formatDisplayDate(job.payment_date) },
  ];
}

function formatAllDates(job: Job) {
  return getDateRows(job)
    .map((row) => `${row.label}: ${row.value}`)
    .join(' | ');
}

function buildCustomerReport(jobs: Job[]) {
  const customerMap = new Map<
    string,
    {
      name: string;
      phone: string;
      totalIncome: number;
      totalPaid: number;
      totalPending: number;
      jobs: Job[];
    }
  >();

  jobs.forEach((job) => {
    const key = `${job.customer_name || ''}-${job.customer_phone || ''}`;
    const existing = customerMap.get(key);
    if (existing) {
      existing.totalIncome += job.total_price;
      existing.totalPaid += job.amount_paid;
      existing.totalPending += job.total_price - job.amount_paid;
      existing.jobs.push(job);
      return;
    }

    customerMap.set(key, {
      name: job.customer_name || 'Unknown Customer',
      phone: job.customer_phone || '-',
      totalIncome: job.total_price,
      totalPaid: job.amount_paid,
      totalPending: job.total_price - job.amount_paid,
      jobs: [job],
    });
  });

  return Array.from(customerMap.values()).sort((a, b) => b.totalIncome - a.totalIncome);
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadReportLogo() {
  const candidates = ['/ak-logo-final.png', '/report-logo.png', '/logo.png', '/brand-logo.png'];
  for (const path of candidates) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const blob = await res.blob();
      return await blobToDataUrl(blob);
    } catch {
      // Ignore missing logo candidates and keep trying.
    }
  }
  return null;
}

function fitText(text: string, max = 30) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

export default function ReportsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('this_month');
  const [customDateRange, setCustomDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [pdfExportLoading, setPdfExportLoading] = useState<PdfReportType | null>(null);

  const periods: { value: TimePeriod; label: string; icon: string }[] = [
    { value: 'this_month', label: 'This Month', icon: '📅' },
    { value: 'last_month', label: 'Last Month', icon: '📆' },
    { value: 'this_quarter', label: 'This Quarter', icon: '📊' },
    { value: 'last_quarter', label: 'Last Quarter', icon: '📈' },
    { value: 'six_months', label: '6 Months', icon: '📉' },
    { value: 'this_year', label: 'This Year', icon: '🗓️' },
    { value: 'last_year', label: 'Last Year', icon: '📋' },
    { value: 'all_time', label: 'All Time', icon: '🌟' },
    { value: 'custom', label: 'Custom', icon: '⚙️' },
  ];

  useEffect(() => {
    if (!authLoading && !user?.id) {
      router.push('/auth/login');
      return;
    }
    if (user?.id) fetchData(user.id);
  }, [selectedPeriod, customDateRange, selectedCategory, authLoading, user?.id, router]);

  async function fetchData(userId: string) {
    setLoading(true);
    try {
      const category =
        selectedCategory === 'ALL'
          ? undefined
          : (selectedCategory as 'EDITING' | 'EXPOSING' | 'ADDON');
      const data = await db.getJobs(userId, category);
      
      // Get date range
      let start: Date, end: Date;
      if (selectedPeriod === 'custom') {
        start = new Date(customDateRange.startDate);
        end = new Date(customDateRange.endDate);
      } else {
        const range = getDateRange(selectedPeriod);
        start = range.start;
        end = range.end;
      }
      
      // Helper function to parse date string as local time (not UTC)
      const parseLocalDate = (dateStr: string) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day); // month is 0-indexed
      };
      
      // Filter by event end_date (or start_date if end_date not available)
      const filtered = data.filter(job => {
        const jobDate = parseLocalDate(job.end_date || job.start_date);
        if (!jobDate) return false;
        return jobDate >= start && jobDate <= end;
      });
      
      setJobs(filtered);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate summaries
  const categorySummaries: CategorySummary[] = [
    {
      category: 'EDITING',
      icon: '🎬',
      color: 'purple',
      totalJobs: jobs.filter(j => j.category === 'EDITING').length,
      totalIncome: jobs.filter(j => j.category === 'EDITING').reduce((acc, j) => acc + j.total_price, 0),
      totalPaid: jobs.filter(j => j.category === 'EDITING').reduce((acc, j) => acc + j.amount_paid, 0),
      totalPending: jobs.filter(j => j.category === 'EDITING').reduce((acc, j) => acc + (j.total_price - j.amount_paid), 0),
      totalProfit: jobs.filter(j => j.category === 'EDITING').reduce((acc, j) => acc + (j.total_price - (j.expense || 0)), 0),
    },
    {
      category: 'EXPOSING',
      icon: '📸',
      color: 'cyan',
      totalJobs: jobs.filter(j => j.category === 'EXPOSING').length,
      totalIncome: jobs.filter(j => j.category === 'EXPOSING').reduce((acc, j) => acc + j.total_price, 0),
      totalPaid: jobs.filter(j => j.category === 'EXPOSING').reduce((acc, j) => acc + j.amount_paid, 0),
      totalPending: jobs.filter(j => j.category === 'EXPOSING').reduce((acc, j) => acc + (j.total_price - j.amount_paid), 0),
      totalProfit: jobs.filter(j => j.category === 'EXPOSING').reduce((acc, j) => acc + (j.total_price - (j.expense || 0)), 0),
    },
    {
      category: 'ADDON',
      icon: '💼',
      color: 'orange',
      totalJobs: jobs.filter(j => j.category === 'ADDON').length,
      totalIncome: jobs.filter(j => j.category === 'ADDON').reduce((acc, j) => acc + j.total_price, 0),
      totalPaid: jobs.filter(j => j.category === 'ADDON').reduce((acc, j) => acc + j.amount_paid, 0),
      totalPending: jobs.filter(j => j.category === 'ADDON').reduce((acc, j) => acc + (j.total_price - j.amount_paid), 0),
      totalProfit: jobs.filter(j => j.category === 'ADDON').reduce((acc, j) => acc + (j.total_price - (j.expense || 0)), 0),
    },
  ];

  const totals = {
    jobs: jobs.length,
    income: jobs.reduce((acc, j) => acc + j.total_price, 0),
    paid: jobs.reduce((acc, j) => acc + j.amount_paid, 0),
    pending: jobs.reduce((acc, j) => acc + (j.total_price - j.amount_paid), 0),
  };

  const monthlyBreakdown = getMonthlyBreakdown(jobs);

  const periodLabel = selectedPeriod === 'custom' 
    ? `${customDateRange.startDate} to ${customDateRange.endDate}`
    : getDateRange(selectedPeriod).label;

  function exportToCSV() {
    const headers = ['Start Date', 'End Date', 'Due Date', 'Payment Date', 'Category', 'Customer', 'Type of Work', 'Total Price', 'Amount Paid', 'Balance', 'Payment Status', 'Job Status'];
    const rows = jobs.map(job => [
      job.start_date,
      job.end_date || '-',
      job.estimated_due_date || '-',
      job.payment_date || '-',
      job.category,
      job.customer_name,
      job.type_of_work || '-',
      job.total_price,
      job.amount_paid,
      job.total_price - job.amount_paid,
      job.payment_status,
      job.status,
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-knot-report-${periodLabel.replace(/\s/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function drawReportFrame(
    doc: jsPDF,
    title: string,
    subtitle: string,
    logoDataUrl: string | null
  ) {
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    doc.setFillColor(...REPORT_THEME.paper);
    doc.rect(0, 0, width, height, 'F');

    doc.setFillColor(...REPORT_THEME.black);
    doc.rect(0, 0, width, 30, 'F');
    doc.setFillColor(...REPORT_THEME.gold);
    doc.rect(0, 30, width, 2.4, 'F');

    doc.setDrawColor(...REPORT_THEME.gold);
    doc.setLineWidth(0.6);
    doc.line(REPORT_MARGIN, 38.5, width - REPORT_MARGIN, 38.5);

    if (logoDataUrl) {
      const maxLogoWidth = 82;
      const maxLogoHeight = 11.4;
      const logoWidth = Math.min(maxLogoWidth, maxLogoHeight * REPORT_LOGO_RATIO);
      const logoHeight = logoWidth / REPORT_LOGO_RATIO;
      doc.addImage(logoDataUrl, 'PNG', REPORT_MARGIN + 2, 8.8, logoWidth, logoHeight);
    } else {
      doc.setFillColor(...REPORT_THEME.gold);
      doc.circle(REPORT_MARGIN + 12, 15, 8, 'F');
      doc.setTextColor(...REPORT_THEME.text);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('AK', REPORT_MARGIN + 8.7, 16.5);
    }

    doc.setTextColor(...REPORT_THEME.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(title.toUpperCase(), width - REPORT_MARGIN - 3, 11, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(subtitle, width - REPORT_MARGIN - 3, 17, { align: 'right' });

    doc.setTextColor(...REPORT_THEME.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Prepared for studio records and client-ready reporting', REPORT_MARGIN, 36);
  }

  function addPageFooter(doc: jsPDF) {
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...REPORT_THEME.muted);
      doc.text(`Page ${i} of ${pageCount}`, width - REPORT_MARGIN - 10, height - 4.5);
    }
  }

  function drawSummaryGrid(
    doc: jsPDF,
    items: { label: string; value: string }[],
    startY: number
  ) {
    const widths = [68, 68, 68, 68];
    const totalWidth = widths.reduce((sum, item) => sum + item, 0);
    let x = REPORT_MARGIN;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setFillColor(...REPORT_THEME.black);
    doc.rect(REPORT_MARGIN, startY - 4, totalWidth, 6.5, 'F');
    items.forEach((item, index) => {
      doc.setDrawColor(...REPORT_THEME.gold);
      doc.rect(x, startY - 4, widths[index], 6.5, 'S');
      doc.setTextColor(...REPORT_THEME.text);
      doc.text(item.label, x + 2, startY);
      x += widths[index];
    });

    const nextY = startY + 5.5;
    return drawTableRow(
      doc,
      items.map((item) => item.value),
      widths,
      nextY,
      false
    );
  }

  function drawSectionTitle(doc: jsPDF, title: string, y: number) {
    const width = doc.internal.pageSize.getWidth();
    doc.setFillColor(...REPORT_THEME.black);
    doc.roundedRect(REPORT_MARGIN, y - 4.5, width - REPORT_MARGIN * 2, 7.5, 1.5, 1.5, 'F');
    doc.setFillColor(...REPORT_THEME.gold);
    doc.rect(REPORT_MARGIN, y - 4.5, 24, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...REPORT_THEME.text);
    doc.text(title.toUpperCase(), REPORT_MARGIN + 28, y);
    return y + 7.5;
  }

  function drawTableHeader(doc: jsPDF, headers: string[], widths: number[], y: number) {
    const totalWidth = widths.reduce((sum, item) => sum + item, 0);
    let x = REPORT_MARGIN;
    const topY = y - 3.8;
    const rowHeight = 6;
    doc.setFillColor(...REPORT_THEME.black);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.rect(REPORT_MARGIN, topY, totalWidth, rowHeight, 'F');
    doc.setDrawColor(...REPORT_THEME.gold);
    doc.rect(REPORT_MARGIN, topY, totalWidth, rowHeight);
    headers.forEach((header, index) => {
      if (index > 0) {
        doc.line(x, topY, x, topY + rowHeight);
      }
      doc.setTextColor(...REPORT_THEME.text);
      doc.text(header, x + 2, y);
      x += widths[index];
    });
    return y + 5.5;
  }

  function drawTableRow(doc: jsPDF, values: string[], widths: number[], y: number, shaded = false) {
    let x = REPORT_MARGIN;
    const totalWidth = widths.reduce((sum, item) => sum + item, 0);
    const topY = y - 3.8;
    const rowHeight = 5.6;
    if (shaded) {
      doc.setFillColor(248, 248, 248);
      doc.rect(REPORT_MARGIN, topY, totalWidth, rowHeight, 'F');
    }
    doc.setTextColor(...REPORT_THEME.text);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setDrawColor(...REPORT_THEME.border);
    doc.line(REPORT_MARGIN, topY + rowHeight, REPORT_MARGIN + totalWidth, topY + rowHeight);
    doc.line(REPORT_MARGIN, topY, REPORT_MARGIN, topY + rowHeight);
    values.forEach((value, index) => {
      if (index > 0) {
        doc.line(x, topY, x, topY + rowHeight);
      }
      doc.text(fitText(value, Math.max(10, Math.floor(widths[index] / 2.1))), x + 1.5, y);
      x += widths[index];
    });
    doc.line(REPORT_MARGIN + totalWidth, topY, REPORT_MARGIN + totalWidth, topY + rowHeight);
    return y + 5;
  }

  function ensurePdfPage(
    doc: jsPDF,
    y: number,
    title: string,
    subtitle: string,
    logoDataUrl: string | null,
    minBottom = 28
  ) {
    const height = doc.internal.pageSize.getHeight();
    if (y <= height - minBottom) return y;
    doc.addPage();
    drawReportFrame(doc, title, subtitle, logoDataUrl);
    return 44;
  }

  async function exportFinancialPDF(logoDataUrl: string | null) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const title = 'Financial Report';
    const subtitle = `${periodLabel}  |  Generated ${new Date().toLocaleDateString('en-IN')}`;
    drawReportFrame(doc, title, subtitle, logoDataUrl);
    let y = 44;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...REPORT_THEME.text);
    doc.text('Financial Summary Snapshot', REPORT_MARGIN, y + 2);
    y = drawSummaryGrid(
      doc,
      [
        { label: 'Total Jobs', value: String(totals.jobs) },
        { label: 'Total Income', value: formatCurrency(totals.income) },
        { label: 'Amount Received', value: formatCurrency(totals.paid) },
        { label: 'Pending Amount', value: formatCurrency(totals.pending) },
      ],
      y + 8
    );

    y = drawSectionTitle(doc, 'Category Breakdown', y + 5);
    y = drawTableHeader(doc, ['Category', 'Jobs', 'Income', 'Paid', 'Pending', 'Profit'], [50, 22, 45, 45, 45, 45], y);
    categorySummaries.forEach((category, index) => {
      y = ensurePdfPage(doc, y, title, subtitle, logoDataUrl);
      y = drawTableRow(
        doc,
        [
          category.category,
          String(category.totalJobs),
          formatCurrency(category.totalIncome),
          formatCurrency(category.totalPaid),
          formatCurrency(category.totalPending),
          formatCurrency(category.totalProfit),
        ],
        [50, 22, 45, 45, 45, 45],
        y,
        index % 2 === 0
      );
    });

    y = drawSectionTitle(doc, 'Monthly Breakdown', y + 3);
    y = drawTableHeader(doc, ['Month', 'Income', 'Paid', 'Pending'], [72, 66, 66, 66], y);
    monthlyBreakdown.forEach((month, index) => {
      y = ensurePdfPage(doc, y, title, subtitle, logoDataUrl);
      y = drawTableRow(
        doc,
        [
          month.month,
          formatCurrency(month.income),
          formatCurrency(month.paid),
          formatCurrency(month.pending),
        ],
        [72, 66, 66, 66],
        y,
        index % 2 === 0
      );
    });

    y = drawSectionTitle(doc, 'Transactions', y + 3);
    y = drawTableHeader(
      doc,
      ['Studio/Customer Name', 'Category', 'Start', 'End', 'Due', 'Payment', 'Total Amount', 'Amount Paid', 'Balance', 'Profit'],
      [54, 22, 22, 22, 22, 24, 28, 28, 28, 28],
      y
    );
    jobs.forEach((job, index) => {
      y = ensurePdfPage(doc, y, title, subtitle, logoDataUrl);
      y = drawTableRow(
        doc,
        [
          job.customer_name,
          job.category,
          formatDisplayDate(job.start_date),
          formatDisplayDate(job.end_date),
          formatDisplayDate(job.estimated_due_date),
          formatDisplayDate(job.payment_date),
          formatCurrency(job.total_price),
          formatCurrency(job.amount_paid),
          formatCurrency(job.total_price - job.amount_paid),
          formatCurrency(job.total_price - (job.expense || 0)),
        ],
        [54, 22, 22, 22, 22, 24, 28, 28, 28, 28],
        y,
        index % 2 === 0
      );
    });

    addPageFooter(doc);
    doc.save(`financial-report-${periodLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  }

  async function exportCustomerPDF(logoDataUrl: string | null) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const title = 'Customer Report';
    const subtitle = `${periodLabel}  |  Generated ${new Date().toLocaleDateString('en-IN')}`;
    const customerReport = buildCustomerReport(jobs);

    drawReportFrame(doc, title, subtitle, logoDataUrl);
    let y = 44;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...REPORT_THEME.text);
    doc.text('Customer Summary Snapshot', REPORT_MARGIN, y + 2);
    y = drawSummaryGrid(
      doc,
      [
        { label: 'Total Customers', value: String(customerReport.length) },
        { label: 'Total Entries', value: String(jobs.length) },
        { label: 'Total Amount', value: formatCurrency(totals.income) },
        { label: 'Balance Pending', value: formatCurrency(totals.pending) },
      ],
      y + 8
    );

    y = drawSectionTitle(doc, 'Customer Overview', y + 5);
    y = drawTableHeader(
      doc,
      ['Studio/Customer Name', 'Phone Number', 'Entries Count', 'Total Amount', 'Amount Paid', 'Balance Pending'],
      [70, 38, 24, 44, 44, 50],
      y
    );
    customerReport.forEach((customer, index) => {
      y = ensurePdfPage(doc, y, title, subtitle, logoDataUrl);
      y = drawTableRow(
        doc,
        [
          customer.name,
          customer.phone,
          String(customer.jobs.length),
          formatCurrency(customer.totalIncome),
          formatCurrency(customer.totalPaid),
          formatCurrency(customer.totalPending),
        ],
        [70, 38, 24, 44, 44, 50],
        y,
        index % 2 === 0
      );
    });

    y = drawSectionTitle(doc, 'Customer Entries', y + 4);
    y = drawTableHeader(
      doc,
      ['Studio/Customer Name', 'Work/Event', 'Category', 'Start', 'End', 'Due', 'Payment', 'Total Amount', 'Amount Paid', 'Balance'],
      [34, 44, 18, 20, 20, 20, 22, 26, 26, 26],
      y
    );
    jobs.forEach((job, index) => {
      const workLabel = job.event_type || job.type_of_work || job.studio_name || job.category;
      y = ensurePdfPage(doc, y, title, subtitle, logoDataUrl);
      y = drawTableRow(
        doc,
        [
          job.customer_name,
          workLabel,
          job.category,
          formatDisplayDate(job.start_date),
          formatDisplayDate(job.end_date),
          formatDisplayDate(job.estimated_due_date),
          formatDisplayDate(job.payment_date),
          formatCurrency(job.total_price),
          formatCurrency(job.amount_paid),
          formatCurrency(job.total_price - job.amount_paid),
        ],
        [34, 44, 18, 20, 20, 20, 22, 26, 26, 26],
        y,
        index % 2 === 0
      );
    });

    addPageFooter(doc);
    doc.save(`customer-report-${periodLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  }

  async function exportToPDF(type: PdfReportType) {
    setPdfExportLoading(type);
    try {
      const logoDataUrl = await loadReportLogo();
      if (type === 'customer') {
        await exportCustomerPDF(logoDataUrl);
        return;
      }
      await exportFinancialPDF(logoDataUrl);
    } finally {
      setPdfExportLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10 backdrop-blur-sm bg-black/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <button onClick={() => router.back()} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors active:scale-95">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                  <span className="text-xl sm:text-3xl">📊</span> Reports
                </h1>
                <p className="text-indigo-300 text-xs sm:text-sm mt-0.5 sm:mt-1 hidden sm:block">Analyze your income by period</p>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button onClick={exportToCSV} className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white/10 text-white font-medium text-xs sm:text-sm hover:bg-white/20 transition-colors active:scale-95">
                <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">CSV</span>
              </button>
              <button onClick={() => exportToPDF('financial')} disabled={pdfExportLoading !== null} className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-xs sm:text-sm hover:shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-95 disabled:opacity-60">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">{pdfExportLoading === 'financial' ? 'Preparing...' : 'Financial PDF'}</span><span className="sm:hidden">PDF 1</span>
              </button>
              <button onClick={() => exportToPDF('customer')} disabled={pdfExportLoading !== null} className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold text-xs sm:text-sm hover:shadow-lg hover:shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-60">
                <Download className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">{pdfExportLoading === 'customer' ? 'Preparing...' : 'Customer PDF'}</span><span className="sm:hidden">PDF 2</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Time Period Quick Select */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
            <h2 className="text-sm sm:text-lg font-semibold text-white">Select Period</h2>
            <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-xs sm:text-sm font-medium">
              {periodLabel}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {periods.map((period) => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all active:scale-95 ${
                  selectedPeriod === period.value
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <span className="mr-1 sm:mr-2">{period.icon}</span>
                <span className="hidden xs:inline">{period.label}</span>
                <span className="xs:hidden">{period.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range & Category Filter */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
            <h2 className="text-sm sm:text-lg font-semibold text-white">Filters</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {selectedPeriod === 'custom' && (
              <>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-indigo-300 mb-1.5 sm:mb-2">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                    <input type="date" value={customDateRange.startDate} onChange={(e) => setCustomDateRange({ ...customDateRange, startDate: e.target.value })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 touch-manipulation" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-indigo-300 mb-1.5 sm:mb-2">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                    <input type="date" value={customDateRange.endDate} onChange={(e) => setCustomDateRange({ ...customDateRange, endDate: e.target.value })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 touch-manipulation" />
                  </div>
                </div>
              </>
            )}
            <div className={selectedPeriod !== 'custom' ? 'sm:col-span-2 md:col-span-3 md:max-w-xs' : ''}>
              <label className="block text-xs sm:text-sm font-medium text-indigo-300 mb-1.5 sm:mb-2">Category</label>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 touch-manipulation">
                <option value="ALL" className="bg-slate-800">All Categories</option>
                <option value="EDITING" className="bg-slate-800">🎬 Editing</option>
                <option value="EXPOSING" className="bg-slate-800">📸 Exposing</option>
                <option value="ADDON" className="bg-slate-800">💼 Add-on Income</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-indigo-300 mt-4 text-sm sm:text-base">Loading report data...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-8">
              <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 backdrop-blur border border-emerald-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <p className="text-emerald-300 text-[10px] sm:text-sm font-medium">Total Jobs</p>
                <p className="text-xl sm:text-3xl font-bold text-white mt-1 sm:mt-2">{totals.jobs}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-600/20 to-blue-600/5 backdrop-blur border border-blue-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <p className="text-blue-300 text-[10px] sm:text-sm font-medium">Total Income</p>
                <p className="text-lg sm:text-3xl font-bold text-white mt-1 sm:mt-2">₹{totals.income.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-gradient-to-br from-cyan-600/20 to-cyan-600/5 backdrop-blur border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <p className="text-cyan-300 text-[10px] sm:text-sm font-medium">Received</p>
                <p className="text-lg sm:text-3xl font-bold text-white mt-1 sm:mt-2">₹{totals.paid.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-600/20 to-amber-600/5 backdrop-blur border border-amber-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <p className="text-amber-300 text-[10px] sm:text-sm font-medium">Pending</p>
                <p className="text-lg sm:text-3xl font-bold text-white mt-1 sm:mt-2">₹{totals.pending.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-8">
              {categorySummaries.map((cat) => (
                <div key={cat.category} className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-indigo-500/50 transition-all active:scale-[0.99]">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <span className="text-xl sm:text-3xl">{cat.icon}</span>
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                  </div>
                  <h3 className="text-sm sm:text-lg font-bold text-white mb-2 sm:mb-3">{cat.category}</h3>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-400">Jobs</span>
                      <span className="text-white font-medium">{cat.totalJobs}</span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-400">Total Income</span>
                      <span className="text-blue-400 font-medium">₹{cat.totalIncome.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-400">Received</span>
                      <span className="text-emerald-400 font-medium">₹{cat.totalPaid.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-400">Pending</span>
                      <span className="text-amber-400 font-medium">₹{cat.totalPending.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Monthly Breakdown - Mobile Card View */}
            {monthlyBreakdown.length > 0 && (
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden mb-4 sm:mb-8">
                <div className="p-4 sm:p-6 border-b border-white/10">
                  <h2 className="text-sm sm:text-lg font-bold text-white flex items-center gap-2">
                    <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" /> Monthly Breakdown
                  </h2>
                </div>
                
                {/* Mobile Card View */}
                <div className="sm:hidden p-4 space-y-3">
                  {monthlyBreakdown.map((month, index) => (
                    <div key={index} className="bg-white/5 rounded-lg p-3">
                      <p className="text-white font-medium text-sm mb-2">{month.month}</p>
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        <div className="flex items-center justify-between">
                          <p className="text-gray-400">Income</p>
                          <p className="text-blue-400 font-medium">Rs.{month.income.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-gray-400">Received</p>
                          <p className="text-emerald-400 font-medium">Rs.{month.paid.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-gray-400">Pending</p>
                          <p className="text-amber-400 font-medium">Rs.{month.pending.toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="text-left py-4 px-6 text-sm font-medium text-indigo-300">Month</th>
                        <th className="text-right py-4 px-6 text-sm font-medium text-indigo-300">Total Income</th>
                        <th className="text-right py-4 px-6 text-sm font-medium text-indigo-300">Received</th>
                        <th className="text-right py-4 px-6 text-sm font-medium text-indigo-300">Pending</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {monthlyBreakdown.map((month, index) => (
                        <tr key={index} className="hover:bg-white/5 transition-colors">
                          <td className="py-4 px-6 text-sm text-white font-medium">{month.month}</td>
                          <td className="py-4 px-6 text-sm text-blue-400 text-right">₹{month.income.toLocaleString('en-IN')}</td>
                          <td className="py-4 px-6 text-sm text-emerald-400 text-right">₹{month.paid.toLocaleString('en-IN')}</td>
                          <td className="py-4 px-6 text-sm text-amber-400 text-right">₹{month.pending.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-white/5">
                      <tr>
                        <td className="py-4 px-6 text-sm text-white font-bold">Total</td>
                        <td className="py-4 px-6 text-sm text-blue-400 font-bold text-right">₹{totals.income.toLocaleString('en-IN')}</td>
                        <td className="py-4 px-6 text-sm text-emerald-400 font-bold text-right">₹{totals.paid.toLocaleString('en-IN')}</td>
                        <td className="py-4 px-6 text-sm text-amber-400 font-bold text-right">₹{totals.pending.toLocaleString('en-IN')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Transactions - Mobile Card View */}
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden pb-24 sm:pb-0">
              <div className="p-4 sm:p-6 border-b border-white/10">
                <h2 className="text-sm sm:text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" /> Transactions ({jobs.length})
                </h2>
              </div>
              {jobs.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-4xl sm:text-5xl">📭</span>
                  <h3 className="text-base sm:text-lg font-bold text-white mt-4">No Transactions Found</h3>
                  <p className="text-indigo-300 text-sm mt-2">Try selecting a different time period</p>
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="sm:hidden p-4 space-y-3">
                    {jobs.map((job) => (
                      <div key={job.id} className="bg-white/5 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-white font-medium text-sm">{job.customer_name}</p>
                            <div className="mt-1 space-y-0.5">
                              {getDateRows(job).map((row) => (
                                <p key={row.label} className="text-gray-400 text-xs">
                                  {row.label}: {row.value}
                                </p>
                              ))}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            job.category === 'EDITING' ? 'bg-purple-500/20 text-purple-400' :
                            job.category === 'EXPOSING' ? 'bg-cyan-500/20 text-cyan-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`}>
                            {job.category}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-xs">
                            <span className="text-white font-medium">₹{job.total_price.toLocaleString('en-IN')}</span>
                            <span className="text-gray-400"> | Bal: </span>
                            <span className="text-amber-400">₹{(job.total_price - job.amount_paid).toLocaleString('en-IN')}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            job.payment_status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                            job.payment_status === 'PARTIAL' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {job.payment_status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="text-left py-4 px-6 text-sm font-medium text-indigo-300">Start</th>
                          <th className="text-left py-4 px-6 text-sm font-medium text-indigo-300">End</th>
                          <th className="text-left py-4 px-6 text-sm font-medium text-indigo-300">Due</th>
                          <th className="text-left py-4 px-6 text-sm font-medium text-indigo-300">Payment</th>
                          <th className="text-left py-4 px-6 text-sm font-medium text-indigo-300">Category</th>
                          <th className="text-left py-4 px-6 text-sm font-medium text-indigo-300">Customer</th>
                          <th className="text-right py-4 px-6 text-sm font-medium text-indigo-300">Total</th>
                          <th className="text-right py-4 px-6 text-sm font-medium text-indigo-300">Paid</th>
                          <th className="text-right py-4 px-6 text-sm font-medium text-indigo-300">Balance</th>
                          <th className="text-center py-4 px-6 text-sm font-medium text-indigo-300">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {jobs.map((job) => (
                          <tr key={job.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-4 px-6 text-sm text-white">{formatDisplayDate(job.start_date)}</td>
                            <td className="py-4 px-6 text-sm text-white">{formatDisplayDate(job.end_date)}</td>
                            <td className="py-4 px-6 text-sm text-white">{formatDisplayDate(job.estimated_due_date)}</td>
                            <td className="py-4 px-6 text-sm text-white">{formatDisplayDate(job.payment_date)}</td>
                            <td className="py-4 px-6 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                job.category === 'EDITING' ? 'bg-purple-500/20 text-purple-400' :
                                job.category === 'EXPOSING' ? 'bg-cyan-500/20 text-cyan-400' :
                                'bg-orange-500/20 text-orange-400'
                              }`}>
                                {job.category}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-sm text-white">{job.customer_name}</td>
                            <td className="py-4 px-6 text-sm text-white text-right">₹{job.total_price.toLocaleString('en-IN')}</td>
                            <td className="py-4 px-6 text-sm text-emerald-400 text-right">₹{job.amount_paid.toLocaleString('en-IN')}</td>
                            <td className="py-4 px-6 text-sm text-amber-400 text-right">₹{(job.total_price - job.amount_paid).toLocaleString('en-IN')}</td>
                            <td className="py-4 px-6 text-sm text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                job.payment_status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                                job.payment_status === 'PARTIAL' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {job.payment_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}



