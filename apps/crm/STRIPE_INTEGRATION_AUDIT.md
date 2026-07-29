# Stripe Integration Audit — Fusion 44X CRM

> **Status:** ❌ Not started
> **Last audit:** {{DATE}}
> **Audit by:** Automation Agent

---

## 1. Current State

- **Stripe SDK:** Not installed (frontend or backend)
- **Backend server:** None exists (pure Vite/React static app)
- **Database:** None exists
- **Environment config:** No `.env`, no Stripe keys
- **Payment UI:** Zero — no checkout, no pricing, no purchase forms
- **Purchase funnel:** FunnelCustomerJourney.tsx has a "Purchase" stage label but it's hardcoded mock data with no real payment flow
- **CustomerPortal.tsx:** Shows hardcoded "Recent Orders" list — not backed by any real order system
- **Types:** No payment-related types in `src/types/index.ts`

---

## 2. What Needs to Be Built

### 2.1 Backend (New — Node.js/Express or equivalent)

| # | Item | Status |
|---|------|--------|
| 1 | Initialize backend project (e.g. `server/` directory) | ❌ |
| 2 | Install `stripe` Node.js SDK | ❌ |
| 3 | Install Express/cors/helmet for API server | ❌ |
| 4 | Create `.env` with `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | ❌ |
| 5 | Set up environment validation on startup | ❌ |
| 6 | Create `/api/health` endpoint | ❌ |
| 7 | Create `/api/stripe/create-checkout-session` | ❌ |
| 8 | Create `/api/stripe/create-portal-session` (customer billing portal) | ❌ |
| 9 | Create `/api/stripe/webhook` endpoint | ❌ |
| 10 | Create `/api/orders` (list orders for a customer) | ❌ |
| 11 | Create `/api/orders/:id` (single order detail) | ❌ |
| 12 | Create `/api/subscriptions` (list subscriptions) | ❌ |
| 13 | Create `/api/products` (list products/prices from Stripe) | ❌ |
| 14 | Add webhook event handlers: `checkout.session.completed`, `customer.subscription.updated`, `invoice.paid`, `invoice.payment_failed` | ❌ |
| 15 | Add error handling and logging | ❌ |
| 16 | Add rate limiting | ❌ |

### 2.2 Database

| # | Item | Status |
|---|------|--------|
| 1 | Choose DB (SQLite for MVP, or PostgreSQL for production) | ❌ |
| 2 | Install DB driver/ORM | ❌ |
| 3 | Create `customers` table (maps CRM user → Stripe `cus_xxx`) | ❌ |
| 4 | Create `orders` table (order_id, stripe_session_id, amount, status, items, created_at) | ❌ |
| 5 | Create `subscriptions` table (id, stripe_subscription_id, status, current_period_start/end, plan) | ❌ |
| 6 | Create migration/seed scripts | ❌ |

### 2.3 Stripe Product & Pricing Configuration (in Stripe Dashboard)

| # | Item | Status |
|---|------|--------|
| 1 | Create Product: "Probe Replacement Kit" with price | ❌ |
| 2 | Create Product: "Calibration Solution" with price | ❌ |
| 3 | Create Product: "Sensor Cap (4-pack)" with price | ❌ |
| 4 | Create Product: "F44X Platform Subscription" (monthly/yearly) | ❌ |
| 5 | Create Product: "Premium Support Plan" | ❌ |
| 6 | Configure Stripe Tax settings (if applicable) | ❌ |
| 7 | Configure Stripe Webhook endpoint in Dashboard → point to deployed webhook URL | ❌ |
| 8 | Set webhook signing secret in `.env` | ❌ |

### 2.4 Frontend — Stripe Integration

| # | Item | Status |
|---|------|--------|
| 1 | Install `@stripe/react-stripe-js` and `@stripe/stripe-js` | ❌ |
| 2 | Add `STRIPE_PUBLISHABLE_KEY` to Vite env vars (`VITE_STRIPE_PUBLISHABLE_KEY`) | ❌ |
| 3 | Wrap app with `Elements` provider | ❌ |
| 4 | Create `CheckoutButton` component → calls `/api/stripe/create-checkout-session`, redirects to Stripe | ❌ |
| 5 | Create `SubscriptionManager` component (view plan, upgrade, cancel) | ❌ |
| 6 | Create `BillingPortalButton` → opens Stripe Customer Portal | ❌ |
| 7 | Create "Pricing / Plans" view | ❌ |
| 8 | Wire "Order Probe" button in CustomerPortal.tsx to real checkout flow | ❌ |
| 9 | Replace hardcoded "Recent Orders" in CustomerPortal.tsx with real data from `/api/orders` | ❌ |
| 10 | Add loading/error/empty states for all payment-related UI | ❌ |
| 11 | Add payment success/cancel pages or modals | ❌ |
| 12 | Connect Purchase stage in FunnelCustomerJourney to real order data | ❌ |
| 13 | Add payment method management UI | ❌ |
| 14 | Add invoice history view | ❌ |

### 2.5 Frontend — Types & State

| # | Item | Status |
|---|------|--------|
| 1 | Add `Order`, `Subscription`, `Product`, `Customer` types to `src/types/index.ts` | ❌ |
| 2 | Add Stripe-related API client functions (or use react-query) | ❌ |
| 3 | Add payment state management (Context or Zustand) | ❌ |

### 2.6 Authentication (Prerequisite for Payments)

| # | Item | Status |
|---|------|--------|
| 1 | Choose auth strategy (Auth0, Clerk, Firebase Auth, or custom JWT) | ❌ |
| 2 | Add login/signup UI | ❌ |
| 3 | Add auth middleware on backend | ❌ |
| 4 | Add protected routes on frontend | ❌ |
| 5 | Link authenticated user to Stripe Customer object | ❌ |

### 2.7 Infrastructure & Deployment

| # | Item | Status |
|---|------|--------|
| 1 | Choose hosting for backend (Railway, Render, Fly.io, Vercel Serverless) | ❌ |
| 2 | Update `netlify.toml` if needed (or add separate deploy config for backend) | ❌ |
| 3 | Add deploy scripts for backend | ❌ |
| 4 | Configure CORS for frontend domain | ❌ |
| 5 | Add Stripe webhook endpoint URL to Stripe Dashboard (after deploy) | ❌ |
| 6 | Set environment variables in production hosting | ❌ |

---

## 3. Architecture Sketch

```
Frontend (Vite + React)          Backend (Node/Express)        Stripe
┌─────────────────────┐        ┌──────────────────────┐     ┌──────────┐
│  @stripe/react-js   │ ────→  │  /create-checkout    │ ──→ │ Checkout │
│  Elements Provider  │        │  /webhook            │ ←── │ Sessions │
│  CheckoutButton     │        │  /portal-session     │ ──→ │ Portal   │
│  BillingPortalBtn   │        │  /orders             │ ──→ │ API      │
│  SubscriptionMgr    │        │  /subscriptions      │     └──────────┘
│  OrderHistory       │        │  /products           │
└─────────────────────┘        └──────────────────────┘
                                       │
                                       ▼
                               ┌──────────────┐
                               │   Database    │
                               │  (SQLite/PG)  │
                               │  - customers  │
                               │  - orders     │
                               │  - subs       │
                               └──────────────┘
