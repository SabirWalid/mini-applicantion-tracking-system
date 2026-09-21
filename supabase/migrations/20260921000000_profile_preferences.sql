alter table public.profiles
  add column if not exists notifications_in_app boolean not null default true,
  add column if not exists notifications_email boolean not null default true,
  add column if not exists live_activity_enabled boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

drop policy if exists "users can update their profile" on public.profiles;
create policy "users can update their profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.set_profile_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_profile_updated_at();
