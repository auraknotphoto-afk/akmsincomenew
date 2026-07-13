'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  Plus,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react';
import { db, Job } from '@/lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type BillPaperSize = 'A4' | 'A5';
type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHERS';
type BillCompletionStatus = 'COMPLETED' | 'NOT_COMPLETED';

type BillItem = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
};

type CustomerSuggestion = {
  name: string;
  phone: string;
  eventType: string;
  eventDates: string;
  address: string;
  gstNo: string;
  source: 'bill' | 'job';
  lastBillNumber?: string;
};

type BillForm = {
  billNumber: string;
  billDate: string;
  completionDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerGstNo: string;
  eventType: string;
  eventDates: string;
  notes: string;
  discountPercent: number;
  taxPercent: number;
  advanceAmount: number;
  completionStatus: BillCompletionStatus;
  paymentMode: PaymentMode;
  paymentDate: string;
  transactionReference: string;
};

type SavedBillRecord = BillForm & {
  id: string;
  items: BillItem[];
  paperSize?: BillPaperSize;
  showPaymentDetails?: boolean;
  showTermsAndNotes?: boolean;
  businessName?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessAddress?: string;
};

type BillNumberRecord = {
  id: string;
  billNumber: string;
  billDate: string;
};

type PdfLayoutConfig = {
  margin: number;
  topBandHeight: number;
  headerHeight: number;
  logoWidth: number;
  baseFontSize: number;
  smallFontSize: number;
  tableRowHeight: number;
  sectionGap: number;
  badgeWidth: number;
  customerSectionHeight: number;
  tableHeaderHeight: number;
  totalsHeight: number;
  bottomSectionHeight: number;
  footerHeight: number;
  footerStripHeight: number;
};

type TableColumns = {
  x: number;
  width: number;
  serialWidth: number;
  descriptionWidth: number;
  qtyWidth: number;
  rateWidth: number;
  amountWidth: number;
  serialX: number;
  descriptionX: number;
  qtyX: number;
  rateX: number;
  amountX: number;
};

type RenderRow = {
  serial: string;
  descriptionLines: string[];
  qty: string;
  rate: string;
  amount: string;
  height: number;
  isEmpty: boolean;
};

const BUSINESS_DETAILS = {
  name: 'AURA KNOT PHOTOGRAPHY',
  tagline: 'CONNECTING MOMENTS, CAPTURING ESSENCE',
  address: 'Perundurai, Erode, Tamil Nadu - 638052',
  phone: '+91 8610 100 885',
  email: 'auraknot.photo@gmail.com',
  website: 'www.auraknotphotography.in',
  instagram: '@aura_knot_photography',
} as const;

const PAPER_SIZE_CONFIG = {
  A4: {
    jsPdfFormat: 'a4',
    width: 210,
    height: 297,
    label: 'A4',
  },
  A5: {
    jsPdfFormat: 'a5',
    width: 148,
    height: 210,
    label: 'A5',
  },
} as const;

const PDF_LAYOUTS: Record<BillPaperSize, PdfLayoutConfig> = {
  A4: {
    margin: 8,
    topBandHeight: 9,
    headerHeight: 42,
    logoWidth: 52,
    baseFontSize: 9,
    smallFontSize: 7,
    tableRowHeight: 8,
    sectionGap: 4,
    badgeWidth: 28,
    customerSectionHeight: 28,
    tableHeaderHeight: 9,
    totalsHeight: 30,
    bottomSectionHeight: 42,
    footerHeight: 20,
    footerStripHeight: 9,
  },
  A5: {
    margin: 5,
    topBandHeight: 7,
    headerHeight: 32,
    logoWidth: 34,
    baseFontSize: 7,
    smallFontSize: 5.5,
    tableRowHeight: 6,
    sectionGap: 2.5,
    badgeWidth: 20,
    customerSectionHeight: 22,
    tableHeaderHeight: 7,
    totalsHeight: 25,
    bottomSectionHeight: 30,
    footerHeight: 18,
    footerStripHeight: 7,
  },
};

const PAYMENT_MODE_OPTIONS: Array<{ value: PaymentMode; label: string }> = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OTHERS', label: 'Others' },
];

const STATIC_TERMS = [
  'Payment is due as per the agreed schedule.',
  'Balance payment to be cleared before delivery.',
  'Cheque / DD to be in favour of "AURA KNOT PHOTOGRAPHY".',
  'We appreciate your trust in us. Thank you!',
];

const MINIMUM_VISIBLE_ROWS = 10;
const GOLD = [196, 154, 67] as const;
const BLACK = [24, 24, 27] as const;
const CHARCOAL = [55, 65, 81] as const;
const LIGHT_BORDER = [214, 214, 219] as const;
const LIGHT_FILL = [249, 250, 251] as const;
const WHITE = [255, 255, 255] as const;
const BILL_LOGO_WIDTH = 3000;
const BILL_LOGO_HEIGHT = 2000;
const BILL_LOGO_RATIO = BILL_LOGO_WIDTH / BILL_LOGO_HEIGHT;

function createItem(): BillItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    quantity: 1,
    rate: 0,
  };
}

