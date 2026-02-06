'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Download, FileSpreadsheet, FileText, TrendingUp, Filter, PieChart } from 'lucide-react';
import { db, Job } from '@/lib/supabase';

type TimePeriod = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'six_months' | 'this_year' | 'last_year' | 'all_time' | 'custom';

type CategorySummary = {
  category: string;
  totalJobs: number;
  totalIncome: number;
  totalPaid: number;
  totalPending: number;
  icon: string;
  color: string;
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

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('this_month');
  const [customDateRange, setCustomDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

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
    fetchData();
  }, [selectedPeriod, customDateRange, selectedCategory]);

  async function fetchData() {
    setLoading(true);
    try {
      const category = selectedCategory === 'ALL' ? undefined : selectedCategory;
      const data = await db.getJobs('00000000-0000-0000-0000-000000000001', category as any);
      
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
    },
    {
      category: 'EXPOSING',
      icon: '📸',
      color: 'cyan',
      totalJobs: jobs.filter(j => j.category === 'EXPOSING').length,
      totalIncome: jobs.filter(j => j.category === 'EXPOSING').reduce((acc, j) => acc + j.total_price, 0),
      totalPaid: jobs.filter(j => j.category === 'EXPOSING').reduce((acc, j) => acc + j.amount_paid, 0),
      totalPending: jobs.filter(j => j.category === 'EXPOSING').reduce((acc, j) => acc + (j.total_price - j.amount_paid), 0),
    },
    {
      category: 'OTHER',
      icon: '💼',
      color: 'orange',
      totalJobs: jobs.filter(j => j.category === 'OTHER').length,
      totalIncome: jobs.filter(j => j.category === 'OTHER').reduce((acc, j) => acc + j.total_price, 0),
      totalPaid: jobs.filter(j => j.category === 'OTHER').reduce((acc, j) => acc + j.amount_paid, 0),
      totalPending: jobs.filter(j => j.category === 'OTHER').reduce((acc, j) => acc + (j.total_price - j.amount_paid), 0),
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

  function exportToPDF() {
    const content = generateReportContent();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-knot-report-${periodLabel.replace(/\s/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportToCSV() {
    const headers = ['Date', 'Category', 'Customer', 'Type of Work', 'Total Price', 'Amount Paid', 'Balance', 'Payment Status', 'Job Status'];
    const rows = jobs.map(job => [
      job.start_date,
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

  function generateReportContent() {
    return `
AURA KNOT PHOTOGRAPHY - INCOME REPORT
=====================================
Report Period: ${periodLabel}
Generated: ${new Date().toLocaleString('en-IN')}

SUMMARY
-------
Total Jobs: ${totals.jobs}
Total Income: ₹${totals.income.toLocaleString('en-IN')}
Amount Received: ₹${totals.paid.toLocaleString('en-IN')}
Pending Amount: ₹${totals.pending.toLocaleString('en-IN')}

CATEGORY BREAKDOWN
------------------
${categorySummaries.map(c => `
${c.icon} ${c.category}
  Jobs: ${c.totalJobs}
  Total Income: ₹${c.totalIncome.toLocaleString('en-IN')}
  Received: ₹${c.totalPaid.toLocaleString('en-IN')}
  Pending: ₹${c.totalPending.toLocaleString('en-IN')}
`).join('\n')}

MONTHLY BREAKDOWN
-----------------
${monthlyBreakdown.map(m => `
${m.month}
  Income: ₹${m.income.toLocaleString('en-IN')}
  Received: ₹${m.paid.toLocaleString('en-IN')}
  Pending: ₹${m.pending.toLocaleString('en-IN')}
`).join('\n')}

DETAILED TRANSACTIONS
---------------------
${jobs.map(j => `
[${j.start_date}] ${j.category}
  Customer: ${j.customer_name}
  Total: ₹${j.total_price.toLocaleString('en-IN')} | Paid: ₹${j.amount_paid.toLocaleString('en-IN')} | Balance: ₹${(j.total_price - j.amount_paid).toLocaleString('en-IN')}
  Status: ${j.status} | Payment: ${j.payment_status}
`).join('\n')}
`;
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
              <button onClick={exportToPDF} className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-xs sm:text-sm hover:shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-95">
                <Download className="w-4 h-4 sm:w-5 sm:h-5" /> Export
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
                <option value="OTHER" className="bg-slate-800">💼 Other</option>
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
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-gray-400">Income</p>
                          <p className="text-blue-400 font-medium">₹{month.income.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Received</p>
                          <p className="text-emerald-400 font-medium">₹{month.paid.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Pending</p>
                          <p className="text-amber-400 font-medium">₹{month.pending.toLocaleString('en-IN')}</p>
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
                            <p className="text-gray-400 text-xs">{new Date(job.start_date).toLocaleDateString('en-IN')}</p>
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
                          <th className="text-left py-4 px-6 text-sm font-medium text-indigo-300">Date</th>
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
                            <td className="py-4 px-6 text-sm text-white">{new Date(job.start_date).toLocaleDateString('en-IN')}</td>
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
