# LaunchGrid AI — Build Summary

Complete file listing with descriptions. All files under `/home/user/workspace/launchgrid-ai/`.

---

## Configuration Files

| File | Description |
|------|-------------|
| `package.json` | NPM dependencies: Next.js 14, Prisma, NextAuth, Stripe, OpenAI, Resend, shadcn/Radix, framer-motion, sonner, zod |
| `tsconfig.json` | TypeScript config with `@/*` path alias pointing to `./src/*` |
| `next.config.mjs` | Next.js config with remote image domains (Google, Maps) |
| `tailwind.config.ts` | Tailwind config with dark mode, custom colors (`lg-bg`, `lg-panel`, `lg-blue`), grid/glow animations |
| `postcss.config.mjs` | PostCSS config with Tailwind + Autoprefixer |
| `components.json` | shadcn/ui config pointing to `src/app/globals.css` |
| `.env.example` | All required environment variables with descriptions |
| `.gitignore` | Standard Next.js + Prisma gitignore |
| `README.md` | Full setup guide, API key instructions, deployment guide |

---

## Database

| File | Description |
|------|-------------|
| `prisma/schema.prisma` | PostgreSQL schema: User, Account, Session, VerificationToken (NextAuth), Business, GeneratedSystem, Proposal, Deal — all with cuid() IDs and cascading deletes |

---

## Library Files (`src/lib/`)

| File | Description |
|------|-------------|
| `prisma.ts` | Singleton Prisma client (prevents hot-reload issues in dev) |
| `auth.ts` | NextAuth config: PrismaAdapter, JWT strategy, Credentials + Google providers, session callbacks adding user.id and plan |
| `stripe.ts` | Stripe client singleton |
| `openai.ts` | OpenAI client singleton with DEFAULT_MODEL=gpt-4o-mini |
| `google-places.ts` | Google Places API (New) text search integration — returns typed PlaceResult[] |
| `resend.ts` | Resend email client + sendProposalEmail() with dark HTML template |
| `utils.ts` | cn(), formatCurrency(), formatDate(), truncate(), slugify() |
| `constants.ts` | PRICING_PRESETS, PLANS (free/pro), DEAL_STAGES, PROPOSAL_STATUSES, APP_URL |
| `validations.ts` | Zod schemas for all API endpoints: auth, business, generate, proposal, deal |
| `limits.ts` | checkPlanLimit() — enforces free plan caps per userId |

---

## Type Definitions (`src/types/`)

| File | Description |
|------|-------------|
| `next-auth.d.ts` | Extends NextAuth session to include user.id and user.plan |
| `index.ts` | Shared TypeScript interfaces: BusinessResult, SavedBusiness, LeadSystem, ContentSystem, ProposalData, BusinessSuggestions, FullProposal, Deal |

---

## App Root (`src/app/`)

| File | Description |
|------|-------------|
| `globals.css` | Tailwind directives, CSS variables (full dark theme), glass-card, bg-grid, bg-hero-glow, panel utility classes, scrollbar styling, sonner dark overrides |
| `layout.tsx` | Root layout: Inter font, dark class on html, Providers, Sonner Toaster |
| `providers.tsx` | Client component wrapping children in NextAuth SessionProvider |
| `page.tsx` | Landing page: Nav + Hero + HowItWorks + WhatWeGenerate + WhyItWorks + Pricing + FAQ + Footer |

---

## Auth Pages

| File | Description |
|------|-------------|
| `(auth)/login/page.tsx` | Login page: glass card, Google OAuth button, email/password form, sonner toasts |
| `(auth)/signup/page.tsx` | Signup page: Google OAuth, name/email/password form, auto-signs in after registration |

---

## Dashboard Pages

| File | Description |
|------|-------------|
| `(dashboard)/layout.tsx` | Dashboard shell: getServerSession guard + Sidebar + main content area |
| `(dashboard)/dashboard/page.tsx` | Overview: 4 stat cards (businesses, systems, proposals, MRR), 3 quick actions, recent businesses + proposals |
| `(dashboard)/businesses/page.tsx` | Client page: BusinessSearch + tab switcher (search results / saved), saved business cards with delete |
| `(dashboard)/businesses/[id]/page.tsx` | Business detail: full info, favorite toggle, AI suggestions panel, generate Lead/Content/Proposal buttons, systems history |
| `(dashboard)/proposals/page.tsx` | Proposals list table with status badges, total accepted MRR, external link to public view |
| `(dashboard)/proposals/new/page.tsx` | Proposal builder: business selector, AI generate, deliverables/benefits list editors, pricing presets, live preview pane |
| `(dashboard)/proposals/[id]/page.tsx` | Proposal detail: full content view, Copy Link, Preview, Send Email dialog, delete |
| `(dashboard)/deals/page.tsx` | Deals Kanban: 6 columns, inline stage selector, value editor, notes, MRR total, add deal dialog |
| `(dashboard)/billing/page.tsx` | Billing page: current plan display, Free vs Pro comparison cards, Stripe Checkout + Portal integration |

---

## Public Pages

| File | Description |
|------|-------------|
| `p/[publicId]/page.tsx` | Unbranded public proposal view: title, package overview, price, deliverables, benefits, next steps, Accept + Contact CTAs. Marks status VIEWED on load. |

---

## API Routes

