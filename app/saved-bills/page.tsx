'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays, FilePenLine, FileSearch, Filter, FolderOpen, Phone, ReceiptText, Search, Trash2, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type SavedBillItem = {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
};

type SavedBill = {
  id: string;
  billNumber: string;
  billDate: string;
  completionDate: string;
  businessName: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  customerGstNo: string | null;
  notes: string | null;
  items: SavedBillItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  advanceAmount: number;
  balanceAmount: number;
  completionStatus: 'COMPLETED' | 'NOT_COMPLETED';
  createdAt: string;
};

type SettlementFilter = 'all' | 'balance_due' | 'settled';
type CustomerCardSummary = {
  name: string;
  phone: string | null;
  total: number;
  count: number;
  lastBillDate: string;
  pendingCount: number;
  completedCount: number;
};

function formatCurrency(value: number) {
  return `Rs.${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN');
}

function getMonthKey(value: string) {
  if (!value) return 'unknown';
  return value.slice(0, 7);
}

function getEffectiveBalance(bill: SavedBill) {
  return bill.completionStatus === 'COMPLETED' ? 0 : Number(bill.balanceAmount) || 0;
}

function getBillSettlementStatus(bill: SavedBill) {
  return bill.completionStatus === 'COMPLETED' ? 'Completed' : 'Not Completed';
}

export default function SavedBillsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<SavedBill[]>([]);
  const [searchText, setSearchText] = useState('');
  const [settlementFilter, setSettlementFilter] = useState<SettlementFilter>('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [activeCustomer, setActiveCustomer] = useState('all');
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [deletingBillId, setDeletingBillId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user?.id) {
      router.push('/auth/login');
      return;
    }

    if (user?.id) {
      void fetchBills();
    }
  }, [authLoading, user?.id, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const customer = new URLSearchParams(window.location.search).get('customer') || 'all';
    setActiveCustomer(customer);
  }, []);

  async function fetchBills() {
    setLoading(true);
    try {
      const response = await fetch('/api/bills', { cache: 'no-store' });
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch bills');
      }

      setBills(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch bills:', error);
      setBills([]);
    } finally {
      setLoading(false);
    }
  }

  async function deleteBill(id: string) {
    const bill = bills.find((entry) => entry.id === id);
    if (!bill) return;

    const confirmed = window.confirm(`Delete saved bill ${bill.billNumber} for ${bill.customerName}?`);
    if (!confirmed) return;

    setDeletingBillId(id);
    try {
      const response = await fetch(`/api/bills/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to delete bill');
      }

      setBills((prev) => prev.filter((entry) => entry.id !== id));
      if (expandedBillId === id) {
        setExpandedBillId(null);
      }
    } catch (error) {
      console.error('Failed to delete bill:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete bill');
    } finally {
      setDeletingBillId(null);
    }
  }

  async function updateBillStatus(id: string, completionStatus: 'COMPLETED' | 'NOT_COMPLETED') {
    const bill = bills.find((entry) => entry.id === id);
    if (!bill) return;

    try {
      const response = await fetch(`/api/bills/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...bill,
          completionStatus,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update bill status');
      }

      setBills((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, completionStatus } : entry))
      );
    } catch (error) {
      console.error('Failed to update bill status:', error);
      alert(error instanceof Error ? error.message : 'Failed to update bill status');
    }
  }

  const customerCards = useMemo(() => {
    const groups = new Map<string, CustomerCardSummary>();

    bills.forEach((bill) => {
      const key = bill.customerName.trim() || 'Unknown Customer';
      const existing = groups.get(key);

      if (existing) {
        existing.count += 1;
        existing.total += Number(bill.grandTotal) || 0;
        existing.completedCount += bill.completionStatus === 'COMPLETED' ? 1 : 0;
        existing.pendingCount += bill.completionStatus === 'COMPLETED' ? 0 : 1;
        if (bill.billDate > existing.lastBillDate) {
          existing.lastBillDate = bill.billDate;
        }
        if (!existing.phone && bill.customerPhone) {
          existing.phone = bill.customerPhone;
        }
        return;
      }

      groups.set(key, {
        name: key,
        phone: bill.customerPhone,
        total: Number(bill.grandTotal) || 0,
        count: 1,
        lastBillDate: bill.billDate,
        completedCount: bill.completionStatus === 'COMPLETED' ? 1 : 0,
        pendingCount: bill.completionStatus === 'COMPLETED' ? 0 : 1,
      });
    });

    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [bills]);

  const monthOptions = useMemo(() => {
    return Array.from(new Set(bills.map((bill) => getMonthKey(bill.billDate))))
      .filter((value) => value !== 'unknown')
      .sort()
      .reverse();
  }, [bills]);

  const filteredBills = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return bills.filter((bill) => {
      const matchesCustomer = activeCustomer === 'all' || bill.customerName === activeCustomer;
      const matchesMonth = monthFilter === 'all' || getMonthKey(bill.billDate) === monthFilter;
      const matchesSettlement =
        settlementFilter === 'all' ||
        (settlementFilter === 'settled'
          ? bill.completionStatus === 'COMPLETED'
          : bill.completionStatus === 'NOT_COMPLETED');
      const matchesSearch =
        !query ||
        bill.customerName.toLowerCase().includes(query) ||
        (bill.customerPhone || '').toLowerCase().includes(query) ||
        bill.billNumber.toLowerCase().includes(query);

      return matchesCustomer && matchesMonth && matchesSettlement && matchesSearch;
    });
  }, [activeCustomer, bills, monthFilter, searchText, settlementFilter]);

  const activeCustomerSummary = useMemo(() => {
    const source = activeCustomer === 'all' ? filteredBills : filteredBills.filter((bill) => bill.customerName === activeCustomer);
    return {
      count: source.length,
      total: source.reduce((sum, bill) => sum + (Number(bill.grandTotal) || 0), 0),
      balance: source.reduce((sum, bill) => sum + getEffectiveBalance(bill), 0),
    };
  }, [activeCustomer, filteredBills]);

  function selectCustomer(customerName: string) {
    setActiveCustomer(customerName);
    const target = customerName === 'all' ? '/saved-bills' : `/saved-bills?customer=${encodeURIComponent(customerName)}`;
    router.replace(target);
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-slate-300 mt-4">Loading saved bills...</p>
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
              <h1 className="text-xl sm:text-3xl font-bold text-white">Saved Bills</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">Search, filter, and open customer-wise bill history.</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/bill-generator')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-700 text-white font-semibold text-sm hover:shadow-lg hover:shadow-cyan-500/25 transition-all active:scale-95"
          >
            <ReceiptText className="w-4 h-4" />
            New Bill
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-4 sm:gap-6">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <Search className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">Search & Filters</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block md:col-span-1">
                <span className="text-xs text-slate-400">Search</span>
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Bill no, customer, phone"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Settlement</span>
                <select
                  value={settlementFilter}
                  onChange={(e) => setSettlementFilter(e.target.value as SettlementFilter)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-900/70 border border-white/15 text-white"
                >
                  <option value="all">All Bills</option>
                  <option value="balance_due">Balance Due</option>
                  <option value="settled">Settled</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Bill Month</span>
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-900/70 border border-white/15 text-white"
                >
                  <option value="all">All Months</option>
                  {monthOptions.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <Filter className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Current View</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-slate-300">
                <span>Customer</span>
                <span className="text-white font-medium">{activeCustomer === 'all' ? 'All Customers' : activeCustomer}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-300">
                <span>Bills</span>
                <span className="text-white font-medium">{activeCustomerSummary.count}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-300">
                <span>Total Value</span>
                <span className="text-white font-medium">{formatCurrency(activeCustomerSummary.total)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-300">
                <span>Balance Due</span>
                <span className="text-amber-300 font-medium">{formatCurrency(activeCustomerSummary.balance)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <FolderOpen className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Customer Cards</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <button
              onClick={() => selectCustomer('all')}
              className={`text-left rounded-xl border px-4 py-3 transition-all active:scale-[0.99] ${
                activeCustomer === 'all'
                  ? 'border-cyan-400/60 bg-cyan-500/10'
                  : 'border-slate-700/50 bg-slate-900/40 hover:bg-slate-800/70'
              }`}
            >
              <p className="text-white font-semibold">All Customers</p>
              <p className="text-slate-400 text-xs mt-1">{customerCards.length} customer cards</p>
            </button>
            {customerCards.map((customer) => (
              <button
                key={customer.name}
                onClick={() => selectCustomer(customer.name)}
                className={`text-left rounded-xl border px-4 py-3 transition-all active:scale-[0.99] ${
                  activeCustomer === customer.name
                    ? 'border-cyan-400/60 bg-cyan-500/10'
                    : 'border-slate-700/50 bg-slate-900/40 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{customer.name}</p>
                    <p className="text-slate-400 text-xs mt-1 truncate">{customer.phone || 'No phone number'}</p>
                  </div>
                  <UserRound className="w-4 h-4 text-cyan-300 shrink-0" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${
                      customer.pendingCount === 0
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {customer.pendingCount === 0 ? 'Completed' : 'Not Completed'}
                  </span>
                  <span className="text-emerald-300 font-medium text-xs">{formatCurrency(customer.total)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{customer.count} bills</span>
                  <span>{customer.pendingCount} pending</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Latest: {formatDate(customer.lastBillDate)}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileSearch className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">
              {activeCustomer === 'all' ? 'Saved Bill List' : `${activeCustomer} Bills`}
            </h2>
          </div>

          {filteredBills.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700/70 bg-slate-900/30 px-6 py-12 text-center">
              <p className="text-white font-medium">No bills found for this filter.</p>
              <p className="text-slate-400 text-sm mt-2">Save a bill from the generator, then it will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBills.map((bill) => {
                const isExpanded = expandedBillId === bill.id;
                return (
                  <div key={bill.id} className="rounded-2xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                      className="w-full text-left px-4 sm:px-5 py-4 hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-white font-semibold text-lg">{bill.billNumber}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
                            <span className="inline-flex items-center gap-1.5">
                              <UserRound className="w-4 h-4" />
                              {bill.customerName}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="w-4 h-4" />
                              {bill.customerPhone || 'No phone'}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays className="w-4 h-4" />
                              Bill Date: {formatDate(bill.billDate)}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:min-w-[260px]">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                            <p className="text-base font-semibold text-white">{formatCurrency(Number(bill.grandTotal) || 0)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Balance</p>
                            <p className={`text-base font-semibold ${getEffectiveBalance(bill) > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                              {formatCurrency(getEffectiveBalance(bill))}
                            </p>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                            <p
                              className={`text-sm font-semibold ${bill.completionStatus === 'COMPLETED' ? 'text-emerald-300' : 'text-amber-300'}`}
                            >
                              {getBillSettlementStatus(bill)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-700/50 px-4 sm:px-5 py-4 bg-slate-950/30">
                        <div className="mb-4 flex flex-wrap gap-3">
                          <label className="inline-flex items-center gap-2 rounded-xl bg-slate-900/70 px-3 py-2 text-sm text-slate-200 border border-slate-700/50">
                            <span>Status</span>
                            <select
                              value={bill.completionStatus}
                              onChange={(e) =>
                                void updateBillStatus(
                                  bill.id,
                                  e.target.value as 'COMPLETED' | 'NOT_COMPLETED'
                                )
                              }
                              className="rounded-lg bg-slate-800 px-2 py-1 text-sm text-white outline-none"
                            >
                              <option value="NOT_COMPLETED">Not Completed</option>
                              <option value="COMPLETED">Completed</option>
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={() => router.push(`/bill-generator?editId=${encodeURIComponent(bill.id)}`)}
                            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/25 transition-colors"
                          >
                            <FilePenLine className="w-4 h-4" />
                            Edit Saved Bill
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteBill(bill.id)}
                            disabled={deletingBillId === bill.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/25 transition-colors disabled:opacity-60"
                          >
                            <Trash2 className="w-4 h-4" />
                            {deletingBillId === bill.id ? 'Deleting...' : 'Delete Saved Bill'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="rounded-xl bg-slate-900/50 border border-slate-700/40 p-4">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Customer Details</p>
                                <p className="text-white font-semibold mt-2">{bill.customerName}</p>
                                <p className="text-slate-400 text-sm mt-1">{bill.customerPhone || 'No phone number'}</p>
                                <p className="text-slate-400 text-sm mt-1">{bill.customerGstNo ? `GST No: ${bill.customerGstNo}` : 'GST No not added'}</p>
                                <p className="text-slate-400 text-sm mt-1 whitespace-pre-line">{bill.customerAddress || 'No address added'}</p>
                              </div>
                              <div className="rounded-xl bg-slate-900/50 border border-slate-700/40 p-4">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Bill Timeline</p>
                                <p className="text-slate-300 text-sm mt-2">Bill Date: <span className="text-white">{formatDate(bill.billDate)}</span></p>
                                <p className="text-slate-300 text-sm mt-1">Completed On: <span className="text-white">{formatDate(bill.completionDate)}</span></p>
                                <p className="text-slate-300 text-sm mt-1">Saved On: <span className="text-white">{formatDate(bill.createdAt)}</span></p>
                              </div>
                            </div>

                            <div className="rounded-xl bg-slate-900/50 border border-slate-700/40 overflow-hidden">
                              <div className="px-4 py-3 border-b border-slate-700/40">
                                <p className="text-white font-semibold">Bill Items</p>
                              </div>
                              <div className="divide-y divide-slate-700/30">
                                {bill.items.map((item, index) => (
                                  <div key={`${bill.id}-${item.id || index}`} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <p className="text-white">{item.description || `Item ${index + 1}`}</p>
                                      <p className="text-slate-400 text-sm">Qty {item.quantity} x {formatCurrency(Number(item.rate) || 0)}</p>
                                    </div>
                                    <p className="text-emerald-300 font-medium">
                                      {formatCurrency((Number(item.quantity) || 0) * (Number(item.rate) || 0))}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="rounded-xl bg-slate-900/50 border border-slate-700/40 p-4">
                              <p className="text-white font-semibold mb-3">Settlement Summary</p>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-slate-300">
                                  <span>Subtotal</span>
                                  <span>{formatCurrency(Number(bill.subtotal) || 0)}</span>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                  <span>Discount</span>
                                  <span>{formatCurrency(Number(bill.discountAmount) || 0)}</span>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                  <span>Tax</span>
                                  <span>{formatCurrency(Number(bill.taxAmount) || 0)}</span>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                  <span>Advance</span>
                                  <span>{formatCurrency(Number(bill.advanceAmount) || 0)}</span>
                                </div>
                                <div className="h-px bg-slate-700/50 my-2" />
                                <div className="flex justify-between text-white font-semibold">
                                  <span>Grand Total</span>
                                  <span>{formatCurrency(Number(bill.grandTotal) || 0)}</span>
                                </div>
                                <div className="flex justify-between font-semibold">
                                  <span className="text-slate-300">Balance Due</span>
                                  <span className={getEffectiveBalance(bill) > 0 ? 'text-amber-300' : 'text-emerald-300'}>
                                    {formatCurrency(getEffectiveBalance(bill))}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-xl bg-slate-900/50 border border-slate-700/40 p-4">
                              <p className="text-white font-semibold mb-2">Notes</p>
                              <p className="text-slate-300 text-sm whitespace-pre-line">
                                {bill.notes?.trim() || 'No notes added for this bill.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
