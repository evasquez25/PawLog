-- LOCAL DEVELOPMENT ONLY. These fixture users deliberately have no password
-- or login identity. Sign up through PawLog to test an actual Auth session.
insert into auth.users(id, raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001', '{"display_name":"Eric (fixture)"}'),
 ('10000000-0000-4000-8000-000000000002', '{"display_name":"Sarah (fixture)"}')
on conflict (id) do nothing;
do $$
declare household uuid; pet uuid; feeding uuid;
begin
  if exists(select 1 from public.households where created_by='10000000-0000-4000-8000-000000000001') then return; end if;
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
  household := public.create_household('Local sample household');
  insert into public.household_members(household_id,user_id) values(household,'10000000-0000-4000-8000-000000000002');
  insert into public.pets(household_id,name,species) values(household,'Max','Dog') returning id into pet;
  select id into feeding from public.activity_types where household_id=household and key='feeding';
  insert into public.activity_logs(household_id,pet_id,activity_type_id,performed_by,logged_by,performed_at,notes,idempotency_key)
  values(household,pet,feeding,'10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',now()-interval '2 hours','Local development sample',gen_random_uuid());
end; $$;
