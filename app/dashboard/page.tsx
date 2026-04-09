'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, DollarSign, Clock, Briefcase, Plus, BarChart3, ArrowRight, Calendar, Settings, LogOut, Camera, Edit, ChevronDown } from 'lucide-react';
import { db, Job } from '@/lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type TimePeriod = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'six_months' | 'this_year' | 'last_year' | 'all_time';

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
        label: 'This Quarter',
      };
    case 'last_quarter':
      const lastQ = currentQuarter === 0 ? 3 : currentQuarter - 1;
      const lastQYear = currentQuarter === 0 ? currentYear - 1 : currentYear;
      return {
        start: new Date(lastQYear, lastQ * 3, 1),
        end: new Date(lastQYear, (lastQ + 1) * 3, 0),
        label: 'Last Quarter',
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
        label: 'This Year',
      };
    case 'last_year':
      return {
        start: new Date(currentYear - 1, 0, 1),
        end: new Date(currentYear - 1, 11, 31),
        label: 'Last Year',
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

function formatJobDate(value?: string) {
  if (!value) return '-';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN');
}

function getJobDetailHref(job: Job) {
  const categoryPath = job.category === 'EDITING'
    ? '/jobs/editing'
    : job.category === 'EXPOSING'
      ? '/jobs/exposing'
      : '/jobs/other';

  const customerKey = job.customer_phone?.trim() || job.customer_name?.trim();
  return customerKey ? `${categoryPath}?customer=${encodeURIComponent(customerKey)}` : categoryPath;
}

function getJobEventDetailsLabel(job: Job) {
  return job.event_details?.trim() || job.type_of_work?.trim() || '-';
}

function parseLocalDate(dateStr?: string) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, logout, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('this_month');
  const [pendingPaymentPeriod, setPendingPaymentPeriod] = useState<TimePeriod>('all_time');
  const [showAddJobMenu, setShowAddJobMenu] = useState(false);
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalPaid: 0,
    totalPending: 0,
    livePending: 0,
    totalJobs: 0,
    byCategory: {
      EDITING: { income: 0, paid: 0, pending: 0, profit: 0, jobs: 0, pendingJobs: 0 },
      EXPOSING: { income: 0, paid: 0, pending: 0, profit: 0, jobs: 0, pendingJobs: 0 },
      ADDON: { income: 0, paid: 0, pending: 0, profit: 0, jobs: 0, pendingJobs: 0 },
    },
  });

  const periods: { value: TimePeriod; label: string; icon: string }[] = [
    { value: 'this_month', label: 'This Month', icon: '📅' },
    { value: 'last_month', label: 'Last Month', icon: '📆' },
    { value: 'this_quarter', label: 'This Quarter', icon: '📊' },
    { value: 'last_quarter', label: 'Last Quarter', icon: '📈' },
    { value: 'six_months', label: '6 Months', icon: '📉' },
    { value: 'this_year', label: 'This Year', icon: '🗓️' },
    { value: 'last_year', label: 'Last Year', icon: '📋' },
    { value: 'all_time', label: 'All Time', icon: '🌟' },
  ];

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchData();
    }
  }, [selectedPeriod, isAuthenticated, user?.id]);

  async function fetchData() {
    if (!user?.id) return;
    setLoading(true);
    try {
      const allJobs = await db.getJobs(user.id);
      const { start, end } = getDateRange(selectedPeriod);

      // Filter by event end_date (or start_date if end_date not available)
      const filteredJobs = allJobs.filter(job => {
        const jobDate = parseLocalDate(job.end_date || job.start_date);
        if (!jobDate) return false;
        return jobDate >= start && jobDate <= end;
      });

      setAllJobs(allJobs);
      setJobs(filteredJobs);

      // Calculate summary
      const newSummary = {
        totalIncome: 0,
        totalPaid: 0,
        totalPending: 0,
        livePending: 0,
        totalJobs: filteredJobs.length,
        byCategory: {
          EDITING: { income: 0, paid: 0, pending: 0, profit: 0, jobs: 0, pendingJobs: 0 },
          EXPOSING: { income: 0, paid: 0, pending: 0, profit: 0, jobs: 0, pendingJobs: 0 },
          ADDON: { income: 0, paid: 0, pending: 0, profit: 0, jobs: 0, pendingJobs: 0 },
        },
      };

      filteredJobs.forEach((job) => {
        newSummary.totalIncome += job.total_price;
        newSummary.totalPending += (job.total_price - job.amount_paid);

        const cat = job.category as keyof typeof newSummary.byCategory;
        if (newSummary.byCategory[cat]) {
          newSummary.byCategory[cat].income += job.total_price;
          newSummary.byCategory[cat].pending += (job.total_price - job.amount_paid);
          newSummary.byCategory[cat].profit += job.category === 'ADDON'
            ? job.total_price - (job.expense || 0)
            : job.total_price;
          newSummary.byCategory[cat].jobs += 1;
          const countsAsPendingJob =
            job.category === 'EXPOSING'
              ? false
              : job.status !== 'COMPLETED';

          if (countsAsPendingJob) {
            newSummary.byCategory[cat].pendingJobs += 1;
          }
        }
      });

      allJobs.forEach((job) => {
        newSummary.livePending += (job.total_price - job.amount_paid);

        const paymentDate = parseLocalDate(job.payment_date);
        if (!paymentDate || paymentDate < start || paymentDate > end) return;

        newSummary.totalPaid += job.amount_paid;

        const cat = job.category as keyof typeof newSummary.byCategory;
        if (newSummary.byCategory[cat]) {
          newSummary.byCategory[cat].paid += job.amount_paid;
        }
      });

      setSummary(newSummary);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  const stats = [
    {
      label: 'Total Income',
      value: `₹${summary.totalIncome.toLocaleString('en-IN')}`,
      icon: TrendingUp,
      color: 'from-emerald-600 to-emerald-500',
      bgColor: 'bg-emerald-500/20',
      textColor: 'text-emerald-400',
    },
    {
      label: 'Amount Received',
      value: `₹${summary.totalPaid.toLocaleString('en-IN')}`,
      icon: DollarSign,
      color: 'from-blue-600 to-blue-500',
      bgColor: 'bg-blue-500/20',
      textColor: 'text-blue-400',
    },
    {
      label: 'Period Pending',
      value: `Rs.${summary.totalPending.toLocaleString('en-IN')}`,
      icon: Clock,
      color: 'from-amber-600 to-amber-500',
      bgColor: 'bg-amber-500/20',
      textColor: 'text-amber-400',
    },
    {
      label: 'Live Outstanding',
      value: `Rs.${summary.livePending.toLocaleString('en-IN')}`,
      icon: Clock,
      color: 'from-orange-600 to-red-500',
      bgColor: 'bg-orange-500/20',
      textColor: 'text-orange-400',
    },
    {
      label: 'Total Jobs',
      value: summary.totalJobs.toString(),
      icon: Briefcase,
      color: 'from-purple-600 to-purple-500',
      bgColor: 'bg-purple-500/20',
      textColor: 'text-purple-400',
    },
  ];

  const categories = [
    {
      name: 'Exposing Sessions',
      subtitle: 'Photo & Video Exposing',
      income: `₹${summary.byCategory.EXPOSING.income.toLocaleString('en-IN')}`,
      pending: `₹${summary.byCategory.EXPOSING.pending.toLocaleString('en-IN')}`,
      profit: '',
      icon: '📷',
      gradient: 'from-cyan-600 to-blue-600',
      route: '/jobs/exposing',
      jobs: summary.byCategory.EXPOSING.jobs,
      pendingJobs: summary.byCategory.EXPOSING.pendingJobs,
    },
    {
      name: 'Post-Production',
      subtitle: 'Editing',
      income: `₹${summary.byCategory.EDITING.income.toLocaleString('en-IN')}`,
      pending: `₹${summary.byCategory.EDITING.pending.toLocaleString('en-IN')}`,
      profit: '',
      icon: '✨',
      gradient: 'from-purple-600 to-pink-600',
      route: '/jobs/editing',
      jobs: summary.byCategory.EDITING.jobs,
      pendingJobs: summary.byCategory.EDITING.pendingJobs,
    },
    {
      name: 'Add-on Income',
      subtitle: 'Add-on Income',
      income: `₹${summary.byCategory.ADDON.income.toLocaleString('en-IN')}`,
      pending: `₹${summary.byCategory.ADDON.pending.toLocaleString('en-IN')}`,
      profit: `Rs.${summary.byCategory.ADDON.profit.toLocaleString('en-IN')}`,
      icon: '💼',
      gradient: 'from-orange-600 to-red-600',
      route: '/jobs/other',
      jobs: summary.byCategory.ADDON.jobs,
      pendingJobs: summary.byCategory.ADDON.pendingJobs,
    },
  ];

  const { label: periodLabel } = getDateRange(selectedPeriod);
  const pendingWorkJobs = jobs
    .filter((job) => job.category !== 'EXPOSING' && job.status !== 'COMPLETED')
    .sort((a, b) => (b.end_date || b.start_date).localeCompare(a.end_date || a.start_date));
  const { start: pendingPaymentStart, end: pendingPaymentEnd, label: pendingPaymentLabel } = getDateRange(pendingPaymentPeriod);
  const pendingPaymentJobs = allJobs
    .filter((job) => {
      if (job.payment_status === 'COMPLETED') return false;
      if (pendingPaymentPeriod === 'all_time') return true;
      const jobDate = parseLocalDate(job.end_date || job.start_date);
      if (!jobDate) return false;
      return jobDate >= pendingPaymentStart && jobDate <= pendingPaymentEnd;
    })
    .sort((a, b) => (b.end_date || b.start_date).localeCompare(a.end_date || a.start_date));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-white">Dashboard</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1 hidden sm:block">Welcome back to Aura Knot Photography</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {db.isDemoMode() && (
                <span className="px-2 sm:px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] sm:text-xs font-medium hidden sm:inline-flex">
                  Demo Mode
                </span>
              )}
              <button
                onClick={() => router.push('/settings')}
                className="p-2 sm:p-2.5 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-white transition-all active:scale-95"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={logout}
                className="p-2 sm:p-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all active:scale-95"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Time Period Selector */}
        <div className="mb-4 sm:mb-8 bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
            <h2 className="text-sm sm:text-lg font-semibold text-white">Time Period</h2>
            <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-xs sm:text-sm font-medium">
              {periodLabel}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {periods.map((period) => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all active:scale-95 whitespace-nowrap ${
                  selectedPeriod === period.value
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="mr-1 sm:mr-2">{period.icon}</span>
                <span>{period.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-slate-400 mt-4">Loading data...</p>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6 mb-4 sm:mb-8">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={index}
                    className="group relative bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-3 sm:p-6 hover:border-slate-600/80 transition-all duration-300 active:scale-98"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700/0 to-slate-700/0 group-hover:from-slate-700/5 group-hover:to-slate-700/10 rounded-xl transition-all duration-300"></div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-2 sm:mb-4">
                        <p className="text-slate-400 text-[10px] sm:text-sm font-medium">{stat.label}</p>
                        <div className={`p-1.5 sm:p-2 rounded-lg ${stat.bgColor}`}>
                          <Icon className={`w-3 h-3 sm:w-4 sm:h-4 ${stat.textColor}`} />
                        </div>
                      </div>
                      
                      <p className="text-lg sm:text-3xl font-bold text-white mb-0.5 sm:mb-2">{stat.value}</p>
                      <p className="text-[10px] sm:text-xs text-slate-500 hidden sm:block">{periodLabel}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Category Cards */}
            <div className="mb-4 sm:mb-8">
              <div className="flex items-center justify-between mb-3 sm:mb-6">
                <div>
                  <h2 className="text-base sm:text-xl font-bold text-white">Income Categories</h2>
                  <p className="text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1 hidden sm:block">Breakdown by category for {periodLabel.toLowerCase()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
                {categories.map((category, index) => (
                  <div
                    key={index}
                    className="group relative bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-600/80 transition-all duration-300 active:scale-98"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                    
                    <div className="relative z-10 p-4 sm:p-6">
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-xl sm:text-3xl">{category.icon}</span>
                          <div>
                            <h3 className="text-sm sm:text-lg font-bold text-white">{category.name}</h3>
                            <p className="text-[10px] sm:text-xs text-slate-400">{category.subtitle}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 sm:space-y-4 mb-3 sm:mb-6">
                        {category.name === 'Add-on Income' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                            <div className="bg-slate-900/50 rounded-lg p-2.5 sm:p-4">
                              <p className="text-slate-400 text-[10px] sm:text-sm mb-0.5 sm:mb-1">Total Income</p>
                              <p className="text-lg sm:text-2xl font-bold text-white">{category.income}</p>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-2.5 sm:p-4">
                              <p className="text-slate-400 text-[10px] sm:text-sm mb-0.5 sm:mb-1">Total Profit</p>
                              <p className="text-lg sm:text-2xl font-bold text-emerald-400">{category.profit}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-900/50 rounded-lg p-2.5 sm:p-4">
                            <p className="text-slate-400 text-[10px] sm:text-sm mb-0.5 sm:mb-1">Total Income</p>
                            <p className="text-lg sm:text-2xl font-bold text-white">{category.income}</p>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                          <div className="bg-slate-900/50 rounded-lg p-2 sm:p-3">
                            <p className="text-slate-400 text-[10px] sm:text-xs mb-0.5 sm:mb-1">Pending</p>
                            <p className="text-sm sm:text-lg font-bold text-amber-400">{category.pending}</p>
                          </div>
                          <div className="bg-slate-900/50 rounded-lg p-2 sm:p-3">
                            <p className="text-slate-400 text-[10px] sm:text-xs mb-0.5 sm:mb-1">Pending Jobs</p>
                            <p className="text-sm sm:text-lg font-bold text-rose-300">{category.pendingJobs}</p>
                          </div>
                          <div className="bg-slate-900/50 rounded-lg p-2 sm:p-3">
                            <p className="text-slate-400 text-[10px] sm:text-xs mb-0.5 sm:mb-1">Jobs</p>
                            <p className="text-sm sm:text-lg font-bold text-white">{category.jobs}</p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => router.push(category.route)}
                        className={`w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg bg-gradient-to-r ${category.gradient} text-white font-semibold text-xs sm:text-sm hover:shadow-lg hover:shadow-slate-900/50 transition-all duration-200 flex items-center justify-center gap-2 group/btn active:scale-95`}
                      >
                        View Details
                        <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
              <div className="relative">
                <button
                  onClick={() => setShowAddJobMenu(!showAddJobMenu)}
                  className="w-full group relative bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-5 sm:p-8 text-white font-semibold text-sm sm:text-lg hover:shadow-2xl hover:shadow-emerald-900/50 transition-all duration-300 overflow-hidden active:scale-95"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span>Add New Job</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${showAddJobMenu ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                
                {/* Dropdown Menu */}
                {showAddJobMenu && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <button
                      onClick={() => { router.push('/jobs/editing'); setShowAddJobMenu(false); }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-purple-600/30 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Edit className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-white font-semibold">Editing</p>
                        <p className="text-slate-400 text-xs">Video/Photo editing jobs</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { router.push('/jobs/exposing'); setShowAddJobMenu(false); }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-cyan-600/30 transition-colors text-left border-t border-slate-700"
                    >
                      <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                        <Camera className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-white font-semibold">Exposing</p>
                        <p className="text-slate-400 text-xs">Photography sessions</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { router.push('/jobs/other'); setShowAddJobMenu(false); }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-orange-600/30 transition-colors text-left border-t border-slate-700"
                    >
                      <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-white font-semibold">Add-on</p>
                        <p className="text-slate-400 text-xs">Album, printing, etc.</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => router.push('/reports')}
                className="group relative bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-5 sm:p-8 text-white font-semibold text-sm sm:text-lg hover:shadow-2xl hover:shadow-indigo-900/50 transition-all duration-300 overflow-hidden active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span>View Reports</span>
                  </div>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>

            <div className="mt-4 sm:mt-8 grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-700/40">
                  <h2 className="text-base sm:text-xl font-bold text-white">Pending Jobs ({periodLabel})</h2>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1">Open work entries across all categories</p>
                </div>
                {pendingWorkJobs.length === 0 ? (
                  <div className="p-6 text-slate-400 text-sm">No pending jobs in this period.</div>
                ) : (
                  <>
                    <div className="sm:hidden space-y-3 p-4">
                      {pendingWorkJobs.slice(0, 8).map((job) => (
                        <button
                          key={job.id}
                          type="button"
                          onClick={() => router.push(getJobDetailHref(job))}
                          className="w-full text-left bg-slate-900/50 rounded-xl p-3 transition-colors hover:bg-slate-800/80 active:scale-[0.99]"
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <p className="text-white font-semibold text-sm">{job.customer_name}</p>
                              <p className="text-slate-400 text-xs mt-1">Date: {formatJobDate(job.end_date || job.start_date)}</p>
                              <p className="text-slate-300 text-xs mt-1">Event Details: {getJobEventDetailsLabel(job)}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              job.category === 'EDITING' ? 'bg-purple-500/20 text-purple-400' :
                              job.category === 'EXPOSING' ? 'bg-cyan-500/20 text-cyan-400' :
                              'bg-orange-500/20 text-orange-400'
                            }`}>
                              {job.category}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <p className="text-white text-sm font-bold">Rs.{job.total_price.toLocaleString('en-IN')}</p>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              job.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {job.status}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-700/30">
                          <tr>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Date</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Customer</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Event Details</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Category</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400">Amount</th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-slate-400">Job Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                          {pendingWorkJobs.slice(0, 8).map((job) => (
                            <tr
                              key={job.id}
                              onClick={() => router.push(getJobDetailHref(job))}
                              className="cursor-pointer hover:bg-slate-700/20 transition-colors"
                            >
                              <td className="py-3 px-4 text-sm text-white">{formatJobDate(job.end_date || job.start_date)}</td>
                              <td className="py-3 px-4 text-sm text-white">{job.customer_name}</td>
                              <td className="py-3 px-4 text-sm text-slate-300">{getJobEventDetailsLabel(job)}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  job.category === 'EDITING' ? 'bg-purple-500/20 text-purple-400' :
                                  job.category === 'EXPOSING' ? 'bg-cyan-500/20 text-cyan-400' :
                                  'bg-orange-500/20 text-orange-400'
                                }`}>
                                  {job.category}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm text-white text-right">Rs.{job.total_price.toLocaleString('en-IN')}</td>
                              <td className="py-3 px-4 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  job.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                  {job.status}
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

              <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-700/40">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-base sm:text-xl font-bold text-white">Pending Payments ({pendingPaymentLabel})</h2>
                      <p className="text-slate-400 text-xs sm:text-sm mt-1">Unsettled payment entries across all categories</p>
                    </div>
                    <div className="w-full sm:w-48">
                      <select
                        value={pendingPaymentPeriod}
                        onChange={(e) => setPendingPaymentPeriod(e.target.value as TimePeriod)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-600/60 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                      >
                        {periods.map((period) => (
                          <option key={period.value} value={period.value} className="bg-slate-900 text-white">
                            {period.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                {pendingPaymentJobs.length === 0 ? (
                  <div className="p-6 text-slate-400 text-sm">No pending payments in this period.</div>
                ) : (
                  <>
                    <div className="sm:hidden space-y-3 p-4">
                      {pendingPaymentJobs.slice(0, 8).map((job) => (
                        <button
                          key={job.id}
                          type="button"
                          onClick={() => router.push(getJobDetailHref(job))}
                          className="w-full text-left bg-slate-900/50 rounded-xl p-3 transition-colors hover:bg-slate-800/80 active:scale-[0.99]"
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <p className="text-white font-semibold text-sm">{job.customer_name}</p>
                              <p className="text-slate-400 text-xs mt-1">Date: {formatJobDate(job.end_date || job.start_date)}</p>
                              <p className="text-slate-300 text-xs mt-1">Event Details: {getJobEventDetailsLabel(job)}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              job.category === 'EDITING' ? 'bg-purple-500/20 text-purple-400' :
                              job.category === 'EXPOSING' ? 'bg-cyan-500/20 text-cyan-400' :
                              'bg-orange-500/20 text-orange-400'
                            }`}>
                              {job.category}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <p className="text-amber-400 text-sm font-bold">Balance: Rs.{(job.total_price - job.amount_paid).toLocaleString('en-IN')}</p>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              job.payment_status === 'PARTIAL' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {job.payment_status}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-700/30">
                          <tr>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Date</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Customer</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Event Details</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Category</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400">Balance</th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-slate-400">Payment Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                          {pendingPaymentJobs.slice(0, 8).map((job) => (
                            <tr
                              key={job.id}
                              onClick={() => router.push(getJobDetailHref(job))}
                              className="cursor-pointer hover:bg-slate-700/20 transition-colors"
                            >
                              <td className="py-3 px-4 text-sm text-white">{formatJobDate(job.end_date || job.start_date)}</td>
                              <td className="py-3 px-4 text-sm text-white">{job.customer_name}</td>
                              <td className="py-3 px-4 text-sm text-slate-300">{getJobEventDetailsLabel(job)}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  job.category === 'EDITING' ? 'bg-purple-500/20 text-purple-400' :
                                  job.category === 'EXPOSING' ? 'bg-cyan-500/20 text-cyan-400' :
                                  'bg-orange-500/20 text-orange-400'
                                }`}>
                                  {job.category}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm text-amber-400 text-right">Rs.{(job.total_price - job.amount_paid).toLocaleString('en-IN')}</td>
                              <td className="py-3 px-4 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  job.payment_status === 'PARTIAL' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}




