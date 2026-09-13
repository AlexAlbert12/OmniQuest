# Catálogo backend generado

> Archivo generado por `npm run docs:generate`. No editar manualmente.

## Resumen

- Migraciones: **117**
- Tablas públicas detectadas: **65**
- Funciones/RPC públicas detectadas: **251**
- Edge Functions: **34**

## Edge Functions

| Función | Verificación de acceso en gateway |
|---|---|
| `admin-archive-course` | JWT requerido |
| `admin-bulk-operations` | JWT requerido |
| `admin-create-teacher` | JWT requerido |
| `admin-deactivate-classroom` | JWT requerido |
| `admin-delete-student-progress` | JWT requerido |
| `admin-invite-admin` | JWT requerido |
| `admin-process-push-delivery` | JWT requerido |
| `admin-reset-password` | JWT requerido |
| `admin-toggle-user` | JWT requerido |
| `auth-attempt-guard` | JWT desactivado; autenticación interna/secret obligatoria |
| `cleanup-question-media` | JWT desactivado; autenticación interna/secret obligatoria |
| `delete-account` | JWT requerido |
| `import-students` | JWT requerido |
| `manage-account-security` | JWT requerido |
| `process-account-requests` | JWT desactivado; autenticación interna/secret obligatoria |
| `process-admin-export-jobs` | JWT desactivado; autenticación interna/secret obligatoria |
| `process-notification-delivery` | JWT desactivado; autenticación interna/secret obligatoria |
| `process-question-media` | JWT requerido |
| `process-support-email-delivery` | JWT desactivado; autenticación interna/secret obligatoria |
| `process-teacher-audit-exports` | JWT desactivado; autenticación interna/secret obligatoria |
| `process-teacher-digests` | JWT desactivado; autenticación interna/secret obligatoria |
| `profile-update-avatar` | JWT requerido |
| `send-push-notification` | JWT requerido |
| `student-reset-own-progress` | JWT requerido |
| `teacher-archive-subject` | JWT requerido |
| `teacher-create-topic` | JWT requerido |
| `teacher-delete-question` | JWT requerido |
| `teacher-regenerate-class-code` | JWT requerido |
| `teacher-remove-student-from-class` | JWT requerido |
| `teacher-reset-own-data` | JWT requerido |
| `teacher-reset-student-progress` | JWT requerido |
| `teacher-student-reminder` | JWT requerido |
| `teacher-update-subject` | JWT requerido |
| `teacher-update-topic` | JWT requerido |

La desactivación de `verify_jwt` no convierte una función en pública: los procesadores programados validan su secreto interno o el contexto de servicio antes de ejecutar trabajo privilegiado.

## Tablas públicas

- `account_backup_codes`
- `account_deletion_requests`
- `admin_audit_chain_checkpoints`
- `admin_audit_logs`
- `admin_audit_logs_default`
- `admin_audit_settings`
- `admin_export_jobs`
- `admin_role_assignments`
- `admin_roles`
- `admin_user_change_history`
- `analytics_events`
- `analytics_reporting_identities`
- `analytics_retention_policy`
- `answers`
- `attempt_history`
- `attempt_sensitive_data_retention_policy`
- `auth_rate_limits`
- `avatar_frames`
- `badge_categories`
- `badge_definitions`
- `classrooms`
- `data_export_requests`
- `enrollments`
- `game_answer_submission_receipts`
- `game_attempts`
- `manual_review_comment_templates`
- `manual_review_comments`
- `manual_review_history`
- `manual_review_settings`
- `notification_delivery_queue`
- `notification_push_deliveries`
- `notification_state`
- `notifications`
- `profile_cosmetics`
- `profiles`
- `push_tokens`
- `question_media_assets`
- `questions`
- `ranking_seasons`
- `roles`
- `student_badges`
- `subject_scores`
- `subject_topics`
- `subjects`
- `support_contact_channels`
- `support_email_deliveries`
- `support_response_templates`
- `support_tags`
- `support_ticket_attachments`
- `support_ticket_history`
- `support_ticket_messages`
- `support_ticket_tags`
- `teacher_audit_alerts`
- `teacher_audit_export_requests`
- `teacher_audit_logs`
- `teacher_audit_retention_policy`
- `teacher_digest_deliveries`
- `teacher_notification_course_preferences`
- `teacher_student_notes`
- `teacher_student_recovery_requests`
- `topic_scores`
- `user_notification_preferences`
- `user_preferences`
- `user_sessions`
- `user_support_tickets`

## Funciones y RPC públicas

