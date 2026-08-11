-- Teacher settings refinement: one source of truth for teacher notifications,
-- truthful alert switches, account-export minimization and support-channel separation.

-- Legacy generic teacher notification toggles are no longer user-facing. Keep them
-- permissive so they cannot silently override the teacher-specific preferences below.
update public.user_notification_preferences np
set activity_enabled = true,
    news_enabled = true,
    daily_summary_enabled = false,
    updated_at = now()
where exists (
  select 1 from public.profiles p
  where p.id = np.user_id and p.role_id = 'teacher'
);

create or replace function public.get_teacher_notification_settings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_result jsonb;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = v_teacher_id
      and p.role_id = 'teacher'
      and coalesce(p.active, true)
  ) then
    raise exception 'Active teacher profile required';
  end if;

  insert into public.user_notification_preferences(user_id)
  values (v_teacher_id)
  on conflict (user_id) do nothing;

  select jsonb_build_object(
    'global', jsonb_build_object(
      'push_enabled', np.push_enabled,
      'inactive_student_alerts', np.teacher_inactive_student_alerts,
      'open_review_alerts', np.teacher_open_review_alerts,
      'audit_alerts', np.teacher_sensitive_action_alerts,
      'muted_until', np.teacher_notifications_muted_until,
      'digest_frequency', np.teacher_digest_frequency,
      'digest_hour', np.teacher_digest_hour,
      'digest_weekday', np.teacher_digest_weekday,
      'last_digest_sent_at', np.teacher_digest_last_sent_at,
      'reminder_email', np.teacher_reminder_email,
      'support_preferred_channel', np.support_preferred_channel,
      'support_contact_email', np.support_contact_email
    ),
    'courses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'subject_id', s.id,
          'subject_name', s.name,
          'critical_enabled', coalesce(preference.critical_enabled, true),
          'informative_enabled', coalesce(preference.informative_enabled, true),
          'digest_enabled', coalesce(preference.digest_enabled, true),
          'muted_until', preference.muted_until
        ) order by s.name, s.id
      )
      from public.subjects s
      left join public.teacher_notification_course_preferences preference
        on preference.teacher_id = v_teacher_id
       and preference.subject_id = s.id
      where s.teacher_id = v_teacher_id
        and not coalesce(s.is_archived, false)
    ), '[]'::jsonb),
    'digest_history', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', history.id,
          'frequency', history.frequency,
          'status', history.status,
          'period_start', history.period_start,
          'period_end', history.period_end,
          'sent_at', history.sent_at,
          'recipient_email', history.recipient_email,
          'last_error_message', history.last_error_message
        ) order by history.created_at desc, history.id desc
      )
      from (
        select delivery.*
        from public.teacher_digest_deliveries delivery
        where delivery.teacher_id = v_teacher_id
        order by delivery.created_at desc, delivery.id desc
        limit 10
      ) history
    ), '[]'::jsonb)
  )
  into v_result
  from public.user_notification_preferences np
  where np.user_id = v_teacher_id;

  return v_result;
end;
$$;

create or replace function public.set_teacher_notification_preferences(
  p_push_enabled boolean,
  p_inactive_student_alerts boolean,
  p_open_review_alerts boolean,
  p_sensitive_action_alerts boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = v_teacher_id
      and p.role_id = 'teacher'
      and coalesce(p.active, true)
  ) then
    raise exception 'Active teacher profile required';
  end if;

  insert into public.user_notification_preferences(
    user_id,
    push_enabled,
    activity_enabled,
    news_enabled,
    daily_summary_enabled,
    teacher_inactive_student_alerts,
    teacher_open_review_alerts,
    teacher_sensitive_action_alerts
  ) values (
    v_teacher_id,
    coalesce(p_push_enabled, false),
    true,
    true,
    false,
    coalesce(p_inactive_student_alerts, true),
    coalesce(p_open_review_alerts, true),
    coalesce(p_sensitive_action_alerts, true)
  )
  on conflict (user_id) do update
  set push_enabled = excluded.push_enabled,
      activity_enabled = true,
      news_enabled = true,
      daily_summary_enabled = false,
      teacher_inactive_student_alerts = excluded.teacher_inactive_student_alerts,
      teacher_open_review_alerts = excluded.teacher_open_review_alerts,
      teacher_sensitive_action_alerts = excluded.teacher_sensitive_action_alerts,
      updated_at = now();

  return public.get_teacher_notification_settings();
end;
$$;

