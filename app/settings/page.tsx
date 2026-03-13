'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Fingerprint, LogOut, User, Shield, MessageCircle, Save, Trash2, Download, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, WhatsAppTemplate } from '@/lib/supabase';
import { getDefaultTemplate, getTemplateVariables } from '@/lib/whatsappTemplates';

type Category = 'EDITING' | 'EXPOSING' | 'OTHER';
type TemplateMode = 'JOB_STATUS' | 'PAYMENT_STATUS' | 'CUSTOMER_SUMMARY';

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading, logout, biometricAvailable, registerBiometric } = useAuth();
  const [biometricRegistered, setBiometricRegistered] = useState(false);
  const [category, setCategory] = useState<Category>('EXPOSING');
  const [templateMode, setTemplateMode] = useState<TemplateMode>('JOB_STATUS');
  const [statusKey, setStatusKey] = useState('BOOKED');

  const dbTemplateType: 'JOB_STATUS' | 'PAYMENT_STATUS' =
    templateMode === 'CUSTOMER_SUMMARY' ? 'JOB_STATUS' : templateMode;
  const dbStatusKey = templateMode === 'CUSTOMER_SUMMARY' ? 'CUSTOMER_SUMMARY' : statusKey;
  const [templateText, setTemplateText] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [defaultLoading, setDefaultLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [allTemplates, setAllTemplates] = useState<WhatsAppTemplate[]>([]);

  useEffect(() => {
    if (!loading && !user?.id) {
      router.push('/auth/login');
      return;
    }
    const biometricReg = localStorage.getItem('akms_biometric_registered');
    if (biometricReg) setBiometricRegistered(true);
  }, [loading, user?.id, router]);

  useEffect(() => {
    if (!user?.id) return;
    loadTemplates(user.id);
  }, [user?.id]);

  useEffect(() => {
    const found = allTemplates.find(
      (t) =>
        t.category === category &&
        t.template_type === dbTemplateType &&
        t.status_key === dbStatusKey
    );
    setTemplateText(found?.template_text || getDefaultTemplate(category, templateMode, dbStatusKey));
  }, [allTemplates, category, templateMode, statusKey, dbTemplateType, dbStatusKey]);

  useEffect(() => {
    if (templateMode === 'CUSTOMER_SUMMARY') {
      if (statusKey !== 'CUSTOMER_SUMMARY') setStatusKey('CUSTOMER_SUMMARY');
      return;
    }
    if (templateMode === 'PAYMENT_STATUS') {
      if (!['PENDING', 'PARTIAL', 'COMPLETED'].includes(statusKey)) setStatusKey('PENDING');
      return;
    }
    if (category === 'EXPOSING') {
      if (!['BOOKED', 'CANCELLED'].includes(statusKey)) setStatusKey('BOOKED');
      return;
    }
    if (!['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(statusKey)) setStatusKey('PENDING');
  }, [category, templateMode, statusKey]);

  async function loadTemplates(userId: string) {
    try {
      const rows = await db.getWhatsAppTemplates(userId);
      setAllTemplates(rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Failed to load WhatsApp templates:', msg);
    }
  }

  const handleRegisterBiometric = async () => {
    const success = await registerBiometric();
    if (success) {
      setBiometricRegistered(true);
      alert('Biometric authentication enabled successfully.');
    } else {
      alert('Failed to enable biometric authentication.');
    }
  };

  const statusOptions =
    templateMode === 'CUSTOMER_SUMMARY'
      ? [{ value: 'CUSTOMER_SUMMARY', label: 'Pending Summary' }]
      : templateMode === 'PAYMENT_STATUS'
      ? [
          { value: 'PENDING', label: 'Pending' },
          { value: 'PARTIAL', label: 'Partial' },
          { value: 'COMPLETED', label: 'Completed' },
        ]
      : category === 'EXPOSING'
      ? [
          { value: 'BOOKED', label: 'Booked' },
          { value: 'CANCELLED', label: 'Cancelled' },
        ]
      : [
          { value: 'PENDING', label: 'Yet to Start' },
          { value: 'IN_PROGRESS', label: 'In Progress' },
          { value: 'COMPLETED', label: 'Completed' },
        ];

  const insertVariable = (v: string) => {
    setTemplateText((prev) => `${prev}${prev.endsWith(' ') || prev.length === 0 ? '' : ' '}${v}`);
  };

  const handleSaveTemplate = async () => {
    if (!user?.id) return;
    setSaveLoading(true);
    try {
      await db.upsertWhatsAppTemplate({
        user_id: user.id,
        category,
        template_type: dbTemplateType,
        status_key: dbStatusKey,
        template_text: templateText.trim(),
      });
      await loadTemplates(user.id);
      alert('WhatsApp template saved.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Failed to save template:', msg);
      alert(`Failed to save template: ${msg}`);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleResetCurrentToDefault = () => {
    setTemplateText(getDefaultTemplate(category, templateMode, dbStatusKey));
  };

  const handleLoadAllDefaults = async () => {
    if (!user?.id) return;
    setDefaultLoading(true);
    try {
      const categories: Category[] = ['EXPOSING', 'EDITING', 'OTHER'];
      const paymentKeys = ['PENDING', 'PARTIAL', 'COMPLETED'];
      const jobKeysByCategory: Record<Category, string[]> = {
        EXPOSING: ['BOOKED', 'CANCELLED'],
        EDITING: ['PENDING', 'IN_PROGRESS', 'COMPLETED'],
        OTHER: ['PENDING', 'IN_PROGRESS', 'COMPLETED'],
      };

      for (const cat of categories) {
        for (const key of jobKeysByCategory[cat]) {
          await db.upsertWhatsAppTemplate({
            user_id: user.id,
            category: cat,
            template_type: 'JOB_STATUS',
            status_key: key,
            template_text: getDefaultTemplate(cat, 'JOB_STATUS', key),
          });
        }
        for (const key of paymentKeys) {
          await db.upsertWhatsAppTemplate({
            user_id: user.id,
            category: cat,
            template_type: 'PAYMENT_STATUS',
            status_key: key,
            template_text: getDefaultTemplate(cat, 'PAYMENT_STATUS', key),
          });
        }
        await db.upsertWhatsAppTemplate({
          user_id: user.id,
          category: cat,
          template_type: 'JOB_STATUS',
          status_key: 'CUSTOMER_SUMMARY',
          template_text: getDefaultTemplate(cat, 'CUSTOMER_SUMMARY', 'CUSTOMER_SUMMARY'),
        });
      }

      await loadTemplates(user.id);
      setTemplateText(getDefaultTemplate(category, templateMode, dbStatusKey));
      alert('Default templates loaded for all categories and statuses.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Failed to load default templates:', msg);
      alert(`Failed to load defaults: ${msg}`);
    } finally {
      setDefaultLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    if (!user?.id) {
      alert('Please sign in again.');
      return;
    }

    setBackupLoading(true);
    try {
      const res = await fetch('/api/backup/download');
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || 'Failed to download backup');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aura-knot-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Failed to download backup: ${msg}`);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async (file: File | null) => {
    if (!file) return;
    if (!user?.id) {
      alert('Please sign in again.');
      return;
    }

    setRestoreLoading(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backup,
          mode: restoreMode,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to restore backup');
      }

      alert('Backup restored successfully.');
      await loadTemplates(user.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Failed to restore backup: ${msg}`);
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="border-b border-white/10 backdrop-blur-sm bg-black/20 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-white">Settings</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1 hidden sm:block">
                Account and security
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8">
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

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            Security
          </h2>

          {biometricAvailable ? (
            <div className="flex items-center justify-between p-3 sm:p-4 bg-white/5 rounded-xl gap-3 flex-wrap">
              <div className="flex items-center gap-2 sm:gap-3">
                <Fingerprint className="w-5 h-5 text-purple-400 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium text-sm sm:text-base">Biometric Login</p>
                  <p className="text-slate-400 text-xs sm:text-sm">Use fingerprint or Face ID</p>
                </div>
              </div>
              {biometricRegistered ? (
                <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs sm:text-sm">
                  Enabled
                </span>
              ) : (
                <button
                  onClick={handleRegisterBiometric}
                  className="px-3 sm:px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors text-sm active:scale-95"
                >
                  Enable
                </button>
              )}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Biometric authentication is not available on this device.</p>
          )}
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
            Data Safety
          </h2>
          <p className="text-slate-300 text-sm mb-3">Deleted entries are moved to Trash first. You can restore them anytime.</p>
          <button
            onClick={() => router.push('/jobs/trash')}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm"
          >
            Open Trash
          </button>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <Download className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400" />
            Manual Backup
          </h2>
          <p className="text-slate-300 text-sm mb-3">
            Download your jobs and WhatsApp templates as a backup JSON file.
          </p>
          <p className="text-slate-400 text-xs mb-3">
            The downloaded file also includes a `jobs_csv` section for spreadsheet import.
          </p>
          <button
            onClick={handleDownloadBackup}
            disabled={backupLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-sky-600 text-white font-medium disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            {backupLoading ? 'Preparing...' : 'Download Backup'}
          </button>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            Restore Backup
          </h2>
          <p className="text-slate-300 text-sm mb-3">
            Upload a downloaded backup JSON file and restore it into Supabase.
          </p>
          <p className="text-slate-400 text-xs mb-3">
            `Merge` keeps existing data. `Replace` clears your current jobs and templates before restore.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <select
              value={restoreMode}
              onChange={(e) => setRestoreMode(e.target.value as 'merge' | 'replace')}
              className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white"
            >
              <option value="merge" className="bg-slate-800">Merge Restore</option>
              <option value="replace" className="bg-slate-800">Replace Restore</option>
            </select>
            <label className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium cursor-pointer">
              <Upload className="w-4 h-4" />
              {restoreLoading ? 'Restoring...' : 'Choose Backup File'}
              <input
                type="file"
                accept="application/json"
                className="hidden"
                disabled={restoreLoading}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  void handleRestoreBackup(file);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
            WhatsApp Templates
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white"
              >
                <option value="EXPOSING" className="bg-slate-800">Exposing</option>
                <option value="EDITING" className="bg-slate-800">Editing</option>
                <option value="OTHER" className="bg-slate-800">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Template Type</label>
              <select
                value={templateMode}
                onChange={(e) => setTemplateMode(e.target.value as TemplateMode)}
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white"
              >
                <option value="JOB_STATUS" className="bg-slate-800">Job Status</option>
                <option value="PAYMENT_STATUS" className="bg-slate-800">Payment Status</option>
                <option value="CUSTOMER_SUMMARY" className="bg-slate-800">Customer Summary</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Status</label>
              <select
                value={statusKey}
                onChange={(e) => setStatusKey(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-slate-800">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-3">
            <p className="text-xs text-slate-300 mb-2">Variables (tap to insert)</p>
            <div className="flex flex-wrap gap-2">
              {getTemplateVariables(category).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="px-2 py-1 rounded-lg bg-white/10 text-xs text-slate-200 hover:bg-white/20"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Template Message</label>
            <textarea
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50"
              placeholder="Write your template using variables..."
            />
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleResetCurrentToDefault}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white font-medium mr-2"
            >
              Reset Current
            </button>
            <button
              onClick={handleLoadAllDefaults}
              disabled={defaultLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-60 mr-2"
            >
              {defaultLoading ? 'Loading Defaults...' : 'Load All Defaults'}
            </button>
            <button
              onClick={handleSaveTemplate}
              disabled={saveLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white font-medium disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saveLoading ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
