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
  estimated_due_date?: string;
  priority?: string;
  session_type?: string;
  exposure_type?: string;
  expose_type?: string;
  number_of_cameras?: number;
  camera_type?: string;
  duration_hours?: number;
  rate_per_hour?: number;
  type_of_work?: string;
  additional_work_type?: string;
  additional_work_custom?: string;
  additional_work_rate?: number;
  expense?: number;
  total_price: number;
  amount_paid: number;
  payment_status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
  payment_date?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  notes?: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

export interface User {
  id: string;
  created_at: string;
  phone: string;
  name?: string;
}

export interface WhatsAppTemplate {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  category: 'EDITING' | 'EXPOSING' | 'OTHER';
  template_type: 'JOB_STATUS' | 'PAYMENT_STATUS';
  status_key: string;
  template_text: string;
}

// Legacy local cache key (kept only for one-time cleanup)
const STORAGE_KEY = 'aura_knot_jobs';

// One-time legacy cleanup so old local data won't appear again.
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // Remove legacy auth keys from older demo/OTP flows.
    localStorage.removeItem('auth_phone');
    localStorage.removeItem('auth_token');
  } catch {
    // ignore
  }
}

function generateId(): string {
  return crypto.randomUUID();
}

// Helper functions for database operations
export const db = {
  // Remove additional_work fields when the remote schema doesn't include them
  _stripAdditionalFields(obj: Record<string, any>) {
    const copy = { ...obj };
    delete copy.additional_work_type;
    delete copy.additional_work_custom;
    delete copy.additional_work_rate;
    // Some remote schemas may be missing the new estimated_due_date column
    delete copy.estimated_due_date;
    // Also allow stripping priority if remote schema misses it
    delete copy.priority;
    return copy;
  },
  // Jobs
  async getJobs(
    userId: string,
    category?: string,
    options?: { includeDeleted?: boolean }
  ): Promise<Job[]> {
    console.log('[DB] getJobs called - userId:', userId, 'category:', category);

    if (!supabase) {
      throw new Error('Supabase is not configured. Storage is Supabase-only.');
    }

    let query = supabase
      .from('jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!options?.includeDeleted) {
      query = query.eq('is_deleted', false);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) {
      const code = (error as any)?.code;
      // Column may not exist yet before soft-delete migration.
      if (code === '42703' && !options?.includeDeleted) {
        let fallbackQuery = supabase
          .from('jobs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (category) {
          fallbackQuery = fallbackQuery.eq('category', category);
        }
        const fallback = await fallbackQuery;
        if (fallback.error) throw fallback.error;
        return (fallback.data || []) as Job[];
      }
      throw error;
    }
    return (data || []) as Job[];
  },

  // synchronise the browser cache with the remote database
  async syncFromSupabase(userId: string): Promise<void> {
    void userId;
  },

  // remove the cached job data from the current browser
  clearLocalCache(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('auth_phone');
    localStorage.removeItem('auth_token');
    console.log('[DB] localStorage cache cleared');
  },

  /**
   * Remove *all* data for a given userID:
   *  1. wipe the browser cache
   *  2. delete all jobs belonging to that user from Supabase
   *  3. (optional) delete the user record itself
   *
   * This is useful for resetting the demo state programmatically.
   */
  async clearAllData(userId: string, dropUser = false): Promise<void> {
    // always clear local cache first
    this.clearLocalCache();

    if (!supabase) {
      console.warn('[DB] clearAllData called but Supabase not configured');
      return;
    }

    try {
      console.log('[DB] deleting remote jobs for user', userId);
      const { error: jobError } = await supabase
        .from('jobs')
        .delete()
        .eq('user_id', userId);

      if (jobError) {
        console.error('[DB] error deleting remote jobs:', jobError.message);
      } else {
        console.log('[DB] remote jobs deleted');
      }

      if (dropUser) {
        console.log('[DB] deleting user record', userId);
        const { error: userError } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);
        if (userError) {
          console.error('[DB] error deleting user:', userError.message);
        } else {
          console.log('[DB] user record deleted');
        }
      }
    } catch (e) {
      console.error('[DB] clearAllData connection error:', e);
    }
  },


  async createJob(job: Omit<Job, 'id' | 'created_at' | 'updated_at'>): Promise<Job> {
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Clean up empty strings - convert to null or default values for Supabase
    const cleanedJob = {
      ...job,
      start_date: job.start_date || today, // Default to today if empty
      end_date: job.end_date || null,
      estimated_due_date: (job as any).estimated_due_date || null,
      priority: (job as any).priority || null,
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
      additional_work_type: (job as any).additional_work_type || null,
      additional_work_custom: (job as any).additional_work_custom || null,
      additional_work_rate: (job as any).additional_work_rate ?? null,
      expense: (job as any).expense ?? 0,
      notes: job.notes || null,
    };
    
    const newJob: Job = {
      ...cleanedJob,
      id: generateId(),
      created_at: now,
      updated_at: now,
    } as Job;

    if (!supabase) {
      throw new Error('Supabase is not configured. Storage is Supabase-only.');
    }

    const { error } = await supabase
      .from('jobs')
      .insert({
        ...cleanedJob,
        id: newJob.id,
        created_at: now,
        updated_at: now,
      });
    if (error) throw error;

    return newJob;
  },

  async updateJob(id: string, updates: Partial<Job>): Promise<Job> {
    console.log('[DB] updateJob called for id:', id);
    
    // Clean up empty strings - convert to null for Supabase
    const cleanedUpdates: Partial<Job> = { ...updates };
    const dateFields = ['start_date', 'end_date', 'payment_date', 'estimated_due_date'];
    const stringFields = ['customer_phone', 'client_name', 'studio_name', 'event_type', 'event_location', 'session_type', 'exposure_type', 'expose_type', 'camera_type', 'type_of_work', 'additional_work_type', 'additional_work_custom', 'notes', 'priority'];
    
    for (const field of dateFields) {
      if (field in cleanedUpdates && cleanedUpdates[field as keyof Job] === '') {
        (cleanedUpdates as Record<string, unknown>)[field] = null;
      }
    }
    for (const field of stringFields) {
      if (field in cleanedUpdates && cleanedUpdates[field as keyof Job] === '') {
        (cleanedUpdates as Record<string, unknown>)[field] = null;
      }
    }
    
    if (!supabase) {
      throw new Error('Supabase is not configured. Storage is Supabase-only.');
    }

    const { data, error } = await supabase
      .from('jobs')
      .update({ ...cleanedUpdates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Job;
  },

  async deleteJob(id: string): Promise<void> {
    console.log('[DB] deleteJob called for id:', id);
    
    if (!supabase) {
      throw new Error('Supabase is not configured. Storage is Supabase-only.');
    }

    const { error } = await supabase
      .from('jobs')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) {
      const code = (error as any)?.code;
      if (code === '42703') {
        throw new Error('Soft delete is not enabled yet. Run supabase/migrations/0004_soft_delete_jobs.sql');
      }
      throw error;
    }
  },

  async restoreJob(id: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase is not configured. Storage is Supabase-only.');
    }

    const { error } = await supabase
      .from('jobs')
      .update({
        is_deleted: false,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },

  async hardDeleteJob(id: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase is not configured. Storage is Supabase-only.');
    }

    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) throw error;
  },

  async getDeletedJobs(userId: string, category?: string): Promise<Job[]> {
    if (!supabase) {
      throw new Error('Supabase is not configured. Storage is Supabase-only.');
    }

    let query = supabase
      .from('jobs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', true)
      .order('deleted_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Job[];
  },

  // WhatsApp Templates
  async getWhatsAppTemplates(
    userId: string,
    category?: 'EDITING' | 'EXPOSING' | 'OTHER'
  ): Promise<WhatsAppTemplate[]> {
    if (!supabase) {
      throw new Error('Supabase is not configured. Storage is Supabase-only.');
    }

    let query = supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) {
      const code = (error as any)?.code;
      // Missing table / insufficient privilege: return empty so app can still run with defaults.
      if (code === '42P01' || code === '42501') {
        console.warn('[DB] WhatsApp templates unavailable:', (error as any)?.message || error);
        return [];
      }
      throw error;
    }
    return (data || []) as WhatsAppTemplate[];
  },

  async upsertWhatsAppTemplate(template: {
    user_id: string;
    category: 'EDITING' | 'EXPOSING' | 'OTHER';
    template_type: 'JOB_STATUS' | 'PAYMENT_STATUS';
    status_key: string;
    template_text: string;
  }): Promise<WhatsAppTemplate> {
    if (!supabase) {
      throw new Error('Supabase is not configured. Storage is Supabase-only.');
    }

    const now = new Date().toISOString();
    const match = {
      user_id: template.user_id,
      category: template.category,
      template_type: template.template_type,
      status_key: template.status_key,
    };

    // First try to find existing row and update/insert manually.
    const { data: existing, error: findError } = await supabase
      .from('whatsapp_templates')
      .select('id')
      .match(match)
      .maybeSingle();

    if (findError) {
      const code = (findError as any)?.code;
      if (code === '42P01') {
        throw new Error('whatsapp_templates table not found. Run supabase/migrations/0003_whatsapp_templates.sql');
      }
      if (code === '42501') {
        throw new Error('Supabase permissions blocked template access. Apply template table grants/policies migration.');
      }
      throw new Error((findError as any)?.message || 'Failed to check existing template');
    }

    if (existing?.id) {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .update({
          template_text: template.template_text,
          updated_at: now,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        const code = (error as any)?.code;
        if (code === '42501') {
          throw new Error('Supabase permissions blocked template update.');
        }
        throw new Error((error as any)?.message || 'Failed to update template');
      }

      return data as WhatsAppTemplate;
    }

    const { data, error } = await supabase
      .from('whatsapp_templates')
      .insert({
        ...template,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      const message = (error as any)?.message || '';
      const details = (error as any)?.details || '';
      // Backward-compat: older schemas require non-null "kind"/"content".
      if (
        message.includes('"kind"') ||
        details.includes('"kind"') ||
        message.includes('"content"') ||
        details.includes('"content"')
      ) {
        const retry = await supabase
          .from('whatsapp_templates')
          .insert({
            ...template,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            kind: template.template_type as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: template.template_text as any,
            updated_at: now,
          })
          .select()
          .single();

        if (retry.error) {
          throw new Error((retry.error as any)?.message || 'Failed to insert template');
        }
        return retry.data as WhatsAppTemplate;
      }

      const code = (error as any)?.code;
      if (code === '42P01') {
        throw new Error('whatsapp_templates table not found. Run supabase/migrations/0003_whatsapp_templates.sql');
      }
      if (code === '42501') {
        throw new Error('Supabase permissions blocked template insert.');
      }
      throw new Error((error as any)?.message || 'Failed to insert template');
    }

    return data as WhatsAppTemplate;
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
        EDITING: { income: 0, paid: 0, pending: 0, profit: 0, jobs: 0 },
        EXPOSING: { income: 0, paid: 0, pending: 0, profit: 0, jobs: 0 },
        OTHER: { income: 0, paid: 0, pending: 0, profit: 0, jobs: 0 },
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
      summary.byCategory[cat].profit += job.category === 'OTHER'
        ? job.total_price - (job.expense || 0)
        : job.total_price;
      summary.byCategory[cat].jobs += 1;

      if (job.status === 'PENDING') summary.statusCounts.pending++;
      if (job.status === 'IN_PROGRESS') summary.statusCounts.inProgress++;
      if (job.status === 'COMPLETED') summary.statusCounts.completed++;
    });

    return summary;
  },

  // User
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
    
    return null;
  },

  async createUser(phone: string, name?: string): Promise<User> {
    if (!supabase) {
      throw new Error('Supabase is not configured. Storage is Supabase-only.');
    }

    const { data, error } = await supabase
      .from('users')
      .insert({ phone, name })
      .select()
      .single();
    if (error) throw error;
    return data as User;
  },

  // Check if using demo mode
  isDemoMode(): boolean {
    return !isSupabaseConfigured;
  }
};
