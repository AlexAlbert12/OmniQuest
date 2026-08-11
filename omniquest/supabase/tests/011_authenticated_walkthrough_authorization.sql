begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(34);

select is(
  (
    select count(*)
    from (values
      ('roles'), ('profiles'), ('subjects'), ('classrooms'), ('subject_topics'), ('questions'), ('answers'), ('enrollments'),
      ('subject_scores'), ('topic_scores'), ('attempt_history'), ('student_badges'), ('notification_state'), ('user_preferences'),
      ('user_notification_preferences'), ('user_support_tickets'), ('support_ticket_messages'), ('support_ticket_attachments'),
      ('account_deletion_requests'), ('data_export_requests'), ('admin_audit_logs'), ('notifications')
    ) required(table_name)
    join pg_class relation on relation.oid = format('public.%I', required.table_name)::regclass
    where not relation.relrowsecurity
  ),
  0::bigint,
  'all client-facing walkthrough tables have RLS enabled'
);

select is(
  (
    select count(*)
    from (values
      ('roles'), ('profiles'), ('subjects'), ('classrooms'), ('subject_topics'), ('questions'), ('answers'), ('enrollments'),
      ('subject_scores'), ('topic_scores'), ('attempt_history'), ('student_badges'), ('notification_state'), ('user_preferences'),
      ('user_notification_preferences'), ('user_support_tickets'), ('support_ticket_messages'), ('support_ticket_attachments'),
      ('account_deletion_requests'), ('data_export_requests'), ('admin_audit_logs'), ('notifications')
    ) required(table_name)
    where not exists (select 1 from pg_policies policy where policy.schemaname = 'public' and policy.tablename = required.table_name)
  ),
  0::bigint,
  'all client-facing walkthrough tables have at least one explicit RLS policy'
);

