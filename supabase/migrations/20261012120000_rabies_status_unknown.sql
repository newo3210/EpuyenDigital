-- Widen animals.rabies_status to include 'unknown' (UX v2 antirrábica "No sé")

alter table public.animals
  drop constraint if exists animals_rabies_status_check;

alter table public.animals
  add constraint animals_rabies_status_check
  check (rabies_status in ('up_to_date', 'pending', 'unknown'));
