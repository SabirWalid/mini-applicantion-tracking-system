# Talentflow ATS

Talentflow is a focused mini applicant-tracking system for a first recruiting team. It ships with a responsive React/Vite frontend, Supabase Auth/database integration, tenant-aware row-level security, and a deployable AI assessment Edge Function.

## Included

- Customer and admin sign-in flow. Admins are identified by the `admin` role in the database; demo mode treats an email beginning with `admin` as an admin.
- Jobs: post and list active recruiting roles.
- Candidates: add profile basics, link a LinkedIn profile, and associate candidates with jobs.
- Pipeline: compact Applied, Screening, Interview, and Offer Kanban columns.
- Filtering by job and candidate name.
- Move candidates between stages from each card.
- Admin team/access view.
- Supabase migration with organizations, memberships, jobs, candidates, profile trigger, and RLS policies.
- `supabase/functions/assess-candidate` as a secure starting point for CV assessment.

## Local development

Prerequisite: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, copy the environment template with:

```powershell
Copy-Item .env.example .env.local
```

Without Supabase environment variables the app runs in demo mode. Use any email/password; prefix the email with `admin` to preview the admin navigation. This mode is intentionally local-only and does not persist data.

## Supabase setup

1. Create a Supabase project and copy the project URL and anon key into `.env.local`.
2. Run `supabase/migrations/20260916000000_initial_schema.sql` in the Supabase SQL editor, or apply it with the Supabase CLI.
3. Create the first user in Supabase Auth, then run the two bootstrap inserts at the bottom of the migration with that user ID and the new organization ID.
4. Create additional users through Supabase Auth. An admin can add their `memberships` row with role `customer` or `admin`.
5. For production, replace the deterministic scorer in `supabase/functions/assess-candidate/index.ts` with an LLM provider call using a Supabase secret. Ask the model for structured JSON containing `score`, `strengths`, `gaps`, and `summary`, validate it, then persist only the structured result on `candidates`.

## Vercel deployment

1. Push this repository to GitHub.
2. Import it into Vercel as a Vite project.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Production and Preview environment variables.
4. Deploy. `vercel.json` provides the SPA fallback for direct navigation.

## Product assumptions

- A workspace belongs to one customer organization; users access it through `memberships`.
- Admin means a workspace-level admin, not a global super-admin. Global account creation can be added through a protected server-side admin function when the first customer needs it.
- Candidate resume uploads are represented by `resume_url`; add a private Supabase Storage bucket and signed URLs before handling real CVs.
- The initial AI assessment is advisory only. Recruiters remain responsible for decisions, and the assessment should never be used as the sole basis for rejecting a candidate.

## Delivery checklist

- [x] React frontend and responsive interaction layer
- [x] Supabase schema, auth integration, and RLS policies
- [x] Vercel configuration and environment template
- [x] AI assessment implementation path
- [ ] Create live Supabase project and add production secrets
- [ ] Push to GitHub and connect Vercel
- [ ] Record a Loom walkthrough after the deployment URL exists
- [ ] Send customer assumptions and access details by email

The last four steps need the owner's GitHub, Supabase, Vercel, Loom, and email accounts; they cannot be completed honestly from this local workspace without credentials.