- `acknowledge_teacher_audit_alert`
- `add_manual_review_comment`
- `add_support_ticket_message`
- `add_teacher_student_note`
- `admin_audit_severity`
- `admin_cancel_push_delivery`
- `admin_has_permission`
- `admin_request_push_delivery_processing`
- `admin_retry_push_delivery`
- `admin_sha256_hex`
- `admin_update_support_ticket`
- `admin_update_support_ticket_secured`
- `analytics_allowed`
- `apply_analytics_retention`
- `apply_attempt_sensitive_data_retention`
- `apply_teacher_audit_retention`
- `apply_teacher_notification_delivery_preferences`
- `apply_teacher_notification_queue_preferences`
- `archive_teacher_question`
- `archive_teacher_topic`
- `assert_topic_playable`
- `assign_admin_role`
- `badge_metric_value`
- `batch_review_manual_attempts`
- `can_access_question_media`
- `can_access_question_media_object`
- `can_read_profile`
- `cancel_account_deletion`
- `capture_manual_review_history`
- `check_attempt_history_topic_deadline`
- `check_game_attempt_topic_deadline`
- `claim_admin_export_jobs`
- `claim_notification_delivery_batch`
- `claim_notification_delivery_item`
- `claim_support_email_delivery_batch`
- `claim_teacher_audit_export_requests`
- `claim_teacher_digest_batch`
- `cleanup_auth_rate_limits`
- `cleanup_expired_guests`
- `complete_admin_export_job`
- `complete_current_user_onboarding`
- `complete_teacher_audit_export`
- `consume_auth_rate_limit`
- `convert_current_guest_to_student`
- `create_notification`
- `create_subject_with_default_topic`
- `create_teacher_classroom`
- `create_teacher_notification`
- `deactivate_push_token`
- `delete_notifications`
- `delete_teacher_question`
- `delete_teacher_topic`
- `delete_user_relational_data`
- `detect_teacher_audit_anomalies`
- `discard_current_guest_session`
- `duplicate_teacher_subject`
- `enforce_global_invite_code_uniqueness`
- `enforce_subject_teacher_role`
- `enqueue_due_teacher_digests`
- `enqueue_notification_push_delivery`
- `enqueue_support_email_delivery`
- `ensure_analytics_reporting_id`
- `ensure_current_ranking_season`
- `ensure_default_classroom`
- `equip_profile_cosmetics`
- `expire_admin_export_jobs`
- `fail_admin_export_job`
- `fill_course_classroom_id`
- `finish_game_attempt`
- `finish_support_email_delivery`
- `finish_teacher_digest`
- `finish_teacher_student_recovery_request`
- `generate_unique_subject_code`
- `get_activity_attempt_detail`
- `get_admin_account_export_requests_page`
- `get_admin_audit_logs_page`
- `get_admin_audit_logs_page_secured`
- `get_admin_audit_policy`
- `get_admin_classrooms_page`
- `get_admin_dashboard_metrics`
- `get_admin_directory_filters`
- `get_admin_enrollments_summary`
- `get_admin_export_download_path`
- `get_admin_export_jobs_page`
- `get_admin_portal_context`
- `get_admin_profile_activity_page`
- `get_admin_profiles_page`
- `get_admin_push_delivery_detail`
- `get_admin_push_delivery_metrics`
- `get_admin_push_delivery_page`
- `get_admin_role_assignments_page`
- `get_admin_roles`
- `get_admin_subjects_page`
- `get_admin_support_directory`
- `get_admin_support_tickets_page`
- `get_admin_support_tickets_page_secured`
- `get_admin_usage_analytics`
- `get_admin_user_change_history_page`
- `get_attempt_feedback`
- `get_avatar_customization_options`
- `get_class_ranking_profiles`
- `get_class_weekly_ranking_profiles`
- `get_game_attempt_review_index`
- `get_game_questions`
- `get_manual_review_configuration`
- `get_manual_review_history`
- `get_manual_review_thread`
- `get_notifications_page`
- `get_own_support_email_history`
- `get_own_support_tickets_page`
- `get_profile_cosmetics`
- `get_question_media_manifest`
- `get_ranking_profiles`
- `get_ranking_profiles_page`
- `get_safe_game_questions`
- `get_safe_game_questions_v2`
- `get_student_attempt_history`
- `get_student_attempt_history_page`
- `get_student_badge_catalog`
- `get_student_badge_metrics`
- `get_student_home_dashboard`
- `get_student_progress_summary`
- `get_student_question_catalog`
- `get_student_recent_game_attempts`
- `get_support_contact_channels`
- `get_support_thread_page`
- `get_teacher_attention_students_page`
- `get_teacher_audit_configuration`
- `get_teacher_audit_logs_page`
- `get_teacher_audit_logs_page_v2`
- `get_teacher_classrooms_page`
- `get_teacher_courses_page`
- `get_teacher_dashboard_summary`
- `get_teacher_manual_review_queue`
- `get_teacher_notification_center_summary`
- `get_teacher_notification_settings`
- `get_teacher_notifications_page`
- `get_teacher_profile_recent_questions_page`
- `get_teacher_profile_recent_subjects_page`
- `get_teacher_profile_summary`
- `get_teacher_question_affected_students_page`
- `get_teacher_question_report`
- `get_teacher_recent_activity_page`
- `get_teacher_student_attempts_page`
- `get_teacher_student_history_metrics`
- `get_teacher_student_history_reviews_page`
- `get_teacher_student_history_summary`
- `get_teacher_student_history_timeline_page`
- `get_teacher_student_history_weaknesses`
- `get_teacher_students_page`
- `get_teacher_students_page_with_avatars`
- `get_teacher_subject_analytics`
- `get_teacher_subject_overview`
- `get_teacher_subject_questions_page`
- `get_teacher_subject_students_page`
- `get_teacher_subject_students_page_with_avatars`
- `get_teacher_subject_topics_page`
- `get_teacher_topic_questions_page`
- `get_teacher_topic_summary`
- `get_weekly_ranking_profiles`
- `handle_new_user`
- `harden_admin_audit_partition_privileges`
- `initialize_guest_profile`
- `invoke_account_requests_processor`
- `invoke_admin_export_processor`
- `invoke_notification_delivery_worker`
- `invoke_support_email_processor`
- `invoke_teacher_audit_export_processor`
- `invoke_teacher_digest_processor`
- `is_active_teacher`
- `is_admin`
- `is_classroom_enrolled`
- `is_classroom_teacher`
- `is_invite_code_available`
- `is_own_avatar_storage_path`
- `is_subject_enrolled`
- `is_subject_teacher`
- `join_subject_by_code`
- `log_badge_unlock_analytics`
- `log_course_join_analytics`
- `log_game_attempt_analytics`
- `log_question_type_analytics`
- `maintain_admin_audit_partitions`
- `mark_all_notifications_read`
- `mark_notifications_read`
- `mark_question_media_orphaned`
- `normalize_answer_text`
- `notify_badge_award_event`
- `notify_enrollment_event`
- `notify_question_failure_threshold_event`
- `on_support_attachment_history`
- `on_support_ticket_message`
- `prepare_admin_audit_log`
- `prepare_guest_profile`
- `prepare_manual_review_sla`
- `prepare_support_ticket_priority_and_sla`
- `prepare_support_ticket_sla`
- `prepare_teacher_audit_log`
- `prevent_admin_user_change_history_mutation`
- `prevent_manual_review_history_mutation`
- `prevent_teacher_audit_mutation`
- `protect_profile_sensitive_columns`
- `reactivate_due_admin_users`
- `recalculate_student_points`
- `register_push_token`
- `register_user_session`
- `reject_admin_audit_mutation`
- `reject_support_history_update`
- `request_account_data_export`
- `request_account_deletion`
- `request_admin_export_job`
- `request_teacher_audit_export`
- `reserve_teacher_student_recovery_request`
- `review_manual_review_attempt`
- `review_open_answer_attempt_v2`
- `revoke_admin_role`
- `revoke_other_user_sessions`
- `revoke_user_session`
- `sanitize_analytics_properties`
- `sanitize_teacher_audit_payload`
- `save_manual_review_settings`
- `save_manual_review_template`
- `save_teacher_question`
- `save_teacher_question_v2`
- `search_app_entities`
- `seed_support_ticket_message`
- `set_analytics_consent`
- `set_teacher_course_notification_preference`
- `set_teacher_digest_preference`
- `set_teacher_notification_preferences`
- `set_teacher_notifications_mute`
- `set_teacher_question_archived`
- `set_teacher_support_preference`
- `set_teacher_topic_archived`
- `start_game_attempt`
- `submit_answer`
- `submit_answer_resumable`
- `support_first_response_interval`
- `support_priority_score`
- `support_resolution_interval`
- `sync_student_badges`
- `sync_student_points`
- `sync_student_points_from_xp_source`
- `teacher_attach_student_avatars`
- `teacher_notification_category`
- `teacher_notification_severity`
- `teacher_notification_subject_id`
- `touch_notifications_updated_at`
- `touch_question_updated_at`
- `track_usage_event`
- `verify_admin_audit_chain`
