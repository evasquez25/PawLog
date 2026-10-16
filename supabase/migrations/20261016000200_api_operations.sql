-- Phase 5: transactional mutations. Apply after the foundation migration.
alter table public.households add column feeding_warning_minutes integer not null default 15
  check (feeding_warning_minutes between 0 and 1440);

create function public.update_household(target_household uuid, new_name text default null, warning_minutes integer default null)
returns public.households language plpgsql security definer set search_path = '' as $$
declare result public.households;
begin
  if not private.is_admin(target_household) then raise exception 'Administrator required' using errcode='42501'; end if;
  if new_name is null and warning_minutes is null then raise exception 'No changes provided' using errcode='22023'; end if;
  update public.households set name=coalesce(btrim(new_name),name), feeding_warning_minutes=coalesce(warning_minutes,feeding_warning_minutes)
    where id=target_household returning * into result;
  return result;
end; $$;
create function public.create_pet(target_household uuid, pet_name text, pet_species text, pet_photo_url text default null)
returns public.pets language plpgsql security definer set search_path = '' as $$
declare result public.pets;
begin
  if not private.is_admin(target_household) then raise exception 'Administrator required' using errcode='42501'; end if;
  insert into public.pets(household_id,name,species,photo_url) values(target_household,btrim(pet_name),btrim(pet_species),pet_photo_url) returning * into result;
  return result;
end; $$;
create function public.update_pet(target_pet uuid, pet_name text default null, pet_species text default null, pet_photo_url text default null, replace_photo boolean default false)
returns public.pets language plpgsql security definer set search_path = '' as $$
declare result public.pets; household uuid;
begin
  select household_id into household from public.pets where id=target_pet;
  if household is null or not private.is_admin(household) then raise exception 'Administrator required' using errcode='42501'; end if;
  if pet_name is null and pet_species is null and not coalesce(replace_photo,false) then raise exception 'No changes provided' using errcode='22023'; end if;
  update public.pets set name=coalesce(btrim(pet_name),name), species=coalesce(btrim(pet_species),species), photo_url=case when replace_photo then pet_photo_url else photo_url end
    where id=target_pet returning * into result;
  return result;
end; $$;

create function public.log_activity(target_pet uuid, target_type uuid, performer uuid, completed_at timestamptz, request_key uuid, activity_notes text default '', allow_recent boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); household uuid; activity_key text; previous public.activity_logs; latest public.activity_logs; result public.activity_logs; warning_minutes integer;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if target_pet is null or target_type is null or performer is null or request_key is null or completed_at is null or not isfinite(completed_at) then raise exception 'Missing or invalid fields' using errcode='22023'; end if;
  -- Serialize reuse of this actor/key even across different pets.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || ':' || request_key::text, 0));
  select household_id into household from public.pets where id=target_pet;
  if household is null or not private.is_member(household) then raise exception 'Pet unavailable' using errcode='42501'; end if;
  select * into previous from public.activity_logs where logged_by=actor and idempotency_key=request_key;
  if found then
    if previous.pet_id<>target_pet or previous.activity_type_id<>target_type or previous.performed_by<>performer or previous.performed_at<>completed_at or previous.notes is distinct from btrim(coalesce(activity_notes,'')) then
      return jsonb_build_object('error','IDEMPOTENCY_CONFLICT');
    end if;
    return jsonb_build_object('log',to_jsonb(previous),'replayed',true);
  end if;
  -- All new activity inserts for this pet use this lock before the warning check.
  perform 1 from public.pets where id=target_pet for update;
  if not exists(select 1 from public.household_members where household_id=household and user_id=performer) then raise exception 'Invalid performer' using errcode='22023'; end if;
  select key into activity_key from public.activity_types where id=target_type and household_id=household and is_active;
  if not found then raise exception 'Invalid activity type' using errcode='22023'; end if;
  if completed_at > clock_timestamp() then raise exception 'Completion time cannot be in the future' using errcode='22023'; end if;
  if char_length(btrim(coalesce(activity_notes,'')))>280 then raise exception 'Note is too long' using errcode='22023'; end if;
  select feeding_warning_minutes into warning_minutes from public.households where id=household;
  if activity_key='feeding' and warning_minutes>0 and not coalesce(allow_recent,false) then
    select * into latest from public.activity_logs where pet_id=target_pet and activity_type_id=target_type
      and performed_at>=clock_timestamp()-make_interval(mins=>warning_minutes)
      order by performed_at desc,created_at desc,id desc limit 1;
    if found then return jsonb_build_object('error','RECENT_FEEDING','latest',to_jsonb(latest),'warning_minutes',warning_minutes); end if;
  end if;
  insert into public.activity_logs(household_id,pet_id,activity_type_id,performed_by,logged_by,performed_at,created_at,notes,idempotency_key)
    values(household,target_pet,target_type,performer,actor,completed_at,clock_timestamp(),btrim(coalesce(activity_notes,'')),request_key) returning * into result;
  return jsonb_build_object('log',to_jsonb(result),'replayed',false);
end; $$;

-- Only one indexed latest record per active type; no history transfer to the browser.
create function public.latest_activities(target_pet uuid) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare household uuid; result jsonb;
begin
  select household_id into household from public.pets where id=target_pet;
  if household is null or not private.is_member(household) then raise exception 'Pet unavailable' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('activity_type',to_jsonb(t),'latest',l.record) order by t.sort_order,t.id),'[]'::jsonb) into result
  from public.activity_types t left join lateral (
    select to_jsonb(log) || jsonb_build_object('performed_by_name',p.display_name) as record
    from public.activity_logs log join public.profiles p on p.id=log.performed_by
    where log.pet_id=target_pet and log.activity_type_id=t.id
    order by log.performed_at desc,log.created_at desc,log.id desc limit 1
  ) l on true where t.household_id=household and t.is_active;
  return result;
end; $$;
revoke all on function public.update_household(uuid,text,integer), public.create_pet(uuid,text,text,text), public.update_pet(uuid,text,text,text,boolean), public.log_activity(uuid,uuid,uuid,timestamptz,uuid,text,boolean), public.latest_activities(uuid) from public,anon;
grant execute on function public.update_household(uuid,text,integer), public.create_pet(uuid,text,text,text), public.update_pet(uuid,text,text,text,boolean), public.log_activity(uuid,uuid,uuid,timestamptz,uuid,text,boolean), public.latest_activities(uuid) to authenticated;
