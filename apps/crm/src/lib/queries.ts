import { supabase } from './supabase';
import type {
  Distributor,
  Lead,
  SupportTicket,
  ContentAsset,
  KnowledgeCategory,
  KnowledgeArticle,
  FunnelMetric,
  Order,
  OrderItem,
  ChatSession,
  ChatMessage,
  AiChatResponse,
  FormSubmission,
  Organization,
  SocialPost,
  SocialPostStatus,
} from '../types';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Missing Supabase configuration in this deployment');
  }
  return supabase;
}

function requireSupabaseUrl() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) {
    throw new Error('Missing VITE_SUPABASE_URL');
  }
  return url.replace(/\/$/, '');
}

async function selectAll<T>(table: string, orderColumn?: string, ascending = true): Promise<T[]> {
  let query = requireSupabase().from(table).select('*');
  if (orderColumn) query = query.order(orderColumn, { ascending });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
}

export function fetchDistributors() {
  return selectAll<Distributor>('distributors', 'name');
}

export function fetchLeads() {
  return selectAll<Lead>('leads', 'date', false);
}

export async function createLead(data: {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
  score?: number;
  status?: string;
  distributor_id?: string;
}): Promise<Lead> {
  const { data: result, error } = await requireSupabase()
    .from('leads')
    .insert({
      name: data.name,
      company: data.company ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      source: data.source ?? 'crm',
      notes: data.notes ?? null,
      score: data.score ?? 0,
      status: data.status ?? 'New',
      distributor_id: data.distributor_id ?? null,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    })
    .select('*')
    .single();
  if (error) throw error;
  return result;
}

