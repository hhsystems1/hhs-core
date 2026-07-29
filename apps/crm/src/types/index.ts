// === Auth ===
export type Role = 'admin' | 'manufacturer' | 'distributor';

export interface Profile {
  id: string;
  user_id: string;
  organization_id: string | null;
  role: Role;
  full_name: string | null;
  company: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  type: 'hqs' | 'manufacturer' | 'distributor' | 'customer';
  parent_org_id: string | null;
  created_by: string | null;
  created_at: string;
}

// === Commerce (Stripe) ===
export interface Product {
  id: string;
  stripe_product_id: string;
  name: string;
  description: string | null;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Price {
  id: string;
  stripe_price_id: string;
  product_id: string;
  currency: string;
  unit_amount: number;
  interval: 'one_time' | 'month' | 'year' | null;
  active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  email: string;
  name: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  amount_total: number;
  currency: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  price_id: string;
  product_name: string;
  quantity: number;
  unit_amount: number;
  amount_total: number;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  status: string;
  price_id: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
}

// === Distributors & Leads ===
export interface Distributor {
  id: string;
  name: string;
  region: string;
  status: string;
  revenue: string;
  contact_email: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  distributor_id: string;
  name: string;
  company: string;
  email?: string;
  phone?: string;
  score: number;
  status: string;
  source: string;
  notes?: string;
  form_data?: Record<string, unknown>;
  date: string;
  created_at: string;
}

export interface FormSubmission {
  id: string;
  source_url?: string;
  form_name: string;
  form_data: Record<string, unknown>;
  lead_id?: string;
  created_at: string;
}

export type SocialPostStatus =
  | 'Draft'
  | 'Ready for Review'
  | 'Approved'
  | 'Scheduled'
  | 'Published';

export interface SocialPost {
  id: string;
  organization_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  title: string;
  platform: string;
  content: string;
  campaign: string | null;
  status: SocialPostStatus;
  scheduled_for: string | null;
  published_at: string | null;
  approval_notes: string | null;
  post_url: string | null;
  media_url: string | null;
  created_at: string;
}

// === Support ===
export interface SupportTicket {
  id: string;
  customer_id: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  message: string;
  created_at: string;
}

// === Content ===
export interface ContentAsset {
  id: string;
  title: string;
  type: string;
  views: number;
  engagement: string;
  status: string;
  file_url: string | null;
  created_at: string;
}

export interface KnowledgeCategory {
  id: string;
  title: string;
  icon_name: string;
  count: number;
  color: string;
  created_at: string;
}

export interface KnowledgeArticle {
  id: string;
  category_id: string;
  title: string;
  content: string | null;
  views: number;
  created_at: string;
}

// === Funnel ===
export interface FunnelMetric {
  id: string;
  funnel_name: string;
  stage_name: string;
  count: number;
  recorded_at: string;
}

// === Existing (UI helpers) ===
export interface KpiData {
  label: string;
  value: string;
  change?: string;
  changeType?: 'up' | 'down';
}

export interface TableColumn {
  key: string;
  label: string;
}

export interface TableRow {
  [key: string]: string | number | boolean;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface ChatMessage {
  id?: string;
  session_id?: string;
  role: 'user' | 'assistant';
  content?: string;
  text?: string;
  time?: string;
  created_at?: string;
}

export interface AiChatResponse {
  message: ChatMessage;
  sessionId: string;
}

export interface FunnelStage {
  label: string;
  count: number;
}

export interface Funnel {
  title: string;
  stages: FunnelStage[];
}
