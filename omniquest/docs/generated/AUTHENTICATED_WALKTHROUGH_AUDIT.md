# Auditoría de recorridos autenticados

Estado acumulado hasta: 20260811193000_admin_home_least_privilege_refinement.sql

## Resumen

- Archivos cliente inspeccionados: 435
- Llamadas inventariadas: 221
- Tablas detectadas: 18
- RPC detectadas: 113
- Edge Functions detectadas: 17
- Buckets detectados: 4
- Incidencias estructurales: 0

## Recursos

- Tablas: account_deletion_requests, attempt_history, classrooms, data_export_requests, enrollments, notification_state, profiles, questions, student_badges, subject_scores, subject_topics, subjects, support_ticket_attachments, teacher_audit_export_requests, topic_scores, user_notification_preferences, user_preferences, user_support_tickets
- RPC: acknowledge_teacher_audit_alert, add_support_ticket_message, add_teacher_student_note, admin_update_support_ticket_secured, archive_teacher_topic, assign_admin_role, batch_review_manual_attempts, cancel_account_deletion, create_subject_with_default_topic, create_teacher_classroom, create_teacher_notification, deactivate_push_token, delete_notifications, duplicate_teacher_subject, ensure_default_classroom, equip_profile_cosmetics, finish_game_attempt, get_activity_attempt_detail, get_admin_audit_logs_page_secured, get_admin_audit_policy, get_admin_classrooms_page, get_admin_dashboard_metrics, get_admin_directory_filters, get_admin_export_download_path, get_admin_export_jobs_page, get_admin_portal_context, get_admin_profile_activity_page, get_admin_profiles_page, get_admin_push_delivery_metrics, get_admin_role_assignments_page, get_admin_roles, get_admin_subjects_page, get_admin_support_directory, get_admin_support_tickets_page_secured, get_admin_usage_analytics, get_admin_user_change_history_page, get_attempt_feedback, get_avatar_customization_options, get_class_ranking_profiles, get_game_attempt_review_index, get_manual_review_configuration, get_manual_review_history, get_manual_review_thread, get_notifications_page, get_own_support_email_history, get_own_support_tickets_page, get_profile_cosmetics, get_question_media_manifest, get_ranking_profiles_page, get_safe_game_questions_v2, get_student_attempt_history, get_student_attempt_history_page, get_student_badge_catalog, get_student_home_dashboard, get_student_progress_summary, get_student_question_catalog, get_support_contact_channels, get_support_thread_page, get_teacher_attention_students_page, get_teacher_audit_configuration, get_teacher_audit_logs_page_v2, get_teacher_classrooms_page, get_teacher_courses_page, get_teacher_dashboard_summary, get_teacher_manual_review_queue, get_teacher_notification_center_summary, get_teacher_notification_settings, get_teacher_notifications_page, get_teacher_profile_recent_questions_page, get_teacher_profile_recent_subjects_page, get_teacher_profile_summary, get_teacher_question_affected_students_page, get_teacher_question_report, get_teacher_recent_activity_page, get_teacher_student_history_metrics, get_teacher_student_history_reviews_page, get_teacher_student_history_summary, get_teacher_student_history_timeline_page, get_teacher_student_history_weaknesses, get_teacher_students_page, get_teacher_subject_analytics, get_teacher_subject_overview, get_teacher_subject_questions_page, get_teacher_subject_students_page, get_teacher_subject_topics_page, get_teacher_topic_questions_page, get_teacher_topic_summary, initialize_guest_profile, join_subject_by_code, mark_all_notifications_read, mark_notifications_read, register_push_token, register_user_session, request_account_data_export, request_account_deletion, request_admin_export_job, request_teacher_audit_export, review_manual_review_attempt, save_manual_review_settings, save_manual_review_template, save_teacher_question_v2, search_app_entities, set_analytics_consent, set_teacher_course_notification_preference, set_teacher_digest_preference, set_teacher_notification_preferences, set_teacher_notifications_mute, set_teacher_support_preference, start_game_attempt, submit_answer_resumable, sync_student_badges, track_usage_event, verify_admin_audit_chain
- Edge Functions: admin-bulk-operations, admin-create-teacher, admin-delete-student-progress, admin-reset-password, auth-attempt-guard, import-students, manage-account-security, process-question-media, profile-update-avatar, student-reset-own-progress, teacher-archive-subject, teacher-create-topic, teacher-delete-question, teacher-reset-own-data, teacher-student-reminder, teacher-update-subject, teacher-update-topic
- Buckets: account-exports, admin-exports, avatars, teacher-audit-exports

