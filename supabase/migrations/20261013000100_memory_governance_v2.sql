-- Canonical screened memory. Browser clients may read their own data, but only
-- the authenticated admission Edge Function may write via its service client.
begin;
create table if not exists public.quanta_memory_banks_v2 (
  id text primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0), value jsonb not null,
  created_at timestamptz not null default now(),
  check (value->>'id' = id and (value->>'owner')::uuid = owner_id),
  check (value->>'scope' in ('private','master')),
  check (value->'policy'->>'sensitiveData' in ('redact','block'))
);
create table if not exists public.quanta_memory_records_v2 (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  bank_id text not null references public.quanta_memory_banks_v2(id),
  version integer not null check (version > 0), value jsonb not null,
  created_at timestamptz not null default now(),
  check ((value->>'id')::uuid = id and (value->>'owner')::uuid = owner_id and value->>'bankId' = bank_id),
  check (value->>'status' in ('active','deleted','superseded')),
  check (value->>'kind' in ('conversation','observation','fact')),
  check (value->>'status' = 'active' or (value->>'text' = '' and value->>'source' = ''))
);
create index if not exists quanta_memory_records_v2_owner_bank on public.quanta_memory_records_v2(owner_id,bank_id,created_at desc);
create table if not exists public.quanta_memory_events_v2 (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  bank_id text not null references public.quanta_memory_banks_v2(id), value jsonb not null,
  created_at timestamptz not null default now(),
  check ((value->>'owner')::uuid = owner_id)
);
create index if not exists quanta_memory_events_v2_owner_bank on public.quanta_memory_events_v2(owner_id,bank_id,created_at desc);
alter table public.quanta_memory_banks_v2 enable row level security;
alter table public.quanta_memory_records_v2 enable row level security;
alter table public.quanta_memory_events_v2 enable row level security;
drop policy if exists memory_owner_read on public.quanta_memory_banks_v2;
create policy memory_owner_read on public.quanta_memory_banks_v2 for select to authenticated using (auth.uid()=owner_id);
drop policy if exists memory_owner_read on public.quanta_memory_records_v2;
create policy memory_owner_read on public.quanta_memory_records_v2 for select to authenticated using (auth.uid()=owner_id);
drop policy if exists memory_owner_read on public.quanta_memory_events_v2;
create policy memory_owner_read on public.quanta_memory_events_v2 for select to authenticated using (auth.uid()=owner_id);
revoke all on public.quanta_memory_banks_v2,public.quanta_memory_records_v2,public.quanta_memory_events_v2 from anon,authenticated;
grant select on public.quanta_memory_banks_v2,public.quanta_memory_records_v2,public.quanta_memory_events_v2 to authenticated;
grant all on public.quanta_memory_banks_v2,public.quanta_memory_records_v2,public.quanta_memory_events_v2 to service_role;

create or replace function public.quanta_memory_commit_v2(p_owner uuid,p_change jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_item jsonb; v_current record; v_bank jsonb; v_id text;
begin
  if p_owner is null or jsonb_array_length(coalesce(p_change->'records','[]'::jsonb)) > 1000 or jsonb_array_length(coalesce(p_change->'events','[]'::jsonb)) > 1000 then raise exception 'Invalid memory change'; end if;
  if p_change ? 'bank' then
    v_item := p_change->'bank'; v_id := v_item->>'id';
    if (v_item->>'owner')::uuid is distinct from p_owner then raise exception 'Invalid bank owner'; end if;
    select * into v_current from public.quanta_memory_banks_v2 where id=v_id for update;
    if found then
      if v_current.owner_id <> p_owner or v_current.version <> (v_item->>'version')::integer-1 then raise exception 'Concurrent policy change' using errcode='40001'; end if;
      update public.quanta_memory_banks_v2 set version=(v_item->>'version')::integer,value=v_item where id=v_id;
    else
      if (v_item->>'version')::integer <> 1 then raise exception 'Invalid bank version'; end if;
      insert into public.quanta_memory_banks_v2(id,owner_id,version,value) values(v_id,p_owner,1,v_item);
    end if;
  end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_change->'records','[]'::jsonb)) loop
    if (v_item->>'owner')::uuid is distinct from p_owner then raise exception 'Invalid record owner'; end if;
    select value into v_bank from public.quanta_memory_banks_v2 where id=v_item->>'bankId' and owner_id=p_owner for update;
    if not found then raise exception 'Invalid record bank'; end if;
    if v_bank->>'scope'='master' and v_item->>'status'='active' and v_item->>'reviewStatus' is distinct from 'human_reviewed' then raise exception 'Master review required'; end if;
    select * into v_current from public.quanta_memory_records_v2 where id=(v_item->>'id')::uuid for update;
    if found then
      if v_current.owner_id<>p_owner or v_current.bank_id<>v_item->>'bankId' or v_current.version<>(v_item->>'version')::integer-1 then raise exception 'Concurrent memory change' using errcode='40001'; end if;
      update public.quanta_memory_records_v2 set version=(v_item->>'version')::integer,value=v_item where id=(v_item->>'id')::uuid;
    else
      if (v_item->>'version')::integer<>1 then raise exception 'Invalid record version'; end if;
      insert into public.quanta_memory_records_v2(id,owner_id,bank_id,version,value) values((v_item->>'id')::uuid,p_owner,v_item->>'bankId',1,v_item);
    end if;
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(p_change->'events','[]'::jsonb)) loop
    if (v_item->>'owner')::uuid is distinct from p_owner or not exists(select 1 from public.quanta_memory_banks_v2 where id=v_item->>'bankId' and owner_id=p_owner) then raise exception 'Invalid audit owner'; end if;
    insert into public.quanta_memory_events_v2(id,owner_id,bank_id,value) values((v_item->>'id')::uuid,p_owner,v_item->>'bankId',v_item);
  end loop;
  return jsonb_build_object('committed',true);
end $$;
revoke all on function public.quanta_memory_commit_v2(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.quanta_memory_commit_v2(uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