create or replace function public.set_teacher_digest_preference(
  p_frequency text,
  p_recipient_email text default null,
  p_hour smallint default 7,
  p_weekday smallint default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_frequency text := lower(trim(coalesce(p_frequency, 'off')));
  v_email text := nullif(lower(trim(coalesce(p_recipient_email, ''))), '');
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = v_teacher_id
      and p.role_id = 'teacher'
      and coalesce(p.active, true)
  ) then
    raise exception 'Active teacher profile required';
  end if;
  if v_frequency not in ('off', 'daily', 'weekly') then
    raise exception 'Unsupported digest frequency';
  end if;
  if p_hour not between 0 and 23 then
    raise exception 'Digest hour must be between 0 and 23';
  end if;
  if p_weekday not between 1 and 7 then
    raise exception 'Digest weekday must be between 1 and 7';
  end if;
  if v_email is not null and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid digest email';
  end if;

  insert into public.user_notification_preferences(
    user_id,
    email_enabled,
    teacher_digest_frequency,
    teacher_reminder_email,
    teacher_digest_hour,
    teacher_digest_weekday,
    teacher_digest_unsubscribed_at
  ) values (
    v_teacher_id,
    v_frequency <> 'off',
    v_frequency,
    v_email,
    p_hour,
    p_weekday,
    case when v_frequency = 'off' then now() else null end
  )
  on conflict (user_id) do update
  set email_enabled = (v_frequency <> 'off'),
      teacher_digest_frequency = v_frequency,
      teacher_reminder_email = coalesce(v_email, user_notification_preferences.teacher_reminder_email),
      teacher_digest_hour = p_hour,
      teacher_digest_weekday = p_weekday,
      teacher_digest_unsubscribed_at = case when v_frequency = 'off' then now() else null end,
      updated_at = now();

  return public.get_teacher_notification_settings();
end;
$$;

create or replace function public.apply_teacher_notification_delivery_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_severity text;
  v_category text;
  v_preference_key text;
  v_subject_id bigint;
  v_global_muted_until timestamptz;
  v_inactive_student_alerts boolean := true;
  v_open_review_alerts boolean := true;
  v_audit_alerts boolean := true;
  v_course_preference public.teacher_notification_course_preferences%rowtype;
  v_push_suppressed boolean := false;
  v_suppression_reason text := null;
begin
  if new.audience <> 'teacher' then
    return new;
  end if;

  v_severity := public.teacher_notification_severity(new.type, new.title, new.metadata);
  v_category := public.teacher_notification_category(new.type, new.title, new.action_url, new.metadata);
  v_preference_key := lower(coalesce(new.metadata ->> 'preference_key', new.metadata ->> 'teacher_preference', ''));
  v_subject_id := public.teacher_notification_subject_id(new.metadata);

  select
    np.teacher_notifications_muted_until,
    coalesce(np.teacher_inactive_student_alerts, true),
    coalesce(np.teacher_open_review_alerts, true),
    coalesce(np.teacher_sensitive_action_alerts, true)
  into
    v_global_muted_until,
    v_inactive_student_alerts,
    v_open_review_alerts,
    v_audit_alerts
  from public.user_notification_preferences np
  where np.user_id = new.user_id;

  if not v_open_review_alerts
     and (v_category = 'review' or v_preference_key in ('open_reviews', 'manual_reviews')) then
    return null;
  end if;

  if not v_audit_alerts
     and (v_category = 'audit' or v_preference_key in ('sensitive_actions', 'audit')) then
    return null;
  end if;

  if not v_inactive_student_alerts
     and (
       v_preference_key in ('inactive_students', 'student_inactivity')
       or lower(coalesce(new.title, '')) like '%sin actividad%'
       or lower(coalesce(new.title, '')) like '%inactividad%'
     ) then
    return null;
  end if;

  if v_severity = 'informative' and v_global_muted_until > now() then
    v_push_suppressed := true;
    v_suppression_reason := 'teacher_temporarily_muted';
  end if;

  if v_subject_id is not null then
    select *
    into v_course_preference
    from public.teacher_notification_course_preferences preference
    where preference.teacher_id = new.user_id
      and preference.subject_id = v_subject_id;

    if found then
      if v_severity = 'critical' and not v_course_preference.critical_enabled then
        v_push_suppressed := true;
        v_suppression_reason := 'course_critical_disabled';
      elsif v_severity = 'informative' and not v_course_preference.informative_enabled then
        v_push_suppressed := true;
        v_suppression_reason := 'course_informative_disabled';
      elsif v_severity = 'informative' and v_course_preference.muted_until > now() then
        v_push_suppressed := true;
        v_suppression_reason := 'course_temporarily_muted';
      end if;
    end if;
  end if;

  new.metadata := coalesce(new.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'severity', v_severity,
      'category', v_category,
      'push_suppressed', v_push_suppressed,
      'push_suppression_reason', v_suppression_reason
    );
  return new;
end;
$$;

comment on column public.user_notification_preferences.teacher_inactive_student_alerts is
  'Whether future teacher notifications about student inactivity are generated and included in digests.';
comment on column public.user_notification_preferences.teacher_open_review_alerts is
  'Whether future teacher notifications about pending manual reviews are generated and included in digests.';
comment on column public.user_notification_preferences.teacher_sensitive_action_alerts is
  'Whether future teacher audit alerts are generated and included in digests.';

revoke all on function public.get_teacher_notification_settings() from public, anon;
revoke all on function public.set_teacher_notification_preferences(boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.set_teacher_digest_preference(text, text, smallint, smallint) from public, anon;

grant execute on function public.get_teacher_notification_settings() to authenticated;
grant execute on function public.set_teacher_notification_preferences(boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.set_teacher_digest_preference(text, text, smallint, smallint) to authenticated;

notify pgrst, 'reload schema';
