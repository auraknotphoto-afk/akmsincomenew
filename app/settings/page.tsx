'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, Save, Sparkles, RefreshCw, Fingerprint, LogOut, User, Clock, Shield } from 'lucide-react';
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
  const [aiLoading, setAiLoading] = useState(false);
  const [biometricRegistered, setBiometricRegistered] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(15);

  // Load saved templates
  useEffect(() => {
    const savedSingle = localStorage.getItem('akms_whatsapp_single');
    const savedConsolidated = localStorage.getItem('akms_whatsapp_consolidated');
    const savedTimeout = localStorage.getItem('akms_session_timeout');
    const biometricReg = localStorage.getItem('akms_biometric_registered');
    
    if (savedSingle) setSingleTemplate(savedSingle);
    if (savedConsolidated) setConsolidatedTemplate(savedConsolidated);
    if (savedTimeout) setSessionTimeout(parseInt(savedTimeout));
    if (biometricReg) setBiometricRegistered(true);
  }, []);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem('akms_whatsapp_single', singleTemplate);
    localStorage.setItem('akms_whatsapp_consolidated', consolidatedTemplate);
    localStorage.setItem('akms_session_timeout', sessionTimeout.toString());
    
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

  const handleAIGenerate = async (type: 'single' | 'consolidated') => {
    setAiLoading(true);
    
    // Simulate AI generation (in production, connect to an AI API)
    const aiPrompts = {
      single: [
        `Hello {customer_name}! 👋

Quick reminder from *Aura Knot Photography*:

📌 *{service_type}*
📆 Date: {date}

💳 Payment Summary:
• Total: Rs.{total_amount}
• Paid: Rs.{amount_paid}
• *Due: Rs.{balance}*

Kindly settle the balance at your convenience. Thank you! 🙏`,

        `Dear {customer_name},

Hope this message finds you well! ✨

This is a gentle reminder about your outstanding balance with *Aura Knot Photography*.

{service_icon} *{service_type}*
📅 {date}

💰 Rs.{balance} pending (of Rs.{total_amount})

We appreciate your prompt attention to this matter.

Warm regards,
Aura Knot Photography 📸`,

        `Hi {customer_name}! 😊

Just a friendly nudge from *Aura Knot Photography*!

Your {service_type} session on {date} has a pending balance.

📊 *Payment Status:*
Total: Rs.{total_amount}
Paid: Rs.{amount_paid}
Balance: Rs.{balance}

Please complete the payment when convenient.

Thank you! 🙏✨`
      ],
      consolidated: [
        `Hi {customer_name}! 👋

Here's your payment summary from *Aura Knot Photography*:

📋 *You have {count} pending service(s):*
{jobs_list}

💵 *Total Outstanding: Rs.{total_balance}*

Please clear the dues at your earliest convenience.

Thanks for your continued support! 🙏`,

        `Dear {customer_name},

Greetings from *Aura Knot Photography*! ✨

Quick update on your account:

📝 *Pending Payments ({count}):*
{jobs_list}

━━━━━━━━━━━━━━━
💰 *Grand Total Due: Rs.{total_balance}*

We'd appreciate your prompt settlement.

Best regards,
Aura Knot Photography 📸`
      ]
    };

    // Randomly select one of the AI-generated templates
    setTimeout(() => {
      const templates = aiPrompts[type];
      const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
      
      if (type === 'single') {
        setSingleTemplate(randomTemplate);
      } else {
        setConsolidatedTemplate(randomTemplate);
      }
      setAiLoading(false);
    }, 1500);
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
      <div className="border-b border-white/10 backdrop-blur-sm bg-black/20">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                  ⚙️ Settings
                </h1>
                <p className="text-slate-400 text-sm mt-1">Customize your app preferences</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Account Section */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-purple-400" />
            Account
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">{user?.username || 'User'}</p>
              <p className="text-slate-400 text-sm">Logged in</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Security
          </h2>
          
          <div className="space-y-4">
            {/* Biometric */}
            {biometricAvailable && (
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <div className="flex items-center gap-3">
                  <Fingerprint className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-white font-medium">Biometric Login</p>
                    <p className="text-slate-400 text-sm">Use fingerprint or Face ID to login</p>
                  </div>
                </div>
                {biometricRegistered ? (
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">Enabled</span>
                ) : (
                  <button
                    onClick={handleRegisterBiometric}
                    className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                  >
                    Enable
                  </button>
                )}
              </div>
            )}

            {/* Session Timeout */}
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-white font-medium">Auto Logout</p>
                  <p className="text-slate-400 text-sm">Logout after inactivity</p>
                </div>
              </div>
              <select
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(parseInt(e.target.value))}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="5" className="bg-slate-800">5 minutes</option>
                <option value="10" className="bg-slate-800">10 minutes</option>
                <option value="15" className="bg-slate-800">15 minutes</option>
                <option value="30" className="bg-slate-800">30 minutes</option>
                <option value="60" className="bg-slate-800">1 hour</option>
              </select>
            </div>
          </div>
        </div>

        {/* WhatsApp Message Templates */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-400" />
            WhatsApp Message Templates
          </h2>
          <p className="text-slate-400 text-sm mb-4">Customize reminder messages sent to customers. These apply to all categories (Editing, Exposing, Other).</p>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('single')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'single' 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              Single Job Reminder
            </button>
            <button
              onClick={() => setActiveTab('consolidated')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'consolidated' 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              Consolidated Reminder
            </button>
          </div>

          {/* Template Editor */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => handleAIGenerate(activeTab)}
                disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-50"
              >
                {aiLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {aiLoading ? 'Generating...' : 'AI Generate'}
              </button>
              <button
                onClick={() => handleReset(activeTab)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reset Default
              </button>
            </div>

            <textarea
              id={activeTab === 'single' ? 'singleTemplate' : 'consolidatedTemplate'}
              value={activeTab === 'single' ? singleTemplate : consolidatedTemplate}
              onChange={(e) => activeTab === 'single' ? setSingleTemplate(e.target.value) : setConsolidatedTemplate(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            />

            {/* Placeholders */}
            <div>
              <p className="text-sm text-slate-400 mb-2">Click to insert placeholder:</p>
              <div className="flex flex-wrap gap-2">
                {PLACEHOLDERS.filter(p => {
                  if (activeTab === 'single') {
                    return !['count', 'jobs_list', 'total_balance'].includes(p.key.replace(/[{}]/g, ''));
                  }
                  return true;
                }).map((placeholder) => (
                  <button
                    key={placeholder.key}
                    onClick={() => insertPlaceholder(placeholder.key)}
                    className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs hover:bg-purple-500/30 transition-colors"
                    title={placeholder.desc}
                  >
                    {placeholder.key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
              saved
                ? 'bg-emerald-500 text-white'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:shadow-purple-500/25'
            } disabled:opacity-50`}
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
