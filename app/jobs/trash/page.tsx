'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import { db, Job } from '@/lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function TrashPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    if (!authLoading && !user?.id) {
      router.push('/auth/login');
      return;
    }
    if (user?.id) {
      fetchDeleted(user.id);
    }
  }, [authLoading, user?.id, router]);

  async function fetchDeleted(userId: string) {
    setLoading(true);
    try {
      const rows = await db.getDeletedJobs(userId);
      setJobs(rows);
    } catch (e) {
      console.error('Failed to load trash', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(id: string) {
    try {
      await db.restoreJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (e) {
      console.error('Restore failed', e);
      alert('Failed to restore job.');
    }
  }

  async function handlePermanentDelete(id: string) {
    const typed = window.prompt('Type PERMANENT DELETE to remove forever.');
    if (typed !== 'PERMANENT DELETE') return;

    try {
      await db.hardDeleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (e) {
      console.error('Permanent delete failed', e);
      alert('Failed to permanently delete job.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="border-b border-white/10 backdrop-blur-sm bg-black/20 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Trash</h1>
              <p className="text-slate-300 text-xs sm:text-sm">Restore deleted jobs or permanently remove them</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <p className="text-slate-300">Loading deleted jobs...</p>
        ) : jobs.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-slate-300">
            Trash is empty.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-white font-semibold">{job.customer_name}</p>
                  <p className="text-slate-300 text-sm">
                    {job.category} • {job.event_type || job.type_of_work || 'Job'} • Rs.{job.total_price.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRestore(job.id)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(job.id)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Forever
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
