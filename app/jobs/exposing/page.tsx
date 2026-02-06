'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Camera, Calendar, User, IndianRupee, MapPin, Trash2, Building2, Phone, Edit2, MessageCircle, Send } from 'lucide-react';
import { db, Job } from '@/lib/supabase';
import { formatSingleReminder, formatConsolidatedReminder, generateWhatsAppUrl, formatJobStatusMessage, formatPaymentStatusMessage } from '@/lib/whatsappTemplates';

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

export default function ExposingPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  
  // Autofill suggestions state
  const [customerSuggestions, setCustomerSuggestions] = useState<{name: string, phone: string}[]>([]);
  const [studioSuggestions, setStudioSuggestions] = useState<string[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const [showStudioSuggestions, setShowStudioSuggestions] = useState(false);
  const [customEventType, setCustomEventType] = useState('');
  const [showCustomEventInput, setShowCustomEventInput] = useState(false);
  
  const customerInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const studioInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<{
    customer_name: string;
    customer_phone: string;
    studio_name: string;
    event_type: string;
    event_location: string;
    start_date: string;
    end_date: string;
    session_type: string;
    exposure_type: string;
    expose_type: string;
    camera_type: string;
    total_price: number;
    amount_paid: number;
    payment_status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    notes: string;
  }>({
    customer_name: '',
    customer_phone: '',
    studio_name: '',
    event_type: '',
    event_location: '',
    start_date: '',
    end_date: '',
    session_type: 'FULL_SESSION',
    exposure_type: '',
    expose_type: '',
    camera_type: '',
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
        acc.push({ name: job.customer_name, phone: job.customer_phone || '' });
      }
      return acc;
    }, [] as {name: string, phone: string}[]);
    setCustomerSuggestions(customers);
    
    const studios = [...new Set(allJobs.filter(j => j.studio_name).map(j => j.studio_name!))];
    setStudioSuggestions(studios);
  }, [allJobs]);

  async function fetchJobs() {
    try {
      const data = await db.getJobs('00000000-0000-0000-0000-000000000001', 'EXPOSING');
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
          category: 'EXPOSING',
        });
        console.log('Job created successfully:', newJob.id);
      }
      
      setFormData({
        customer_name: '',
        customer_phone: '',
        studio_name: '',
        event_type: '',
        event_location: '',
        start_date: '',
        end_date: '',
        session_type: 'FULL_SESSION',
        exposure_type: '',
        expose_type: '',
        camera_type: '',
        total_price: 0,
        amount_paid: 0,
        payment_status: 'PENDING',
        status: 'PENDING',
        notes: '',
      });
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
    setFormData({
      customer_name: job.customer_name,
      customer_phone: job.customer_phone || '',
      studio_name: job.studio_name || '',
      event_type: isCustomEvent ? '' : (job.event_type || ''),
      event_location: job.event_location || '',
      start_date: job.start_date,
      end_date: job.end_date || '',
      session_type: job.session_type || 'FULL_SESSION',
      exposure_type: job.exposure_type || '',
      expose_type: job.expose_type || '',
      camera_type: job.camera_type || '',
      total_price: job.total_price,
      amount_paid: job.amount_paid,
      payment_status: job.payment_status,
      status: job.status,
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
      studio_name: '',
      event_type: '',
      event_location: '',
      start_date: '',
      end_date: '',
      session_type: 'FULL_SESSION',
      exposure_type: '',
      expose_type: '',
      camera_type: '',
      total_price: 0,
      amount_paid: 0,
      payment_status: 'PENDING',
      status: 'PENDING',
      notes: '',
    });
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
  
  const filteredStudios = studioSuggestions.filter(s => 
    s.toLowerCase().includes(formData.studio_name.toLowerCase()) && formData.studio_name.length > 0
  );

  const selectCustomer = (customer: {name: string, phone: string}) => {
    setFormData({ ...formData, customer_name: customer.name, customer_phone: customer.phone });
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
    const balance = job.total_price - job.amount_paid;
    const phone = job.customer_phone?.replace(/[^0-9]/g, '') || '';
    const message = `Hi ${job.customer_name},

This is a friendly reminder from *Aura Knot Photography* regarding your pending payment.

� Service: ${job.event_type || 'Exposing Session'}
📅 Date: ${new Date(job.start_date).toLocaleDateString('en-IN')}
💰 Total Amount: Rs.${job.total_price.toLocaleString('en-IN')}
✅ Amount Paid: Rs.${job.amount_paid.toLocaleString('en-IN')}
⏳ *Balance Due: Rs.${balance.toLocaleString('en-IN')}*

Please complete the payment at your earliest convenience.

Thank you for choosing us! 🙏

- Aura Knot Photography`;
    
    const url = `https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${encodeURIComponent(message)}`;
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
    let totalPending = 0;
    let jobsList = '';
    
    pendingJobs.forEach((job, index) => {
      const balance = job.total_price - job.amount_paid;
      totalPending += balance;
      const category = job.category === 'EXPOSING' ? '📷 Exposing' : job.category === 'EDITING' ? '🎬 Editing' : '📋 Other';
      const service = job.event_type || job.type_of_work || 'Service';
      jobsList += `\n${index + 1}. ${category} - ${service}\n   📅 ${new Date(job.start_date).toLocaleDateString('en-IN')}\n   💰 Total: Rs.${job.total_price.toLocaleString('en-IN')} | Paid: Rs.${job.amount_paid.toLocaleString('en-IN')}\n   ⏳ Balance: Rs.${balance.toLocaleString('en-IN')}\n`;
    });
    
    const message = `Hi ${customerName},

This is a friendly reminder from *Aura Knot Photography* regarding your pending payments.

📝 *Pending Services (${pendingJobs.length}):*${jobsList}
━━━━━━━━━━━━━━━
💵 *TOTAL BALANCE DUE: Rs.${totalPending.toLocaleString('en-IN')}*

Please complete the payment at your earliest convenience.

Thank you for choosing us! 🙏

- Aura Knot Photography`;
    
    const url = `https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${encodeURIComponent(message)}`;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900">
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
                  <span className="text-xl sm:text-3xl">📷</span> <span className="hidden xs:inline">Exposing</span> Sessions
                </h1>
                <p className="text-cyan-300 text-xs sm:text-sm mt-0.5 sm:mt-1 hidden sm:block">Photo and video exposing</p>
              </div>
            </div>
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold text-sm sm:text-base hover:shadow-lg hover:shadow-cyan-500/25 transition-all active:scale-95 touch-manipulation">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Add</span> Session
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Form */}
        {showForm && (
          <div className="mb-6 sm:mb-8 bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6">{editingJob ? 'Edit Exposing Session' : 'New Exposing Session'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Studio Name/Customer Name with Autofill */}
                <div className="relative">
                  <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Studio Name/Customer Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                    <input 
                      ref={customerInputRef}
                      type="text" 
                      required 
                      value={formData.customer_name} 
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} 
                      onFocus={() => setShowCustomerSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                      className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation" 
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
                          className="w-full px-4 py-2 text-left text-white hover:bg-cyan-600/30 flex items-center gap-2"
                        >
                          <User className="w-4 h-4 text-cyan-400" />
                          <span>{customer.name}</span>
                          {customer.phone && <span className="text-cyan-300 text-sm ml-auto">{customer.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Phone Number with Autofill */}
                <div className="relative">
                  <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                    <input 
                      ref={phoneInputRef}
                      type="tel" 
                      value={formData.customer_phone} 
                      onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })} 
                      onFocus={() => setShowPhoneSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowPhoneSuggestions(false), 200)}
                      className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation" 
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
                          className="w-full px-4 py-2 text-left text-white hover:bg-cyan-600/30 flex items-center gap-2"
                        >
                          <Phone className="w-4 h-4 text-cyan-400" />
                          <span>{customer.phone}</span>
                          <span className="text-cyan-300 text-sm ml-auto">{customer.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Client Name with Autofill */}
                <div className="relative">
                  <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Client Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                    <input 
                      ref={studioInputRef}
                      type="text" 
                      value={formData.studio_name} 
                      onChange={(e) => setFormData({ ...formData, studio_name: e.target.value })} 
                      onFocus={() => setShowStudioSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowStudioSuggestions(false), 200)}
                      className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation" 
                      placeholder="Client name"
                      autoComplete="off"
                    />
                  </div>
                  {showStudioSuggestions && filteredStudios.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-white/20 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredStudios.map((studio, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, studio_name: studio });
                            setShowStudioSuggestions(false);
                          }}
                          className="w-full px-4 py-2 text-left text-white hover:bg-cyan-600/30 flex items-center gap-2"
                        >
                          <Building2 className="w-4 h-4 text-cyan-400" />
                          <span>{studio}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Event Type Dropdown */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Event Type</label>
                  {!showCustomEventInput ? (
                    <select 
                      value={formData.event_type} 
                      onChange={(e) => handleEventTypeChange(e.target.value)} 
                      className="w-full px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation"
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
                        className="flex-1 px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation" 
                        placeholder="Enter event type"
                      />
                      <button 
                        type="button" 
                        onClick={() => { setShowCustomEventInput(false); setCustomEventType(''); }}
                        className="px-3 py-2 bg-white/10 rounded-xl text-white hover:bg-white/20 active:scale-95 touch-manipulation"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                    <input type="text" value={formData.event_location} onChange={(e) => setFormData({ ...formData, event_location: e.target.value })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation" placeholder="Event location" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Event Start Date *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                    <input type="date" required value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Event End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                    <input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Session Type</label>
                  <select value={formData.session_type} onChange={(e) => setFormData({ ...formData, session_type: e.target.value })} className="w-full px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation">
                    <option value="FULL_SESSION" className="bg-slate-800">Full Session</option>
                    <option value="HALF_SESSION" className="bg-slate-800">Half Session</option>
                    <option value="HOURLY" className="bg-slate-800">Hourly</option>
                  </select>
                </div>

                {/* Type of Expose Dropdown */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Type of Expose</label>
                  <div className="relative">
                    <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                    <select 
                      value={formData.expose_type} 
                      onChange={(e) => setFormData({ ...formData, expose_type: e.target.value })} 
                      className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation"
                    >
                      <option value="" className="bg-slate-800">Select Type</option>
                      <option value="Man Expose" className="bg-slate-800">Man Expose</option>
                      <option value="Man + Camera Expose" className="bg-slate-800">Man + Camera Expose</option>
                      <option value="Camera Only" className="bg-slate-800">Camera Only</option>
                    </select>
                  </div>
                </div>

                {/* Types of Camera - Manual Entry */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Types of Camera</label>
                  <div className="relative">
                    <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                    <input 
                      type="text" 
                      value={formData.camera_type} 
                      onChange={(e) => setFormData({ ...formData, camera_type: e.target.value })} 
                      className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation" 
                      placeholder="e.g., Canon 5D, Sony A7III"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Total Price (INR) *</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                    <input type="number" required min="0" value={formData.total_price} onChange={(e) => setFormData({ ...formData, total_price: parseFloat(e.target.value) || 0 })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation" placeholder="0" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Amount Paid (INR)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                    <input type="number" min="0" value={formData.amount_paid} onChange={(e) => setFormData({ ...formData, amount_paid: parseFloat(e.target.value) || 0 })} className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation" placeholder="0" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Balance (INR)</label>
                  <div className={`px-4 py-2.5 sm:py-3 rounded-xl font-bold text-base sm:text-lg ${balance > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    ₹{balance.toLocaleString('en-IN')}
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Job Status</label>
                  <div className="flex gap-2">
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })} className="flex-1 px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation">
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
                            category: 'EXPOSING'
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
                  <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Payment Status</label>
                  <div className="flex gap-2">
                    <select value={formData.payment_status} onChange={(e) => setFormData({ ...formData, payment_status: e.target.value as any })} className="flex-1 px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation">
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
                            category: 'EXPOSING'
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
                <label className="block text-xs sm:text-sm font-medium text-cyan-300 mb-1.5 sm:mb-2">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="w-full px-4 py-2.5 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 touch-manipulation" placeholder="Add any notes..." />
              </div>

              <div className="flex gap-3 sm:gap-4">
                <button type="button" onClick={handleCancelEdit} className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-white/10 text-white font-semibold text-sm sm:text-base hover:bg-white/20 transition-colors active:scale-95 touch-manipulation">Cancel</button>
                <button type="submit" disabled={formLoading} className="flex-1 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold text-sm sm:text-base hover:shadow-lg disabled:opacity-50 transition-all active:scale-95 touch-manipulation">
                  {formLoading ? 'Saving...' : editingJob ? 'Update Session' : 'Save Session'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Jobs List */}
        <div className="space-y-3 sm:space-y-4 pb-24 sm:pb-0">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-cyan-300 mt-4 text-sm sm:text-base">Loading sessions...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 sm:py-16 bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl">
              <span className="text-5xl sm:text-6xl">📷</span>
              <h3 className="text-lg sm:text-xl font-bold text-white mt-4">No Exposing Sessions Yet</h3>
              <p className="text-cyan-300 mt-2 text-sm sm:text-base">Click "Add Session" to create your first session</p>
            </div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/50 transition-all active:scale-[0.99]">
                {/* Mobile View */}
                <div className="sm:hidden">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-base font-bold text-white">{job.customer_name}</h3>
                      <p className="text-cyan-300 text-xs mt-0.5">{job.event_type || 'Exposing Session'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${job.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : job.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {getStatusDisplay(job.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-cyan-300 mb-3">
                    <span>📅 {new Date(job.start_date).toLocaleDateString('en-IN')}</span>
                    {job.event_location && <span>📍 {job.event_location}</span>}
                    {job.studio_name && <span>🏢 {job.studio_name}</span>}
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-lg font-bold text-white">₹{job.total_price.toLocaleString('en-IN')}</p>
                      <p className={`text-xs ${job.payment_status === 'COMPLETED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {job.payment_status === 'COMPLETED' ? 'Paid' : `Bal: ₹${(job.total_price - job.amount_paid).toLocaleString('en-IN')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {job.customer_phone && (
                        <>
                          <button onClick={() => sendWhatsAppReminder(job)} className="p-2 rounded-lg bg-green-500/20 text-green-400 active:scale-95 touch-manipulation" title="Send WhatsApp">
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          {getPendingCountForCustomer(job.customer_phone) > 1 && (
                            <button onClick={() => sendAllPendingReminder(job.customer_phone || '')} className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 active:scale-95 touch-manipulation relative" title="Send All Reminders">
                              <Send className="w-4 h-4" />
                              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
                                {getPendingCountForCustomer(job.customer_phone)}
                              </span>
                            </button>
                          )}
                        </>
                      )}
                      <button onClick={() => handleEdit(job)} className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 active:scale-95 touch-manipulation">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(job.id)} className="p-2 rounded-lg bg-red-500/20 text-red-400 active:scale-95 touch-manipulation">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Desktop View */}
                <div className="hidden sm:flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-white">{job.customer_name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${job.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : job.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {getStatusDisplay(job.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-cyan-300">
                      {job.event_type && <span>📸 {job.event_type}</span>}
                      {job.expose_type && <span>🎬 {job.expose_type}</span>}
                      {job.camera_type && <span>📹 {job.camera_type}</span>}
                      <span>📅 {new Date(job.start_date).toLocaleDateString('en-IN')}</span>
                      {job.end_date && <span>→ {new Date(job.end_date).toLocaleDateString('en-IN')}</span>}
                      {job.event_location && <span>📍 {job.event_location}</span>}
                      {job.studio_name && <span>🏢 {job.studio_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white">₹{job.total_price.toLocaleString('en-IN')}</p>
                      <p className={`text-sm ${job.payment_status === 'COMPLETED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {job.payment_status === 'COMPLETED' ? 'Paid' : `Pending: ₹${(job.total_price - job.amount_paid).toLocaleString('en-IN')}`}
                      </p>
                    </div>
                    {job.customer_phone && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => sendWhatsAppReminder(job)} className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors active:scale-95" title="Send WhatsApp">
                          <MessageCircle className="w-5 h-5" />
                        </button>
                        {getPendingCountForCustomer(job.customer_phone) > 1 && (
                          <button onClick={() => sendAllPendingReminder(job.customer_phone || '')} className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors relative active:scale-95" title={`Send All ${getPendingCountForCustomer(job.customer_phone)} Pending Reminders`}>
                            <Send className="w-5 h-5" />
                            <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                              {getPendingCountForCustomer(job.customer_phone)}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                    <button onClick={() => handleEdit(job)} className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors active:scale-95">
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDelete(job.id)} className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors active:scale-95">
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
