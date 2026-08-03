do $$
declare
  v_function record;
  v_authenticated_names constant text[] := array[
    'add_manual_review_comment',
    'can_read_profile',
    'convert_current_guest_to_student',
    'create_teacher_classroom',
    'duplicate_teacher_subject',
    'get_class_ranking_profiles',
    'get_class_weekly_ranking_profiles',
    'get_manual_review_thread',
    'get_ranking_profiles',
    'get_teacher_manual_review_queue',
    'get_weekly_ranking_profiles',
    'is_admin',
    'is_classroom_enrolled',
    'is_classroom_teacher',
    'is_subject_enrolled',
    'is_subject_teacher',
    'join_subject_by_code',
    'register_user_session',
    'revoke_other_user_sessions',
    'start_game_attempt'
  ];
  v_service_names constant text[] := array[
    'apply_teacher_audit_retention',
    'enqueue_due_teacher_digests'
  ];
  v_internal_names constant text[] := array[
    'assert_topic_playable',
    'capture_manual_review_history',
    'check_attempt_history_topic_deadline',
    'check_game_attempt_topic_deadline',
    'enqueue_support_email_delivery',
    'fill_course_classroom_id',
    'handle_new_user',
    'log_badge_unlock_analytics',
    'log_course_join_analytics',
    'log_game_attempt_analytics',
    'log_question_type_analytics',
    'mark_question_media_orphaned',
    'notify_attempt_event',
    'notify_badge_award_event',
    'notify_enrollment_event',
    'notify_question_failure_threshold_event',
    'on_support_attachment_history',
    'on_support_ticket_message',
    'prepare_admin_audit_log',
    'prepare_manual_review_sla',
    'prepare_support_ticket_priority_and_sla',
    'protect_profile_sensitive_columns',
    'seed_support_ticket_message'
  ];
begin
  for v_function in
    select procedure.oid::regprocedure as signature, procedure.proname as name
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and procedure.proname = any (
        v_authenticated_names || v_service_names || v_internal_names
      )
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      v_function.signature
    );

    if v_function.name = any (v_authenticated_names) then
      execute format(
        'grant execute on function %s to authenticated, service_role',
        v_function.signature
      );
    elsif v_function.name = any (v_service_names) then
      execute format(
        'grant execute on function %s to service_role',
        v_function.signature
      );
    end if;
  end loop;
end;
$$;
