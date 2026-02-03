'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, DollarSign, Clock, Briefcase, Plus, BarChart3, ArrowRight, Calendar, Settings, LogOut } from 'lucide-react';
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

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('this_month');
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalPaid: 0,
    totalPending: 0,
    totalJobs: 0,
    byCategory: {
      EDITING: { income: 0, paid: 0, pending: 0, jobs: 0 },
      EXPOSING: { income: 0, paid: 0, pending: 0, jobs: 0 },
      OTHER: { income: 0, paid: 0, pending: 0, jobs: 0 },
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
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [selectedPeriod, isAuthenticated]);

  async function fetchData() {
    setLoading(true);
    try {
      const allJobs = await db.getJobs('00000000-0000-0000-0000-000000000001');
      const { start, end } = getDateRange(selectedPeriod);
      
      // Filter by date range
      const filteredJobs = allJobs.filter(job => {
        const jobDate = new Date(job.start_date);
        return jobDate >= start && jobDate <= end;
      });

      setJobs(filteredJobs);

      // Calculate summary
      const newSummary = {
        totalIncome: 0,
        totalPaid: 0,
        totalPending: 0,
        totalJobs: filteredJobs.length,
        byCategory: {
          EDITING: { income: 0, paid: 0, pending: 0, jobs: 0 },
          EXPOSING: { income: 0, paid: 0, pending: 0, jobs: 0 },
          OTHER: { income: 0, paid: 0, pending: 0, jobs: 0 },
        },
      };

      filteredJobs.forEach((job) => {
        newSummary.totalIncome += job.total_price;
        newSummary.totalPaid += job.amount_paid;
        newSummary.totalPending += (job.total_price - job.amount_paid);

        const cat = job.category as keyof typeof newSummary.byCategory;
        if (newSummary.byCategory[cat]) {
          newSummary.byCategory[cat].income += job.total_price;
          newSummary.byCategory[cat].paid += job.amount_paid;
          newSummary.byCategory[cat].pending += (job.total_price - job.amount_paid);
          newSummary.byCategory[cat].jobs += 1;
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
      label: 'Pending Amount',
      value: `₹${summary.totalPending.toLocaleString('en-IN')}`,
      icon: Clock,
      color: 'from-amber-600 to-amber-500',
      bgColor: 'bg-amber-500/20',
      textColor: 'text-amber-400',
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
      icon: '📷',
      gradient: 'from-cyan-600 to-blue-600',
      route: '/jobs/exposing',
      jobs: summary.byCategory.EXPOSING.jobs,
    },
    {
      name: 'Post-Production',
      subtitle: 'Editing',
      income: `₹${summary.byCategory.EDITING.income.toLocaleString('en-IN')}`,
      pending: `₹${summary.byCategory.EDITING.pending.toLocaleString('en-IN')}`,
      icon: '✨',
      gradient: 'from-purple-600 to-pink-600',
      route: '/jobs/editing',
      jobs: summary.byCategory.EDITING.jobs,
    },
    {
      name: 'Other Services',
      subtitle: 'Additional Income',
      income: `₹${summary.byCategory.OTHER.income.toLocaleString('en-IN')}`,
      pending: `₹${summary.byCategory.OTHER.pending.toLocaleString('en-IN')}`,
      icon: '💼',
      gradient: 'from-orange-600 to-red-600',
      route: '/jobs/other',
      jobs: summary.byCategory.OTHER.jobs,
    },
  ];

  const { label: periodLabel } = getDateRange(selectedPeriod);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Dashboard</h1>
              <p className="text-slate-400 text-sm mt-1">Welcome back to Aura Knot Photography</p>
            </div>
            <div className="flex items-center gap-3">
              {db.isDemoMode() && (
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                  Demo Mode
                </span>
              )}
              <button
                onClick={() => router.push('/settings')}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors duration-200"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={logout}
                className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors duration-200"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Time Period Selector */}
        <div className="mb-8 bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Time Period</h2>
            <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-sm font-medium">
              {periodLabel}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {periods.map((period) => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  selectedPeriod === period.value
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="mr-2">{period.icon}</span>
                {period.label}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={index}
                    className="group relative bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/80 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700/0 to-slate-700/0 group-hover:from-slate-700/5 group-hover:to-slate-700/10 rounded-xl transition-all duration-300"></div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
                        <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                          <Icon className={`w-4 h-4 ${stat.textColor}`} />
                        </div>
                      </div>
                      
                      <p className="text-3xl font-bold text-white mb-2">{stat.value}</p>
                      <p className="text-xs text-slate-500">{periodLabel}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Category Cards */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Income Categories</h2>
                  <p className="text-slate-400 text-sm mt-1">Breakdown by category for {periodLabel.toLowerCase()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {categories.map((category, index) => (
                  <div
                    key={index}
                    className="group relative bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-600/80 transition-all duration-300"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                    
                    <div className="relative z-10 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{category.icon}</span>
                          <div>
                            <h3 className="text-lg font-bold text-white">{category.name}</h3>
                            <p className="text-xs text-slate-400">{category.subtitle}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 mb-6">
                        <div className="bg-slate-900/50 rounded-lg p-4">
                          <p className="text-slate-400 text-sm mb-1">Total Income</p>
                          <p className="text-2xl font-bold text-white">{category.income}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-900/50 rounded-lg p-3">
                            <p className="text-slate-400 text-xs mb-1">Pending</p>
                            <p className="text-lg font-bold text-amber-400">{category.pending}</p>
                          </div>
                          <div className="bg-slate-900/50 rounded-lg p-3">
                            <p className="text-slate-400 text-xs mb-1">Jobs</p>
                            <p className="text-lg font-bold text-white">{category.jobs}</p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => router.push(category.route)}
                        className={`w-full py-3 px-4 rounded-lg bg-gradient-to-r ${category.gradient} text-white font-semibold text-sm hover:shadow-lg hover:shadow-slate-900/50 transition-all duration-200 flex items-center justify-center gap-2 group/btn`}
                      >
                        View Details
                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => router.push('/jobs/editing')}
                className="group relative bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-8 text-white font-semibold text-lg hover:shadow-2xl hover:shadow-emerald-900/50 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Plus className="w-6 h-6" />
                    <span>Add New Job</span>
                  </div>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              <button
                onClick={() => router.push('/reports')}
                className="group relative bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-8 text-white font-semibold text-lg hover:shadow-2xl hover:shadow-indigo-900/50 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-6 h-6" />
                    <span>View Reports</span>
                  </div>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>

            {/* Recent Jobs */}
            {jobs.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-bold text-white mb-4">Recent Jobs ({periodLabel})</h2>
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-700/30">
                        <tr>
                          <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Date</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Customer</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Category</th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-slate-400">Amount</th>
                          <th className="text-center py-3 px-4 text-xs font-medium text-slate-400">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/30">
                        {jobs.slice(0, 5).map((job) => (
                          <tr key={job.id} className="hover:bg-slate-700/20 transition-colors">
                            <td className="py-3 px-4 text-sm text-white">{new Date(job.start_date).toLocaleDateString('en-IN')}</td>
                            <td className="py-3 px-4 text-sm text-white">{job.customer_name}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                job.category === 'EDITING' ? 'bg-purple-500/20 text-purple-400' :
                                job.category === 'EXPOSING' ? 'bg-cyan-500/20 text-cyan-400' :
                                'bg-orange-500/20 text-orange-400'
                              }`}>
                                {job.category}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-white text-right">₹{job.total_price.toLocaleString('en-IN')}</td>
                            <td className="py-3 px-4 text-center">
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
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
