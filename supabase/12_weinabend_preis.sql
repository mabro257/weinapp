-- =====================================================================
-- Update 7: Weinabend mit Teilnehmerauswahl und verdeckten Weinen, Preisklasse nachtragen.
-- Im Supabase SQL Editor ausführen, NACH 11. Kann gefahrlos mehrfach laufen.
-- Hinweis: Meldet Supabase „table without RLS", „Run and enable RLS" wählen.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Teilnehmer: Der Gastgeber wählt, wer aus der Gruppe dabei ist.
--    Ohne Einträge (ältere Abende) ist die ganze Gruppe dabei.
-- ---------------------------------------------------------------------
create table if not exists public.tasting_participants (
  tasting_id bigint not null references public.tastings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (tasting_id, user_id)
);
alter table public.tasting_participants enable row level security;

create or replace function public.is_tasting_participant(p_tasting bigint, p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tastings t
    join public.group_members gm on gm.group_id = t.group_id and gm.user_id = p_user
    where t.id = p_tasting
      and (t.host = p_user
           or exists (select 1 from public.tasting_participants p where p.tasting_id = t.id and p.user_id = p_user)
           or not exists (select 1 from public.tasting_participants p where p.tasting_id = t.id)))
$$;

drop policy if exists "Teilnehmer lesen" on public.tasting_participants;
create policy "Teilnehmer lesen" on public.tasting_participants for select to authenticated
  using (public.is_tasting_participant(tasting_id));
grant select on public.tasting_participants to authenticated;

-- Teilnehmer festlegen (nur Gastgeber; nur Gruppenmitglieder; der Gastgeber ist immer dabei)
create or replace function public.set_tasting_participants(p_tasting bigint, p_users uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  t public.tastings;
begin
  select * into t from public.tastings where id = p_tasting;
  if t.id is null or t.host is distinct from auth.uid() then
    raise exception 'Nur der Gastgeber kann die Teilnehmer festlegen';
  end if;
  delete from public.tasting_participants where tasting_id = p_tasting;
  insert into public.tasting_participants (tasting_id, user_id)
  select p_tasting, gm.user_id from public.group_members gm
  where gm.group_id = t.group_id and (gm.user_id = any (p_users) or gm.user_id = t.host)
  on conflict do nothing;
end $$;
grant execute on function public.set_tasting_participants(bigint, uuid[]) to authenticated;

-- Weinabende sehen nur Gastgeber und Teilnehmer
drop policy if exists "Weinabende lesen" on public.tastings;
create policy "Weinabende lesen" on public.tastings for select to authenticated
  using (host = auth.uid() or (group_id in (select public.my_group_ids()) and public.is_tasting_participant(id)));

-- Fortschritt nur für Teilnehmer
create or replace function public.tasting_progress(p_tasting bigint)
returns table (user_id uuid, display_name text, rated int)
language sql stable security definer set search_path = ''
as $$
  select gm.user_id, p.display_name,
         (select count(distinct r.wine_id)::int from public.ratings r
           where r.tasting_id = p_tasting and r.user_id = gm.user_id)
  from public.tastings t
  join public.group_members gm on gm.group_id = t.group_id
  join public.profiles p on p.id = gm.user_id
  where t.id = p_tasting
    and public.is_tasting_participant(t.id)
    and public.is_tasting_participant(t.id, gm.user_id)
  order by p.display_name
$$;

-- ---------------------------------------------------------------------
-- 2. Weine verdeckt: Der Gastgeber schaltet sie einzeln sichtbar.
--    Bestehende Weine bleiben sichtbar; nach dem Aufdecken sind alle sichtbar.
-- ---------------------------------------------------------------------
alter table public.tasting_wines add column if not exists visible boolean not null default true;
alter table public.tasting_wines alter column visible set default false;

drop policy if exists "Weine des Abends lesen" on public.tasting_wines;
create policy "Weine des Abends lesen" on public.tasting_wines for select to authenticated
  using (exists (
    select 1 from public.tastings t
    where t.id = tasting_id
      and (t.host = auth.uid()
           or (public.is_tasting_participant(t.id) and (visible or t.status <> 'offen')))));

-- Bewertungen zu einem Weinabend nur von Teilnehmern, für sichtbare Weine, solange der Abend läuft
drop policy if exists "Bewertung im Weinabend" on public.ratings;
create policy "Bewertung im Weinabend" on public.ratings as restrictive for insert to authenticated
  with check (
    tasting_id is null
    or (public.is_tasting_participant(tasting_id)
        and public.tasting_is_open(tasting_id)
        and exists (select 1 from public.tasting_wines tw
                    join public.tastings t on t.id = tw.tasting_id
                    where tw.tasting_id = ratings.tasting_id and tw.wine_id = ratings.wine_id
                      and (tw.visible or t.host = auth.uid()))));

-- ---------------------------------------------------------------------
-- 3. Preisklasse nachtragen: jeder, solange noch keine hinterlegt ist;
--    ändern dürfen Admin und Ersteller (ungeprüft).
--    1 = bis 5 €, 2 = bis 10 €, 3 = bis 15 €, 4 = über 15 €
-- ---------------------------------------------------------------------
create or replace function public.set_wine_price(p_wine bigint, p_class smallint)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if p_class is not null and p_class not between 1 and 4 then raise exception 'Ungültige Preisklasse'; end if;
  update public.wines w set price_class = p_class
  where w.id = p_wine
    and (w.price_class is null or public.is_admin() or (w.created_by = auth.uid() and w.status = 'offen'));
  if not found then raise exception 'Die Preisklasse ist schon hinterlegt'; end if;
end $$;
grant execute on function public.set_wine_price(bigint, smallint) to authenticated;