function getTodayIsoDate() {
  return new Date().toISOString().split('T')[0];
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

function getBillSequenceForDate(
  dateValue: string,
  bills: BillNumberRecord[],
  currentBillId?: string | null
) {
  const { startShort, endShort } = getFiscalYearParts(dateValue);
  const prefix = `AKP/BILL/${startShort}-${endShort}/`;

  return (
    bills
      .filter((bill) => bill.id !== currentBillId && bill.billNumber.startsWith(prefix))
      .reduce((max, bill) => {
        const sequence = Number(bill.billNumber.split('/').pop() || 0);
        return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
      }, 0) + 1
  );
}

function formatCurrency(value: number) {
  return `Rs.${value.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  })}`;
}

function formatPdfCurrency(value: number) {
  return `Rs. ${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

  return `${ones[Math.floor(value / 100)]} Hundred${
    value % 100 ? ` ${convertBelowThousand(value % 100)}` : ''
  }`.trim();
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

function formatDisplayDate(dateValue?: string) {
  if (!dateValue) return '-';
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateValue;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatEventDates(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return '';
  if (startDate && endDate && startDate !== endDate) {
    return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
  }
  return formatDisplayDate(startDate || endDate);
}

function getJobEventType(job: Job) {
  return (job.event_details || job.type_of_work || job.event_type || '').trim();
}

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
    const response = await fetch('/03%20copy.png');
    if (!response.ok) return null;
    return await blobToDataUrl(await response.blob());
  } catch {
    return null;
  }
}

function getTableColumns(pageWidth: number, margin: number): TableColumns {
  const x = margin;
  const width = pageWidth - margin * 2;
  const serialWidth = width * 0.08;
  const qtyWidth = width * 0.1;
  const rateWidth = width * 0.17;
  const amountWidth = width * 0.19;
  const descriptionWidth = width - serialWidth - qtyWidth - rateWidth - amountWidth;

  return {
    x,
    width,
    serialWidth,
    descriptionWidth,
    qtyWidth,
    rateWidth,
    amountWidth,
    serialX: x,
    descriptionX: x + serialWidth,
    qtyX: x + serialWidth + descriptionWidth,
    rateX: x + serialWidth + descriptionWidth + qtyWidth,
    amountX: x + serialWidth + descriptionWidth + qtyWidth + rateWidth,
  };
}

function buildRenderRows(
  doc: jsPDF,
  items: BillItem[],
  layout: PdfLayoutConfig,
  columns: TableColumns
): RenderRow[] {
  const rows: RenderRow[] = items.map((item, index) => {
    const descriptionLines = doc.splitTextToSize(item.description || '', columns.descriptionWidth - 4);
    const amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);

    return {
      serial: String(index + 1),
      descriptionLines: descriptionLines.length ? descriptionLines : [''],
      qty: String(Number(item.quantity) || 0),
      rate: formatPdfCurrency(Number(item.rate) || 0),
      amount: formatPdfCurrency(amount),
      height: Math.max(
        layout.tableRowHeight,
        descriptionLines.length * (layout.baseFontSize * 0.55) + 3
      ),
      isEmpty: false,
    };
  });

  const emptyRowCount = Math.max(0, MINIMUM_VISIBLE_ROWS - rows.length);
  for (let index = 0; index < emptyRowCount; index += 1) {
    rows.push({
      serial: '',
      descriptionLines: [''],
      qty: '',
      rate: '',
      amount: '',
      height: layout.tableRowHeight,
      isEmpty: true,
    });
  }

  return rows;
}

function paginateRows(
  rows: RenderRow[],
  startY: number,
  pageHeight: number,
  layout: PdfLayoutConfig,
  finalSectionHeight: number
) {
  const safeBottom = pageHeight - layout.margin - finalSectionHeight;
  const pages: RenderRow[][] = [];
  let currentPage: RenderRow[] = [];
  let cursorY = startY;

  rows.forEach((row) => {
    if (currentPage.length > 0 && cursorY + row.height > safeBottom) {
      pages.push(currentPage);
      currentPage = [];
      cursorY = startY;
    }
    currentPage.push(row);
    cursorY += row.height;
  });

  pages.push(currentPage.length > 0 ? currentPage : []);
  return pages;
}

function drawTopBorder(doc: jsPDF, pageWidth: number, layout: PdfLayoutConfig) {
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageWidth, layout.topBandHeight, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, layout.topBandHeight - 1.1, pageWidth, 1.1, 'F');
}

function drawHeader(
  doc: jsPDF,
  pageWidth: number,
  layout: PdfLayoutConfig,
  logoDataUrl: string | null,
  form: BillForm,
  pageLabel?: string
) {
  const { margin } = layout;
  const headerTop = layout.topBandHeight + 4;
  const centerX = pageWidth / 2;
  const badgeWidth = layout.badgeWidth;
  const badgeX = pageWidth - margin - badgeWidth;
  const badgeY = headerTop;

  if (logoDataUrl) {
    const logoHeight = layout.logoWidth / BILL_LOGO_RATIO;
    doc.addImage(logoDataUrl, 'PNG', margin, headerTop, layout.logoWidth, logoHeight);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(layout.baseFontSize + 3);
  doc.setTextColor(...BLACK);
  doc.text(BUSINESS_DETAILS.name, centerX, headerTop + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(layout.smallFontSize + 0.8);
  doc.setTextColor(...CHARCOAL);
  doc.text(BUSINESS_DETAILS.tagline, centerX, headerTop + 8.5, { align: 'center' });
  doc.text(BUSINESS_DETAILS.address, centerX, headerTop + 13, { align: 'center' });
  doc.text(`${BUSINESS_DETAILS.phone} | ${BUSINESS_DETAILS.email}`, centerX, headerTop + 17.2, {
    align: 'center',
  });
  doc.text(BUSINESS_DETAILS.website, centerX, headerTop + 21.4, { align: 'center' });

  doc.setFillColor(...BLACK);
  doc.roundedRect(badgeX, badgeY, badgeWidth, 14, 2, 2, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(badgeX, badgeY + 11.5, badgeWidth, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(layout.baseFontSize + 4);
  doc.setTextColor(...WHITE);
  doc.text('BILL', badgeX + badgeWidth / 2, badgeY + 7.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(layout.baseFontSize);
  doc.setTextColor(...BLACK);
  doc.text(`Bill No.: ${form.billNumber}`, pageWidth - margin, badgeY + 20, { align: 'right' });
  doc.text(`Date: ${formatDisplayDate(form.billDate)}`, pageWidth - margin, badgeY + 24.5, {
    align: 'right',
  });
  if (pageLabel) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(layout.smallFontSize + 0.4);
    doc.setTextColor(...CHARCOAL);
    doc.text(pageLabel, pageWidth - margin, badgeY + 29, { align: 'right' });
  }

  const separatorY = layout.topBandHeight + layout.headerHeight;
  doc.setDrawColor(...LIGHT_BORDER);
  doc.setLineWidth(0.35);
  doc.line(margin, separatorY, pageWidth - margin, separatorY);
}

function drawCustomerSection(
  doc: jsPDF,
  pageWidth: number,
  layout: PdfLayoutConfig,
  form: BillForm
) {
  const { margin } = layout;
  const y = layout.topBandHeight + layout.headerHeight + layout.sectionGap;
  const width = pageWidth - margin * 2;
  const leftWidth = width * 0.54;
  const leftX = margin;
  const rightX = margin + leftWidth;

  doc.setDrawColor(...LIGHT_BORDER);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, y, width, layout.customerSectionHeight, 2, 2);
  doc.line(rightX, y, rightX, y + layout.customerSectionHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(layout.smallFontSize + 0.6);
  doc.setTextColor(...CHARCOAL);
  doc.text('CUSTOMER NAME', leftX + 2.5, y + 4.5);
  doc.text('ADDRESS', leftX + 2.5, y + 14.5);
  doc.text('PHONE NO.', rightX + 2.5, y + 4.5);
  if (form.customerGstNo.trim()) {
    doc.text('GST NUMBER', rightX + 2.5, y + 14.5);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(layout.baseFontSize);
  doc.setTextColor(...BLACK);
  const leftTextWidth = leftWidth - 5;
  const rightTextWidth = width - leftWidth - 5;
  const nameLines = doc.splitTextToSize(form.customerName || '-', leftTextWidth).slice(0, 1);
  const addressLines = doc
    .splitTextToSize(form.customerAddress || '-', leftTextWidth)
    .slice(0, layout.customerSectionHeight > 24 ? 2 : 1);

  doc.text(nameLines, leftX + 2.5, y + 8.5);
  doc.text(addressLines.length ? addressLines : ['-'], leftX + 2.5, y + 18.5);
  doc.text(
    doc.splitTextToSize(form.customerPhone || '-', rightTextWidth).slice(0, 1),
    rightX + 2.5,
    y + 8.5
  );
  if (form.customerGstNo.trim()) {
    doc.text(
      doc.splitTextToSize(form.customerGstNo.trim(), rightTextWidth).slice(0, 1),
      rightX + 2.5,
      y + 18.5
    );
  }
}

function drawTableHeader(
  doc: jsPDF,
  columns: TableColumns,
  y: number,
  layout: PdfLayoutConfig
) {
  doc.setFillColor(...BLACK);
  doc.rect(columns.x, y, columns.width, layout.tableHeaderHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(layout.smallFontSize + 0.8);
  doc.setTextColor(...WHITE);
  doc.text('S.No.', columns.serialX + columns.serialWidth / 2, y + layout.tableHeaderHeight - 2.3, {
    align: 'center',
  });
  doc.text(
    'DESCRIPTION / SERVICES',
    columns.descriptionX + columns.descriptionWidth / 2,
    y + layout.tableHeaderHeight - 2.3,
    { align: 'center' }
  );
  doc.text('QTY.', columns.qtyX + columns.qtyWidth / 2, y + layout.tableHeaderHeight - 2.3, {
    align: 'center',
  });
  doc.text('RATE (Rs.)', columns.rateX + columns.rateWidth / 2, y + layout.tableHeaderHeight - 2.3, {
    align: 'center',
  });
  doc.text(
    'AMOUNT (Rs.)',
    columns.amountX + columns.amountWidth / 2,
    y + layout.tableHeaderHeight - 2.3,
    { align: 'center' }
  );
}

function drawRows(
  doc: jsPDF,
  columns: TableColumns,
  rows: RenderRow[],
  startY: number,
  layout: PdfLayoutConfig
) {
  let y = startY;

  rows.forEach((row, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(...LIGHT_FILL);
      doc.rect(columns.x, y, columns.width, row.height, 'F');
    }

    doc.setDrawColor(...LIGHT_BORDER);
    doc.rect(columns.x, y, columns.width, row.height);
    doc.line(columns.descriptionX, y, columns.descriptionX, y + row.height);
    doc.line(columns.qtyX, y, columns.qtyX, y + row.height);
    doc.line(columns.rateX, y, columns.rateX, y + row.height);
    doc.line(columns.amountX, y, columns.amountX, y + row.height);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(layout.baseFontSize);
    doc.setTextColor(...BLACK);

    if (!row.isEmpty) {
      doc.text(row.serial, columns.serialX + columns.serialWidth / 2, y + row.height / 2 + 1.2, {
        align: 'center',
      });
      doc.text(row.descriptionLines, columns.descriptionX + 2, y + 4.4);
      doc.text(row.qty, columns.qtyX + columns.qtyWidth / 2, y + row.height / 2 + 1.2, {
        align: 'center',
      });
      doc.text(row.rate, columns.rateX + columns.rateWidth - 2, y + row.height / 2 + 1.2, {
        align: 'right',
      });
      doc.text(row.amount, columns.amountX + columns.amountWidth - 2, y + row.height / 2 + 1.2, {
        align: 'right',
      });
    }

    y += row.height;
  });

  return y;
}

function drawTotalsSection(
  doc: jsPDF,
  pageWidth: number,
  y: number,
  layout: PdfLayoutConfig,
  values: {
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    grandTotal: number;
  }
) {
  const width = pageWidth - layout.margin * 2;
  const amountWordsWidth = width * 0.55;
  const totalsWidth = width - amountWordsWidth - layout.sectionGap;
  const leftX = layout.margin;
  const rightX = leftX + amountWordsWidth + layout.sectionGap;

  doc.setDrawColor(...LIGHT_BORDER);
  doc.roundedRect(leftX, y, amountWordsWidth, layout.totalsHeight, 2, 2);
  doc.roundedRect(rightX, y, totalsWidth, layout.totalsHeight, 2, 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(layout.smallFontSize + 0.8);
  doc.setTextColor(...CHARCOAL);
  doc.text('Rupees (in words)', leftX + 3, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(layout.baseFontSize);
  doc.setTextColor(...BLACK);
  doc.text(doc.splitTextToSize(numberToWords(values.grandTotal), amountWordsWidth - 6), leftX + 3, y + 10);

  const rows: Array<[string, number]> = [
    ['SUB TOTAL', values.subtotal],
    ['DISCOUNT', values.discountAmount],
    ['GST', values.taxAmount],
  ];
  const isCompactLayout = layout.totalsHeight <= 25;
  const summaryRowHeight = isCompactLayout ? 4.2 : 5.4;
  const grandRowHeight = isCompactLayout ? 7 : 9;
  const summaryTopPadding = isCompactLayout ? 5 : 6;
  const grandTotalY = isCompactLayout
    ? y + summaryTopPadding + rows.length * summaryRowHeight
    : y + layout.totalsHeight - grandRowHeight - 1.5;
  const grandTextY = isCompactLayout
    ? grandTotalY + grandRowHeight / 2 + 1
    : y + layout.totalsHeight - 4.3;

  let rowY = y + summaryTopPadding;
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(layout.smallFontSize + 0.6);
    doc.setTextColor(...CHARCOAL);
    doc.text(label, rightX + 3, rowY);
    doc.setTextColor(...BLACK);
    doc.text(formatPdfCurrency(value), rightX + totalsWidth - 3, rowY, { align: 'right' });
    rowY += summaryRowHeight;
  });

  doc.setFillColor(...BLACK);
  doc.rect(rightX + 1.5, grandTotalY, totalsWidth - 3, grandRowHeight, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(
    rightX + totalsWidth * 0.57,
    grandTotalY,
    totalsWidth * 0.43 - 1.5,
    grandRowHeight,
    'F'
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(layout.baseFontSize);
  doc.setTextColor(...WHITE);
  doc.text('GRAND TOTAL', rightX + 4, grandTextY);
  doc.setTextColor(...BLACK);
  doc.text(formatPdfCurrency(values.grandTotal), rightX + totalsWidth - 3, grandTextY, {
    align: 'right',
  });

  return y + layout.totalsHeight + layout.sectionGap;
}

function drawPaymentAndTerms(
  doc: jsPDF,
  pageWidth: number,
  y: number,
  layout: PdfLayoutConfig,
  form: BillForm,
  balanceAmount: number,
  options: {
    showPaymentDetails: boolean;
    showTermsAndNotes: boolean;
  }
) {
  if (!options.showPaymentDetails && !options.showTermsAndNotes) {
    return y;
  }

  const width = pageWidth - layout.margin * 2;
  const leftX = layout.margin;
  const isTwoColumn = options.showPaymentDetails && options.showTermsAndNotes;
  const leftWidth = isTwoColumn ? width * 0.45 : width;
  const rightWidth = isTwoColumn ? width - leftWidth : width;
  const rightX = isTwoColumn ? leftX + leftWidth : leftX;

  doc.setDrawColor(...LIGHT_BORDER);
  doc.roundedRect(leftX, y, width, layout.bottomSectionHeight, 2, 2);
  if (isTwoColumn) {
    doc.line(rightX, y, rightX, y + layout.bottomSectionHeight);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(layout.smallFontSize + 0.8);
  doc.setTextColor(...BLACK);

  if (options.showPaymentDetails) {
    doc.text('PAYMENT DETAILS', leftX + 3, y + 5);

    const paymentRows: Array<[string, string]> = [
      ['Advance Received', formatPdfCurrency(Number(form.advanceAmount) || 0)],
      [
        'Balance Amount',
        formatPdfCurrency(form.completionStatus === 'COMPLETED' ? 0 : balanceAmount),
      ],
      [
        'Payment Mode',
        PAYMENT_MODE_OPTIONS.find((item) => item.value === form.paymentMode)?.label ||
          form.paymentMode,
      ],
      ['Payment Date', form.paymentDate ? formatDisplayDate(form.paymentDate) : '-'],
      ['Transaction / Ref. No.', form.transactionReference || '-'],
    ];

    let paymentY = y + 10;
    const valueX = leftX + (isTwoColumn ? 29 : Math.min(48, leftWidth * 0.34));
    paymentRows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(layout.smallFontSize + 0.2);
      doc.setTextColor(...CHARCOAL);
      doc.text(label, leftX + 3, paymentY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...BLACK);
      doc.text(doc.splitTextToSize(value, leftX + leftWidth - valueX - 3), valueX, paymentY);
      paymentY += 5.4;
    });
  }

  if (options.showTermsAndNotes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(layout.smallFontSize + 0.8);
    doc.setTextColor(...BLACK);
    doc.text('TERMS & NOTES', rightX + 3, y + 5);

    let termsY = y + 9.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(layout.smallFontSize + 0.2);
    doc.setTextColor(...BLACK);
    STATIC_TERMS.forEach((term) => {
      const lines = doc.splitTextToSize(`- ${term}`, rightWidth - 6);
      doc.text(lines, rightX + 3, termsY);
      termsY += lines.length * (layout.smallFontSize * 0.62) + 2;
    });

    if (form.notes.trim()) {
      doc.setFont('helvetica', 'bold');
      doc.text('Custom Notes:', rightX + 3, termsY + 1);
      doc.setFont('helvetica', 'normal');
      const noteLines = doc.splitTextToSize(form.notes.trim(), rightWidth - 6);
      doc.text(noteLines, rightX + 3, termsY + 5);
    }
  }

  return y + layout.bottomSectionHeight + layout.sectionGap;
}

function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number, layout: PdfLayoutConfig) {
  const isCompactLayout = layout.footerStripHeight <= 7;
  if (!isCompactLayout) {
    const topY = pageHeight - layout.footerHeight - layout.footerStripHeight;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(layout.baseFontSize + 1.5);
    doc.setTextColor(...BLACK);
    doc.text('Thank You!', layout.margin, topY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(layout.smallFontSize + 0.8);
    doc.setTextColor(...CHARCOAL);
    doc.text('FOR CHOOSING AURA KNOT PHOTOGRAPHY', layout.margin, topY + 10);
    doc.text('This is a computer-generated final bill.', layout.margin, topY + 14.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(layout.baseFontSize);
    doc.setTextColor(...BLACK);
    doc.text('Authorized Signature', pageWidth - layout.margin, topY + 10, { align: 'right' });

    doc.setFillColor(...BLACK);
    doc.rect(0, pageHeight - layout.footerStripHeight, pageWidth, layout.footerStripHeight, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, pageHeight - layout.footerStripHeight, pageWidth, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(layout.smallFontSize + 0.8);
    doc.setTextColor(...WHITE);
    doc.text(BUSINESS_DETAILS.tagline, pageWidth / 2, pageHeight - layout.footerStripHeight / 2 + 1, {
      align: 'center',
    });
    return;
  }

  const bottomStripTopY = pageHeight - layout.footerStripHeight;
  const footerSafeGap = 3;
  const footerSafeBottomY = bottomStripTopY - footerSafeGap;
  const lineSpacing = 4.1;
  const computerGeneratedY = footerSafeBottomY - 2;
  const choosingTextY = computerGeneratedY - lineSpacing;
  const thankYouY = choosingTextY - lineSpacing;
  const signatureY = choosingTextY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(layout.baseFontSize + 1.5);
  doc.setTextColor(...BLACK);
  doc.text('Thank You!', layout.margin, thankYouY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(layout.smallFontSize + 0.8);
  doc.setTextColor(...CHARCOAL);
  doc.text('FOR CHOOSING AURA KNOT PHOTOGRAPHY', layout.margin, choosingTextY);
  doc.text('This is a computer-generated final bill.', layout.margin, computerGeneratedY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(layout.baseFontSize);
  doc.setTextColor(...BLACK);
  doc.text('Authorized Signature', pageWidth - layout.margin, signatureY, { align: 'right' });

  doc.setFillColor(...BLACK);
  doc.rect(0, bottomStripTopY, pageWidth, layout.footerStripHeight, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, bottomStripTopY, pageWidth, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(layout.smallFontSize + 0.8);
  doc.setTextColor(...WHITE);
  doc.text(BUSINESS_DETAILS.tagline, pageWidth / 2, pageHeight - layout.footerStripHeight / 2 + 1, {
    align: 'center',
  });
}

function buildPdfFileName(billNumber: string, customerName: string) {
  const safeName = customerName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'customer';
  return `${billNumber.replace(/\//g, '-')}-${safeName}.pdf`;
}

function rebuildCustomerMemory(allJobs: Job[], billsData: SavedBillRecord[]) {
  const remembered = new Map<string, CustomerSuggestion>();
  const combined = new Map<string, CustomerSuggestion>();

  billsData.forEach((bill) => {
    const name = String(bill.customerName || '').trim();
    const phone = String(bill.customerPhone || '').trim();
    if (!name) return;

    const key = `${name.toLowerCase()}-${phone}`;
    const customer: CustomerSuggestion = {
      name,
      phone,
      eventType: String(bill.eventType || '').trim(),
      eventDates: String(bill.eventDates || '').trim(),
      address: String(bill.customerAddress || '').trim(),
      gstNo: String(bill.customerGstNo || '').trim(),
      source: 'bill',
      lastBillNumber: String(bill.billNumber || ''),
    };

    remembered.set(key, customer);
    combined.set(key, customer);
  });

  allJobs.forEach((job) => {
    const name = (job.customer_name || '').trim();
    const phone = (job.customer_phone || '').trim();
    if (!name) return;

    const key = `${name.toLowerCase()}-${phone}`;
    if (!combined.has(key)) {
      combined.set(key, {
        name,
        phone,
        eventType: getJobEventType(job),
        eventDates: formatEventDates(job.start_date, job.end_date),
        address: '',
        gstNo: '',
        source: 'job',
      });
    }
  });

  return {
    rememberedCustomers: Array.from(remembered.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 6),
    customerSuggestions: Array.from(combined.values()).sort((a, b) => {
      if (a.source !== b.source) return a.source === 'bill' ? -1 : 1;
      return a.name.localeCompare(b.name);
    }),
  };
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
  const [paperSize, setPaperSize] = useState<BillPaperSize>('A4');
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showTermsAndNotes, setShowTermsAndNotes] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [rememberedCustomers, setRememberedCustomers] = useState<CustomerSuggestion[]>([]);
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [form, setForm] = useState<BillForm>(() => {
    const today = getTodayIsoDate();
    return {
      billNumber: buildBillNumber(today, 1),
      billDate: today,
      completionDate: today,
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      customerGstNo: '',
      eventType: '',
      eventDates: '',
      notes: '',
      discountPercent: 0,
      taxPercent: 0,
      advanceAmount: 0,
      completionStatus: 'NOT_COMPLETED',
      paymentMode: 'CASH',
      paymentDate: today,
      transactionReference: '',
    };
  });
  const [items, setItems] = useState<BillItem[]>([createItem()]);

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

  useEffect(() => {
    if (editingBillId || billNumberTouched) return;
    const nextSequence = getBillSequenceForDate(form.billDate, savedBills, editingBillId);
    const nextBillNumber = buildBillNumber(form.billDate, nextSequence);
    setForm((prev) => (prev.billNumber === nextBillNumber ? prev : { ...prev, billNumber: nextBillNumber }));
  }, [billNumberTouched, editingBillId, form.billDate, savedBills]);

  async function refreshBillMemory(allJobs: Job[] = jobs) {
    const response = await fetch('/api/bills', { cache: 'no-store' });
    const billsData = (await response.json().catch(() => [])) as SavedBillRecord[];
    if (!response.ok || !Array.isArray(billsData)) return;

    setSavedBills(
      billsData.map((bill) => ({
        id: String(bill.id),
        billNumber: String(bill.billNumber || ''),
        billDate: String(bill.billDate || ''),
      }))
    );

    const memory = rebuildCustomerMemory(allJobs, billsData);
    setRememberedCustomers(memory.rememberedCustomers);
    setCustomerSuggestions(memory.customerSuggestions);
  }

  async function fetchBillData(userId: string) {
    setLoading(true);
    try {
      const [allJobs, billsResponse] = await Promise.all([
        db.getJobs(userId),
        fetch('/api/bills', { cache: 'no-store' }),
      ]);

      setJobs(allJobs);
      const billsData = (await billsResponse.json().catch(() => [])) as SavedBillRecord[];
      if (billsResponse.ok && Array.isArray(billsData)) {
        setSavedBills(
          billsData.map((bill) => ({
            id: String(bill.id),
            billNumber: String(bill.billNumber || ''),
            billDate: String(bill.billDate || ''),
          }))
        );
        const memory = rebuildCustomerMemory(allJobs, billsData);
        setRememberedCustomers(memory.rememberedCustomers);
        setCustomerSuggestions(memory.customerSuggestions);
      }
    } catch (error) {
      console.error('Failed to load bill data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadBillForEdit(editId: string) {
    try {
      const response = await fetch(`/api/bills/${editId}`, { cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load bill');
      }

      const bill = data as SavedBillRecord;
      setEditingBillId(bill.id);
      setPaperSize(bill.paperSize || 'A4');
      setShowPaymentDetails(bill.showPaymentDetails ?? false);
      setShowTermsAndNotes(bill.showTermsAndNotes ?? false);
      setForm({
        billNumber: bill.billNumber,
        billDate: bill.billDate,
        completionDate: bill.completionDate,
        customerName: bill.customerName || '',
        customerPhone: bill.customerPhone || '',
        customerAddress: bill.customerAddress || '',
        customerGstNo: bill.customerGstNo || '',
        eventType: bill.eventType || '',
        eventDates: bill.eventDates || '',
        notes: bill.notes || '',
        discountPercent: Number(bill.discountPercent) || 0,
        taxPercent: Number(bill.taxPercent) || 0,
        advanceAmount: Number(bill.advanceAmount) || 0,
        completionStatus: bill.completionStatus || 'NOT_COMPLETED',
        paymentMode: bill.paymentMode || 'CASH',
        paymentDate: bill.paymentDate || '',
        transactionReference: bill.transactionReference || '',
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
      alert(error instanceof Error ? error.message : 'Failed to load bill');
    }
  }

  const filteredSuggestions = useMemo(() => {
    const query = form.customerName.trim().toLowerCase();
    if (!query) return [];
    return customerSuggestions
      .filter(
        (customer) =>
          customer.name.toLowerCase().includes(query) || customer.phone.includes(query)
      )
      .slice(0, 6);
  }, [customerSuggestions, form.customerName]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0),
        0
      ),
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
      eventType: customer.eventType || prev.eventType,
      eventDates: customer.eventDates || prev.eventDates,
    }));
    setShowSuggestions(false);
  }

  function buildBillPayload() {
    return {
      id: editingBillId,
      businessName: BUSINESS_DETAILS.name,
      businessPhone: BUSINESS_DETAILS.phone,
      businessEmail: BUSINESS_DETAILS.email,
      businessAddress: BUSINESS_DETAILS.address,
      paperSize,
      showPaymentDetails,
      showTermsAndNotes,
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
    if (!options?.silent) setSaveMessage(null);

    try {
      const response = await fetch(editingBillId ? `/api/bills/${editingBillId}` : '/api/bills', {
        method: editingBillId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBillPayload()),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save bill');
      }

      if (data?.id) {
        setEditingBillId(String(data.id));
      }
      await refreshBillMemory();

      if (!options?.silent) {
        setSaveMessage(
          `${editingBillId ? 'Updated' : 'Saved'} bill ${form.billNumber} for ${form.customerName}.`
        );
      }
      return true;
    } catch (error) {
      console.error('Failed to save bill:', error);
      alert(error instanceof Error ? error.message : 'Failed to save bill');
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
      const selectedPaper = PAPER_SIZE_CONFIG[paperSize];
      const layout = PDF_LAYOUTS[paperSize];
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: selectedPaper.jsPdfFormat,
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const columns = getTableColumns(pageWidth, layout.margin);
      const logoDataUrl = await loadBillLogo();
      const rows = buildRenderRows(doc, items, layout, columns);
      const hasBottomDetails = showPaymentDetails || showTermsAndNotes;
      const optionalSectionHeight = hasBottomDetails
        ? layout.bottomSectionHeight + layout.sectionGap
        : 0;
      const finalSectionHeight =
        layout.totalsHeight +
        layout.sectionGap +
        optionalSectionHeight +
        layout.footerHeight +
        layout.footerStripHeight +
        6;

      const startY =
        layout.topBandHeight +
        layout.headerHeight +
        layout.sectionGap +
        layout.customerSectionHeight +
        layout.sectionGap +
        layout.tableHeaderHeight;

      const pages = paginateRows(rows, startY, pageHeight, layout, finalSectionHeight);

      const renderPageShell = (pageLabel?: string) => {
        drawTopBorder(doc, pageWidth, layout);
        drawHeader(doc, pageWidth, layout, logoDataUrl, form, pageLabel);
        drawCustomerSection(doc, pageWidth, layout, form);
        drawTableHeader(doc, columns, startY - layout.tableHeaderHeight, layout);
      };

      renderPageShell(pages.length > 1 ? 'Page 1' : undefined);
      let currentY = startY;

      pages.forEach((pageRows, pageIndex) => {
        if (pageIndex > 0) {
          doc.addPage(selectedPaper.jsPdfFormat, 'portrait');
          renderPageShell(`Page ${pageIndex + 1}`);
          currentY = startY;
        }
        currentY = drawRows(doc, columns, pageRows, currentY, layout);
      });

      const footerTopY = pageHeight - layout.footerHeight - layout.footerStripHeight;
      const optionalSectionY = hasBottomDetails
        ? footerTopY - layout.sectionGap - layout.bottomSectionHeight
        : footerTopY;
      const totalsY =
        optionalSectionY - layout.sectionGap - layout.totalsHeight;
      const sectionY = Math.max(currentY + layout.sectionGap, totalsY);

      drawTotalsSection(doc, pageWidth, sectionY, layout, {
        subtotal,
        discountAmount,
        taxAmount,
        grandTotal,
      });
      if (hasBottomDetails) {
        drawPaymentAndTerms(doc, pageWidth, optionalSectionY, layout, form, balance, {
          showPaymentDetails,
          showTermsAndNotes,
        });
      }
      drawFooter(doc, pageWidth, pageHeight, layout);

      doc.save(buildPdfFileName(form.billNumber, form.customerName));
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
              <h1 className="text-xl sm:text-3xl font-bold text-white">
                {editingBillId ? 'Edit Saved Bill' : 'Bill Generator'}
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                {editingBillId
                  ? 'Update the saved bill and export the latest PDF version.'
                  : 'Create polished Aura Knot Photography bills with A4 and A5 export.'}
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
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold text-sm hover:shadow-lg hover:shadow-orange-500/25 transition-all active:scale-95 disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {savingPdf ? 'Preparing PDF...' : 'Export PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4 sm:gap-6">
        <div className="space-y-4 sm:space-y-6">
          {saveMessage && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              <p className="text-sm">{saveMessage}</p>
            </div>
          )}

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-amber-400" />
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
                <input
                  type="date"
                  value={form.billDate}
                  onChange={(e) => setFormField('billDate', e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Work Completed Date</span>
                <input
                  type="date"
                  value={form.completionDate}
                  onChange={(e) => setFormField('completionDate', e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white"
                />
              </label>
              <div className="block">
                <span className="text-xs text-slate-400">Bill Size</span>
                <div className="mt-1 grid grid-cols-2 gap-2 rounded-xl bg-slate-900/60 p-1 border border-white/10">
                  {(Object.keys(PAPER_SIZE_CONFIG) as BillPaperSize[]).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPaperSize(size)}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                        paperSize === size
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-transparent text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserRound className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">Billed To</h2>
              <span className="text-xs text-slate-400">{jobs.length} jobs scanned</span>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 mb-4">
              <p className="text-sm font-semibold text-amber-100">
                Business details are fixed for Aura Knot Photography.
              </p>
              <p className="text-xs text-amber-200/80 mt-1">
                The PDF will use your official business information automatically.
              </p>
            </div>

            {rememberedCustomers.length > 0 && (
              <div className="mb-4">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                  Remembered Customers
                </p>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3 relative lg:col-span-2">
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
                            {!customer.lastBillNumber && customer.eventType ? ` | ${customer.eventType}` : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <input
                value={form.customerPhone}
                onChange={(e) => setFormField('customerPhone', e.target.value)}
                placeholder="Customer phone"
                className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400"
              />
              <input
                value={form.customerGstNo}
                onChange={(e) => setFormField('customerGstNo', e.target.value)}
                placeholder="Customer GST No"
                className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400"
              />
              <textarea
                value={form.customerAddress}
                onChange={(e) => setFormField('customerAddress', e.target.value)}
                placeholder="Customer address"
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400 lg:col-span-2"
              />
              <input
                value={form.eventType}
                onChange={(e) => setFormField('eventType', e.target.value)}
                placeholder="Event type"
                className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400"
              />
              <input
                value={form.eventDates}
                onChange={(e) => setFormField('eventDates', e.target.value)}
                placeholder="Event date(s)"
                className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400"
              />
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Bill Items</h2>
              <button
                onClick={addItem}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[1fr_90px_120px_48px] gap-3 bg-slate-900/40 rounded-xl p-3">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder={`Service ${index + 1}`}
                    className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400"
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                    className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white"
                  />
                  <input
                    type="number"
                    min="0"
                    value={item.rate}
                    onChange={(e) => updateItem(item.id, 'rate', Number(e.target.value))}
                    className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white"
                  />
                  <button
                    onClick={() => removeItem(item.id)}
                    className="inline-flex items-center justify-center rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Notes & Settlement</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <textarea
                value={form.notes}
                onChange={(e) => setFormField('notes', e.target.value)}
                rows={7}
                placeholder="Additional notes"
                className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400"
              />
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs text-slate-400">Discount %</span>
                    <input
                      type="number"
                      min="0"
                      value={form.discountPercent}
                      onChange={(e) => setFormField('discountPercent', Number(e.target.value))}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-400">Tax %</span>
                    <input
                      type="number"
                      min="0"
                      value={form.taxPercent}
                      onChange={(e) => setFormField('taxPercent', Number(e.target.value))}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-xs text-slate-400">Advance Amount</span>
                    <input
                      type="number"
                      min="0"
                      value={form.advanceAmount}
                      onChange={(e) => setFormField('advanceAmount', Number(e.target.value))}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white"
                    />
                  </label>
                </div>

                <div>
                  <span className="text-xs text-slate-400">Payment Mode</span>
                  <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PAYMENT_MODE_OPTIONS.map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => setFormField('paymentMode', mode.value)}
                        className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                          form.paymentMode === mode.value
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-white/10 border border-white/15 text-slate-200 hover:bg-white/15'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs text-slate-400">Payment Date</span>
                    <input
                      type="date"
                      value={form.paymentDate}
                      onChange={(e) => setFormField('paymentDate', e.target.value)}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-400">Transaction / Ref. No.</span>
                    <input
                      value={form.transactionReference}
                      onChange={(e) => setFormField('transactionReference', e.target.value)}
                      placeholder="Reference number"
                      className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">PDF Options</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowPaymentDetails((prev) => !prev)}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  showPaymentDetails
                    ? 'border-amber-400/60 bg-amber-500/15 text-amber-100'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                <span className="text-sm font-semibold">Show Payment Details</span>
                <span
                  className={`h-5 w-9 rounded-full p-0.5 transition-colors ${
                    showPaymentDetails ? 'bg-amber-400' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                      showPaymentDetails ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowTermsAndNotes((prev) => !prev)}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  showTermsAndNotes
                    ? 'border-amber-400/60 bg-amber-500/15 text-amber-100'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                <span className="text-sm font-semibold">Show Terms & Notes</span>
                <span
                  className={`h-5 w-9 rounded-full p-0.5 transition-colors ${
                    showTermsAndNotes ? 'bg-amber-400' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                      showTermsAndNotes ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 sticky top-24">
            <h2 className="text-lg font-semibold text-white mb-4">Bill Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-slate-300">
                <span>Selected Size</span>
                <span>{PAPER_SIZE_CONFIG[paperSize].label}</span>
              </div>
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
              <div className="flex justify-between text-sm text-slate-300">
                <span>Payment Mode</span>
                <span>
                  {PAYMENT_MODE_OPTIONS.find((item) => item.value === form.paymentMode)?.label}
                </span>
              </div>
              <div className="flex justify-between text-sm text-slate-300">
                <span>PDF Details</span>
                <span>
                  {showPaymentDetails || showTermsAndNotes
                    ? [
                        showPaymentDetails ? 'Payment' : '',
                        showTermsAndNotes ? 'Terms' : '',
                      ]
                        .filter(Boolean)
                        .join(' + ')
                    : 'Hidden'}
                </span>
              </div>
              <div className="h-px bg-slate-700/60 my-2" />
              <div className="flex justify-between text-lg font-semibold text-white">
                <span>Grand Total</span>
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
              <p className="text-slate-400 text-sm mt-1">{form.eventType || 'Event type'}</p>
              <p className="text-slate-300 text-sm mt-3">Bill #{form.billNumber}</p>
              <p className="text-slate-400 text-xs mt-1">Paper size: {paperSize}</p>
              {editingBillId && <p className="text-cyan-300 text-xs mt-1">Editing saved record</p>}
            </div>

            <button
              onClick={exportBillPdf}
              disabled={savingPdf || savingRecord}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:shadow-lg hover:shadow-orange-500/25 transition-all active:scale-95 disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {savingPdf ? 'Preparing PDF...' : `Download ${paperSize} Bill`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
