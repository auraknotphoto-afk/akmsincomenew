'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, Save, RefreshCw, Fingerprint, LogOut, User, Clock, Shield, Edit2, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Default WhatsApp message templates
const DEFAULT_TEMPLATES = {
  singleReminder: `Hi {customer_name},

This is a friendly reminder from *Aura Knot Photography* regarding your pending payment.

{service_icon} Service: {service_type}
📅 Date: {date}
💰 Total Amount: Rs.{total_amount}
✅ Amount Paid: Rs.{amount_paid}
⏳ *Balance Due: Rs.{balance}*

Please complete the payment at your earliest convenience.

Thank you for choosing us! 🙏

- Aura Knot Photography`,
  
  consolidatedReminder: `Hi {customer_name},

This is a friendly reminder from *Aura Knot Photography* regarding your pending payments.

📝 *Pending Services ({count}):*
{jobs_list}
━━━━━━━━━━━━━━━
💵 *TOTAL BALANCE DUE: Rs.{total_balance}*

Please complete the payment at your earliest convenience.

Thank you for choosing us! 🙏

- Aura Knot Photography`
};

// Default Job Status Templates
const DEFAULT_JOB_STATUS_TEMPLATES = {
  PENDING: `Hi {customer_name},

Your {service_type} job has been *received* and is currently *PENDING*.

📋 *Job Details:*
{service_icon} Service: {service_type}
📅 Date: {date}

We will start working on it soon and keep you updated.

Thank you for choosing *Aura Knot Photography*! 🙏`,

  IN_PROGRESS: `Hi {customer_name},

Great news! Your {service_type} is now *IN PROGRESS*.

📋 *Job Details:*
{service_icon} Service: {service_type}
📅 Date: {date}

Our team is working on it. We'll notify you once completed.

Thank you for your patience! 🙏

- Aura Knot Photography`,

  COMPLETED: `Hi {customer_name},

🎉 Your {service_type} is now *COMPLETED*!

📋 *Job Details:*
{service_icon} Service: {service_type}
📅 Date: {date}

{balance_message}

Thank you for choosing *Aura Knot Photography*! 🙏

We hope you love the results! ❤️`
};

// Default Payment Status Templates
const DEFAULT_PAYMENT_STATUS_TEMPLATES = {
  PENDING: `Hi {customer_name},

This is a reminder about your *PENDING PAYMENT*.

📋 *Payment Details:*
{service_icon} Service: {service_type}
📅 Date: {date}
💰 Total Amount: Rs.{total_amount}
⏳ *Balance Due: Rs.{balance}*

Please complete the payment at your earliest convenience.

Thank you! 🙏

- Aura Knot Photography`,

  PARTIAL: `Hi {customer_name},

Thank you for your partial payment! 🙏

📋 *Payment Details:*
{service_icon} Service: {service_type}
📅 Date: {date}
💰 Total Amount: Rs.{total_amount}
✅ Amount Paid: Rs.{amount_paid}
⏳ *Remaining Balance: Rs.{balance}*

Please clear the remaining balance when convenient.

Thank you for choosing *Aura Knot Photography*!`,

  COMPLETED: `Hi {customer_name},

✅ *PAYMENT RECEIVED*

Thank you for completing your payment!

📋 *Payment Details:*
{service_icon} Service: {service_type}
📅 Date: {date}
💰 Total Amount: Rs.{total_amount}
✅ *Fully Paid*

We appreciate your trust in *Aura Knot Photography*! 🙏

Thank you for choosing us! ❤️`
};

