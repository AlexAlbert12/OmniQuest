-- Configurable haptics, reusable avatar cosmetics and safe public cosmetics lookup.

alter table public.user_preferences
  add column if not exists haptics_enabled boolean not null default true;

create table if not exists public.avatar_frames (
  frame_key text primary key,
  name text not null,
  description text,
  primary_color text not null,
  secondary_color text not null,
  rarity text not null default 'common'
    check (rarity in ('common', 'rare', 'epic', 'legendary')),
  minimum_level integer not null default 1 check (minimum_level >= 1),
  required_badge_id text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_cosmetics (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  equipped_frame_key text references public.avatar_frames(frame_key) on delete set null,
  featured_badge_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profile_cosmetics_frame_idx
  on public.profile_cosmetics(equipped_frame_key);

insert into public.avatar_frames (
  frame_key,
  name,
  description,
  primary_color,
  secondary_color,
  rarity,
  minimum_level,
  required_badge_id,
  sort_order,
  is_active
)
values
  ('explorer', 'Explorador', 'El marco inicial de todo aventurero de OmniQuest.', '#58B5FF', '#7C5CFF', 'common', 1, null, 10, true),
  ('nebula', 'Nebulosa', 'Una estela violeta para quienes ya dominan sus primeras misiones.', '#8B5CF6', '#EC4899', 'rare', 5, null, 20, true),
  ('aurora', 'Aurora', 'Colores vivos para estudiantes constantes y curiosos.', '#34D399', '#38BDF8', 'rare', 10, null, 30, true),
  ('stellar', 'Estelar', 'Un marco dorado reservado para quienes siguen progresando.', '#FBBF24', '#F97316', 'epic', 15, null, 40, true),
  ('legend', 'Leyenda', 'El marco más brillante para las leyendas de OmniQuest.', '#FDE68A', '#A78BFA', 'legendary', 20, null, 50, true),
  ('streak', 'Racha semanal', 'Demuestra que has mantenido una semana de práctica.', '#F97316', '#FB7185', 'epic', 1, 'streak-7', 60, true),
  ('precision', 'Precisión brillante', 'Desbloqueado al conseguir el logro de precisión.', '#34D399', '#A7F3D0', 'epic', 1, 'accuracy-80', 70, true),
  ('xp-master', 'Maestro de XP', 'Para quienes han convertido la práctica en experiencia.', '#FBBF24', '#8B5CF6', 'legendary', 1, 'xp-2000', 80, true)
on conflict (frame_key) do update
set
  name = excluded.name,
  description = excluded.description,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  rarity = excluded.rarity,
  minimum_level = excluded.minimum_level,
  required_badge_id = excluded.required_badge_id,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

alter table public.avatar_frames enable row level security;
alter table public.profile_cosmetics enable row level security;

revoke all on public.avatar_frames from anon;
revoke all on public.profile_cosmetics from anon, authenticated;
grant select on public.avatar_frames to authenticated;
grant select on public.profile_cosmetics to authenticated;

drop policy if exists "avatar_frames_authenticated_read" on public.avatar_frames;
create policy "avatar_frames_authenticated_read"
on public.avatar_frames for select to authenticated
using (is_active = true);

drop policy if exists "profile_cosmetics_read_own" on public.profile_cosmetics;
create policy "profile_cosmetics_read_own"
on public.profile_cosmetics for select to authenticated
using (user_id = auth.uid());

create or replace function public.get_profile_cosmetics(p_user_ids uuid[] default null)
returns table (
  user_id uuid,
  frame_key text,
  name text,
  description text,
  primary_color text,
  secondary_color text,
  rarity text,
  minimum_level integer,
  required_badge_id text,
  featured_badge_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_requested_ids uuid[];
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_requested_ids := case
    when p_user_ids is null or cardinality(p_user_ids) = 0 then array[v_user_id]
    else p_user_ids
  end;

  return query
  select
    p.id,
    coalesce(pc.equipped_frame_key, 'explorer') as frame_key,
    af.name,
    af.description,
    af.primary_color,
    af.secondary_color,
    af.rarity,
    af.minimum_level,
    af.required_badge_id,
    pc.featured_badge_id
  from public.profiles p
  left join public.profile_cosmetics pc on pc.user_id = p.id
  join public.avatar_frames af
    on af.frame_key = coalesce(pc.equipped_frame_key, 'explorer')
   and af.is_active = true
  where p.id = any(v_requested_ids)
    and (
      p.id = v_user_id
      or coalesce(p.visibility, 'private') = 'public'
      or public.is_admin()
      or exists (
        select 1
        from public.subjects s
        join public.enrollments e on e.subject_id = s.id
        where s.teacher_id = v_user_id
          and e.student_id = p.id
      )
    );
end;
$$;

create or replace function public.get_avatar_customization_options()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_points integer := 0;
  v_level integer := 1;
  v_frames jsonb := '[]'::jsonb;
  v_badges jsonb := '[]'::jsonb;
  v_cosmetics jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(points, 0)
  into v_points
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  v_level := floor(greatest(v_points, 0) / 100.0)::integer + 1;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'frame_key', af.frame_key,
      'name', af.name,
      'description', af.description,
      'primary_color', af.primary_color,
      'secondary_color', af.secondary_color,
      'rarity', af.rarity,
      'minimum_level', af.minimum_level,
      'required_badge_id', af.required_badge_id,
      'unlocked', (
        v_level >= af.minimum_level
        and (
          af.required_badge_id is null
          or exists (
            select 1
            from public.student_badges sb
            where sb.student_id = v_user_id
              and sb.badge_id = af.required_badge_id
          )
        )
      ),
      'locked_reason', case
        when v_level < af.minimum_level then format('Alcanza el nivel %s', af.minimum_level)
        when af.required_badge_id is not null and not exists (
          select 1
          from public.student_badges sb
          where sb.student_id = v_user_id
            and sb.badge_id = af.required_badge_id
        ) then 'Desbloquea el logro requerido'
        else null
      end
    ) order by af.sort_order, af.frame_key
  ), '[]'::jsonb)
  into v_frames
  from public.avatar_frames af
  where af.is_active = true;

  select coalesce(jsonb_agg(sb.badge_id order by sb.awarded_at desc), '[]'::jsonb)
  into v_badges
  from public.student_badges sb
  where sb.student_id = v_user_id;

  select jsonb_build_object(
    'user_id', v_user_id,
    'frame_key', coalesce(pc.equipped_frame_key, 'explorer'),
    'name', af.name,
    'description', af.description,
    'primary_color', af.primary_color,
    'secondary_color', af.secondary_color,
    'rarity', af.rarity,
    'minimum_level', af.minimum_level,
    'required_badge_id', af.required_badge_id,
    'featured_badge_id', pc.featured_badge_id
  )
  into v_cosmetics
  from public.avatar_frames af
  left join public.profile_cosmetics pc
    on pc.user_id = v_user_id
   and af.frame_key = coalesce(pc.equipped_frame_key, 'explorer')
  where af.frame_key = coalesce(
    (select equipped_frame_key from public.profile_cosmetics where user_id = v_user_id),
    'explorer'
  )
    and af.is_active = true
  limit 1;

  return jsonb_build_object(
    'level', v_level,
    'frames', v_frames,
    'awarded_badge_ids', v_badges,
    'cosmetics', coalesce(v_cosmetics, '{}'::jsonb)
  );
