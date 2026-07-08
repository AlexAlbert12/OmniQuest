create or replace function public.create_notification(
  p_user_id uuid,
  p_audience text,
  p_type text,
  p_title text,
  p_description text,
  p_icon text default 'notifications-outline',
  p_color text default '#8B5CF6',
  p_action_url text default null,
  p_related_table text default null,
  p_related_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_fingerprint text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_fingerprint text;
  v_activity_enabled boolean := true;
  v_news_enabled boolean := false;
  v_preference_category text;
  v_is_activity_notification boolean := false;
  v_is_news_notification boolean := false;
begin
  if p_user_id is null then
    return null;
  end if;

  select
    coalesce(activity_enabled, true),
    coalesce(news_enabled, false)
  into v_activity_enabled, v_news_enabled
  from public.user_notification_preferences
  where user_id = p_user_id;

  v_activity_enabled := coalesce(v_activity_enabled, true);
  v_news_enabled := coalesce(v_news_enabled, false);
  v_preference_category := lower(coalesce(p_metadata->>'preference_category', ''));

  v_is_activity_notification :=
    v_preference_category = 'activity'
    or p_type in ('enrollment', 'student_activity', 'achievement', 'new_class')
    or (
      p_type = 'announcement'
      and coalesce(p_related_table, '') in ('questions', 'attempt_history', 'enrollments', 'student_badges', 'subject_scores', 'topic_scores')
    );

  v_is_news_notification :=
    v_preference_category = 'news'
    or (
      p_type = 'announcement'
      and not v_is_activity_notification
      and v_preference_category <> 'system'
    );

  if v_is_activity_notification and not v_activity_enabled then
    return null;
  end if;

  if v_is_news_notification and not v_news_enabled then
    return null;
  end if;

  v_fingerprint := coalesce(
    p_fingerprint,
    concat_ws(':', p_audience, p_type, coalesce(p_related_table, 'general'), coalesce(p_related_id, md5(p_title || p_description)))
  );

  insert into public.notifications (
    user_id,
    audience,
    type,
    title,
    description,
    icon,
    color,
    action_url,
    related_table,
    related_id,
    fingerprint,
    metadata
  ) values (
    p_user_id,
    p_audience,
    p_type,
    p_title,
    p_description,
    coalesce(p_icon, 'notifications-outline'),
    coalesce(p_color, '#8B5CF6'),
    p_action_url,
    p_related_table,
    p_related_id,
    v_fingerprint,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, fingerprint) do update
  set
    title = excluded.title,
    description = excluded.description,
    icon = excluded.icon,
    color = excluded.color,
    action_url = excluded.action_url,
    related_table = excluded.related_table,
    related_id = excluded.related_id,
    metadata = excluded.metadata,
    deleted_at = null,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_notification(uuid, text, text, text, text, text, text, text, text, text, jsonb, text) to authenticated;
