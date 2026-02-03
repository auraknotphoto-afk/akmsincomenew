import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'your_supabase_url' && 
  supabaseAnonKey !== 'your_supabase_anon_key' &&
  supabaseUrl.includes('supabase.co');

// Log connection status for debugging
if (typeof window !== 'undefined') {
  console.log('[Supabase] URL configured:', !!supabaseUrl);
  console.log('[Supabase] Key configured:', !!supabaseAnonKey);
  console.log('[Supabase] Will use Supabase:', isSupabaseConfigured);
}

export const supabase: SupabaseClient | null = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Types for our database
export interface Job {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  category: 'EDITING' | 'EXPOSING' | 'OTHER';
  customer_name: string;
  customer_phone?: string;
  client_name?: string;
  studio_name?: string;
  event_type?: string;
  event_location?: string;
  start_date: string;
  end_date?: string;
  session_type?: string;
  exposure_type?: string;
  expose_type?: string;
  number_of_cameras?: number;
  camera_type?: string;
  duration_hours?: number;
  rate_per_hour?: number;
  type_of_work?: string;
  total_price: number;
  amount_paid: number;
  payment_status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
  payment_date?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  notes?: string;
}

export interface User {
  id: string;
  created_at: string;
  phone: string;
  name?: string;
}

// LocalStorage fallback for demo mode
const STORAGE_KEY = 'aura_knot_jobs';

