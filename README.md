# LaunchGrid AI

> Find businesses. Generate AI systems. Send proposals. Get paid monthly.

LaunchGrid AI is a B2C SaaS that helps freelancers and agency owners (1) find real local businesses via Google Places, (2) generate AI-powered Lead & Content systems for them, (3) send professional proposals, and (4) close monthly recurring clients.

---

## Features

- **Business Finder** — Search any industry in any city using Google Places API. Real data, real businesses.
- **AI Lead Systems** — Full lead capture page with headlines, qualification questions, booking CTA, and 5-day follow-up sequences.
- **AI Content Systems** — 30-day social media content calendar with hooks, captions, and hashtags.
- **AI Proposals** — Professional proposals generated in seconds. Share via public link or email.
- **Deals Pipeline** — Kanban-style deal tracker with MRR estimation.
- **Stripe Billing** — Free plan with limits. Pro plan ($49/mo) unlocks unlimited everything.
- **Public Proposal URLs** — Unbranded shareable proposal links for business owners.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 App Router + TypeScript |
| Styling | Tailwind CSS + shadcn/ui components |
| Database | Prisma ORM + PostgreSQL |
| Auth | NextAuth v4 (Credentials + Google OAuth) |
| AI | OpenAI API (gpt-4o-mini) |
| Payments | Stripe Subscriptions |
| Email | Resend |
| Business Data | Google Places API (New) |
| Icons | lucide-react |
| Animations | framer-motion |
| Validation | Zod |
| Toasts | Sonner |

---

## Prerequisites

- Node.js 18+
- PostgreSQL database (local or cloud)
- Accounts: OpenAI, Google Cloud (Places API), Stripe, Resend

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/launchgrid-ai.git
cd launchgrid-ai
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in all values (see [API Keys](#api-keys) section below).

### 3. Set up the database

```bash
npx prisma migrate dev --name init
```

This creates all tables in your PostgreSQL database.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API Keys

### NEXTAUTH_SECRET
```bash
openssl rand -base64 32
```

### Google OAuth (for sign in with Google)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → APIs & Services → Credentials
3. Create OAuth 2.0 Client ID (Web application)
4. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy Client ID → `GOOGLE_CLIENT_ID` and Client Secret → `GOOGLE_CLIENT_SECRET`

### Google Places API
1. In the same Google Cloud project, enable the **Places API (New)**
2. Create an API Key → restrict to Places API
3. Copy to `GOOGLE_PLACES_API_KEY`

### OpenAI API
1. Visit [platform.openai.com](https://platform.openai.com)
2. Create API key → copy to `OPENAI_API_KEY`

### Stripe
1. Visit [dashboard.stripe.com](https://dashboard.stripe.com)
2. Get Secret Key → `STRIPE_SECRET_KEY`
3. Create a recurring product ($49/month) → copy Price ID → `STRIPE_PRO_PRICE_ID`
4. For webhooks (see below)

### Stripe Webhook (local development)

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli), then:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret → `STRIPE_WEBHOOK_SECRET`

For production, create a webhook in the Stripe Dashboard pointing to `https://yourdomain.com/api/stripe/webhook` and listen for:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### Resend
1. Visit [resend.com](https://resend.com)
2. Create API key → `RESEND_API_KEY`
3. Add and verify your sending domain → `RESEND_FROM_EMAIL`

---

## Deployment

### Vercel + Neon/Supabase PostgreSQL (Recommended)

1. **Database**: Create a free PostgreSQL database at [neon.tech](https://neon.tech) or [supabase.com](https://supabase.com)
2. Copy the connection string → `DATABASE_URL`
3. **Deploy**: Connect your GitHub repo to [Vercel](https://vercel.com)
4. Add all environment variables in Vercel's dashboard
5. Vercel will auto-run `prisma generate` via the `postinstall` script
6. Run migrations: `npx prisma migrate deploy` (one-time, from local or Vercel CLI)
7. Set `NEXTAUTH_URL` to your production URL
8. Set up Stripe webhook pointing to your production URL

### Dockerfile (optional)
The project works with standard Vercel Node.js serverless deployment — no custom Dockerfile needed.

---

## Plan Limits

| Feature | Free | Pro |
|---------|------|-----|
| Saved businesses | 10 | Unlimited |
| AI generations | 5 | Unlimited |
| Proposals | 3 | Unlimited |
| Email delivery | ✓ | ✓ |
| Deals pipeline | ✓ | ✓ |

---

## Project Structure

```
launchgrid-ai/
├── prisma/schema.prisma         # Database models
├── src/
│   ├── app/                     # Next.js App Router pages + API routes
│   │   ├── (auth)/             # Login + Signup pages
│   │   ├── (dashboard)/        # Protected dashboard pages
│   │   ├── p/[publicId]/       # Public proposal view
│   │   └── api/                # API route handlers
│   ├── components/
│   │   ├── ui/                  # shadcn/ui base components
│   │   ├── landing/             # Landing page sections
│   │   ├── dashboard/           # Dashboard layout components
│   │   ├── businesses/          # Business finder + cards
│   │   ├── proposals/           # Proposal builder
│   │   └── deals/               # Deals kanban
│   ├── lib/                     # Utilities, clients, constants
│   └── types/                   # TypeScript type definitions
└── README.md
```