export async function updateLead(id: string, updates: Partial<{
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  notes: string;
  score: number;
  status: string;
  distributor_id: string;
}>): Promise<Lead> {
  const { data, error } = await requireSupabase()
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export function fetchFormSubmissions() {
  return selectAll<FormSubmission>('form_submissions', 'created_at', false);
}

export function fetchSocialPosts() {
  return selectAll<SocialPost>('social_posts', 'created_at', false);
}

export async function createSocialPost(data: {
  title: string;
  platform: string;
  content: string;
  campaign?: string;
  organization_id?: string | null;
  status?: SocialPostStatus;
  scheduled_for?: string | null;
  approval_notes?: string | null;
  media_url?: string | null;
  post_url?: string | null;
}): Promise<SocialPost> {
  const client = requireSupabase();
  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session?.user) {
    throw new Error('Not authenticated');
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('organization_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  const { data: created, error } = await client
    .from('social_posts')
    .insert({
      title: data.title,
      platform: data.platform,
      content: data.content,
      campaign: data.campaign ?? null,
      organization_id: data.organization_id ?? profile?.organization_id ?? null,
      status: data.status ?? 'Draft',
      scheduled_for: data.scheduled_for ?? null,
      approval_notes: data.approval_notes ?? null,
      media_url: data.media_url ?? null,
      post_url: data.post_url ?? null,
      created_by: session.user.id,
    })
    .select('*')
    .single();
  if (error) throw error;
  return created as SocialPost;
}

export async function updateSocialPost(
  id: string,
  updates: Partial<{
    title: string;
    platform: string;
    content: string;
    campaign: string | null;
    status: SocialPostStatus;
    scheduled_for: string | null;
    approved_by: string | null;
    published_at: string | null;
    approval_notes: string | null;
    media_url: string | null;
    post_url: string | null;
  }>
): Promise<SocialPost> {
  const { data, error } = await requireSupabase()
    .from('social_posts')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as SocialPost;
}

export function fetchTickets() {
  return selectAll<SupportTicket>('support_tickets', 'created_at', false);
}

export async function createTicket(data: {
  subject: string;
  description?: string;
  priority?: string;
}): Promise<SupportTicket> {
  const client = requireSupabase();
  const userId = (await client.auth.getUser()).data.user?.id;
  const { data: result, error } = await client
    .from('support_tickets')
    .insert({
      customer_id: userId,
      subject: data.subject,
      description: data.description ?? null,
      priority: data.priority ?? 'Med',
      status: 'Open',
    })
    .select('*')
    .single();
  if (error) throw error;
  return result;
}

export async function updateTicket(id: string, updates: Partial<{
  status: string;
  priority: string;
  assigned_to: string;
  resolved_at: string;
}>): Promise<SupportTicket> {
  const { data, error } = await requireSupabase()
    .from('support_tickets')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export function fetchContentAssets() {
  return selectAll<ContentAsset>('content_assets', 'views', false);
}

export async function createContentAsset(data: {
  title: string;
  type: string;
  file_url?: string;
}): Promise<ContentAsset> {
  const { data: result, error } = await requireSupabase()
    .from('content_assets')
    .insert({
      title: data.title,
      type: data.type,
      file_url: data.file_url ?? null,
      status: 'Draft',
    })
    .select('*')
    .single();
  if (error) throw error;
  return result;
}

export function fetchKnowledgeArticles(categoryId?: string) {
  let query = requireSupabase().from('knowledge_articles').select('*');
  if (categoryId) query = query.eq('category_id', categoryId);
  return query.order('created_at', { ascending: false }).then(({ data, error }) => {
    if (error) throw error;
    return (data ?? []) as KnowledgeArticle[];
  });
}

export function fetchAllProfiles() {
  return requireSupabase()
    .from('profiles')
    .select('id, user_id, full_name, role')
    .order('full_name')
    .then(({ data, error }) => {
      if (error) throw error;
      return data ?? [];
    });
}

export function fetchKnowledgeCategories() {
  return selectAll<KnowledgeCategory>('knowledge_categories', 'title');
}

export function fetchFunnelMetrics() {
  return selectAll<FunnelMetric>('funnel_metrics', 'recorded_at');
}

export function fetchOrders() {
  return selectAll<Order>('orders', 'created_at', false);
}

export function fetchMyOrders() {
  return fetchOrders();
}

export function fetchOrderItems() {
  return selectAll<OrderItem>('order_items');
}

// === Chat ===

export function fetchChatSessions() {
  return selectAll<ChatSession>('chat_sessions', 'created_at', false);
}

export async function fetchChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await requireSupabase()
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function sendChatMessage(message: string, sessionId?: string): Promise<AiChatResponse> {
  const client = requireSupabase();
  const { data: { session } } = await client.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const functionUrl = `${requireSupabaseUrl()}/functions/v1/ai-chat`;

  let res: Response;
  try {
    res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, sessionId }),
    });
  } catch {
    throw new Error(`Failed to reach AI chat function at ${functionUrl}`);
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed.error) {
        throw new Error(parsed.error);
      }
    } catch {
      // Fall through to the raw text fallback below.
    }
    throw new Error(raw || 'Failed to send message');
  }

  return res.json();
}

// === Organizations ===

export function fetchOrganizations() {
  return selectAll<Organization>('organizations', 'name');
}

export async function fetchMyOrganization(): Promise<Organization | null> {
  const { data: profile } = await requireSupabase()
    .from('profiles')
    .select('organization_id')
    .eq('user_id', (await requireSupabase().auth.getUser()).data.user?.id)
    .single();

  if (!profile?.organization_id) return null;

  const { data, error } = await requireSupabase()
    .from('organizations')
    .select('*')
    .eq('id', profile.organization_id)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchChildOrganizations(parentId: string): Promise<Organization[]> {
  const { data, error } = await requireSupabase()
    .from('organizations')
    .select('*')
    .eq('parent_org_id', parentId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createOrganization(data: {
  name: string;
  type: string;
  parent_org_id?: string;
}): Promise<Organization> {
  const { data: result, error } = await requireSupabase()
    .from('organizations')
    .insert({
      name: data.name,
      type: data.type,
      parent_org_id: data.parent_org_id ?? null,
      created_by: (await requireSupabase().auth.getUser()).data.user?.id,
    })
    .select('*')
    .single();
  if (error) throw error;
  return result;
}

export async function fetchOrganizationProfiles(orgId: string) {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('*')
    .eq('organization_id', orgId)
    .order('full_name');
  if (error) throw error;
  return data ?? [];
}

export async function assignUserToOrganization(userId: string, orgId: string) {
  const { error } = await requireSupabase()
    .from('profiles')
    .update({ organization_id: orgId })
    .eq('user_id', userId);
  if (error) throw error;
}