// Available placeholders
const PLACEHOLDERS = [
  { key: '{customer_name}', desc: 'Customer name' },
  { key: '{service_type}', desc: 'Type of service/event' },
  { key: '{service_icon}', desc: 'Category icon (📷/🎬/📋)' },
  { key: '{date}', desc: 'Service date' },
  { key: '{total_amount}', desc: 'Total price' },
  { key: '{amount_paid}', desc: 'Amount already paid' },
  { key: '{balance}', desc: 'Remaining balance' },
  { key: '{count}', desc: 'Number of pending jobs (consolidated)' },
  { key: '{jobs_list}', desc: 'List of all pending jobs (consolidated)' },
  { key: '{total_balance}', desc: 'Total balance across all jobs (consolidated)' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout, biometricAvailable, registerBiometric } = useAuth();
  
  const [singleTemplate, setSingleTemplate] = useState(DEFAULT_TEMPLATES.singleReminder);
  const [consolidatedTemplate, setConsolidatedTemplate] = useState(DEFAULT_TEMPLATES.consolidatedReminder);
  const [activeTab, setActiveTab] = useState<'single' | 'consolidated'>('single');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [biometricRegistered, setBiometricRegistered] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(15);
  
  // Job Status Templates
  const [jobStatusTemplates, setJobStatusTemplates] = useState(DEFAULT_JOB_STATUS_TEMPLATES);
  const [editingJobStatus, setEditingJobStatus] = useState<string | null>(null);
  const [expandedJobStatus, setExpandedJobStatus] = useState(false);
  
  // Payment Status Templates
  const [paymentStatusTemplates, setPaymentStatusTemplates] = useState(DEFAULT_PAYMENT_STATUS_TEMPLATES);
  const [editingPaymentStatus, setEditingPaymentStatus] = useState<string | null>(null);
  const [expandedPaymentStatus, setExpandedPaymentStatus] = useState(false);

  // Load saved templates
  useEffect(() => {
    const savedSingle = localStorage.getItem('akms_whatsapp_single');
    const savedConsolidated = localStorage.getItem('akms_whatsapp_consolidated');
    const savedTimeout = localStorage.getItem('akms_session_timeout');
    const biometricReg = localStorage.getItem('akms_biometric_registered');
    const savedJobStatusTemplates = localStorage.getItem('akms_job_status_templates');
    const savedPaymentStatusTemplates = localStorage.getItem('akms_payment_status_templates');
    
    if (savedSingle) setSingleTemplate(savedSingle);
    if (savedConsolidated) setConsolidatedTemplate(savedConsolidated);
    if (savedTimeout) setSessionTimeout(parseInt(savedTimeout));
    if (biometricReg) setBiometricRegistered(true);
    if (savedJobStatusTemplates) setJobStatusTemplates(JSON.parse(savedJobStatusTemplates));
    if (savedPaymentStatusTemplates) setPaymentStatusTemplates(JSON.parse(savedPaymentStatusTemplates));
  }, []);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem('akms_whatsapp_single', singleTemplate);
    localStorage.setItem('akms_whatsapp_consolidated', consolidatedTemplate);
    localStorage.setItem('akms_session_timeout', sessionTimeout.toString());
    localStorage.setItem('akms_job_status_templates', JSON.stringify(jobStatusTemplates));
    localStorage.setItem('akms_payment_status_templates', JSON.stringify(paymentStatusTemplates));
    
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 500);
  };

  const handleReset = (type: 'single' | 'consolidated') => {
    if (confirm('Reset to default template?')) {
      if (type === 'single') {
        setSingleTemplate(DEFAULT_TEMPLATES.singleReminder);
      } else {
        setConsolidatedTemplate(DEFAULT_TEMPLATES.consolidatedReminder);
      }
    }
  };

  const handleRegisterBiometric = async () => {
    const success = await registerBiometric();
    if (success) {
      setBiometricRegistered(true);
      alert('Biometric authentication enabled successfully!');
    } else {
      alert('Failed to enable biometric authentication. Please try again.');
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    const textarea = document.getElementById(activeTab === 'single' ? 'singleTemplate' : 'consolidatedTemplate') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = activeTab === 'single' ? singleTemplate : consolidatedTemplate;
      const newValue = currentValue.substring(0, start) + placeholder + currentValue.substring(end);
      
      if (activeTab === 'single') {
        setSingleTemplate(newValue);
      } else {
        setConsolidatedTemplate(newValue);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10 backdrop-blur-sm bg-black/20 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <button onClick={() => router.back()} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors active:scale-95">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                  ⚙️ Settings
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1 hidden sm:block">Customize your app preferences</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8">
        {/* Account Section */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            Account
          </h2>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-white font-medium text-sm sm:text-base">{user?.username || 'User'}</p>
              <p className="text-slate-400 text-xs sm:text-sm">Logged in</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            Security
          </h2>
          
          <div className="space-y-3 sm:space-y-4">
            {/* Biometric */}
            {biometricAvailable && (
              <div className="flex items-center justify-between p-3 sm:p-4 bg-white/5 rounded-xl gap-3 flex-wrap">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Fingerprint className="w-5 h-5 text-purple-400 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium text-sm sm:text-base">Biometric Login</p>
                    <p className="text-slate-400 text-xs sm:text-sm">Use fingerprint or Face ID</p>
                  </div>
                </div>
                {biometricRegistered ? (
                  <span className="px-2.5 sm:px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs sm:text-sm">Enabled</span>
                ) : (
                  <button
                    onClick={handleRegisterBiometric}
                    className="px-3 sm:px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors text-sm active:scale-95"
                  >
                    Enable
                  </button>
                )}
              </div>
            )}

            {/* Session Timeout */}
            <div className="flex items-center justify-between p-3 sm:p-4 bg-white/5 rounded-xl gap-3 flex-wrap">
              <div className="flex items-center gap-2 sm:gap-3">
                <Clock className="w-5 h-5 text-purple-400 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium text-sm sm:text-base">Auto Logout</p>
                  <p className="text-slate-400 text-xs sm:text-sm">Logout after inactivity</p>
                </div>
              </div>
              <select
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(parseInt(e.target.value))}
                className="px-2.5 sm:px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation"
              >
                <option value="5" className="bg-slate-800">5 min</option>
                <option value="10" className="bg-slate-800">10 min</option>
                <option value="15" className="bg-slate-800">15 min</option>
                <option value="30" className="bg-slate-800">30 min</option>
                <option value="60" className="bg-slate-800">1 hour</option>
              </select>
            </div>
          </div>
        </div>

        {/* WhatsApp Message Templates */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
            WhatsApp Templates
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mb-3 sm:mb-4">Customize reminder messages sent to customers.</p>

          {/* Tabs */}
          <div className="flex gap-2 mb-3 sm:mb-4 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setActiveTab('single')}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm whitespace-nowrap active:scale-95 ${
                activeTab === 'single' 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              Single Job
            </button>
            <button
              onClick={() => setActiveTab('consolidated')}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm whitespace-nowrap active:scale-95 ${
                activeTab === 'consolidated' 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              Consolidated
            </button>
          </div>

          {/* Template Editor */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleReset(activeTab)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 transition-colors text-xs sm:text-sm active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Reset to Default
              </button>
            </div>

            <textarea
              id={activeTab === 'single' ? 'singleTemplate' : 'consolidatedTemplate'}
              value={activeTab === 'single' ? singleTemplate : consolidatedTemplate}
              onChange={(e) => activeTab === 'single' ? setSingleTemplate(e.target.value) : setConsolidatedTemplate(e.target.value)}
              rows={10}
              className="w-full px-3 sm:px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-xs sm:text-sm touch-manipulation"
            />

            {/* Placeholders */}
            <div>
              <p className="text-xs sm:text-sm text-slate-400 mb-2">Click to insert placeholder:</p>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {PLACEHOLDERS.filter(p => {
                  if (activeTab === 'single') {
                    return !['count', 'jobs_list', 'total_balance'].includes(p.key.replace(/[{}]/g, ''));
                  }
                  return true;
                }).map((placeholder) => (
                  <button
                    key={placeholder.key}
                    onClick={() => insertPlaceholder(placeholder.key)}
                    className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-[10px] sm:text-xs hover:bg-purple-500/30 transition-colors active:scale-95"
                    title={placeholder.desc}
                  >
                    {placeholder.key}
                  </button>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-lg hover:shadow-green-500/25'
              } disabled:opacity-50`}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Template'}
            </button>
          </div>
        </div>

        {/* Job Status Templates */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <button 
            onClick={() => setExpandedJobStatus(!expandedJobStatus)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              Job Status Templates
            </h2>
            {expandedJobStatus ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">Templates for PENDING, IN_PROGRESS, COMPLETED job statuses</p>
          
          {expandedJobStatus && (
            <div className="mt-4 space-y-4">
              {(['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map((status) => (
                <div key={status} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' :
                      status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {status.replace('_', ' ')}
                    </span>
                    <div className="flex gap-2">
                      {editingJobStatus === status ? (
                        <>
                          <button
                            onClick={() => setEditingJobStatus(null)}
                            className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 active:scale-95"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setJobStatusTemplates(prev => ({
                                ...prev,
                                [status]: DEFAULT_JOB_STATUS_TEMPLATES[status]
                              }));
                              setEditingJobStatus(null);
                            }}
                            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 active:scale-95"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditingJobStatus(status)}
                          className="p-2 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 active:scale-95"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {editingJobStatus === status ? (
                    <textarea
                      value={jobStatusTemplates[status]}
                      onChange={(e) => setJobStatusTemplates(prev => ({
                        ...prev,
                        [status]: e.target.value
                      }))}
                      rows={8}
                      className="w-full px-3 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs sm:text-sm"
                    />
                  ) : (
                    <pre className="text-slate-300 text-xs sm:text-sm whitespace-pre-wrap font-mono bg-black/20 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {jobStatusTemplates[status]}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Status Templates */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <button 
            onClick={() => setExpandedPaymentStatus(!expandedPaymentStatus)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
              Payment Status Templates
            </h2>
            {expandedPaymentStatus ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">Templates for PENDING, PARTIAL, COMPLETED payment statuses</p>
          
          {expandedPaymentStatus && (
            <div className="mt-4 space-y-4">
              {(['PENDING', 'PARTIAL', 'COMPLETED'] as const).map((status) => (
                <div key={status} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      status === 'PENDING' ? 'bg-red-500/20 text-red-400' :
                      status === 'PARTIAL' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {status}
                    </span>
                    <div className="flex gap-2">
                      {editingPaymentStatus === status ? (
                        <>
                          <button
                            onClick={() => setEditingPaymentStatus(null)}
                            className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 active:scale-95"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setPaymentStatusTemplates(prev => ({
                                ...prev,
                                [status]: DEFAULT_PAYMENT_STATUS_TEMPLATES[status]
                              }));
                              setEditingPaymentStatus(null);
                            }}
                            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 active:scale-95"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditingPaymentStatus(status)}
                          className="p-2 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 active:scale-95"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {editingPaymentStatus === status ? (
                    <textarea
                      value={paymentStatusTemplates[status]}
                      onChange={(e) => setPaymentStatusTemplates(prev => ({
                        ...prev,
                        [status]: e.target.value
                      }))}
                      rows={8}
                      className="w-full px-3 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-500 font-mono text-xs sm:text-sm"
                    />
                  ) : (
                    <pre className="text-slate-300 text-xs sm:text-sm whitespace-pre-wrap font-mono bg-black/20 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {paymentStatusTemplates[status]}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end pb-24 sm:pb-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all active:scale-95 ${
              saved
                ? 'bg-emerald-500 text-white'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:shadow-purple-500/25'
            } disabled:opacity-50`}
          >
            <Save className="w-4 h-4 sm:w-5 sm:h-5" />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
