# Talentflow ATS

Talentflow is a focused mini applicant-tracking system for a first recruiting team. It ships with a responsive React/Vite frontend, Supabase Auth/database integration, tenant-aware row-level security, and a deployable AI assessment Edge Function.

## Included

- Customer and admin sign-in flow. Admins are identified only by the `admin` role in the database membership.
- New users see the sign-up form first. Sign-in requires a valid Supabase Auth account and a matching workspace membership.
- Admins receive a separate Admin Dashboard entry with workspace metrics and controls for pipeline, jobs, candidates, and team access. Customers never receive that entry.
- Confirmed customer sign-ups appear in the admin dashboard's Access requests queue. An admin can grant customer access; the customer sees an approval notification on their next sign-in.
- Jobs: post and list active recruiting roles.
- Candidates: add profile basics, link a LinkedIn profile, and associate candidates with jobs.
- Candidate CVs can be pasted or uploaded as PDF, DOCX, TXT, Markdown, or RTF; selectable text is extracted in the browser before assessment. Scanned image-only PDFs require OCR.
- Pipeline: compact Applied, Screening, Interview, and Offer Kanban columns.
- Filtering by job and candidate name.
- Move candidates between stages from each card.
- Admin team/access view with protected account invitations for admin and customer roles.
- Supabase migration with organizations, memberships, jobs, candidates, profile trigger, and RLS policies.
- `supabase/functions/assess-candidate` as a secure starting point for CV assessment.
- `supabase/functions/admin-create-user` for admin-only Supabase Auth invitations and workspace membership assignment.

## Local development

Prerequisite: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Before running the app, create a `.env` file in the project root with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Supabase must be configured for sign-up and sign-in. The app does not provide a demo authentication bypass, and an email address can never grant admin access.

## Supabase setup

1. Create a Supabase project and copy the project URL and anon key into `.env`.
	The variable names must be exactly `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; never put a service-role key in the frontend environment.
2. Run `supabase/migrations/20260916000000_initial_schema.sql` in the Supabase SQL editor, or apply it with the Supabase CLI.
3. Create the first user in Supabase Auth, then run the two bootstrap inserts at the bottom of the migration with that user ID and the new organization ID.
4. Install the Supabase CLI, authenticate, and link this folder to your project. Replace `YOUR_PROJECT_REF` with the project reference from the Supabase dashboard URL:
	```powershell
	npx supabase login
	npx supabase link --project-ref YOUR_PROJECT_REF
	```
5. Supabase automatically provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Do not create frontend-style duplicate secrets for them and never expose the service-role key. Configure only the AI provider as an additional Supabase secret:
	```powershell
	npx supabase secrets set OPENAI_API_KEY=your-openai-api-key OPENAI_MODEL=gpt-4o-mini
	```
6. Deploy all functions from the repository root:
	```powershell
	npx supabase functions deploy assess-candidate
	npx supabase functions deploy admin-create-user
	npx supabase functions deploy admin-manage-access
	```
	Inspect the assessment function if it fails:
	```powershell
	npx supabase functions logs assess-candidate
	```
7. New sign-ups create an Auth user and profile, but do not automatically grant workspace access. Add their row to `memberships`, or invite them from Team & access as an admin, before they can sign in.
8. Use the Team & access screen as an admin to invite customer or admin accounts. The function uses the service-role key server-side, verifies the caller's admin membership, and never exposes that key to React.

## Vercel deployment

1. Push this repository to GitHub.
2. Import it into Vercel as a Vite project.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Production and Preview environment variables. These are public client values; never add a service-role key to Vercel.
4. In Supabase Authentication settings, set the Site URL to the production Vercel URL and add both the production URL and Vercel preview URL pattern to Redirect URLs. Configure Google as an Auth provider there if Google sign-in should be available.
5. Deploy. `vercel.json` provides the SPA fallback for direct navigation.

## Product assumptions

- A workspace belongs to one customer organization; users access it through `memberships`.
- Admin means a workspace-level admin for the current organization. Admins can invite accounts into that organization; global cross-organization provisioning is intentionally out of scope.
- Candidate resume uploads are represented by `resume_url`; add a private Supabase Storage bucket and signed URLs before handling real CVs.
- The initial AI assessment is advisory only. Recruiters remain responsible for decisions, and the assessment should never be used as the sole basis for rejecting a candidate.

## Delivery checklist

- [x] React frontend and responsive interaction layer
- [x] Supabase schema, auth integration, and RLS policies
- [x] Vercel configuration and environment template
- [x] AI assessment implementation path and candidate CV text entry
- [x] Admin-only account invitation function
- [ ] Create live Supabase project and add production secrets
- [ ] Push to GitHub and connect Vercel
