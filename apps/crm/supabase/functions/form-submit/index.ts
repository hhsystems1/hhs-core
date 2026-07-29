import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const FORM_API_KEY = Deno.env.get('FORM_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey !== FORM_API_KEY) {
    return new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const body = await req.json().catch(() => ({}));
  const { name, email, phone, company, message, formName, sourceUrl } = body;

  if (!name || !email) {
    return new Response(
      JSON.stringify({ error: 'Name and email are required' }),
      { status: 400 },
    );
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .insert({
      name,
      email,
      phone: phone ?? null,
      company: company ?? null,
      source: 'website_form',
      notes: message ?? null,
      form_data: { formName: formName ?? 'Unknown', sourceUrl: sourceUrl ?? null, ...body },
      status: 'New',
      score: 0,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    })
    .select('id')
    .single();

  if (leadError) {
    return new Response(
      JSON.stringify({ error: `Failed to create lead: ${leadError.message}` }),
      { status: 500 },
    );
  }

  const { error: submissionError } = await supabase
    .from('form_submissions')
    .insert({
      source_url: sourceUrl ?? null,
      form_name: formName ?? 'Website Form',
      form_data: body,
      lead_id: lead.id,
    });

  if (submissionError) {
    console.error('Failed to save form submission:', submissionError.message);
  }

  return new Response(
    JSON.stringify({ success: true, leadId: lead.id }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