## Inventario de llamadas

| Tipo | Recurso | Archivo | Línea |
|---|---|---|---:|
| edge | `admin-bulk-operations` | `components/admin/api/adminApi.ts` | 69 |
| edge | `admin-create-teacher` | `components/admin/users/AdminTeachersSection.tsx` | 70 |
| edge | `admin-delete-student-progress` | `components/admin/hooks/useAdminActions.ts` | 89 |
| edge | `admin-reset-password` | `components/admin/hooks/useAdminActions.ts` | 74 |
| edge | `auth-attempt-guard` | `lib/authSecurity.ts` | 109 |
| edge | `import-students` | `components/teacher/TeacherStudentImportModal.tsx` | 86 |
| edge | `manage-account-security` | `components/settings/ManagedSessionsCard.tsx` | 34 |
| edge | `process-question-media` | `lib/questionMedia.ts` | 378 |
| edge | `profile-update-avatar` | `components/student/profile/StudentAvatarCustomizationModal.tsx` | 118 |
| edge | `profile-update-avatar` | `hooks/teacher/useTeacherProfile.ts` | 231 |
| edge | `profile-update-avatar` | `lib/offlineMutations.ts` | 286 |
| edge | `student-reset-own-progress` | `hooks/useSettingsData.ts` | 240 |
| edge | `teacher-archive-subject` | `features/teacher-subject/api.ts` | 42 |
| edge | `teacher-create-topic` | `features/teacher-subject/api.ts` | 24 |
| edge | `teacher-delete-question` | `app/(teacher)/topic/[id].tsx` | 91 |
| edge | `teacher-delete-question` | `features/teacher-subject/api.ts` | 35 |
| edge | `teacher-delete-question` | `hooks/teacher/useQuestionReport.ts` | 84 |
| edge | `teacher-reset-own-data` | `hooks/useSettingsData.ts` | 259 |
| edge | `teacher-student-reminder` | `app/(teacher)/student/[id]/history.tsx` | 75 |
| edge | `teacher-student-reminder` | `components/teacher/TeacherStudentImportModal.tsx` | 172 |
| edge | `teacher-student-reminder` | `features/teacher-students/api.ts` | 47 |
| edge | `teacher-update-subject` | `components/teacher/TeacherSubjectForm.tsx` | 203 |
| edge | `teacher-update-topic` | `components/teacher/TeacherTopicForm.tsx` | 181 |
| rpc | `acknowledge_teacher_audit_alert` | `hooks/teacher/useTeacherAudit.ts` | 117 |
| rpc | `add_support_ticket_message` | `lib/support.ts` | 306 |
| rpc | `add_teacher_student_note` | `hooks/teacher/useTeacherStudentHistory.ts` | 145 |
| rpc | `admin_update_support_ticket_secured` | `components/admin/support/AdminSupportSection.tsx` | 123 |
| rpc | `archive_teacher_topic` | `hooks/teacher/useTeacherTopicDetail.ts` | 108 |
| rpc | `assign_admin_role` | `components/admin/api/adminApi.ts` | 123 |
| rpc | `batch_review_manual_attempts` | `hooks/teacher/useManualReview.ts` | 104 |
| rpc | `cancel_account_deletion` | `components/settings/AccountDataRequestsCard.tsx` | 110 |
| rpc | `create_subject_with_default_topic` | `components/teacher/TeacherSubjectForm.tsx` | 229 |
| rpc | `create_teacher_classroom` | `features/teacher-subject/api.ts` | 5 |
| rpc | `create_teacher_notification` | `lib/notifications/teacher.ts` | 20 |
| rpc | `deactivate_push_token` | `lib/pushNotifications.ts` | 104 |
| rpc | `delete_notifications` | `lib/notifications/persistent.ts` | 157 |
| rpc | `duplicate_teacher_subject` | `features/teacher-subject/api.ts` | 49 |
| rpc | `ensure_default_classroom` | `components/teacher/question-form/useTeacherQuestionForm.ts` | 352 |
| rpc | `equip_profile_cosmetics` | `lib/avatarCosmetics.ts` | 118 |
| rpc | `finish_game_attempt` | `hooks/useGame.ts` | 260 |
| rpc | `get_activity_attempt_detail` | `lib/studentSecureData.ts` | 333 |
| rpc | `get_admin_audit_logs_page_secured` | `components/admin/audit/AdminAuditSection.tsx` | 51 |
| rpc | `get_admin_audit_logs_page_secured` | `lib/adminExports.ts` | 230 |
| rpc | `get_admin_audit_policy` | `components/admin/audit/AdminAuditSection.tsx` | 48 |
| rpc | `get_admin_classrooms_page` | `components/admin/classrooms/AdminClassroomsSection.tsx` | 54 |
| rpc | `get_admin_dashboard_metrics` | `components/admin/hooks/useAdminData.ts` | 38 |
| rpc | `get_admin_directory_filters` | `components/admin/shared/AdminAdvancedFilters.tsx` | 42 |
| rpc | `get_admin_export_download_path` | `components/admin/api/adminApi.ts` | 90 |
| rpc | `get_admin_export_jobs_page` | `components/admin/api/adminApi.ts` | 84 |
| rpc | `get_admin_portal_context` | `components/admin/api/adminApi.ts` | 49 |
| rpc | `get_admin_profile_activity_page` | `components/admin/users/AdminProfileActivityScreen.tsx` | 47 |
| rpc | `get_admin_profiles_page` | `components/admin/hooks/useAdminData.ts` | 39 |
| rpc | `get_admin_profiles_page` | `components/admin/users/AdminStudentsSection.tsx` | 53 |
| rpc | `get_admin_profiles_page` | `components/admin/users/AdminTeachersSection.tsx` | 62 |
| rpc | `get_admin_push_delivery_metrics` | `components/admin/dashboard/AdminPushDeliveryPanel.tsx` | 52 |
| rpc | `get_admin_role_assignments_page` | `components/admin/api/adminApi.ts` | 117 |
| rpc | `get_admin_roles` | `components/admin/api/adminApi.ts` | 111 |
| rpc | `get_admin_subjects_page` | `components/admin/courses/AdminCoursesSection.tsx` | 54 |
| rpc | `get_admin_support_directory` | `lib/support.ts` | 193 |
| rpc | `get_admin_support_tickets_page_secured` | `components/admin/support/AdminSupportSection.tsx` | 56 |
| rpc | `get_admin_support_tickets_page_secured` | `lib/adminExports.ts` | 264 |
| rpc | `get_admin_usage_analytics` | `components/admin/dashboard/AdminUsageAnalyticsPanel.tsx` | 23 |
| rpc | `get_admin_user_change_history_page` | `components/admin/api/adminApi.ts` | 101 |
| rpc | `get_attempt_feedback` | `lib/studentSecureData.ts` | 258 |
| rpc | `get_avatar_customization_options` | `lib/avatarCosmetics.ts` | 83 |
| rpc | `get_class_ranking_profiles` | `app/(student)/class/[id].tsx` | 205 |
| rpc | `get_game_attempt_review_index` | `lib/studentSecureData.ts` | 274 |
| rpc | `get_manual_review_configuration` | `hooks/teacher/useManualReview.ts` | 21 |
| rpc | `get_manual_review_history` | `hooks/teacher/useManualReview.ts` | 120 |
| rpc | `get_manual_review_thread` | `hooks/teacher/useManualReview.ts` | 120 |
| rpc | `get_notifications_page` | `lib/notifications/persistent.ts` | 49 |
| rpc | `get_own_support_email_history` | `lib/support.ts` | 224 |
| rpc | `get_own_support_tickets_page` | `lib/support.ts` | 135 |
| rpc | `get_profile_cosmetics` | `lib/avatarCosmetics.ts` | 138 |
| rpc | `get_question_media_manifest` | `lib/questionMedia.ts` | 269 |
| rpc | `get_ranking_profiles_page` | `hooks/student/useStudentRanking.ts` | 261 |
| rpc | `get_safe_game_questions_v2` | `hooks/useGame.ts` | 171 |
| rpc | `get_student_attempt_history` | `lib/studentSecureData.ts` | 190 |
| rpc | `get_student_attempt_history_page` | `lib/studentSecureData.ts` | 215 |
| rpc | `get_student_badge_catalog` | `lib/studentBadges.ts` | 129 |
| rpc | `get_student_home_dashboard` | `features/student-home/api.ts` | 6 |
| rpc | `get_student_progress_summary` | `features/student-progress/api.ts` | 5 |
| rpc | `get_student_question_catalog` | `lib/studentSecureData.ts` | 173 |
| rpc | `get_support_contact_channels` | `lib/support.ts` | 210 |
| rpc | `get_support_thread_page` | `lib/support.ts` | 169 |
| rpc | `get_teacher_attention_students_page` | `features/teacher-dashboard/api.ts` | 14 |
| rpc | `get_teacher_audit_configuration` | `hooks/teacher/useTeacherAudit.ts` | 47 |
| rpc | `get_teacher_audit_logs_page_v2` | `hooks/teacher/useTeacherAudit.ts` | 26 |
| rpc | `get_teacher_classrooms_page` | `features/teacher-catalog/api.ts` | 23 |
| rpc | `get_teacher_courses_page` | `features/teacher-catalog/api.ts` | 13 |
| rpc | `get_teacher_dashboard_summary` | `features/teacher-dashboard/api.ts` | 13 |
| rpc | `get_teacher_manual_review_queue` | `hooks/teacher/useManualReview.ts` | 27 |
| rpc | `get_teacher_notification_center_summary` | `hooks/teacher/useTeacherNotifications.ts` | 56 |
| rpc | `get_teacher_notification_settings` | `components/support/RoleHelpCenter.tsx` | 152 |
| rpc | `get_teacher_notification_settings` | `hooks/teacher/useTeacherCommunicationSettings.ts` | 68 |
| rpc | `get_teacher_notifications_page` | `hooks/teacher/useTeacherNotifications.ts` | 82 |
| rpc | `get_teacher_profile_recent_questions_page` | `hooks/teacher/useTeacherProfile.ts` | 177 |
| rpc | `get_teacher_profile_recent_subjects_page` | `hooks/teacher/useTeacherProfile.ts` | 150 |
| rpc | `get_teacher_profile_summary` | `hooks/teacher/useTeacherProfile.ts` | 122 |
| rpc | `get_teacher_question_affected_students_page` | `hooks/teacher/useQuestionReport.ts` | 42 |
| rpc | `get_teacher_question_report` | `hooks/teacher/useQuestionReport.ts` | 36 |
| rpc | `get_teacher_recent_activity_page` | `features/teacher-dashboard/api.ts` | 15 |
| rpc | `get_teacher_student_history_metrics` | `hooks/teacher/useTeacherStudentHistory.ts` | 75 |
| rpc | `get_teacher_student_history_reviews_page` | `hooks/teacher/useTeacherStudentHistory.ts` | 65 |
| rpc | `get_teacher_student_history_summary` | `hooks/teacher/useTeacherStudentHistory.ts` | 42 |
| rpc | `get_teacher_student_history_timeline_page` | `hooks/teacher/useTeacherStudentHistory.ts` | 48 |
| rpc | `get_teacher_student_history_weaknesses` | `hooks/teacher/useTeacherStudentHistory.ts` | 58 |
| rpc | `get_teacher_students_page` | `features/teacher-students/api.ts` | 15 |
| rpc | `get_teacher_subject_analytics` | `hooks/teacher/subject/useTeacherSubjectAnalytics.ts` | 21 |
| rpc | `get_teacher_subject_overview` | `hooks/teacher/subject/useTeacherSubjectOverview.ts` | 28 |
| rpc | `get_teacher_subject_questions_page` | `hooks/teacher/subject/useTeacherSubjectQuestions.ts` | 16 |
| rpc | `get_teacher_subject_students_page` | `hooks/teacher/subject/useTeacherSubjectStudents.ts` | 35 |
| rpc | `get_teacher_subject_topics_page` | `hooks/teacher/subject/useTeacherSubjectTopics.ts` | 12 |
| rpc | `get_teacher_topic_questions_page` | `hooks/teacher/useTeacherTopicDetail.ts` | 47 |
| rpc | `get_teacher_topic_summary` | `hooks/teacher/useTeacherTopicDetail.ts` | 39 |
| rpc | `initialize_guest_profile` | `app/_layout.tsx` | 177 |
| rpc | `initialize_guest_profile` | `app/index.tsx` | 109 |
| rpc | `join_subject_by_code` | `lib/studentClassJoin.ts` | 31 |
| rpc | `mark_all_notifications_read` | `lib/notifications/persistent.ts` | 146 |
| rpc | `mark_notifications_read` | `lib/notifications/persistent.ts` | 138 |
| rpc | `register_push_token` | `lib/pushNotifications.ts` | 82 |
| rpc | `register_user_session` | `lib/sessionSecurity.ts` | 21 |
| rpc | `request_account_data_export` | `components/settings/AccountDataRequestsCard.tsx` | 83 |
| rpc | `request_account_deletion` | `hooks/useSettingsData.ts` | 575 |
| rpc | `request_admin_export_job` | `components/admin/api/adminApi.ts` | 75 |
| rpc | `request_teacher_audit_export` | `hooks/teacher/useTeacherAudit.ts` | 103 |
| rpc | `review_manual_review_attempt` | `hooks/teacher/useManualReview.ts` | 99 |
| rpc | `save_manual_review_settings` | `hooks/teacher/useManualReview.ts` | 110 |
| rpc | `save_manual_review_template` | `hooks/teacher/useManualReview.ts` | 115 |
| rpc | `save_teacher_question_v2` | `components/teacher/question-form/useTeacherQuestionForm.ts` | 658 |
| rpc | `search_app_entities` | `components/search/GlobalSearchButton.tsx` | 66 |
| rpc | `set_analytics_consent` | `lib/analytics.ts` | 60 |
| rpc | `set_teacher_course_notification_preference` | `hooks/teacher/useTeacherCommunicationSettings.ts` | 158 |
| rpc | `set_teacher_digest_preference` | `hooks/teacher/useTeacherCommunicationSettings.ts` | 120 |
| rpc | `set_teacher_notification_preferences` | `hooks/teacher/useTeacherCommunicationSettings.ts` | 94 |
| rpc | `set_teacher_notifications_mute` | `hooks/teacher/useTeacherCommunicationSettings.ts` | 140 |
| rpc | `set_teacher_notifications_mute` | `hooks/teacher/useTeacherNotifications.ts` | 214 |
| rpc | `set_teacher_support_preference` | `components/support/RoleHelpCenter.tsx` | 293 |
| rpc | `start_game_attempt` | `hooks/useGame.ts` | 193 |
| rpc | `submit_answer_resumable` | `hooks/useGame.ts` | 419 |
| rpc | `sync_student_badges` | `lib/offlineMutations.ts` | 295 |
| rpc | `sync_student_badges` | `lib/studentBadges.ts` | 503 |
| rpc | `track_usage_event` | `lib/analytics.ts` | 91 |
| rpc | `verify_admin_audit_chain` | `components/admin/audit/AdminAuditSection.tsx` | 61 |
| storage | `account-exports` | `components/settings/AccountDataRequestsCard.tsx` | 97 |
| storage | `admin-exports` | `components/admin/api/adminApi.ts` | 95 |
| storage | `avatars` | `components/student/profile/StudentAvatarCustomizationModal.tsx` | 115 |
| storage | `avatars` | `hooks/teacher/useTeacherProfile.ts` | 225 |
| storage | `avatars` | `lib/offlineMutations.ts` | 284 |
| storage | `teacher-audit-exports` | `hooks/teacher/useTeacherAudit.ts` | 128 |
| table | `account_deletion_requests` | `components/settings/AccountDataRequestsCard.tsx` | 58 |
| table | `attempt_history` | `hooks/student/useStudentProgress.ts` | 120 |
| table | `attempt_history` | `lib/weeklyGoal.ts` | 19 |
| table | `classrooms` | `components/teacher/question-form/useTeacherQuestionForm.ts` | 340 |
| table | `classrooms` | `components/teacher/question-form/useTeacherQuestionForm.ts` | 354 |
| table | `classrooms` | `lib/classCode.ts` | 46 |
| table | `data_export_requests` | `components/settings/AccountDataRequestsCard.tsx` | 53 |
| table | `enrollments` | `app/(student)/class/[id].tsx` | 156 |
| table | `enrollments` | `app/(student)/classes.tsx` | 164 |
| table | `enrollments` | `components/teacher/TeacherSubjectForm.tsx` | 128 |
| table | `enrollments` | `hooks/student/useStudentRanking.ts` | 283 |
| table | `enrollments` | `lib/notifications/derivedStudent.ts` | 23 |
| table | `enrollments` | `lib/notifications/derivedTeacher.ts` | 27 |
| table | `enrollments` | `lib/offlineMutations.ts` | 258 |
| table | `notification_state` | `lib/notifications/persistent.ts` | 176 |
| table | `notification_state` | `lib/notifications/persistent.ts` | 209 |
| table | `notification_state` | `lib/notifications/persistent.ts` | 221 |
| table | `notification_state` | `lib/notifications/persistent.ts` | 234 |
| table | `profiles` | `app/_layout.tsx` | 164 |
| table | `profiles` | `app/_layout.tsx` | 182 |
| table | `profiles` | `app/(auth)/login.tsx` | 120 |
| table | `profiles` | `app/(student)/badges.tsx` | 131 |
| table | `profiles` | `app/(student)/classes.tsx` | 163 |
| table | `profiles` | `app/(student)/notifications.tsx` | 99 |
| table | `profiles` | `components/admin/users/AdminProfileActivityScreen.tsx` | 35 |
| table | `profiles` | `components/support/RoleHelpCenter.tsx` | 147 |
| table | `profiles` | `components/teacher/TeacherSidebar.tsx` | 75 |
| table | `profiles` | `components/ui/RoleHeaderAvatar.tsx` | 35 |
| table | `profiles` | `hooks/student/useStudentActivity.ts` | 93 |
| table | `profiles` | `hooks/student/useStudentProfile.ts` | 81 |
| table | `profiles` | `hooks/student/useStudentProgress.ts` | 114 |
| table | `profiles` | `hooks/student/useStudentRanking.ts` | 106 |
| table | `profiles` | `hooks/useNotifications.ts` | 95 |
| table | `profiles` | `hooks/useSettingsData.ts` | 149 |
| table | `profiles` | `hooks/useSettingsData.ts` | 159 |
| table | `profiles` | `hooks/useSettingsData.ts` | 281 |
| table | `profiles` | `hooks/useSettingsData.ts` | 510 |
| table | `profiles` | `lib/notifications/derivedTeacher.ts` | 75 |
| table | `profiles` | `lib/studentClassJoin.ts` | 18 |
| table | `questions` | `components/teacher/question-form/useTeacherQuestionForm.ts` | 342 |
| table | `questions` | `lib/notifications/derivedTeacher.ts` | 40 |
| table | `student_badges` | `lib/notifications/derivedStudent.ts` | 33 |
| table | `subject_scores` | `app/(student)/class/[id].tsx` | 193 |
| table | `subject_scores` | `components/NotificationBadge.tsx` | 53 |
| table | `subject_scores` | `hooks/student/useStudentProgress.ts` | 115 |
| table | `subject_scores` | `lib/notifications/derivedStudent.ts` | 28 |
| table | `subject_scores` | `lib/notifications/derivedTeacher.ts` | 33 |
| table | `subject_topics` | `app/(student)/class/[id].tsx` | 175 |
| table | `subject_topics` | `components/teacher/question-form/useTeacherQuestionForm.ts` | 795 |
| table | `subject_topics` | `components/teacher/TeacherTopicForm.tsx` | 87 |
| table | `subject_topics` | `components/teacher/TeacherTopicForm.tsx` | 104 |
| table | `subjects` | `components/support/RoleHelpCenter.tsx` | 149 |
| table | `subjects` | `components/teacher/question-form/useTeacherQuestionForm.ts` | 339 |
| table | `subjects` | `components/teacher/TeacherSubjectForm.tsx` | 101 |
| table | `subjects` | `components/teacher/TeacherTopicForm.tsx` | 95 |
| table | `subjects` | `hooks/teacher/useQuestionReport.ts` | 59 |
| table | `subjects` | `hooks/useSettingsData.ts` | 443 |
| table | `subjects` | `lib/classCode.ts` | 33 |
| table | `subjects` | `lib/notifications/derivedTeacher.ts` | 13 |
| table | `support_ticket_attachments` | `lib/support.ts` | 393 |
| table | `teacher_audit_export_requests` | `hooks/teacher/useTeacherAudit.ts` | 58 |
| table | `topic_scores` | `app/(student)/class/[id].tsx` | 187 |
| table | `user_notification_preferences` | `hooks/useSettingsData.ts` | 406 |
| table | `user_notification_preferences` | `hooks/useSettingsData.ts` | 460 |
| table | `user_notification_preferences` | `lib/notifications/preferences.ts` | 14 |
| table | `user_notification_preferences` | `lib/pushNotifications.ts` | 129 |
| table | `user_preferences` | `hooks/useSettingsData.ts` | 388 |
| table | `user_preferences` | `hooks/useSettingsData.ts` | 438 |
| table | `user_preferences` | `lib/analytics.ts` | 39 |
| table | `user_support_tickets` | `lib/support.ts` | 147 |
| table | `user_support_tickets` | `lib/support.ts` | 266 |

## Resultado

- PASS: no se detectaron huecos estructurales en el inventario estático.