| File | Description |
|------|-------------|
| `api/auth/[...nextauth]/route.ts` | NextAuth handler (GET + POST) |
| `api/auth/register/route.ts` | POST: creates user with bcrypt-hashed password, checks for duplicates |
| `api/businesses/search/route.ts` | POST: Google Places text search by industry + city |
| `api/businesses/route.ts` | GET (list) + POST (save with plan limit check) |
| `api/businesses/[id]/route.ts` | GET (detail with systems/proposals) + PATCH (favorite, AI fields) + DELETE |
| `api/generate/suggestions/route.ts` | POST: OpenAI generates painPoint/outreachAngle/suggestedOffer for a business |
| `api/generate/lead/route.ts` | POST: OpenAI generates full Lead Capture System, stores in GeneratedSystem |
| `api/generate/content/route.ts` | POST: OpenAI generates 30-day Content Calendar System, stores in GeneratedSystem |
| `api/generate/proposal/route.ts` | POST: OpenAI generates proposal copy (title, deliverables, benefits, email) |
| `api/proposals/route.ts` | GET (list) + POST (create with plan limit check) |
| `api/proposals/[id]/route.ts` | GET + PATCH + DELETE |
| `api/proposals/[id]/send/route.ts` | POST: sends proposal via Resend email, updates status to SENT |
| `api/deals/route.ts` | GET (list with business/proposal joins) + POST (create) |
| `api/deals/[id]/route.ts` | PATCH (stage/value/notes) + DELETE |
| `api/stripe/checkout/route.ts` | POST: creates Stripe Checkout Session for Pro plan |
| `api/stripe/portal/route.ts` | POST: creates Stripe Billing Portal session |
| `api/stripe/webhook/route.ts` | POST: handles checkout.session.completed, subscription.updated, subscription.deleted — updates user plan |

---

## UI Components (`src/components/ui/`)

| File | Description |
|------|-------------|
| `button.tsx` | Variants: default, destructive, outline, secondary, ghost, link, blue, blue-outline |
| `input.tsx` | Dark-themed input with blue focus ring |
| `label.tsx` | Radix Label with gray text |
| `card.tsx` | Glass card: bg-white/[0.03] backdrop-blur-xl border border-white/10 |
| `badge.tsx` | Variants: default, secondary, destructive, outline, blue, green, yellow, red, gray |
| `dialog.tsx` | Radix Dialog with dark panel bg |
| `dropdown-menu.tsx` | Full Radix Dropdown with dark styling |
| `select.tsx` | Radix Select with dark content panel |
| `separator.tsx` | Horizontal/vertical divider |
| `skeleton.tsx` | Animated pulse skeleton |
| `tabs.tsx` | Radix Tabs with blue active state |
| `textarea.tsx` | Dark-themed textarea |
| `avatar.tsx` | Radix Avatar with blue fallback |
| `accordion.tsx` | Radix Accordion with animate classes |

---

## Landing Components (`src/components/landing/`)

| File | Description |
|------|-------------|
| `Nav.tsx` | Sticky transparent nav with blur-on-scroll, mobile menu |
| `Hero.tsx` | Full-screen hero: animated orb glow, gradient headline, stats grid |
| `HowItWorks.tsx` | 4-step numbered glass cards |
| `WhatWeGenerate.tsx` | 3 feature cards: Lead, Content, Proposal with bullet outputs |
| `WhyItWorks.tsx` | 4-column grid: recurring revenue, simple offers, fast deployment, local need |
| `Pricing.tsx` | Free vs Pro cards, Pro highlighted with glow |
| `FAQ.tsx` | 6-item accordion FAQ |
| `Footer.tsx` | Logo, links, copyright |

---

## Dashboard Components (`src/components/dashboard/`)

| File | Description |
|------|-------------|
| `Sidebar.tsx` | Fixed 240px sidebar with nav items, active state highlighting, sign out |
| `TopBar.tsx` | Page header with title, subtitle, user avatar, Pro badge |
| `StatCard.tsx` | Metric card: icon, value, description, optional trend |

---

## Business Components (`src/components/businesses/`)

| File | Description |
|------|-------------|
| `BusinessSearch.tsx` | Industry + city search form |
| `BusinessCard.tsx` | Search result card: name, rating, address, phone, website, save button |

---

## Other Components

| File | Description |
|------|-------------|
| `components/Logo.tsx` | Inline SVG logo — geometric grid mark with LG letterforms in electric blue |

---

## Middleware

| File | Description |
|------|-------------|
| `middleware.ts` | NextAuth withAuth protecting /dashboard, /businesses, /proposals, /deals, /billing routes |

---

## Known Limitations / TODOs

1. **Lead/Content system viewer** — Generated systems are stored but no dedicated full-screen viewer page was built. Data is accessible via the Business detail page and the API. A future `/systems/[id]` page could display the full structured output.

2. **Proposal edit page** — The `proposals/[id]` page shows the proposal in read-only mode. A full edit form (similar to `proposals/new`) wasn't built as a separate page. You can extend it by adding an edit mode toggle.

3. **Prisma migrations** — No migration files are committed (`.gitignore` excludes them). Run `npx prisma migrate dev --name init` after cloning.

4. **Google OAuth redirect URI** — Must be configured in Google Cloud Console for `http://localhost:3000/api/auth/callback/google` (dev) and your production URL.

5. **Stripe webhook local testing** — Requires the Stripe CLI (`stripe listen --forward-to localhost:3000/api/stripe/webhook`).

6. **`@dnd-kit`** — Added to package.json but not used (dropdown approach used for Kanban stage selection instead, as recommended in the spec).

7. **No E2E tests** — Test coverage not included in this MVP.
