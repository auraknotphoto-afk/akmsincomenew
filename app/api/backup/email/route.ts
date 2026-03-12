import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/lib/auth-config';

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
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

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => esc(row[h])).join(',')),
  ];

  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to } = await req.json();
    const toEmail = String(to || '').trim();
    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return NextResponse.json({ error: 'Valid backup email is required' }, { status: 400 });
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

    const resendApiKey = process.env.RESEND_API_KEY || '';
    const fromEmail = process.env.BACKUP_FROM_EMAIL || '';
    if (!resendApiKey || !fromEmail) {
      return NextResponse.json(
        { error: 'Email service is not configured. Set RESEND_API_KEY and BACKUP_FROM_EMAIL.' },
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
    const payload = {
      exported_at: new Date().toISOString(),
      user_id: userId,
      counts: {
        jobs: jobs.length,
        templates: templates.length,
      },
      jobs,
      whatsapp_templates: templates,
    };

    const jsonText = JSON.stringify(payload, null, 2);
    const jobsCsv = toCsv(jobs as Record<string, unknown>[]);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: `Aura Knot Backup - ${new Date().toLocaleDateString('en-IN')}`,
        text:
          `Your data backup is attached.\n\n` +
          `User ID: ${userId}\n` +
          `Jobs: ${jobs.length}\n` +
          `Templates: ${templates.length}\n` +
          `Exported At: ${payload.exported_at}\n`,
        attachments: [
          {
            filename: `aura-knot-backup-${timestamp}.json`,
            content: Buffer.from(jsonText, 'utf8').toString('base64'),
          },
          {
            filename: `aura-knot-jobs-${timestamp}.csv`,
            content: Buffer.from(jobsCsv, 'utf8').toString('base64'),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Email send failed: ${errText}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Backup email sent successfully',
      counts: payload.counts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Backup email error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

