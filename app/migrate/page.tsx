'use client';

import { useState } from 'react';

export default function MigratePage() {
  const [status, setStatus] = useState<string>('idle');
  const [log, setLog] = useState<string[]>([]);

  const append = (s: string) => setLog(l => [...l, s]);

  const migrate = async () => {
    setStatus('running');
    append('Starting migration from this device...');

    try {
      // Templates keys
      const single = localStorage.getItem('akms_whatsapp_single');
      const consolidated = localStorage.getItem('akms_whatsapp_consolidated');

      const jobStatus = localStorage.getItem('akms_job_status_templates');
      const paymentStatus = localStorage.getItem('akms_payment_status_templates');

      const perCats = ['EDITING','EXPOSING','OTHER'];

      // Send single & consolidated
      if (single) {
        append('Uploading single template...');
        await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'single', category: null, content: single }) });
        append('Single template uploaded');
      } else append('No single template found');

      if (consolidated) {
        append('Uploading consolidated template...');
        await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'consolidated', category: null, content: consolidated }) });
        append('Consolidated template uploaded');
      } else append('No consolidated template found');

      // Job/payment status (global)
      if (jobStatus) {
        append('Uploading global job status templates...');
        await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'job_status', category: null, content: JSON.parse(jobStatus) }) });
        append('Job status templates uploaded');
      }
      if (paymentStatus) {
        append('Uploading global payment status templates...');
        await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'payment_status', category: null, content: JSON.parse(paymentStatus) }) });
        append('Payment status templates uploaded');
      }

      // Per-category templates
      for (const cat of perCats) {
        const k = `akms_whatsapp_single_${cat}`;
        const v = localStorage.getItem(k);
        if (v) {
          append(`Uploading single template for ${cat}...`);
          await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'single', category: cat, content: v }) });
          append(`Uploaded single template for ${cat}`);
        }

        const jk = `akms_job_status_templates_${cat}`;
        const jv = localStorage.getItem(jk);
        if (jv) {
          append(`Uploading job status templates for ${cat}...`);
          await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'job_status', category: cat, content: JSON.parse(jv) }) });
          append(`Uploaded job status templates for ${cat}`);
        }

        const pk = `akms_payment_status_templates_${cat}`;
        const pv = localStorage.getItem(pk);
        if (pv) {
          append(`Uploading payment status templates for ${cat}...`);
          await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'payment_status', category: cat, content: JSON.parse(pv) }) });
          append(`Uploaded payment status templates for ${cat}`);
        }
      }

      // Jobs migration
      const jobsRaw = localStorage.getItem('aura_knot_jobs');
      if (jobsRaw) {
        const jobs = JSON.parse(jobsRaw || '[]');
        if (jobs && Array.isArray(jobs) && jobs.length > 0) {
          append(`Uploading ${jobs.length} jobs to server...`);
          const res = await fetch('/api/migrate-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobs }) });
          const jres = await res.json();
          if (res.ok) {
            append(`Jobs migrated: ${jres?.inserted || jres?.count || jobs.length}`);
          } else {
            append(`Jobs migration failed: ${jres?.error || res.statusText}`);
          }
        } else append('No jobs found to migrate');
      } else append('No local jobs key found');

      setStatus('done');
      append('Migration complete');
    } catch (e) {
      append('Migration error: ' + String(e));
      setStatus('error');
    }
  };

  const clearLocalData = () => {
    if (!confirm('Delete local templates and jobs from this device? This cannot be undone.')) return;
    try {
      const keys = [
        'akms_whatsapp_single',
        'akms_whatsapp_consolidated',
        'akms_job_status_templates',
        'akms_payment_status_templates',
        'akms_session_timeout',
        'akms_biometric_registered',
        'aura_knot_jobs'
      ];
      const cats = ['EDITING','EXPOSING','OTHER'];
      for (const k of keys) {
        localStorage.removeItem(k);
        append(`Removed ${k}`);
      }
      for (const c of cats) {
        localStorage.removeItem(`akms_whatsapp_single_${c}`);
        localStorage.removeItem(`akms_job_status_templates_${c}`);
        localStorage.removeItem(`akms_payment_status_templates_${c}`);
        append(`Removed per-category keys for ${c}`);
      }
      setStatus('cleared');
      append('Local data cleared');
    } catch (e) {
      append('Error clearing local data: ' + String(e));
    }
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-xl font-bold mb-4">Migrate Local Data to Server</h1>
      <p className="mb-4">Open this page on the device that has the data you want to migrate (e.g., your mobile). Press the button to upload local templates and jobs to the server.</p>
      <div className="space-y-3 mb-4">
        <button onClick={migrate} className="px-4 py-2 bg-blue-600 text-white rounded">Migrate Now</button>
        {status === 'done' && (
          <button onClick={clearLocalData} className="ml-2 px-4 py-2 bg-red-600 text-white rounded">Clear local data</button>
        )}
        <div>State: {status}</div>
      </div>

      <div className="bg-black/10 p-3 rounded h-72 overflow-auto">
        {log.map((l, i) => <div key={i} className="text-sm">{l}</div>)}
      </div>
    </div>
  );
}
