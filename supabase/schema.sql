-- AreaKey core schema. Run once in Supabase SQL Editor. Test data only.
create schema if not exists private;

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 80),
  postcode text not null check (postcode ~ '^[A-Za-z0-9]{11}$'), -- format check only
  postcode_verified boolean not null default false,             -- only the server-side NIPOST module may set true
  owner_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.houses (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete cascade,
  label text not null check (char_length(label) between 2 and 80),
  postcode text check (postcode ~ '^[A-Za-z0-9]{11}$'),
  postcode_verified boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.house_members (
  house_id uuid not null references public.houses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  primary key (house_id, user_id)
);
create table public.invitations (
  code text primary key default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  house_id uuid not null references public.houses(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  expires_at timestamptz not null default now() + interval '48 hours',
  revoked boolean not null default false
);
create table public.help_requests (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id),
  title text not null check (char_length(title) between 3 and 100),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  created_at timestamptz not null default now()
);

alter table public.areas enable row level security;
alter table public.houses enable row level security;
alter table public.house_members enable row level security;
alter table public.invitations enable row level security;
alter table public.help_requests enable row level security;

-- Helpers live in a private (unexposed) schema to avoid RLS recursion.
create function private.is_house_member(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.house_members where house_id = h and user_id = (select auth.uid()));
$$;
create function private.in_area(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.areas where id = a and owner_id = (select auth.uid()))
      or exists (select 1 from public.house_members m join public.houses h on h.id = m.house_id
                 where m.user_id = (select auth.uid()) and h.area_id = a);
$$;
grant usage on schema private to authenticated;
grant execute on function private.is_house_member(uuid), private.in_area(uuid) to authenticated;
grant select, insert, update, delete on public.areas, public.houses, public.house_members,
  public.invitations, public.help_requests to authenticated;

-- Areas: visible to the owner and to members of houses in the area.
create policy areas_select on public.areas for select to authenticated using (private.in_area(id));
create policy areas_insert on public.areas for insert to authenticated
  with check (owner_id = (select auth.uid()) and postcode_verified = false);

-- Houses: only the area owner registers houses (open question: how other residents add houses).
create policy houses_select on public.houses for select to authenticated using (private.in_area(area_id));
create policy houses_insert on public.houses for insert to authenticated
  with check (created_by = (select auth.uid()) and postcode_verified = false
    and exists (select 1 from public.areas a where a.id = area_id and a.owner_id = (select auth.uid())));

-- Resident lists: members of that house ONLY. Area owners get no access.
create policy members_select on public.house_members for select to authenticated using (private.is_house_member(house_id));
create policy members_insert_creator on public.house_members for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.houses h where h.id = house_id and h.created_by = (select auth.uid())));
create policy members_leave on public.house_members for delete to authenticated using (user_id = (select auth.uid()));

-- Invitations: managed by house members; joining goes through redeem_invitation().
create policy inv_select on public.invitations for select to authenticated using (private.is_house_member(house_id));
create policy inv_insert on public.invitations for insert to authenticated
  with check (created_by = (select auth.uid()) and private.is_house_member(house_id));
create policy inv_revoke on public.invitations for update to authenticated
  using (private.is_house_member(house_id)) with check (private.is_house_member(house_id));

-- Help requests: visible to the neighbourhood; only the author edits.
create policy help_select on public.help_requests for select to authenticated using (private.in_area(area_id));
create policy help_insert on public.help_requests for insert to authenticated
  with check (author_id = (select auth.uid()) and private.in_area(area_id));
create policy help_update on public.help_requests for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

-- Joining: validates code, expiry and revocation. A code proves an invitation, not residence.
create function public.redeem_invitation(p_code text, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_house uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  select house_id into v_house from public.invitations
    where code = upper(trim(p_code)) and not revoked and expires_at > now();
  if v_house is null then raise exception 'Invalid or expired code'; end if;
  insert into public.house_members (house_id, user_id, display_name)
    values (v_house, v_uid, left(trim(p_name), 60)) on conflict do nothing;
  return v_house;
end $$;
revoke execute on function public.redeem_invitation(text, text) from public, anon;
grant execute on function public.redeem_invitation(text, text) to authenticated;
