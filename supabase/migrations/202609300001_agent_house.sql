-- One private, operator-owned workspace. Agent KB scope is selected before harness invocation.
create table if not exists public.agent_house_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 1500000),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.agent_house_workspaces enable row level security;
revoke all on public.agent_house_workspaces from anon;
grant select, insert, update, delete on public.agent_house_workspaces to authenticated;
create policy "Owners read their house" on public.agent_house_workspaces for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners create their house" on public.agent_house_workspaces for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Owners update their house" on public.agent_house_workspaces for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners delete their house" on public.agent_house_workspaces for delete to authenticated using ((select auth.uid()) = owner_id);
