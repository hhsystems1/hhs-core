import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${authHeader}` } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
  }

  const { message, sessionId } = await req.json();
  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
  }

  let chatSessionId = sessionId;

  if (!chatSessionId) {
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id, title: message.slice(0, 60) })
      .select('id')
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Failed to create session' }), { status: 500 });
    }
    chatSessionId = session.id;
  } else {
    const { data: ownedSession, error: ownershipError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', chatSessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (ownershipError) {
      return new Response(JSON.stringify({ error: 'Failed to verify chat session' }), { status: 500 });
    }

    if (!ownedSession) {
      return new Response(JSON.stringify({ error: 'Chat session not found' }), { status: 404 });
    }
  }

  const { error: msgError } = await supabase
    .from('chat_messages')
    .insert({ session_id: chatSessionId, role: 'user', content: message });

  if (msgError) {
    return new Response(JSON.stringify({ error: 'Failed to save message' }), { status: 500 });
  }

  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', chatSessionId)
    .order('created_at', { ascending: true });

  const messages = [
    { role: 'system', content: 'You are a helpful AI assistant for the Fusion 44X CRM platform. You help with water treatment industry knowledge, product information, troubleshooting, and training. Keep answers concise and practical.' },
    ...(history ?? []).map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), { status: 500 });
  }

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    return new Response(JSON.stringify({ error: `OpenAI API error: ${errText}` }), { status: 502 });
  }

  const openaiData = await openaiRes.json();
  const assistantContent: string = openaiData.choices?.[0]?.message?.content ?? 'No response';

  const { data: saved, error: saveError } = await supabase
    .from('chat_messages')
    .insert({ session_id: chatSessionId, role: 'assistant', content: assistantContent })
    .select('id, role, content, created_at')
    .single();

  if (saveError) {
    return new Response(JSON.stringify({ error: 'Failed to save response' }), { status: 500 });
  }

  return new Response(
    JSON.stringify({
      message: saved,
      sessionId: chatSessionId,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