```

### Checkout Flow

1. User clicks "Order Probe" (or "Subscribe", "Buy Now")
2. Frontend POSTs to `/api/stripe/create-checkout-session` with `priceId` + `customerId`
3. Backend calls `stripe.checkout.sessions.create()` → returns `session.url`
4. Frontend calls `window.location.href = session.url` → user is on Stripe Checkout
5. Stripe redirects to `{success_url}?session_id={id}` or `{cancel_url}`
6. Webhook `checkout.session.completed` fires → backend creates order in DB
7. Frontend fetches `/api/orders` to show updated order history

---

## 4. Files That Need Changes

| File | Change |
|------|--------|
| `src/components/cards/CustomerPortal.tsx` | Wire "Order Probe" button to checkout; replace hardcoded orders with API data |
| `src/components/cards/FunnelCustomerJourney.tsx` | Connect Purchase stage funnel data to real order metrics |
| `src/types/index.ts` | Add Order, Subscription, Product, Customer interfaces |
| `package.json` | Add `@stripe/react-stripe-js`, `@stripe/stripe-js` |
| `src/App.tsx` | Wrap with Elements provider; add routing if needed |
| `.gitignore` | Add `.env` entry |
| `netlify.toml` | May need updates for API proxying |
| *(new) `server/`* | Entire backend |

---

## 5. Key Files Reference (Current)

| File | Lines | Content |
|------|-------|---------|
| `src/components/cards/FunnelCustomerJourney.tsx` | 10, 19, 28 | "Purchase" stage label — currently hardcoded integer counts |
| `src/components/cards/CustomerPortal.tsx` | 50 | "Order Probe" button — no onClick handler |
| `src/components/cards/CustomerPortal.tsx` | 53-67 | Hardcoded "Recent Orders" list — no API backing |
| `src/components/cards/CustomerPortal.tsx` | 49 | "Schedule Service" button — no onClick handler |
| `src/types/index.ts` | 1-55 | Current types — no payment-related interfaces exist |

---

## 6. Stripe Price IDs (To Be Created)

Once products are created in Stripe Dashboard, document price IDs here:

| Product | Price ID (Test) | Price ID (Live) |
|---------|----------------|-----------------|
| Probe Replacement Kit | `price_xxxxx` | `price_xxxxx` |
| Calibration Solution | `price_xxxxx` | `price_xxxxx` |
| Sensor Cap (4-pack) | `price_xxxxx` | `price_xxxxx` |
| F44X Platform — Monthly | `price_xxxxx` | `price_xxxxx` |
| F44X Platform — Yearly | `price_xxxxx` | `price_xxxxx` |
| Premium Support Plan | `price_xxxxx` | `price_xxxxx` |

---

## 7. Environment Variables Needed

```env
# Backend
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
DATABASE_URL=...
FRONTEND_URL=http://localhost:5173

