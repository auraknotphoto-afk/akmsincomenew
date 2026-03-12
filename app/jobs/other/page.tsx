'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, Calendar, User, IndianRupee, Trash2, Briefcase, Phone, Edit2, MessageCircle } from 'lucide-react';
import { db, Job } from '@/lib/supabase';
import { buildCustomerSummaryMessage, buildWhatsAppMessage, generateWhatsAppUrl } from '@/lib/whatsappTemplates';
import { useAuth } from '../../contexts/AuthContext';
async function formatConsolidatedReminderAsync(..._args: unknown[]) { return ''; }
async function formatJobStatusMessageAsync(..._args: unknown[]) { return ''; }
function formatPaymentStatusMessage(..._args: unknown[]) { return ''; }

export default function OtherPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'LOW' | 'NORMAL' | 'HIGH'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [whatsAppJob, setWhatsAppJob] = useState<Job | null>(null);
  const [waUpdateType, setWaUpdateType] = useState<'job' | 'payment'>('job');
  const [waJobStatus, setWaJobStatus] = useState<'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>('PENDING');
  const [waPaymentStatus, setWaPaymentStatus] = useState<'PENDING' | 'PARTIAL' | 'COMPLETED'>('PENDING');
  
  // Autofill suggestions state
  const [customerSuggestions, setCustomerSuggestions] = useState<{name: string, phone: string}[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  
  const customerInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<{
    customer_name: string;
    customer_phone: string;
    type_of_work: string;
    start_date: string;
    end_date: string;
    estimated_due_date: string;
    total_price: number;
    amount_paid: number;
    payment_status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    notes: string;
  }>({
    customer_name: '',
    customer_phone: '',
    type_of_work: '',
    start_date: '',
    end_date: '',
    estimated_due_date: '',
    total_price: 0,
    amount_paid: 0,
    payment_status: 'PENDING',
    status: 'PENDING',
    notes: '',
  });

  useEffect(() => {
    if (!authLoading && !user?.id) {
      router.push('/auth/login');
      return;
    }
    if (user?.id) fetchJobs(user.id);
  }, [authLoading, user?.id, router]);

  // Build suggestions from ALL jobs across all categories
  useEffect(() => {
    const customers = allJobs.reduce((acc, job) => {
      const existing = acc.find(c => c.name === job.customer_name);
      if (!existing && job.customer_name) {
        acc.push({ name: job.customer_name, phone: job.customer_phone || '' });
      }
      return acc;
    }, [] as {name: string, phone: string}[]);
    setCustomerSuggestions(customers);
  }, [allJobs]);

  async function fetchJobs(userId: string) {
    try {
      const data = await db.getJobs(userId, 'OTHER');
      setJobs(data);
      // Fetch all jobs for consolidated reminder
      const allData = await db.getJobs(userId);
      setAllJobs(allData);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id) {
      alert('Please sign in again.');
      return;
    }
    setFormLoading(true);

    try {
      if (editingJob) {
        // Update existing job
        await db.updateJob(editingJob.id, formData);
        setEditingJob(null);
      } else {
        // Create new job
        const newJob = await db.createJob({
          ...formData,
          user_id: user.id,
          category: 'OTHER',
        });
        console.log('Job created successfully:', newJob.id);
      }
      
      setFormData({
        customer_name: '',
        customer_phone: '',
        type_of_work: '',
        start_date: '',
        end_date: '',
        estimated_due_date: '',
        total_price: 0,
        amount_paid: 0,
        payment_status: 'PENDING',
        status: 'PENDING',
        notes: '',
      });
      setShowForm(false);
      fetchJobs(user.id);
    } catch (error) {
      console.error('Error creating job:', error);
      alert('Error saving job: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const typed = window.prompt('Type DELETE to move this entry to Trash.');
    if (typed !== 'DELETE') return;
    try {
      console.log('[UI] Deleting job:', id);
      await db.deleteJob(id);
      // Immediately update UI by removing from state
      setJobs(prev => prev.filter(j => j.id !== id));
      console.log('[UI] Job deleted successfully');
    } catch (error) {
      console.error('Error deleting job:', error);
      alert('Error deleting job: ' + (error as Error).message);
    }
  }

  async function handlePriorityChange(id: string, newPriority: string) {
    // optimistic UI
    setJobs(prev => prev.map(j => j.id === id ? { ...j, priority: newPriority } : j));
    try {
      await db.updateJob(id, { priority: newPriority as any });
      console.log('[UI] Priority updated for', id, newPriority);
    } catch (e) {
      console.error('Error updating priority:', e);
    }
  }

  function handleEdit(job: Job) {
    setFormData({
      customer_name: job.customer_name,
      customer_phone: job.customer_phone || '',
      type_of_work: job.type_of_work || '',
      start_date: job.start_date,
      end_date: job.end_date || '',
      estimated_due_date: (job as any).estimated_due_date || '',
      total_price: job.total_price,
      amount_paid: job.amount_paid,
      payment_status: job.payment_status,
      status: job.status,
      notes: job.notes || '',
    });
    setEditingJob(job);
    setShowForm(true);
  }

  function handleCancelEdit() {
    setEditingJob(null);
    setFormData({
      customer_name: '',
      customer_phone: '',
      type_of_work: '',
      start_date: '',
      end_date: '',
      estimated_due_date: '',
      total_price: 0,
      amount_paid: 0,
      payment_status: 'PENDING',
      status: 'PENDING',
      notes: '',
    });
    setShowForm(false);
  }

  // Filter suggestions based on input
  const filteredCustomersByName = customerSuggestions.filter(c => 
    c.name.toLowerCase().includes(formData.customer_name.toLowerCase()) && formData.customer_name.length > 0
  );
  
  const filteredCustomersByPhone = customerSuggestions.filter(c => 
    c.phone.includes(formData.customer_phone) && formData.customer_phone.length > 0
  );

  const selectCustomer = (customer: {name: string, phone: string}) => {
    setFormData({ ...formData, customer_name: customer.name, customer_phone: customer.phone });
    setShowCustomerSuggestions(false);
    setShowPhoneSuggestions(false);
  };

  const balance = formData.total_price - formData.amount_paid;

  const getStatusDisplay = (status: string) => {
    if (status === 'PENDING') return 'Yet to Start';
    if (status === 'IN_PROGRESS') return 'In Progress';
    if (status === 'COMPLETED') return 'Completed';
    return status;
  };

  const getPaymentStatusDisplay = (status: string) => {
    if (status === 'PENDING') return 'Pending';
    if (status === 'PARTIAL') return 'Partial';
    if (status === 'COMPLETED') return 'Completed';
    return status;
  };

  const sendWhatsAppReminder = async (job: Job, updateType: 'job' | 'payment', selectedJobStatus: string, selectedPaymentStatus: string) => {
    if (!user?.id) {
      alert('Please sign in again.');
      return;
    }
    const phone = job.customer_phone?.replace(/[^0-9]/g, '') || '';
    const message = await buildWhatsAppMessage({
      userId: user.id,
      category: 'OTHER',
      updateType,
      selectedJobStatus,
      selectedPaymentStatus,
      job,
    });
    const url = generateWhatsAppUrl(phone, message);
    if (!url) {
      alert('Customer phone number is missing.');
      return;
    }
    window.open(url, '_blank');
  };

  const openWhatsAppDialog = (job: Job) => {
    setWhatsAppJob(job);
    setWaUpdateType('job');
    setWaJobStatus(job.status);
    setWaPaymentStatus(job.payment_status);
  };

  const sendCustomerSummaryWhatsApp = async (group: { name: string; phone: string; jobs: Job[] }) => {
    if (!user?.id) {
      alert('Please sign in again.');
      return;
    }
    const phone = (group.phone || '').replace(/[^0-9]/g, '');
    if (!phone) {
      alert('Customer phone number is missing.');
      return;
    }
    const message = await buildCustomerSummaryMessage({
      userId: user.id,
      category: 'OTHER',
      group,
    });

    const url = generateWhatsAppUrl(phone, message);
    if (!url) {
      alert('Customer phone number is invalid.');
      return;
    }
    window.open(url, '_blank');
  };

  const sendAllPendingReminder = async (customerPhone: string) => {
    try {
      const phone = customerPhone?.replace(/[^0-9]/g, '') || '';
      const pendingJobs = allJobs.filter(j => 
        j.customer_phone?.replace(/[^0-9]/g, '') === phone && 
        j.payment_status !== 'COMPLETED'
      );

      if (pendingJobs.length === 0) return;

      const customerName = pendingJobs[0].customer_name;
      const message = await formatConsolidatedReminderAsync(customerName, pendingJobs.map(job => ({
        event_type: job.event_type,
        service_type: job.type_of_work,
        start_date: job.start_date,
        total_price: job.total_price,
        amount_paid: job.amount_paid,
        category: job.category
      })));
      const url = generateWhatsAppUrl(phone, message);
      window.open(url, '_blank');
    } catch (e) {
      console.error('Error sending consolidated reminder:', e);
    }
  };

  const getPendingCountForCustomer = (customerPhone: string) => {
    const phone = customerPhone?.replace(/[^0-9]/g, '') || '';
    return allJobs.filter(j => 
      j.customer_phone?.replace(/[^0-9]/g, '') === phone && 
      j.payment_status !== 'COMPLETED'
    ).length;
  };

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return jobs.filter(j => {
      if (priorityFilter !== 'ALL') {
        const p = (j.priority || 'NORMAL').toUpperCase();
        if (p !== priorityFilter) return false;
      }
      if (!q) return true;
      const hay = `${j.customer_name || ''} ${j.type_of_work || ''} ${j.notes || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [jobs, priorityFilter, searchQuery]);

  const customerKeyForJob = (job: Job) =>
    (job.customer_phone && job.customer_phone.trim()) ||
    (job.customer_name && job.customer_name.trim()) ||
    job.id;

  const selectedCustomerKey = searchParams.get('customer');
  const isCustomerView = !!selectedCustomerKey;

  const customerGroups = filteredJobs.reduce((acc, job) => {
    const key = customerKeyForJob(job);
    const existing = acc.get(key);
    if (!existing) {
      acc.set(key, { key, name: job.customer_name, phone: job.customer_phone || '', jobs: [job] });
    } else {
      existing.jobs.push(job);
    }
    return acc;
  }, new Map<string, { key: string; name: string; phone: string; jobs: Job[] }>());

  const groupedCustomers = Array.from(customerGroups.values());
  const customerJobs = isCustomerView
    ? jobs.filter((j) => customerKeyForJob(j) === selectedCustomerKey)
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-orange-900 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10 backdrop-blur-sm bg-black/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <button onClick={() => router.back()} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors active:scale-95 touch-manipulation">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                  <span className="text-xl sm:text-3xl">💼</span> Other Income
                </h1>
                <p className="text-orange-300 text-xs sm:text-sm mt-0.5 sm:mt-1 hidden sm:block">Additional services & miscellaneous</p>
              </div>
            </div>
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-white font-semibold text-sm sm:text-base hover:shadow-lg hover:shadow-orange-500/25 transition-all active:scale-95 touch-manipulation">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Add</span> Income
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Filters */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search customer, work or notes" className="w-full sm:w-80 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-orange-300 mr-1">Priority</label>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as any)} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none">
              <option value="ALL">All</option>
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
            </select>
          </div>
        </div>
        {/* Form */}
        {showForm && (
          <div className="mb-6 sm:mb-8 bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6">{editingJob ? 'Edit Income Entry' : 'New Other Income'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Customer Name with Autofill */}
                <div className="relative">
                  <label className="block text-xs sm:text-sm font-medium text-orange-300 mb-1.5 sm:mb-2">Customer Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                    <input 
                      ref={customerInputRef}
                      type="text" 
                      required 
                      value={formData.customer_name} 
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} 
                      onFocus={() => setShowCustomerSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                      className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500 touch-manipulation" 
                      placeholder="Enter customer name"
                      autoComplete="off"
                    />
                  </div>
                  {showCustomerSuggestions && filteredCustomersByName.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-white/20 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredCustomersByName.map((customer, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectCustomer(customer)}
                          className="w-full px-4 py-2 text-left text-white hover:bg-orange-600/30 flex items-center gap-2"
                        >
                          <User className="w-4 h-4 text-orange-400" />
                          <span>{customer.name}</span>
                          {customer.phone && <span className="text-orange-300 text-sm ml-auto">{customer.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Phone Number with Autofill */}
                <div className="relative">
                  <label className="block text-xs sm:text-sm font-medium text-orange-300 mb-1.5 sm:mb-2">Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                    <input 
                      ref={phoneInputRef}
                      type="tel" 
                      value={formData.customer_phone} 
                      onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })} 
                      onFocus={() => setShowPhoneSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowPhoneSuggestions(false), 200)}
                      className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500 touch-manipulation" 
                      placeholder="9876543210"
                      autoComplete="off"
                    />
                  </div>
                  {showPhoneSuggestions && filteredCustomersByPhone.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-white/20 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredCustomersByPhone.map((customer, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectCustomer(customer)}
                          className="w-full px-4 py-2 text-left text-white hover:bg-orange-600/30 flex items-center gap-2"
                        >
                          <Phone className="w-4 h-4 text-orange-400" />
                          <span>{customer.phone}</span>
                          <span className="text-orange-300 text-sm ml-auto">{customer.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-orange-300 mb-1.5 sm:mb-2">Type of Work *</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                    <input type="text" required value={formData.type_of_work} onChange={(e) => setFormData({ ...formData, type_of_work: e.target.value })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500 touch-manipulation" placeholder="e.g., Album Design, Printing" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-orange-300 mb-1.5 sm:mb-2">Start Date *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                    <input type="date" required value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 touch-manipulation" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-orange-300 mb-1.5 sm:mb-2">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                    <input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 touch-manipulation" />
                  </div>
                </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-orange-300 mb-1.5 sm:mb-2">Estimated Due Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                      <input type="date" value={formData.estimated_due_date} onChange={(e) => setFormData({ ...formData, estimated_due_date: e.target.value })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 touch-manipulation" />
                    </div>
                  </div>

                  <div>
                  <label className="block text-xs sm:text-sm font-medium text-orange-300 mb-1.5 sm:mb-2">Total Price (INR) *</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                    <input type="number" required min="0" value={formData.total_price} onChange={(e) => setFormData({ ...formData, total_price: parseFloat(e.target.value) || 0 })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 touch-manipulation" placeholder="0" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-orange-300 mb-1.5 sm:mb-2">Amount Paid (INR)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                    <input type="number" min="0" value={formData.amount_paid} onChange={(e) => setFormData({ ...formData, amount_paid: parseFloat(e.target.value) || 0 })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 touch-manipulation" placeholder="0" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-orange-300 mb-1.5 sm:mb-2">Balance (INR)</label>
                  <div className={`px-4 py-2.5 sm:py-3 rounded-xl font-bold text-base sm:text-lg ${balance > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    ₹{balance.toLocaleString('en-IN')}
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-orange-300 mb-1.5 sm:mb-2">Status</label>
                  <div className="flex gap-2">
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })} className="flex-1 px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 touch-manipulation">
                      <option value="PENDING" className="bg-slate-800">Yet to Start</option>
                      <option value="IN_PROGRESS" className="bg-slate-800">In Progress</option>
                      <option value="COMPLETED" className="bg-slate-800">Completed</option>
                    </select>
                    {false && (
                      <button
                        type="button"
                        onClick={async () => {
                          const message = await formatJobStatusMessageAsync(formData.status, {
                            customer_name: formData.customer_name,
                            event_type: formData.type_of_work,
                            start_date: formData.start_date,
                            total_price: formData.total_price,
                            amount_paid: formData.amount_paid,
                            category: 'OTHER'
                          });
                          window.open(generateWhatsAppUrl(formData.customer_phone, message), '_blank');
                        }}
                        className="p-2.5 sm:p-3 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors active:scale-95"
                        title="Send Status via WhatsApp"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-orange-300 mb-1.5 sm:mb-2">Payment Status</label>
                  <div className="flex gap-2">
                    <select value={formData.payment_status} onChange={(e) => setFormData({ ...formData, payment_status: e.target.value as any })} className="flex-1 px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-orange-500 touch-manipulation">
                      <option value="PENDING" className="bg-slate-800">Pending</option>
                      <option value="PARTIAL" className="bg-slate-800">Partial</option>
                      <option value="COMPLETED" className="bg-slate-800">Completed</option>
                    </select>
                    {false && (
                      <button
                        type="button"
                        onClick={async () => {
                          const message = formatPaymentStatusMessage(formData.payment_status, {
                            customer_name: formData.customer_name,
                            event_type: formData.type_of_work,
                            start_date: formData.start_date,
                            total_price: formData.total_price,
                            amount_paid: formData.amount_paid,
                            category: 'OTHER'
                          });
                          window.open(generateWhatsAppUrl(formData.customer_phone, message), '_blank');
                        }}
                        className="p-2.5 sm:p-3 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors active:scale-95"
                        title="Send Payment Status via WhatsApp"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-orange-300 mb-1.5 sm:mb-2">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="w-full px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500 touch-manipulation" placeholder="Add any notes..." />
              </div>

              <div className="flex gap-3 sm:gap-4">
                <button type="button" onClick={handleCancelEdit} className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-white/10 text-white font-semibold text-sm sm:text-base hover:bg-white/20 transition-colors active:scale-95 touch-manipulation">Cancel</button>
                <button type="submit" disabled={formLoading} className="flex-1 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-white font-semibold text-sm sm:text-base hover:shadow-lg disabled:opacity-50 transition-all active:scale-95 touch-manipulation">
                  {formLoading ? 'Saving...' : editingJob ? 'Update Income' : 'Save Income'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Jobs List */}
        <div className="space-y-3 sm:space-y-4 pb-24 sm:pb-0">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-orange-300 mt-4 text-sm sm:text-base">Loading income entries...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 sm:py-16 bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl">
              <span className="text-5xl sm:text-6xl">💼</span>
              <h3 className="text-lg sm:text-xl font-bold text-white mt-4">No Other Income Yet</h3>
              <p className="text-orange-300 mt-2 text-sm sm:text-base">Click "Add Income" to create your first entry</p>
            </div>
          ) : !isCustomerView && filteredJobs.length === 0 ? (
            <div className="text-center py-12 sm:py-16 bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl">
              <h3 className="text-lg sm:text-xl font-bold text-white mt-4">No matching entries</h3>
              <p className="text-orange-300 text-sm sm:text-base mt-2">Try clearing filters or search to see entries.</p>
            </div>
          ) : !isCustomerView ? (
            groupedCustomers.map((group) => {
              const totalIncome = group.jobs.reduce((s, j) => s + j.total_price, 0);
              const totalPaid = group.jobs.reduce((s, j) => s + j.amount_paid, 0);
              return (
                <div
                  key={group.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/jobs/other?customer=${encodeURIComponent(group.key)}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(`/jobs/other?customer=${encodeURIComponent(group.key)}`);
                    }
                  }}
                  className="w-full text-left bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-orange-500/50 transition-all active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">{group.name}</h3>
                      <p className="text-orange-300 text-sm mt-1">
                        {group.phone ? `Phone: ${group.phone}` : 'No phone'}
                      </p>
                      <p className="text-orange-300 text-sm mt-1">Entries: {group.jobs.length}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">Rs.{totalIncome.toLocaleString('en-IN')}</p>
                      <p className="text-sm text-amber-400">
                        Pending: Rs.{(totalIncome - totalPaid).toLocaleString('en-IN')}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sendCustomerSummaryWhatsApp(group);
                        }}
                        className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs"
                        title="Send Pending Summary"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp
                      </button>
                      <p className="text-xs text-orange-300 mt-2">Tap to view all entries</p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : customerJobs.length === 0 ? (
            <div className="text-center py-12 sm:py-16 bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl">
              <h3 className="text-lg sm:text-xl font-bold text-white mt-4">No entries for this customer</h3>
              <button
                onClick={() => router.push('/jobs/other')}
                className="mt-4 px-4 py-2 rounded-xl bg-orange-600 text-white font-semibold"
              >
                Back to Customers
              </button>
            </div>
          ) : (
            <>
              <div className="mb-2">
                <button
                  onClick={() => router.push('/jobs/other')}
                  className="px-3 py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20"
                >
                  Back to Customers
                </button>
              </div>
              {customerJobs.map((job) => (
              <div key={job.id} className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:border-orange-500/50 transition-all active:scale-[0.99]">
                {/* Mobile View */}
                <div className="sm:hidden">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${job.priority === 'HIGH' ? 'bg-red-500' : job.priority === 'LOW' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <h3 className="text-base font-bold text-white">{job.customer_name}</h3>
                      </div>
                      <p className="text-orange-300 text-xs mt-0.5">{job.type_of_work || 'Service'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${job.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : job.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {getStatusDisplay(job.status)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 text-xs text-orange-300 mb-2">
                    <div>Editing Start Date: <span className="font-medium text-white">{new Date(job.start_date).toLocaleDateString('en-IN')}</span></div>
                    <div>Estimated Due Date: <span className="font-medium text-white">{job.estimated_due_date ? new Date(job.estimated_due_date).toLocaleDateString('en-IN') : '—'}</span></div>
                    <div>Job Status: <span className="font-medium text-white">{getStatusDisplay(job.status)}</span></div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-lg font-bold text-white">Total Price (INR)
                        <span className="block text-2xl">₹{job.total_price.toLocaleString('en-IN')}</span>
                      </p>
                      <p className={`text-xs ${job.payment_status === 'COMPLETED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        Balance (INR): ₹{(job.total_price - job.amount_paid).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openWhatsAppDialog(job)} className="p-2 rounded-lg bg-green-500/20 text-green-400 active:scale-95 touch-manipulation" title="WhatsApp">
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <select value={(job.priority || 'NORMAL')} onChange={(e) => handlePriorityChange(job.id, e.target.value)} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                        <option value="LOW">Low</option>
                        <option value="NORMAL">Normal</option>
                        <option value="HIGH">High</option>
                      </select>
                      <button onClick={() => handleEdit(job)} className="p-2 rounded-lg bg-orange-500/20 text-orange-400 active:scale-95 touch-manipulation">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(job.id)} className="p-2 rounded-lg bg-red-500/20 text-red-400 active:scale-95 touch-manipulation">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Desktop View */}
                <div className="hidden sm:flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${job.priority === 'HIGH' ? 'bg-red-500' : job.priority === 'LOW' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <h3 className="text-lg font-bold text-white">{job.customer_name}</h3>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${job.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : job.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {getStatusDisplay(job.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-orange-300">
                      {job.type_of_work && <span>💼 {job.type_of_work}</span>}
                      <span>Editing Start Date: <span className="text-white font-medium">{new Date(job.start_date).toLocaleDateString('en-IN')}</span></span>
                      <span>Estimated Due Date: <span className="text-white font-medium">{job.estimated_due_date ? new Date(job.estimated_due_date).toLocaleDateString('en-IN') : '—'}</span></span>
                    </div>
                  </div>
                    <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-orange-300">Total Price (INR)</p>
                      <p className="text-2xl font-bold text-white">₹{job.total_price.toLocaleString('en-IN')}</p>
                      <p className={`text-sm ${job.payment_status === 'COMPLETED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        Balance (INR): ₹{(job.total_price - job.amount_paid).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <button onClick={() => openWhatsAppDialog(job)} className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors active:scale-95" title="WhatsApp">
                      <MessageCircle className="w-5 h-5" />
                    </button>
                    <select value={(job.priority || 'NORMAL')} onChange={(e) => handlePriorityChange(job.id, e.target.value)} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white text-sm mr-2">
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                    </select>
                    <button onClick={() => handleEdit(job)} className="p-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors active:scale-95">
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDelete(job.id)} className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors active:scale-95">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            </>
          )}
        </div>
      </div>

      {whatsAppJob && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-white/20 rounded-2xl p-5">
            <h3 className="text-white text-lg font-bold mb-4">Send WhatsApp Update</h3>
            <p className="text-orange-300 text-sm mb-4">{whatsAppJob.customer_name}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-orange-300 mb-1">Update Type</label>
                <select
                  value={waUpdateType}
                  onChange={(e) => setWaUpdateType(e.target.value as 'job' | 'payment')}
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white"
                >
                  <option value="job" className="bg-slate-800">Job Status</option>
                  <option value="payment" className="bg-slate-800">Payment Status</option>
                </select>
              </div>
              {waUpdateType === 'job' ? (
                <div>
                  <label className="block text-xs text-orange-300 mb-1">Job Status</label>
                  <select
                    value={waJobStatus}
                    onChange={(e) => setWaJobStatus(e.target.value as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED')}
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white"
                  >
                    <option value="PENDING" className="bg-slate-800">Yet to Start</option>
                    <option value="IN_PROGRESS" className="bg-slate-800">In Progress</option>
                    <option value="COMPLETED" className="bg-slate-800">Completed</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-orange-300 mb-1">Payment Status</label>
                  <select
                    value={waPaymentStatus}
                    onChange={(e) => setWaPaymentStatus(e.target.value as 'PENDING' | 'PARTIAL' | 'COMPLETED')}
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white"
                  >
                    <option value="PENDING" className="bg-slate-800">Pending</option>
                    <option value="PARTIAL" className="bg-slate-800">Partial</option>
                    <option value="COMPLETED" className="bg-slate-800">Completed</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setWhatsAppJob(null)}
                className="flex-1 py-2 rounded-xl bg-white/10 text-white"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await sendWhatsAppReminder(whatsAppJob, waUpdateType, waJobStatus, waPaymentStatus);
                  setWhatsAppJob(null);
                }}
                className="flex-1 py-2 rounded-xl bg-green-600 text-white font-semibold"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
