-- =====================================================================
-- Update 11: Merker „Einführung gesehen" im Profil (statt nur im Gerät).
-- Im Supabase SQL Editor ausführen. Kann gefahrlos mehrfach laufen.
-- =====================================================================

alter table public.profiles add column if not exists intro_seen_at timestamptz;

-- Bestehende Nutzer, die schon bewertet haben, sehen die Einführung nicht automatisch
update public.profiles p set intro_seen_at = now()
where p.intro_seen_at is null
  and exists (select 1 from public.ratings r where r.user_id = p.id);

-- Einführung als gesehen markieren (nur das eigene Profil, nur diese Spalte)
create or replace function public.mark_intro_seen()
returns void
language sql security definer set search_path = ''
as $$
  update public.profiles set intro_seen_at = coalesce(intro_seen_at, now()) where id = auth.uid()
$$;
grant execute on function public.mark_intro_seen() to authenticated;

select count(*) filter (where intro_seen_at is not null) as schon_gesehen,
       count(*) filter (where intro_seen_at is null) as sehen_einfuehrung
from public.profiles;
