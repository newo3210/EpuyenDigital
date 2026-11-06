-- Behavioral SQL proof for areas_guard_default promote/swap (7.1).
-- Run against a DB after applying 20261106120000_areas_operators_admin.sql
-- (e.g. `supabase db reset` or psql). Not executed in CI here: Docker/Podman
-- unavailable in the cloud agent environment (2026-11-06).
--
-- Expected: Mesa ↔ Inspectoría promote succeeds; clearing the sole default fails.

begin;

-- Isolate fixtures (adjust org id if seed already created Mesa/Inspectoría).
do $$
declare
  v_org uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_mesa uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  v_insp uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
begin
  insert into public.organizations (id, name, slug)
  values (v_org, 'Proof Org', 'proof-org-default-swap')
  on conflict (id) do nothing;

  delete from public.areas where org_id = v_org;

  insert into public.areas (id, org_id, name, is_default, is_active, color)
  values
    (v_mesa, v_org, 'Mesa de Entrada', true, true, '#1B4F72'),
    (v_insp, v_org, 'Inspectoría', false, true, '#2E86AB');

  -- Promote Inspectoría → should clear Mesa without org_requires_default_area.
  update public.areas set is_default = true where id = v_insp;

  if (select count(*) from public.areas where org_id = v_org and is_default) <> 1 then
    raise exception 'PROOF_FAIL: expected exactly one default after promote Inspectoría';
  end if;
  if not (select is_default from public.areas where id = v_insp) then
    raise exception 'PROOF_FAIL: Inspectoría should be default';
  end if;

  -- Promote Mesa again.
  update public.areas set is_default = true where id = v_mesa;

  if not (select is_default from public.areas where id = v_mesa) then
    raise exception 'PROOF_FAIL: Mesa should be default after second promote';
  end if;

  -- Clearing the sole default must fail.
  begin
    update public.areas set is_default = false where id = v_mesa;
    raise exception 'PROOF_FAIL: clearing sole default should have raised';
  exception
    when raise_exception then
      if sqlerrm not like '%org_requires_default_area%' then
        raise;
      end if;
  end;

  raise notice 'PROOF_OK: default area promote/swap + sole-clear rejection';
end $$;

rollback;
