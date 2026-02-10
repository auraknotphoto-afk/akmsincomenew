import { NextResponse } from 'next/server';
import { supabase } from '../../../src/lib/supabase';

export async function POST(req: Request) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    const body = await req.json();
    const jobs = body.jobs || [];
    if (!Array.isArray(jobs)) return NextResponse.json({ error: 'jobs must be array' }, { status: 400 });

    // Upsert jobs by id (if id missing, generate one in client beforehand)
    const { data, error } = await supabase
      .from('jobs')
      .upsert(jobs, { onConflict: 'id' })
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, inserted: Array.isArray(data) ? data.length : 1, data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
