create table if not exists public.test_access_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  contact_email text not null check (
    char_length(contact_email) <= 254
    and position('@' in contact_email) > 1
    and contact_email = lower(btrim(contact_email))
  ),
  consented_at timestamptz not null default now()
);

alter table public.test_access_contacts enable row level security;
revoke all on table public.test_access_contacts from anon, authenticated;
grant insert on table public.test_access_contacts to authenticated;

drop policy if exists "test guests can submit their own contact email"
  on public.test_access_contacts;

create policy "test guests can submit their own contact email"
  on public.test_access_contacts
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select auth.jwt() ->> 'is_anonymous') = 'true'
  );
