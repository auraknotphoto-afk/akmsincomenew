import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/lib/auth-config';

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );

  const esc = (value: unknown) => {
    const s = String(value ?? '');
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => esc(row[header])).join(',')),
  ].join('\n');
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const [jobsRes, templatesRes] = await Promise.all([
      supabase
        .from('jobs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
    ]);

    if (jobsRes.error) {
      return NextResponse.json(
        { error: `Failed to fetch jobs: ${jobsRes.error.message}` },
        { status: 500 }
      );
    }

    if (templatesRes.error && templatesRes.error.code !== '42P01') {
      return NextResponse.json(
        { error: `Failed to fetch templates: ${templatesRes.error.message}` },
        { status: 500 }
      );
    }

    const jobs = jobsRes.data || [];
    const templates = templatesRes.data || [];
    const exportedAt = new Date().toISOString();
    const timestamp = exportedAt.replace(/[:.]/g, '-');

    const payload = {
      exported_at: exportedAt,
      user_id: userId,
      counts: {
        jobs: jobs.length,
        templates: templates.length,
      },
      jobs,
      whatsapp_templates: templates,
      jobs_csv: toCsv(jobs as Record<string, unknown>[]),
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="aura-knot-backup-${timestamp}.json"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Backup download error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