select is(
  (
    select count(*)
    from (values
      ('roles'), ('profiles'), ('subjects'), ('classrooms'), ('subject_topics'), ('questions'), ('answers'), ('enrollments'),
      ('subject_scores'), ('topic_scores'), ('attempt_history'), ('student_badges'), ('notification_state'), ('user_preferences'),
      ('user_notification_preferences'), ('user_support_tickets'), ('support_ticket_messages'), ('support_ticket_attachments'),
      ('account_deletion_requests'), ('data_export_requests'), ('admin_audit_logs'), ('notifications')
    ) required(table_name)
    where has_table_privilege('anon', format('public.%I', required.table_name), 'SELECT')
       or has_table_privilege('anon', format('public.%I', required.table_name), 'INSERT')
       or has_table_privilege('anon', format('public.%I', required.table_name), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', required.table_name), 'DELETE')
  ),
  0::bigint,
  'anonymous users have no direct walkthrough table privileges'
);

select ok(has_table_privilege('authenticated', 'public.roles', 'SELECT'), 'authenticated users can read the role catalog');
select ok(has_table_privilege('authenticated', 'public.profiles', 'SELECT') and not has_table_privilege('authenticated', 'public.profiles', 'UPDATE') and has_column_privilege('authenticated', 'public.profiles', 'alias', 'UPDATE') and has_column_privilege('authenticated', 'public.profiles', 'visibility', 'UPDATE') and not has_column_privilege('authenticated', 'public.profiles', 'role_id', 'UPDATE') and not has_column_privilege('authenticated', 'public.profiles', 'active', 'UPDATE') and not has_table_privilege('authenticated', 'public.profiles', 'INSERT') and not has_table_privilege('authenticated', 'public.profiles', 'DELETE'), 'profile access is read and limited to safe self-service columns');
select ok(has_table_privilege('authenticated', 'public.subjects', 'SELECT') and not has_table_privilege('authenticated', 'public.subjects', 'INSERT') and not has_table_privilege('authenticated', 'public.subjects', 'UPDATE') and not has_table_privilege('authenticated', 'public.subjects', 'DELETE'), 'course writes remain server-controlled');
select ok(has_table_privilege('authenticated', 'public.classrooms', 'SELECT') and not has_table_privilege('authenticated', 'public.classrooms', 'INSERT') and not has_table_privilege('authenticated', 'public.classrooms', 'UPDATE') and not has_table_privilege('authenticated', 'public.classrooms', 'DELETE'), 'classroom writes remain server-controlled');
select ok(has_table_privilege('authenticated', 'public.subject_topics', 'SELECT') and not has_table_privilege('authenticated', 'public.subject_topics', 'INSERT') and not has_table_privilege('authenticated', 'public.subject_topics', 'UPDATE') and not has_table_privilege('authenticated', 'public.subject_topics', 'DELETE'), 'topic writes remain server-controlled');
select ok(has_table_privilege('authenticated', 'public.questions', 'SELECT') and has_table_privilege('authenticated', 'public.answers', 'SELECT') and not has_table_privilege('authenticated', 'public.questions', 'INSERT') and not has_table_privilege('authenticated', 'public.questions', 'UPDATE') and not has_table_privilege('authenticated', 'public.questions', 'DELETE'), 'question authoring writes remain protected operations');
select ok(has_table_privilege('authenticated', 'public.enrollments', 'SELECT') and has_table_privilege('authenticated', 'public.enrollments', 'DELETE') and not has_table_privilege('authenticated', 'public.enrollments', 'INSERT') and not has_table_privilege('authenticated', 'public.enrollments', 'UPDATE'), 'enrollment reads and self-leave are the only direct client operations');
select ok(has_table_privilege('authenticated', 'public.subject_scores', 'SELECT') and has_table_privilege('authenticated', 'public.topic_scores', 'SELECT'), 'learning score reads are available through RLS');
select ok(not has_table_privilege('authenticated', 'public.subject_scores', 'INSERT') and not has_table_privilege('authenticated', 'public.subject_scores', 'UPDATE') and not has_table_privilege('authenticated', 'public.subject_scores', 'DELETE') and not has_table_privilege('authenticated', 'public.topic_scores', 'INSERT') and not has_table_privilege('authenticated', 'public.topic_scores', 'UPDATE') and not has_table_privilege('authenticated', 'public.topic_scores', 'DELETE'), 'learning score writes remain server-controlled');
select ok(has_table_privilege('authenticated', 'public.attempt_history', 'SELECT') and has_table_privilege('authenticated', 'public.student_badges', 'SELECT'), 'attempt and badge reads are available through RLS');
select ok(has_table_privilege('authenticated', 'public.notification_state', 'SELECT') and has_table_privilege('authenticated', 'public.notification_state', 'INSERT') and has_table_privilege('authenticated', 'public.notification_state', 'UPDATE') and not has_table_privilege('authenticated', 'public.notification_state', 'DELETE'), 'notification state can be persisted but not deleted directly');
select ok(has_table_privilege('authenticated', 'public.user_preferences', 'SELECT') and has_table_privilege('authenticated', 'public.user_preferences', 'INSERT') and has_table_privilege('authenticated', 'public.user_preferences', 'UPDATE') and not has_table_privilege('authenticated', 'public.user_preferences', 'DELETE'), 'user settings remain RLS-scoped');
select ok(has_table_privilege('authenticated', 'public.user_notification_preferences', 'SELECT') and has_table_privilege('authenticated', 'public.user_notification_preferences', 'INSERT') and has_table_privilege('authenticated', 'public.user_notification_preferences', 'UPDATE') and not has_table_privilege('authenticated', 'public.user_notification_preferences', 'DELETE'), 'notification preferences remain RLS-scoped');
select ok(has_table_privilege('authenticated', 'public.user_support_tickets', 'SELECT') and has_table_privilege('authenticated', 'public.user_support_tickets', 'INSERT') and not has_table_privilege('authenticated', 'public.user_support_tickets', 'UPDATE') and not has_table_privilege('authenticated', 'public.user_support_tickets', 'DELETE'), 'support tickets can be read and created only through RLS');
select ok(has_table_privilege('authenticated', 'public.support_ticket_messages', 'SELECT') and not has_table_privilege('authenticated', 'public.support_ticket_messages', 'INSERT') and not has_table_privilege('authenticated', 'public.support_ticket_messages', 'UPDATE') and not has_table_privilege('authenticated', 'public.support_ticket_messages', 'DELETE'), 'support replies remain protected RPC operations');
select ok(has_table_privilege('authenticated', 'public.support_ticket_attachments', 'SELECT') and has_table_privilege('authenticated', 'public.support_ticket_attachments', 'INSERT') and not has_table_privilege('authenticated', 'public.support_ticket_attachments', 'UPDATE') and not has_table_privilege('authenticated', 'public.support_ticket_attachments', 'DELETE'), 'support attachment metadata is RLS-scoped');
select ok(has_table_privilege('authenticated', 'public.account_deletion_requests', 'SELECT') and has_table_privilege('authenticated', 'public.data_export_requests', 'SELECT'), 'account request status remains readable through RLS');
select ok(has_table_privilege('authenticated', 'public.admin_audit_logs', 'SELECT') and not has_table_privilege('authenticated', 'public.admin_audit_logs', 'INSERT') and not has_table_privilege('authenticated', 'public.admin_audit_logs', 'UPDATE') and not has_table_privilege('authenticated', 'public.admin_audit_logs', 'DELETE'), 'admin audit is read-only to authorized authenticated users');
select ok(not has_table_privilege('authenticated', 'public.notifications', 'SELECT') and not has_table_privilege('authenticated', 'public.notifications', 'INSERT') and not has_table_privilege('authenticated', 'public.notifications', 'UPDATE') and not has_table_privilege('authenticated', 'public.notifications', 'DELETE'), 'persistent notifications are accessible only through protected RPCs');
select ok(has_sequence_privilege('authenticated', 'public.notification_state_id_seq', 'USAGE') and has_sequence_privilege('authenticated', 'public.user_support_tickets_id_seq', 'USAGE'), 'only legitimate direct inserts can allocate client-visible identities');
select ok(not has_sequence_privilege('authenticated', 'public.classrooms_id_seq', 'USAGE') and not has_sequence_privilege('authenticated', 'public.subject_topics_id_seq', 'USAGE') and not has_sequence_privilege('authenticated', 'public.enrollments_id_seq', 'USAGE') and not has_sequence_privilege('authenticated', 'public.subject_scores_id_seq', 'USAGE') and not has_sequence_privilege('authenticated', 'public.topic_scores_id_seq', 'USAGE'), 'server-controlled workflow identities are not client-allocatable');
select is(
  (
    select count(*)
    from (values
      ('account_backup_codes'), ('admin_audit_logs_default'), ('admin_role_assignments'), ('admin_roles'),
      ('analytics_reporting_identities'), ('analytics_retention_policy'), ('attempt_sensitive_data_retention_policy'),
      ('auth_rate_limits'), ('game_answer_submission_receipts'), ('notification_delivery_queue'), ('notification_push_deliveries'),
      ('question_media_assets'), ('teacher_audit_retention_policy'), ('teacher_digest_deliveries'), ('teacher_student_recovery_requests')
    ) internal(table_name)
    where has_table_privilege('authenticated', format('public.%I', internal.table_name), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', internal.table_name), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', internal.table_name), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', internal.table_name), 'DELETE')
  ),
  0::bigint,
  'internal workflow tables remain inaccessible to authenticated clients'
);
select is((select count(*) from pg_class relation join pg_namespace namespace on namespace.oid = relation.relnamespace where namespace.nspname = 'public' and relation.relkind in ('r', 'p') and (not has_table_privilege('service_role', relation.oid, 'SELECT') or not has_table_privilege('service_role', relation.oid, 'INSERT') or not has_table_privilege('service_role', relation.oid, 'UPDATE') or not has_table_privilege('service_role', relation.oid, 'DELETE'))), 0::bigint, 'service workers retain all public table operations');
select is((select count(*) from pg_class relation join pg_namespace namespace on namespace.oid = relation.relnamespace where namespace.nspname = 'public' and relation.relkind = 'S' and (not has_sequence_privilege('service_role', relation.oid, 'USAGE') or not has_sequence_privilege('service_role', relation.oid, 'SELECT'))), 0::bigint, 'service workers retain all public sequence operations');
select ok(has_function_privilege('authenticated', 'public.get_notifications_page(text,integer,timestamptz,uuid)', 'EXECUTE') and has_function_privilege('authenticated', 'public.mark_notifications_read(uuid[])', 'EXECUTE') and has_function_privilege('authenticated', 'public.delete_notifications(uuid[])', 'EXECUTE'), 'protected notification RPCs remain executable by authenticated users');
select ok(has_function_privilege('authenticated', 'public.create_subject_with_default_topic(text,text,text,text,text,text,text,text)', 'EXECUTE') and has_function_privilege('authenticated', 'public.create_teacher_classroom(bigint,text,text)', 'EXECUTE') and has_function_privilege('authenticated', 'public.save_teacher_question(bigint,bigint,bigint,bigint,text,text,integer,integer,integer,text,jsonb,text,text,text,text,text,numeric,text,text)', 'EXECUTE'), 'teacher authoring uses protected server operations');
select ok(has_function_privilege('authenticated', 'public.join_subject_by_code(text)', 'EXECUTE') and has_function_privilege('authenticated', 'public.start_game_attempt(bigint,bigint,bigint,boolean,integer)', 'EXECUTE') and has_function_privilege('authenticated', 'public.submit_answer_resumable(uuid,bigint,bigint,text,jsonb,integer,boolean,boolean,uuid)', 'EXECUTE') and has_function_privilege('authenticated', 'public.finish_game_attempt(uuid,text)', 'EXECUTE'), 'student enrollment and game operations remain protected RPCs');
select is((select count(distinct procedure.proname) from pg_proc procedure join pg_namespace namespace on namespace.oid = procedure.pronamespace where namespace.nspname = 'public' and procedure.proname in ('get_teacher_students_page', 'get_teacher_manual_review_queue', 'get_teacher_question_report', 'get_teacher_audit_logs_page_v2', 'get_teacher_subject_overview') and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')), 5::bigint, 'teacher reporting RPCs are available to authenticated users');
select is((select count(distinct procedure.proname) from pg_proc procedure join pg_namespace namespace on namespace.oid = procedure.pronamespace where namespace.nspname = 'public' and procedure.proname in ('get_admin_portal_context', 'get_admin_profiles_page', 'get_admin_subjects_page', 'get_admin_classrooms_page', 'get_admin_audit_logs_page_secured', 'request_admin_export_job', 'get_admin_export_jobs_page') and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')), 7::bigint, 'admin supervision and export RPCs are available to authenticated users');
select ok(
  (
    select count(*) = 110
      and count(*) filter (where exists (select 1 from pg_proc procedure join pg_namespace namespace on namespace.oid = procedure.pronamespace where namespace.nspname = 'public' and procedure.proname = expected.name and has_function_privilege('authenticated', procedure.oid, 'EXECUTE'))) = 110
      and count(*) filter (where exists (select 1 from pg_proc procedure join pg_namespace namespace on namespace.oid = procedure.pronamespace where namespace.nspname = 'public' and procedure.proname = expected.name and has_function_privilege('anon', procedure.oid, 'EXECUTE'))) = 0
    from unnest(array['acknowledge_teacher_audit_alert', 'add_support_ticket_message', 'add_teacher_student_note', 'admin_update_support_ticket_secured', 'archive_teacher_topic', 'assign_admin_role', 'batch_review_manual_attempts', 'cancel_account_deletion', 'create_subject_with_default_topic', 'create_teacher_classroom', 'create_teacher_notification', 'deactivate_push_token', 'delete_notifications', 'duplicate_teacher_subject', 'equip_profile_cosmetics', 'finish_game_attempt', 'get_activity_attempt_detail', 'get_admin_audit_logs_page_secured', 'get_admin_audit_policy', 'get_admin_classrooms_page', 'get_admin_dashboard_metrics', 'get_admin_directory_filters', 'get_admin_export_download_path', 'get_admin_export_jobs_page', 'get_admin_portal_context', 'get_admin_profile_activity_page', 'get_admin_profiles_page', 'get_admin_push_delivery_metrics', 'get_admin_role_assignments_page', 'get_admin_roles', 'get_admin_subjects_page', 'get_admin_support_directory', 'get_admin_support_tickets_page_secured', 'get_admin_usage_analytics', 'get_admin_user_change_history_page', 'get_attempt_feedback', 'get_avatar_customization_options', 'get_class_ranking_profiles', 'get_manual_review_configuration', 'get_manual_review_history', 'get_manual_review_thread', 'get_notifications_page', 'get_own_support_email_history', 'get_own_support_tickets_page', 'get_profile_cosmetics', 'get_question_media_manifest', 'get_ranking_profiles_page', 'get_safe_game_questions', 'get_student_attempt_history', 'get_student_attempt_history_page', 'get_student_badge_catalog', 'get_student_home_dashboard', 'get_student_progress_summary', 'get_student_question_catalog', 'get_support_contact_channels', 'get_support_thread_page', 'get_teacher_attention_students_page', 'get_teacher_audit_configuration', 'get_teacher_audit_logs_page_v2', 'get_teacher_classrooms_page', 'get_teacher_courses_page', 'get_teacher_dashboard_summary', 'get_teacher_manual_review_queue', 'get_teacher_notification_center_summary', 'get_teacher_notification_settings', 'get_teacher_notifications_page', 'get_teacher_profile_recent_questions_page', 'get_teacher_profile_recent_subjects_page', 'get_teacher_profile_summary', 'get_teacher_question_affected_students_page', 'get_teacher_question_report', 'get_teacher_recent_activity_page', 'get_teacher_student_history_metrics', 'get_teacher_student_history_reviews_page', 'get_teacher_student_history_summary', 'get_teacher_student_history_timeline_page', 'get_teacher_student_history_weaknesses', 'get_teacher_students_page', 'get_teacher_subject_analytics', 'get_teacher_subject_overview', 'get_teacher_subject_questions_page', 'get_teacher_subject_students_page', 'get_teacher_subject_topics_page', 'get_teacher_topic_questions_page', 'get_teacher_topic_summary', 'initialize_guest_profile', 'join_subject_by_code', 'mark_notifications_read', 'register_push_token', 'register_user_session', 'request_account_data_export', 'request_account_deletion', 'request_admin_export_job', 'request_teacher_audit_export', 'review_manual_review_attempt', 'save_manual_review_settings', 'save_manual_review_template', 'save_teacher_audit_filter', 'save_teacher_question', 'search_app_entities', 'set_analytics_consent', 'set_teacher_course_notification_preference', 'set_teacher_digest_preference', 'set_teacher_notifications_mute', 'set_teacher_support_preference', 'start_game_attempt', 'submit_answer_resumable', 'sync_student_badges', 'track_usage_event', 'verify_admin_audit_chain']::text[]) as expected(name)
  ),
  'all client-invoked walkthrough RPC names exist, are authenticated-only and remain executable'
);
select is((select count(*) from pg_proc procedure join pg_namespace namespace on namespace.oid = procedure.pronamespace cross join lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) privilege where namespace.nspname = 'public' and procedure.prosecdef and privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'), 0::bigint, 'SECURITY DEFINER functions are never executable through PUBLIC');

select * from finish();
rollback;