function getLocalJobs(): Job[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveLocalJobs(jobs: Job[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    // Verify save worked
    const saved = localStorage.getItem(STORAGE_KEY);
    console.log('[DB] localStorage save verified:', saved ? 'OK' : 'FAILED');
  } catch (e) {
    console.error('[DB] localStorage save error:', e);
  }
}

function generateId(): string {
  return crypto.randomUUID();
}

// Helper functions for database operations
export const db = {
  // Jobs
  async getJobs(userId: string, category?: string): Promise<Job[]> {
    console.log('[DB] getJobs called - userId:', userId, 'category:', category);
    
    // Always get localStorage data first
    let localJobs = getLocalJobs();
    console.log('[DB] localStorage has', localJobs.length, 'jobs');
    
    // Try to get from Supabase if configured
    if (supabase) {
      try {
        console.log('[DB] Also checking Supabase...');
        let query = supabase
          .from('jobs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        if (category) {
          query = query.eq('category', category);
        }
        
        const { data, error } = await query;
        if (error) {
          console.warn('[DB] Supabase error:', error.message, '- using localStorage only');
        } else {
          console.log('[DB] Supabase returned', data?.length || 0, 'jobs');
          // Merge Supabase data with localStorage data
          const supabaseJobs = data || [];
          const supabaseIds = new Set(supabaseJobs.map((j: Job) => j.id));
          const localOnlyJobs = localJobs.filter(j => !supabaseIds.has(j.id));
          
          if (localOnlyJobs.length > 0) {
            console.log('[DB] Found', localOnlyJobs.length, 'local-only jobs, merging...');
          }
          
          // Combine: Supabase jobs + local-only jobs
          const merged = [...supabaseJobs, ...localOnlyJobs];
          
          if (category) {
            return merged.filter(j => j.category === category).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) as Job[];
          }
          return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) as Job[];
        }
      } catch (e) {
        console.warn('[DB] Supabase connection error:', e, '- using localStorage only');
      }
    }
    
    // Return localStorage data only (Supabase failed or not configured)
    console.log('[DB] Returning localStorage data only');
    if (category) {
      localJobs = localJobs.filter(j => j.category === category);
    }
    return localJobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createJob(job: Omit<Job, 'id' | 'created_at' | 'updated_at'>): Promise<Job> {
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Clean up empty strings - convert to null or default values for Supabase
    const cleanedJob = {
      ...job,
      start_date: job.start_date || today, // Default to today if empty
      end_date: job.end_date || null,
      payment_date: job.payment_date || null,
      customer_phone: job.customer_phone || null,
      client_name: job.client_name || null,
      studio_name: job.studio_name || null,
      event_type: job.event_type || null,
      event_location: job.event_location || null,
      session_type: job.session_type || null,
      exposure_type: job.exposure_type || null,
      expose_type: job.expose_type || null,
      camera_type: job.camera_type || null,
      type_of_work: job.type_of_work || null,
      notes: job.notes || null,
    };
    
    const newJob: Job = {
      ...cleanedJob,
      id: generateId(),
      created_at: now,
      updated_at: now,
    } as Job;

    console.log('[DB] createJob called with:', job.category, job.customer_name);

    // Always save to localStorage first (ensures data is never lost)
    const jobs = getLocalJobs();
    jobs.unshift(newJob);
    saveLocalJobs(jobs);
    console.log('[DB] Saved to localStorage, total jobs:', jobs.length);

    // Also try to save to Supabase if configured
    if (supabase) {
      try {
        console.log('[DB] Also saving to Supabase...');
        const { data, error } = await supabase
          .from('jobs')
          .insert({
            ...cleanedJob,
            id: newJob.id,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();
        
        if (error) {
          console.error('[DB] Supabase error (data still in localStorage):', error.message);
        } else {
          console.log('[DB] Also saved to Supabase successfully');
        }
      } catch (e) {
        console.error('[DB] Supabase connection error (data still in localStorage):', e);
      }
    }
    
    return newJob;
  },

  async updateJob(id: string, updates: Partial<Job>): Promise<Job> {
    console.log('[DB] updateJob called for id:', id);
    
    // Always update localStorage first
    const jobs = getLocalJobs();
    const index = jobs.findIndex(j => j.id === id);
    let updatedJob: Job;
    
    if (index !== -1) {
      jobs[index] = { ...jobs[index], ...updates, updated_at: new Date().toISOString() };
      saveLocalJobs(jobs);
      updatedJob = jobs[index];
      console.log('[DB] Updated in localStorage');
    } else {
      // Job not in localStorage, create it there
      updatedJob = { ...updates, id, updated_at: new Date().toISOString() } as Job;
      jobs.push(updatedJob);
      saveLocalJobs(jobs);
      console.log('[DB] Added to localStorage (was not present)');
    }
    
    // Also update in Supabase if configured
    if (supabase) {
      try {
        console.log('[DB] Also updating in Supabase...');
        const { data, error } = await supabase
          .from('jobs')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        
        if (error) {
          console.error('[DB] Supabase update error:', error.message);
        } else {
          console.log('[DB] Also updated in Supabase successfully');
          return data as Job;
        }
      } catch (e) {
        console.error('[DB] Supabase connection error during update:', e);
      }
    }
    
    return updatedJob;
  },

  async deleteJob(id: string): Promise<void> {
    console.log('[DB] deleteJob called for id:', id);
    
    // Always delete from localStorage first
    const jobs = getLocalJobs();
    const filtered = jobs.filter(j => j.id !== id);
    saveLocalJobs(filtered);
    console.log('[DB] Deleted from localStorage, remaining jobs:', filtered.length);
    
    // Also delete from Supabase if configured
    if (supabase) {
      try {
        console.log('[DB] Also deleting from Supabase...');
        const { error } = await supabase
          .from('jobs')
          .delete()
          .eq('id', id);
        
        if (error) {
          console.error('[DB] Supabase delete error:', error.message);
        } else {
          console.log('[DB] Also deleted from Supabase successfully');
        }
      } catch (e) {
        console.error('[DB] Supabase connection error during delete:', e);
      }
    }
  },

  // Dashboard summary
  async getDashboardSummary(userId: string) {
    const jobs = await this.getJobs(userId);

    const summary = {
      totalIncome: 0,
      totalPaid: 0,
      totalPending: 0,
      totalJobs: jobs.length,
      byCategory: {
        EDITING: { income: 0, paid: 0, pending: 0, jobs: 0 },
        EXPOSING: { income: 0, paid: 0, pending: 0, jobs: 0 },
        OTHER: { income: 0, paid: 0, pending: 0, jobs: 0 },
      },
      statusCounts: {
        pending: 0,
        inProgress: 0,
        completed: 0,
      },
    };

    jobs.forEach((job: Job) => {
      summary.totalIncome += job.total_price;
      summary.totalPaid += job.amount_paid;
      summary.totalPending += (job.total_price - job.amount_paid);

      const cat = job.category as keyof typeof summary.byCategory;
      summary.byCategory[cat].income += job.total_price;
      summary.byCategory[cat].paid += job.amount_paid;
      summary.byCategory[cat].pending += (job.total_price - job.amount_paid);
      summary.byCategory[cat].jobs += 1;

      if (job.status === 'PENDING') summary.statusCounts.pending++;
      if (job.status === 'IN_PROGRESS') summary.statusCounts.inProgress++;
      if (job.status === 'COMPLETED') summary.statusCounts.completed++;
    });

    return summary;
  },

  // User (localStorage fallback for demo)
  async getUser(phone: string): Promise<User | null> {
    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as User | null;
    }
    
    // Demo user
    return {
      id: '00000000-0000-0000-0000-000000000001',
      created_at: new Date().toISOString(),
      phone: phone,
      name: 'Demo User',
    };
  },

  async createUser(phone: string, name?: string): Promise<User> {
    const newUser: User = {
      id: generateId(),
      created_at: new Date().toISOString(),
      phone,
      name,
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .insert({ phone, name })
        .select()
        .single();
      
      if (error) throw error;
      return data as User;
    }
    
    return newUser;
  },

  // Check if using demo mode
  isDemoMode(): boolean {
    return !isSupabaseConfigured;
  }
};
