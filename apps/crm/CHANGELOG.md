# Changelog

## [1.0.0] — 2026-06-15

### Added

- **Supabase backend foundation**
  - Database schema with 15 tables: profiles, products, prices, customers, orders, order_items, subscriptions, distributors, leads, support_tickets, ticket_messages, content_assets, knowledge_categories, knowledge_articles, funnel_metrics
  - Row Level Security (RLS) policies for multi-role access (manufacturer, distributor, customer)
  - Auto-profile creation trigger on user signup
  - Seed data matching existing UI mock data

- **Authentication system**
  - Login and Signup pages with role selection (Manufacturer / Distributor / Customer)
  - AuthContext provider for global auth state
  - AuthGuard component for protected routes with optional role checking
  - Sign-out functionality in dashboard header

- **Routing**
  - React Router with routes: `/login`, `/signup`, `/dashboard` (protected), catch-all redirect
  - Post-login redirect to originally requested page

- **Stripe integration audit document**
  - `STRIPE_INTEGRATION_AUDIT.md` — comprehensive checklist covering backend API, database, frontend Stripe integration, authentication, infrastructure, and daily audit rubric
  - Scoring system to track integration progress (0/100)

- **TypeScript types**
  - Full type definitions for all 15 database tables
  - Stripe commerce types (Product, Price, Customer, Order, OrderItem, Subscription)
  - Domain types (Distributor, Lead, SupportTicket, ContentAsset, KnowledgeCategory, FunnelMetric)

- **Infrastructure**
  - Supabase client configuration (`src/lib/supabase.ts`)
  - Environment variable template (`.env.example`)
  - `.gitignore` updated for `.env` files
  - Database migration file (`supabase/migrations/001_schema.sql`)

### Changed

- `src/main.tsx` — wrapped app with BrowserRouter and AuthProvider
- `src/App.tsx` — converted from hardcoded grid to route-based layout
- `src/components/Header.tsx` — added user name display and sign-out button
- `src/types/index.ts` — added 15+ new interfaces for database entities
- `package.json` — added `@supabase/supabase-js`, `react-router-dom` dependencies

### Technical

- Vite 8 + TypeScript 6 + React 19 build verified (1812 modules, 0 errors)
- Supabase Edge Functions planned for Phase 2 Stripe integration
- Multi-tenant role architecture designed from day one