end;
$$;

create or replace function public.equip_profile_cosmetics(
  p_frame_key text default null,
  p_featured_badge_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_frame_key text := coalesce(nullif(trim(p_frame_key), ''), 'explorer');
  v_points integer := 0;
  v_level integer := 1;
  v_frame public.avatar_frames%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(points, 0)
  into v_points
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  v_level := floor(greatest(v_points, 0) / 100.0)::integer + 1;

  select *
  into v_frame
  from public.avatar_frames
  where frame_key = v_frame_key
    and is_active = true;

  if not found then
    raise exception 'Frame not found';
  end if;

  if v_level < v_frame.minimum_level then
    raise exception 'Frame is locked until level %', v_frame.minimum_level;
  end if;

  if v_frame.required_badge_id is not null
     and not exists (
       select 1
       from public.student_badges sb
       where sb.student_id = v_user_id
         and sb.badge_id = v_frame.required_badge_id
     ) then
    raise exception 'Required badge is not unlocked';
  end if;

  if p_featured_badge_id is not null
     and not exists (
       select 1
       from public.student_badges sb
       where sb.student_id = v_user_id
         and sb.badge_id = p_featured_badge_id
     ) then
    raise exception 'Featured badge is not unlocked';
  end if;

  insert into public.profile_cosmetics (
    user_id,
    equipped_frame_key,
    featured_badge_id,
    updated_at
  ) values (
    v_user_id,
    v_frame.frame_key,
    p_featured_badge_id,
    now()
  )
  on conflict (user_id) do update
  set
    equipped_frame_key = excluded.equipped_frame_key,
    featured_badge_id = excluded.featured_badge_id,
    updated_at = now();

  return jsonb_build_object(
    'user_id', v_user_id,
    'frame_key', v_frame.frame_key,
    'name', v_frame.name,
    'description', v_frame.description,
    'primary_color', v_frame.primary_color,
    'secondary_color', v_frame.secondary_color,
    'rarity', v_frame.rarity,
    'minimum_level', v_frame.minimum_level,
    'required_badge_id', v_frame.required_badge_id,
    'featured_badge_id', p_featured_badge_id
  );
end;
$$;

revoke all on function public.get_profile_cosmetics(uuid[]) from public, anon;
revoke all on function public.get_avatar_customization_options() from public, anon;
revoke all on function public.equip_profile_cosmetics(text, text) from public, anon;
grant execute on function public.get_profile_cosmetics(uuid[]) to authenticated;
grant execute on function public.get_avatar_customization_options() to authenticated;
grant execute on function public.equip_profile_cosmetics(text, text) to authenticated;

notify pgrst, 'reload schema';
