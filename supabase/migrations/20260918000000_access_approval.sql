alter table public.profiles
  add column if not exists access_granted_at timestamptz,
  add column if not exists access_granted_by uuid references auth.users(id),
  add column if not exists timezone text not null default 'UTC',
  add column if not exists language text not null default 'English';
