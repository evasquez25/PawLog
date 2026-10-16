-- PawLog Phase 4. Run through the Supabase migration workflow.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);
create index household_members_user_idx on public.household_members(user_id, household_id);
create table public.pets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  species text not null check (char_length(btrim(species)) between 1 and 40),
  photo_url text check (photo_url is null or (char_length(photo_url) <= 2048 and photo_url ~ '^https://')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);
create table public.activity_types (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  icon text not null,
  color text not null,
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (household_id, key), unique (household_id, id)
);
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  pet_id uuid not null,
  activity_type_id uuid not null,
  performed_by uuid not null,
  logged_by uuid not null,
  performed_at timestamptz not null,
  created_at timestamptz not null default now(),
  notes text not null default '' check (char_length(notes) <= 280),
  idempotency_key uuid not null,
  check (performed_at <= created_at),
  foreign key (household_id, pet_id) references public.pets(household_id, id) on delete restrict,
  foreign key (household_id, activity_type_id) references public.activity_types(household_id, id) on delete restrict,
  foreign key (household_id, performed_by) references public.household_members(household_id, user_id) on delete restrict,
  foreign key (household_id, logged_by) references public.household_members(household_id, user_id) on delete restrict,
  unique (logged_by, idempotency_key)
);
create index activity_logs_latest_idx on public.activity_logs(pet_id, activity_type_id, performed_at desc, created_at desc, id desc);
create index activity_logs_household_idx on public.activity_logs(household_id);
create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  redeemed_by uuid references public.profiles(id) on delete restrict,
  redeemed_at timestamptz,
  foreign key (household_id, created_by) references public.household_members(household_id, user_id),
  check (expires_at > created_at),
  check ((redeemed_by is null) = (redeemed_at is null))
);
create index invitations_household_idx on public.household_invitations(household_id);
-- These tables are private operational state; not exposed by the REST API.
create table private.invitation_attempts (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0
);

create function private.is_member(target_household uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.household_members where household_id = target_household and user_id = (select auth.uid())); $$;
create function private.is_admin(target_household uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.household_members where household_id = target_household and user_id = (select auth.uid()) and role = 'admin'); $$;
create function private.shares_household(target_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.household_members me join public.household_members other on other.household_id = me.household_id where me.user_id = (select auth.uid()) and other.user_id = target_user); $$;
revoke all on function private.is_member(uuid), private.is_admin(uuid), private.shares_household(uuid) from public;
grant execute on function private.is_member(uuid), private.is_admin(uuid), private.shares_household(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.pets enable row level security;
alter table public.activity_types enable row level security;
alter table public.activity_logs enable row level security;
alter table public.household_invitations enable row level security;
alter table private.invitation_attempts enable row level security;
-- No direct table writes, including for authenticated clients. Writes use scoped RPCs.
revoke all on public.profiles, public.households, public.household_members, public.pets, public.activity_types, public.activity_logs, public.household_invitations from anon, authenticated;
grant select on public.profiles, public.households, public.household_members, public.pets, public.activity_types, public.activity_logs to authenticated;
create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or private.shares_household(id));
create policy households_read on public.households for select to authenticated using (private.is_member(id));
create policy members_read on public.household_members for select to authenticated using (private.is_member(household_id));
create policy pets_read on public.pets for select to authenticated using (private.is_member(household_id));
create policy types_read on public.activity_types for select to authenticated using (private.is_member(household_id));
create policy logs_read on public.activity_logs for select to authenticated using (private.is_member(household_id));
-- Invitation hashes have no SELECT grants or policies, even for admins.

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
create trigger profile_updated before update on public.profiles for each row execute function private.touch_updated_at();
create trigger household_updated before update on public.households for each row execute function private.touch_updated_at();
create trigger pet_updated before update on public.pets for each row execute function private.touch_updated_at();
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(nullif(left(btrim(new.raw_user_meta_data->>'display_name'),60), ''), 'Pet person'));
  return new;
end; $$;
revoke all on function private.handle_new_user(), private.touch_updated_at() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();
-- Backfill existing Auth users when adding PawLog to a fresh or existing project.
insert into public.profiles(id, display_name)
select id, coalesce(nullif(left(btrim(raw_user_meta_data->>'display_name'),60), ''), 'Pet person') from auth.users
on conflict (id) do nothing;

create function public.create_household(household_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); household uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if household_name is null or char_length(btrim(household_name)) not between 1 and 80 then raise exception 'Invalid household name' using errcode = '22023'; end if;
  insert into public.households(name, created_by) values (btrim(household_name), actor) returning id into household;
  insert into public.household_members(household_id,user_id,role) values(household,actor,'admin');
  insert into public.activity_types(household_id,key,name,icon,color,sort_order) values
    (household,'feeding','Feeding','bone','sage',0),
    (household,'potty','Potty Break','trees','peach',1),
    (household,'walking','Walking','footprints','lavender',2),
    (household,'bathing','Bathing','droplets','blue',3);
  return household;
end; $$;
create function public.update_profile(new_display_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if new_display_name is null or char_length(btrim(new_display_name)) not between 1 and 60 then raise exception 'Invalid display name' using errcode = '22023'; end if;
  update public.profiles set display_name=btrim(new_display_name) where id=auth.uid();
end; $$;
-- Server generates a 32-byte cryptographically random code and hashes it using SHA-256.
-- Only the hash is stored. Plaintext is returned once by the future Express endpoint.
create function public.create_household_invitation(target_household uuid, invitation_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare invitation uuid;
begin
  if not private.is_admin(target_household) then raise exception 'Administrator required' using errcode='42501'; end if;
  if invitation_hash is null or invitation_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid invitation hash' using errcode='22023'; end if;
  insert into public.household_invitations(household_id,code_hash,created_by) values(target_household,invitation_hash,auth.uid()) returning id into invitation;
  return invitation;
end; $$;
-- Return invalid attempts instead of throwing so failed attempts are committed.
create function public.redeem_household_invitation(invitation_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); attempt private.invitation_attempts%rowtype; invitation public.household_invitations%rowtype;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  insert into private.invitation_attempts(user_id) values(actor) on conflict do nothing;
  select * into attempt from private.invitation_attempts where user_id=actor for update;
  if attempt.window_started_at <= now()-interval '15 minutes' then
    update private.invitation_attempts set window_started_at=now(), attempts=0 where user_id=actor;
    attempt.attempts := 0;
  end if;
  if attempt.attempts >= 10 then return jsonb_build_object('error','RATE_LIMITED'); end if;
  update private.invitation_attempts set attempts=attempts+1 where user_id=actor;
  select * into invitation from public.household_invitations where code_hash=invitation_hash for update;
  if not found or invitation.expires_at <= now() or invitation.redeemed_at is not null then return jsonb_build_object('error','INVALID_INVITATION'); end if;
  if private.is_member(invitation.household_id) then return jsonb_build_object('error','ALREADY_MEMBER'); end if;
  insert into public.household_members(household_id,user_id,role) values(invitation.household_id,actor,'member');
  update public.household_invitations set redeemed_by=actor,redeemed_at=now() where id=invitation.id;
  return jsonb_build_object('household_id',invitation.household_id);
end; $$;
revoke all on function public.create_household(text), public.update_profile(text), public.create_household_invitation(uuid,text), public.redeem_household_invitation(text) from public, anon;
grant execute on function public.create_household(text), public.update_profile(text), public.create_household_invitation(uuid,text), public.redeem_household_invitation(text) to authenticated;
