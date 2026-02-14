import { NextResponse } from 'next/server';
import { supabase } from '../../../src/lib/supabase';

// Simple route handler for templates
export async function GET(req: Request) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    const url = new URL(req.url);
    const kind = url.searchParams.get('kind');
    const category = url.searchParams.get('category');

    if (!kind) return NextResponse.json({ error: 'kind is required' }, { status: 400 });

    // If requesting job_status/payment_status without category, return all rows
    if ((kind === 'job_status' || kind === 'payment_status') && !category) {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('id, user_id, category, kind, content')
        .eq('kind', kind);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Build map category -> content
      const map: Record<string, any> = {};
      (data || []).forEach((row: any) => {
        const cat = row.category || 'GLOBAL';
        map[cat] = row.content;
      });

      return NextResponse.json({ kind, templates: map });
    }

    // Single resource: try per-category first, then global (category=NULL)
    if (category) {
      const { data: perCat, error: err1 } = await supabase
        .from('whatsapp_templates')
        .select('id, content')
        .eq('kind', kind)
        .eq('category', category)
        .limit(1);

      if (err1) return NextResponse.json({ error: err1.message }, { status: 500 });
      if (perCat && perCat.length > 0) return NextResponse.json({ content: perCat[0].content });
    }

    // fallback global
    const { data: globalRows, error: err2 } = await supabase
      .from('whatsapp_templates')
      .select('id, content')
      .eq('kind', kind)
      .is('category', null)
      .limit(1);

    if (err2) return NextResponse.json({ error: err2.message }, { status: 500 });
    if (globalRows && globalRows.length > 0) return NextResponse.json({ content: globalRows[0].content });

    return NextResponse.json({ content: null });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    const body = await req.json();
    const { kind, category = null, content } = body;

    if (!kind || content === undefined) return NextResponse.json({ error: 'kind and content required' }, { status: 400 });

    // Upsert by (user_id=null, kind, category)
    const payload = {
      user_id: null,
      kind,
      category,
      content,
    };

    // Use kind+category as the conflict target so NULL user_id (global templates)
    // will upsert correctly (Postgres treats NULLs as distinct for unique constraints).
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .upsert([payload], { onConflict: 'kind,category' })
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
