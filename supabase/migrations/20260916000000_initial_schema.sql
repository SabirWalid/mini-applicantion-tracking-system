create type public.app_role as enum ('admin', 'customer');
create type public.candidate_stage as enum ('Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'customer',
  access_granted_at timestamptz,
  access_granted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null default 'customer',
  primary key (organization_id, user_id)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  location text not null default 'Remote',
  description text,
  status text not null default 'Active' check (status in ('Active', 'Paused', 'Closed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  location text,
  linkedin_url text,
  resume_url text,
  stage public.candidate_stage not null default 'Applied',
  ai_score integer check (ai_score between 0 and 100),
  ai_summary text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index jobs_org_idx on public.jobs(organization_id);
create index candidates_org_idx on public.candidates(organization_id);
create index candidates_job_idx on public.candidates(job_id);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs') then
    alter publication supabase_realtime add table public.jobs;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'candidates') then
    alter publication supabase_realtime add table public.candidates;
  end if;
end;
$$;

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where organization_id = target_org and user_id = auth.uid());
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where organization_id = target_org and user_id = auth.uid() and role = 'admin');
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.jobs enable row level security;
alter table public.candidates enable row level security;

create policy "members can read their organizations" on public.organizations for select using (public.is_org_member(id));
create policy "users can read their profile" on public.profiles for select using (id = auth.uid());
create policy "members can read memberships" on public.memberships for select using (public.is_org_member(organization_id));
create policy "admins manage memberships" on public.memberships for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "members manage jobs" on public.jobs for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage candidates" on public.candidates for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Bootstrap the first workspace after creating the first user in Supabase Auth:
-- insert into public.organizations (name) values ('Acme Co.') returning id;
-- insert into public.memberships (organization_id, user_id, role) values ('ORG_UUID', 'AUTH_USER_UUID', 'admin');
