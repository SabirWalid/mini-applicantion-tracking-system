# Mini ATS (Applicant Tracking System)

This repository now contains a production-ready **MVP ATS** built to get a first customer live quickly.

## What is implemented

- Admin can create accounts (admin/customer)
- Customer login with Supabase Auth
- Customers can create jobs
- Customers can add candidates (including LinkedIn URL + CV text)
- Compact Kanban board grouped by stage
- Filters by job and candidate name
- Admin can operate on behalf of any customer workspace
- Simple AI CV assessment (keyword match score + summary) on candidate creation

## Stack

- **Frontend / Backend:** Next.js (App Router, Server Actions)
- **Auth + Database:** Supabase
- **Styling:** Tailwind CSS
- **Deployment target:** Vercel

## 1) Environment setup

Create a `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (required for admin account creation)

## 2) Database setup (Supabase)

Run SQL in `supabase/schema.sql` inside Supabase SQL Editor.

This creates:

- `profiles`
- `jobs`
- `candidates`
- RLS policies for admin/customer permissions

## 3) Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## 4) Bootstrapping first admin

Because account creation requires an admin role, create your first admin user once in Supabase:

1. Create a user in Supabase Auth (email/password).
2. Insert/update their row in `profiles` with role `admin`.

Example SQL:

```sql
insert into public.profiles (id, email, role)
values ('<auth_user_id>', 'admin@example.com', 'admin')
on conflict (id) do update set role = 'admin';
```

After this, log in and create customer/admin users from the dashboard UI.

## 5) Deployment

Deploy to Vercel:

1. Import this repository in Vercel.
2. Add the three environment variables.
3. Deploy.

Supabase remains the single backend (Auth + DB).

## AI feature implemented

When adding a candidate, the app computes a lightweight CV relevance score by matching keywords from the selected job description against the pasted CV text and stores:

- `assessment_score` (0-100)
- `assessment_summary`

This provides an immediate first-pass screening signal.

## Delivery checklist mapping

- Repo link: this repository
- Admin login: generated during bootstrap step above
- Demo video + assumptions email: operationally ready from this implementation (record/share externally)

## Assumptions

- Users are created by admins (no public sign-up)
- One candidate belongs to one job
- Kanban stages are fixed: sourced, screening, interview, offer, hired, rejected
