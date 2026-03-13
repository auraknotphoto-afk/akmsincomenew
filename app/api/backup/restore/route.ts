import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/lib/auth-config';

type BackupJob = Record<string, unknown>;
type BackupTemplate = Record<string, unknown>;

function normalizeJob(userId: string, job: BackupJob) {
  return {
    id: String(job.id || crypto.randomUUID()),
    user_id: userId,
    category: String(job.category || 'OTHER'),
    customer_name: String(job.customer_name || ''),
    customer_phone: job.customer_phone ? String(job.customer_phone) : null,
    client_name: job.client_name ? String(job.client_name) : null,
    studio_name: job.studio_name ? String(job.studio_name) : null,
    event_type: job.event_type ? String(job.event_type) : null,
    event_location: job.event_location ? String(job.event_location) : null,
    start_date: String(job.start_date || new Date().toISOString().slice(0, 10)),
    end_date: job.end_date ? String(job.end_date) : null,
    estimated_due_date: job.estimated_due_date ? String(job.estimated_due_date) : null,
    priority: job.priority ? String(job.priority) : null,
    session_type: job.session_type ? String(job.session_type) : null,
    exposure_type: job.exposure_type ? String(job.exposure_type) : null,
    expose_type: job.expose_type ? String(job.expose_type) : null,
    number_of_cameras:
      typeof job.number_of_cameras === 'number' ? job.number_of_cameras : null,
    camera_type: job.camera_type ? String(job.camera_type) : null,
    duration_hours: typeof job.duration_hours === 'number' ? job.duration_hours : null,
    rate_per_hour: typeof job.rate_per_hour === 'number' ? job.rate_per_hour : null,
    type_of_work: job.type_of_work ? String(job.type_of_work) : null,
    additional_work_type: job.additional_work_type ? String(job.additional_work_type) : null,
    additional_work_custom: job.additional_work_custom ? String(job.additional_work_custom) : null,
    additional_work_rate:
      typeof job.additional_work_rate === 'number' ? job.additional_work_rate : null,
    expense: typeof job.expense === 'number' ? job.expense : Number(job.expense || 0),
    total_price: Number(job.total_price || 0),
    amount_paid: Number(job.amount_paid || 0),
    payment_status: String(job.payment_status || 'PENDING'),
    payment_date: job.payment_date ? String(job.payment_date) : null,
    status: String(job.status || 'PENDING'),
    notes: job.notes ? String(job.notes) : null,
    is_deleted: Boolean(job.is_deleted),
    deleted_at: job.deleted_at ? String(job.deleted_at) : null,
    created_at: job.created_at ? String(job.created_at) : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function normalizeTemplate(userId: string, template: BackupTemplate) {
  return {
    user_id: userId,
    category: String(template.category || 'EXPOSING'),
    template_type: String(template.template_type || 'JOB_STATUS'),
    status_key: String(template.status_key || 'PENDING'),
    template_text: String(template.template_text || ''),
    updated_at: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const backup = body?.backup;
    const mode = body?.mode === 'replace' ? 'replace' : 'merge';

    if (!backup || typeof backup !== 'object') {
      return NextResponse.json({ error: 'Invalid backup file' }, { status: 400 });
    }

    const jobs = Array.isArray(backup.jobs) ? backup.jobs : [];
    const templates = Array.isArray(backup.whatsapp_templates)
      ? backup.whatsapp_templates
      : [];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase env is missing on server' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (mode === 'replace') {
      const deleteJobsRes = await supabase.from('jobs').delete().eq('user_id', userId);
      if (deleteJobsRes.error) {
        return NextResponse.json(
          { error: `Failed to clear jobs: ${deleteJobsRes.error.message}` },
          { status: 500 }
        );
      }

      const deleteTemplatesRes = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('user_id', userId);

      if (deleteTemplatesRes.error && deleteTemplatesRes.error.code !== '42P01') {
        return NextResponse.json(
          { error: `Failed to clear templates: ${deleteTemplatesRes.error.message}` },
          { status: 500 }
        );
      }
    }

    if (jobs.length) {
      const normalizedJobs = jobs.map((job) => normalizeJob(userId, job as BackupJob));
      const jobsUpsertRes = await supabase.from('jobs').upsert(normalizedJobs, {
        onConflict: 'id',
      });

      if (jobsUpsertRes.error) {
        return NextResponse.json(
          { error: `Failed to restore jobs: ${jobsUpsertRes.error.message}` },
          { status: 500 }
        );
      }
    }

    if (templates.length) {
      const normalizedTemplates = templates.map((template) =>
        normalizeTemplate(userId, template as BackupTemplate)
      );

      const templatesUpsertRes = await supabase.from('whatsapp_templates').upsert(
        normalizedTemplates,
        {
          onConflict: 'user_id,category,template_type,status_key',
        }
      );

      if (templatesUpsertRes.error && templatesUpsertRes.error.code !== '42P01') {
        return NextResponse.json(
          { error: `Failed to restore templates: ${templatesUpsertRes.error.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: mode === 'replace' ? 'Backup restored with replace mode' : 'Backup merged successfully',
      counts: {
        jobs: jobs.length,
        templates: templates.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Backup restore error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
