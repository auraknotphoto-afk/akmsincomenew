'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Camera, Calendar, User, IndianRupee, Trash2, Phone, Edit2, MessageCircle, Send, Building2, Clock } from 'lucide-react';
import { db, Job } from '@/lib/supabase';
import { formatSingleReminder, formatConsolidatedReminder, generateWhatsAppUrl, getServiceIcon, formatJobStatusMessage, formatPaymentStatusMessage } from '@/lib/whatsappTemplates';

// Event types list - used across the app
const EVENT_TYPES = [
  'Engagement',
  'Reception',
  'Wedding',
  'Puberty',
  'Baby Shower',
  'Corporate',
  'School/College',
  'House Warming',
  'Ear Piercing',
  'Tonsure Event',
  'Manual Entry',
];

// Camera options for dropdown
const CAMERA_OPTIONS = [
  'Single Camera',
  'Double Camera',
  'Multi Camera',
];

export default function EditingPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  
  // Autofill suggestions state
  const [customerSuggestions, setCustomerSuggestions] = useState<{name: string, phone: string, client_name?: string, studio_name?: string}[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const [customEventType, setCustomEventType] = useState('');
  const [showCustomEventInput, setShowCustomEventInput] = useState(false);
  
  const customerInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  
  // Separate state for hours and minutes input
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(0);
  
  const [formData, setFormData] = useState<{
    customer_name: string;
    customer_phone: string;
    client_name: string;
    studio_name: string;
    event_type: string;
    start_date: string;
    end_date: string;
    camera_type: string;
    duration_hours: number;
    rate_per_hour: number;
    total_price: number;
    amount_paid: number;
    payment_status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    notes: string;
  }>({
    customer_name: '',
    customer_phone: '',
    client_name: '',
    studio_name: '',
    event_type: '',
    start_date: '',
    end_date: '',
    camera_type: '',
    duration_hours: 0,
    rate_per_hour: 0,
    total_price: 0,
    amount_paid: 0,
    payment_status: 'PENDING',
    status: 'PENDING',
    notes: '',
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  // Build suggestions from ALL jobs across all categories
  useEffect(() => {
    const customers = allJobs.reduce((acc, job) => {
      const existing = acc.find(c => c.name === job.customer_name);
      if (!existing && job.customer_name) {
        acc.push({ 
          name: job.customer_name, 
          phone: job.customer_phone || '',
          client_name: job.client_name || '',
          studio_name: job.studio_name || ''
        });
      }
      return acc;
    }, [] as {name: string, phone: string, client_name?: string, studio_name?: string}[]);
    setCustomerSuggestions(customers);
  }, [allJobs]);

  // Auto-calculate duration_hours from hours and minutes
  useEffect(() => {
    const totalHours = durationHours + (durationMinutes / 60);
    setFormData(prev => ({ ...prev, duration_hours: totalHours }));
  }, [durationHours, durationMinutes]);

  // Auto-calculate total price when duration or rate changes
  useEffect(() => {
    if (formData.duration_hours > 0 && formData.rate_per_hour > 0) {
      const calculatedPrice = Math.round(formData.duration_hours * formData.rate_per_hour);
      setFormData(prev => ({ ...prev, total_price: calculatedPrice }));
    }
  }, [formData.duration_hours, formData.rate_per_hour]);

  async function fetchJobs() {
    try {
      const data = await db.getJobs('00000000-0000-0000-0000-000000000001', 'EDITING');
      setJobs(data);
      // Fetch all jobs for consolidated reminder
      const allData = await db.getJobs('00000000-0000-0000-0000-000000000001');
      setAllJobs(allData);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);

    try {
      const eventType = showCustomEventInput ? customEventType : formData.event_type;
      
      if (editingJob) {
        // Update existing job
        await db.updateJob(editingJob.id, {
          ...formData,
          event_type: eventType,
        });
        setEditingJob(null);
      } else {
        // Create new job
        const newJob = await db.createJob({
          ...formData,
          event_type: eventType,
          user_id: '00000000-0000-0000-0000-000000000001',
          category: 'EDITING',
        });
        console.log('Job created successfully:', newJob.id);
      }
      
      setFormData({
        customer_name: '',
        customer_phone: '',
        client_name: '',
        studio_name: '',
        event_type: '',
        start_date: '',
        end_date: '',
        camera_type: '',
        duration_hours: 0,
        rate_per_hour: 0,
        total_price: 0,
        amount_paid: 0,
        payment_status: 'PENDING',
        status: 'PENDING',
        notes: '',
      });
      setDurationHours(0);
      setDurationMinutes(0);
      setCustomEventType('');
      setShowCustomEventInput(false);
      setShowForm(false);
      fetchJobs();
    } catch (error) {
      console.error('Error creating job:', error);
      alert('Error saving job: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this job?')) return;
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

  function handleEdit(job: Job) {
    const isCustomEvent = !EVENT_TYPES.includes(job.event_type || '');
    // Convert duration_hours back to hours and minutes
    const totalDuration = job.duration_hours || 0;
    const hrs = Math.floor(totalDuration);
    const mins = Math.round((totalDuration - hrs) * 60);
    setDurationHours(hrs);
    setDurationMinutes(mins);
    
    setFormData({
      customer_name: job.customer_name,
      customer_phone: job.customer_phone || '',
      client_name: job.client_name || '',
      studio_name: job.studio_name || '',
      event_type: isCustomEvent ? '' : (job.event_type || ''),
      start_date: job.start_date,
      end_date: job.end_date || '',
      camera_type: job.camera_type || '',
      duration_hours: job.duration_hours || 0,
      rate_per_hour: job.rate_per_hour || 0,
      total_price: job.total_price,
      amount_paid: job.amount_paid,
      payment_status: job.payment_status as 'PENDING' | 'PARTIAL' | 'COMPLETED',
      status: job.status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED',
      notes: job.notes || '',
    });
    if (isCustomEvent && job.event_type) {
      setShowCustomEventInput(true);
      setCustomEventType(job.event_type);
    } else {
      setShowCustomEventInput(false);
      setCustomEventType('');
    }
    setEditingJob(job);
    setShowForm(true);
  }

  function handleCancelEdit() {
    setEditingJob(null);
    setFormData({
      customer_name: '',
      customer_phone: '',
      client_name: '',
      studio_name: '',
      event_type: '',
      start_date: '',
      end_date: '',
      camera_type: '',
      duration_hours: 0,
      rate_per_hour: 0,
      total_price: 0,
      amount_paid: 0,
      payment_status: 'PENDING',
      status: 'PENDING',
      notes: '',
    });
    setDurationHours(0);
    setDurationMinutes(0);
    setCustomEventType('');
    setShowCustomEventInput(false);
    setShowForm(false);
  }

  // Filter suggestions based on input
  const filteredCustomersByName = customerSuggestions.filter(c => 
    c.name.toLowerCase().includes(formData.customer_name.toLowerCase()) && formData.customer_name.length > 0
  );
  
  const filteredCustomersByPhone = customerSuggestions.filter(c => 
    c.phone.includes(formData.customer_phone) && formData.customer_phone.length > 0
  );

  const selectCustomer = (customer: {name: string, phone: string, client_name?: string, studio_name?: string}) => {
    setFormData({ 
      ...formData, 
      customer_name: customer.name, 
      customer_phone: customer.phone,
      client_name: customer.client_name || '',
      studio_name: customer.studio_name || ''
    });
    setShowCustomerSuggestions(false);
    setShowPhoneSuggestions(false);
  };

  const handleEventTypeChange = (value: string) => {
    if (value === 'Manual Entry') {
      setShowCustomEventInput(true);
      setFormData({ ...formData, event_type: '' });
    } else {
      setShowCustomEventInput(false);
      setCustomEventType('');
      setFormData({ ...formData, event_type: value });
    }
  };

  const balance = formData.total_price - formData.amount_paid;

  const getStatusDisplay = (status: string) => {
    if (status === 'PENDING') return 'Yet to Start';
    if (status === 'IN_PROGRESS') return 'In Progress';
    if (status === 'COMPLETED') return 'Completed';
    return status;
  };

  const sendWhatsAppReminder = (job: Job) => {
    const phone = job.customer_phone?.replace(/[^0-9]/g, '') || '';
    const message = formatSingleReminder({
      customer_name: job.customer_name,
      event_type: job.event_type,
      start_date: job.start_date,
      total_price: job.total_price,
      amount_paid: job.amount_paid,
      category: job.category
    });
    
    const url = generateWhatsAppUrl(phone, message);
    window.open(url, '_blank');
  };

  const sendAllPendingReminder = (customerPhone: string) => {
    const phone = customerPhone?.replace(/[^0-9]/g, '') || '';
    const pendingJobs = allJobs.filter(j => 
      j.customer_phone?.replace(/[^0-9]/g, '') === phone && 
      j.payment_status !== 'COMPLETED'
    );
    
    if (pendingJobs.length === 0) return;
    
    const customerName = pendingJobs[0].customer_name;
    const message = formatConsolidatedReminder(customerName, pendingJobs.map(job => ({
      event_type: job.event_type,
      service_type: job.type_of_work,
      start_date: job.start_date,
      total_price: job.total_price,
      amount_paid: job.amount_paid,
      category: job.category
    })));
    
    const url = generateWhatsAppUrl(phone, message);
    window.open(url, '_blank');
  };

  const getPendingCountForCustomer = (customerPhone: string) => {
    const phone = customerPhone?.replace(/[^0-9]/g, '') || '';
    return allJobs.filter(j => 
      j.customer_phone?.replace(/[^0-9]/g, '') === phone && 
      j.payment_status !== 'COMPLETED'
    ).length;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
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
                  <span className="text-xl sm:text-3xl">✨</span> Editing Jobs
                </h1>
                <p className="text-purple-300 text-xs sm:text-sm mt-0.5 sm:mt-1 hidden sm:block">Post-production & video editing</p>
              </div>
            </div>
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm sm:text-base hover:shadow-lg hover:shadow-purple-500/25 transition-all active:scale-95">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden xs:inline">Add</span> Job
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Form */}
        {showForm && (
          <div className="mb-4 sm:mb-8 bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <h2 className="text-base sm:text-xl font-bold text-white mb-4 sm:mb-6">{editingJob ? 'Edit Editing Job' : 'New Editing Job'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Studio Name/Customer Name with Autofill */}
                <div className="relative">
                  <label className="block text-xs sm:text-sm font-medium text-purple-300 mb-1.5 sm:mb-2">Studio Name/Customer Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                    <input 
                      ref={customerInputRef}
                      type="text" 
                      required 
                      value={formData.customer_name} 
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} 
                      onFocus={() => setShowCustomerSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                      className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation" 
                      placeholder="Enter studio/customer name"
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
                          className="w-full px-3 sm:px-4 py-2.5 text-left text-white text-sm hover:bg-purple-600/30 flex items-center gap-2"
                        >
                          <User className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          <span className="truncate">{customer.name}</span>
                          {customer.phone && <span className="text-purple-300 text-xs ml-auto flex-shrink-0">{customer.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Phone Number with Autofill */}
                <div className="relative">
                  <label className="block text-xs sm:text-sm font-medium text-purple-300 mb-1.5 sm:mb-2">Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                    <input 
                      ref={phoneInputRef}
                      type="tel" 
                      value={formData.customer_phone} 
                      onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })} 
                      onFocus={() => setShowPhoneSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowPhoneSuggestions(false), 200)}
                      className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation" 
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
                          className="w-full px-3 sm:px-4 py-2.5 text-left text-white text-sm hover:bg-purple-600/30 flex items-center gap-2"
                        >
                          <Phone className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          <span>{customer.phone}</span>
                          <span className="text-purple-300 text-xs ml-auto truncate">{customer.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Client Name */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-purple-300 mb-1.5 sm:mb-2">Client Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                    <input 
                      type="text" 
                      value={formData.client_name} 
                      onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} 
                      className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation" 
                      placeholder="Enter client name"
                    />
                  </div>
                </div>

                {/* Event Type Dropdown */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-purple-300 mb-1.5 sm:mb-2">Event Type</label>
                  {!showCustomEventInput ? (
                    <select 
                      value={formData.event_type} 
                      onChange={(e) => handleEventTypeChange(e.target.value)} 
                      className="w-full px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation"
                    >
                      <option value="" className="bg-slate-800">Select Event</option>
                      {EVENT_TYPES.map(type => (
                        <option key={type} value={type} className="bg-slate-800">{type}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={customEventType} 
                        onChange={(e) => setCustomEventType(e.target.value)} 
                        className="flex-1 px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation" 
                        placeholder="Enter event type"
                      />
                      <button 
                        type="button" 
                        onClick={() => { setShowCustomEventInput(false); setCustomEventType(''); }}
                        className="px-3 py-2 bg-white/10 rounded-xl text-white hover:bg-white/20 active:scale-95"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-purple-300 mb-1.5 sm:mb-2">Editing Start Date *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                    <input type="date" required value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-purple-300 mb-1.5 sm:mb-2">Editing End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                    <input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-purple-300 mb-1.5 sm:mb-2">Camera Type</label>
                  <div className="relative">
                    <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                    <select 
                      value={formData.camera_type} 
                      onChange={(e) => setFormData({ ...formData, camera_type: e.target.value })} 
                      className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation"
                    >
                      <option value="" className="bg-slate-800">Select Camera</option>
                      {CAMERA_OPTIONS.map(type => (
                        <option key={type} value={type} className="bg-slate-800">{type}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-purple-300 mb-1.5 sm:mb-2">Total Duration</label>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                      <input 
                        type="number" 
                        min="0" 
                        value={durationHours} 
                        onChange={(e) => setDurationHours(parseInt(e.target.value) || 0)} 
                        className="w-full pl-10 sm:pl-11 pr-8 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation" 
                        placeholder="0" 
                      />
                      <span className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-purple-300 text-xs sm:text-sm">hrs</span>
                    </div>
                    <span className="text-purple-300">:</span>
                    <div className="relative flex-1">
                      <input 
                        type="number" 
                        min="0" 
                        max="59" 
                        value={durationMinutes} 
                        onChange={(e) => setDurationMinutes(Math.min(59, parseInt(e.target.value) || 0))} 
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation" 
                        placeholder="0" 
                      />
                      <span className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-purple-300 text-xs sm:text-sm">min</span>
                    </div>
                  </div>
                  {formData.duration_hours > 0 && (
                    <p className="text-[10px] sm:text-xs text-purple-400 mt-1">Total: {formData.duration_hours.toFixed(2)} hours</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-purple-300 mb-1.5 sm:mb-2">Rate per Hour (INR)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                    <input type="number" min="0" value={formData.rate_per_hour} onChange={(e) => setFormData({ ...formData, rate_per_hour: parseFloat(e.target.value) || 0 })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation" placeholder="0" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-purple-300 mb-1.5 sm:mb-2">Total Price (INR) *</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                    <input type="number" required min="0" value={formData.total_price} onChange={(e) => setFormData({ ...formData, total_price: parseFloat(e.target.value) || 0 })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation" placeholder="0" />
                  </div>
                  {formData.duration_hours > 0 && formData.rate_per_hour > 0 && (
                    <p className="text-[10px] sm:text-xs text-purple-400 mt-1">Calculated: {formData.duration_hours} hrs × Rs.{formData.rate_per_hour} = Rs.{(formData.duration_hours * formData.rate_per_hour).toLocaleString('en-IN')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-purple-300 mb-1.5 sm:mb-2">Amount Paid (INR)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                    <input type="number" min="0" value={formData.amount_paid} onChange={(e) => setFormData({ ...formData, amount_paid: parseFloat(e.target.value) || 0 })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation" placeholder="0" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-purple-300 mb-1.5 sm:mb-2">Balance (INR)</label>
                  <div className={`px-4 py-2.5 sm:py-3 rounded-xl font-bold text-base sm:text-lg ${balance > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    ₹{balance.toLocaleString('en-IN')}
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-purple-300 mb-1.5 sm:mb-2">Job Status</label>
                  <div className="flex gap-2">
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })} className="flex-1 px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation">
                      <option value="PENDING" className="bg-slate-800">Yet to Start</option>
                      <option value="IN_PROGRESS" className="bg-slate-800">In Progress</option>
                      <option value="COMPLETED" className="bg-slate-800">Completed</option>
                    </select>
                    {formData.customer_phone && (
                      <button
                        type="button"
                        onClick={() => {
                          const message = formatJobStatusMessage(formData.status, {
                            customer_name: formData.customer_name,
                            event_type: formData.event_type,
                            start_date: formData.start_date,
                            total_price: formData.total_price,
                            amount_paid: formData.amount_paid,
                            category: 'EDITING'
                          });
                          window.open(generateWhatsAppUrl(formData.customer_phone, message), '_blank');
                        }}
                        className="p-2.5 sm:p-3 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors active:scale-95"
                        title="Send Job Status via WhatsApp"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-purple-300 mb-1.5 sm:mb-2">Payment Status</label>
                  <div className="flex gap-2">
                    <select value={formData.payment_status} onChange={(e) => setFormData({ ...formData, payment_status: e.target.value as any })} className="flex-1 px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation">
                      <option value="PENDING" className="bg-slate-800">Pending</option>
                      <option value="PARTIAL" className="bg-slate-800">Partial</option>
                      <option value="COMPLETED" className="bg-slate-800">Completed</option>
                    </select>
                    {formData.customer_phone && (
                      <button
                        type="button"
                        onClick={() => {
                          const message = formatPaymentStatusMessage(formData.payment_status, {
                            customer_name: formData.customer_name,
                            event_type: formData.event_type,
                            start_date: formData.start_date,
                            total_price: formData.total_price,
                            amount_paid: formData.amount_paid,
                            category: 'EDITING'
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
                <label className="block text-xs sm:text-sm font-medium text-purple-300 mb-1.5 sm:mb-2">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="w-full px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation" placeholder="Add any notes..." />
              </div>

              <div className="flex gap-3 sm:gap-4">
                <button type="button" onClick={handleCancelEdit} className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-white/10 text-white font-semibold text-sm sm:text-base hover:bg-white/20 transition-colors active:scale-95">Cancel</button>
                <button type="submit" disabled={formLoading} className="flex-1 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm sm:text-base hover:shadow-lg disabled:opacity-50 transition-all active:scale-95">
                  {formLoading ? 'Saving...' : editingJob ? 'Update Job' : 'Save Job'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Jobs List */}
        <div className="space-y-3 sm:space-y-4 pb-24 sm:pb-0">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-purple-300 mt-4 text-sm sm:text-base">Loading jobs...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 sm:py-16 bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl">
              <span className="text-4xl sm:text-6xl">✨</span>
              <h3 className="text-lg sm:text-xl font-bold text-white mt-4">No Editing Jobs Yet</h3>
              <p className="text-purple-300 text-sm sm:text-base mt-2">Click "Add Job" to create your first editing job</p>
            </div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-purple-500/50 transition-all active:scale-[0.99]">
                <div className="flex flex-col gap-3 sm:gap-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-bold text-white truncate">{job.customer_name}</h3>
                        <span className={`px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium flex-shrink-0 ${job.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : job.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {getStatusDisplay(job.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-purple-300">
                        {job.event_type && <span>📸 {job.event_type}</span>}
                        <span>📅 {new Date(job.start_date).toLocaleDateString('en-IN')}</span>
                        {job.customer_phone && <span className="hidden sm:inline">📞 {job.customer_phone}</span>}
                      </div>
                    </div>
                    
                    {/* Desktop Price Display */}
                    <div className="text-right hidden sm:block">
                      <p className="text-xl sm:text-2xl font-bold text-white">₹{job.total_price.toLocaleString('en-IN')}</p>
                      <p className={`text-xs sm:text-sm ${job.payment_status === 'COMPLETED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {job.payment_status === 'COMPLETED' ? 'Paid' : `Pending: ₹${(job.total_price - job.amount_paid).toLocaleString('en-IN')}`}
                      </p>
                    </div>
                  </div>
                  
                  {/* Mobile Price and Actions Row */}
                  <div className="flex items-center justify-between gap-3 sm:hidden">
                    <div>
                      <p className="text-lg font-bold text-white">₹{job.total_price.toLocaleString('en-IN')}</p>
                      <p className={`text-xs ${job.payment_status === 'COMPLETED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {job.payment_status === 'COMPLETED' ? 'Paid' : `Pending: ₹${(job.total_price - job.amount_paid).toLocaleString('en-IN')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.customer_phone && (
                        <>
                          <button onClick={() => sendWhatsAppReminder(job)} className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors active:scale-95" title="Send WhatsApp">
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          {getPendingCountForCustomer(job.customer_phone || '') > 1 && (
                            <button onClick={() => sendAllPendingReminder(job.customer_phone || '')} className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors relative active:scale-95" title="Send All Reminders">
                              <Send className="w-4 h-4" />
                              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
                                {getPendingCountForCustomer(job.customer_phone || '')}
                              </span>
                            </button>
                          )}
                        </>
                      )}
                      <button onClick={() => handleEdit(job)} className="p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors active:scale-95">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(job.id)} className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors active:scale-95">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Desktop Actions */}
                  <div className="hidden sm:flex items-center justify-end gap-2">
                    {job.customer_phone && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => sendWhatsAppReminder(job)} className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors" title="Send WhatsApp">
                          <MessageCircle className="w-5 h-5" />
                        </button>
                        {getPendingCountForCustomer(job.customer_phone || '') > 1 && (
                          <button onClick={() => sendAllPendingReminder(job.customer_phone || '')} className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors relative" title={`Send All ${getPendingCountForCustomer(job.customer_phone || '')} Pending Reminders`}>
                            <Send className="w-5 h-5" />
                            <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                              {getPendingCountForCustomer(job.customer_phone || '')}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                    <button onClick={() => handleEdit(job)} className="p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors">
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDelete(job.id)} className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