# Frontend (Vite)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:3001/api
```

---

## 8. Daily Audit Checklist

Run this every day to track progress:

- [ ] Backend server running? `curl http://localhost:3001/api/health`
- [ ] Stripe keys set in `.env`?
- [ ] `@stripe/stripe-js` and `@stripe/react-stripe-js` in `package.json`?
- [ ] Checkout session creation endpoint returns valid URL?
- [ ] Webhook handler logging events?
- [ ] CustomerPortal.tsx showing real order data from API?
- [ ] FunnelCustomerJourney.tsx purchase counts reflecting real orders?
- [ ] Auth working for protected payment routes?
- [ ] Deployed backend accessible from frontend?
- [ ] Stripe Dashboard webhook logs showing successful events?

---

## 9. Rollback Plan

If Stripe integration causes issues:

1. Keep the static mock data in CustomerPortal.tsx and FunnelCustomerJourney.tsx as fallback
2. Feature-flag all Stripe features behind a config variable
3. Switch back to mock mode by toggling `VITE_ENABLE_PAYMENTS=false`

---

## Scoring Rubric

| Category | Points | Current Score |
|----------|--------|---------------|
| Backend API | 25 | 0 |
| Database | 15 | 0 |
| Stripe Config (Dashboard) | 10 | 0 |
| Frontend Payment UI | 20 | 0 |
| Auth | 10 | 0 |
| Types/State | 5 | 0 |
| Infrastructure | 10 | 0 |
| Testing | 5 | 0 |
| **Total** | **100** | **0** |

---

*Generated for Fusion 44X CRM automation agent — update daily.*
