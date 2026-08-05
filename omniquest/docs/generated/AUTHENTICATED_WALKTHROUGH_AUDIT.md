# Auditoría de recorridos autenticados

Estado acumulado hasta: 20260805200000_authenticated_walkthrough_authorization_matrix.sql

## Resumen

- Archivos cliente inspeccionados: 443
- Llamadas inventariadas: 221
- Tablas detectadas: 17
- RPC detectadas: 113
- Edge Functions detectadas: 17
- Buckets detectados: 4
- Incidencias estructurales: 0

## Recursos

- Tablas: account_deletion_requests, attempt_history, classrooms, data_export_requests, enrollments, notification_state, profiles, questions, student_badges, subject_scores, subject_topics, subjects, support_ticket_attachments, topic_scores, user_notification_preferences, user_preferences, user_support_tickets
- RPC: acknowledge_teacher_audit_alert, add_support_ticket_message, add_teacher_student_note, admin_update_support_ticket_secured, archive_teacher_topic, assign_admin_role, assign_manual_review_attempts, batch_review_manual_attempts, cancel_account_deletion, create_subject_with_default_topic, create_teacher_classroom, create_teacher_notification, deactivate_push_token, delete_notifications, duplicate_teacher_subject, equip_profile_cosmetics, finish_game_attempt, get_activity_attempt_detail, get_admin_audit_logs_page_secured, get_admin_audit_policy, get_admin_classrooms_page, get_admin_dashboard_metrics, get_admin_directory_filters, get_admin_export_download_path, get_admin_export_jobs_page, get_admin_portal_context, get_admin_profile_activity_page, get_admin_profiles_page, get_admin_push_delivery_metrics, get_admin_role_assignments_page, get_admin_roles, get_admin_subjects_page, get_admin_support_directory, get_admin_support_tickets_page_secured, get_admin_usage_analytics, get_admin_user_change_history_page, get_attempt_feedback, get_avatar_customization_options, get_class_ranking_profiles, get_manual_review_configuration, get_manual_review_history, get_manual_review_thread, get_notifications_page, get_own_support_email_history, get_own_support_tickets_page, get_profile_cosmetics, get_question_media_manifest, get_ranking_profiles_page, get_safe_game_questions, get_student_attempt_history, get_student_attempt_history_page, get_student_badge_catalog, get_student_home_dashboard, get_student_progress_summary, get_student_question_catalog, get_support_contact_channels, get_support_thread_page, get_teacher_attention_students_page, get_teacher_audit_configuration, get_teacher_audit_logs_page_v2, get_teacher_classrooms_page, get_teacher_courses_page, get_teacher_dashboard_summary, get_teacher_manual_review_queue, get_teacher_notification_center_summary, get_teacher_notification_settings, get_teacher_notifications_page, get_teacher_profile_recent_questions_page, get_teacher_profile_recent_subjects_page, get_teacher_profile_summary, get_teacher_question_affected_students_page, get_teacher_question_report, get_teacher_recent_activity_page, get_teacher_student_history_metrics, get_teacher_student_history_reviews_page, get_teacher_student_history_summary, get_teacher_student_history_timeline_page, get_teacher_student_history_weaknesses, get_teacher_students_page, get_teacher_subject_analytics, get_teacher_subject_overview, get_teacher_subject_questions_page, get_teacher_subject_students_page, get_teacher_subject_topics_page, get_teacher_topic_questions_page, get_teacher_topic_summary, initialize_guest_profile, join_subject_by_code, mark_notifications_read, register_push_token, register_user_session, request_account_data_export, request_account_deletion, request_admin_export_job, request_teacher_audit_export, review_manual_review_attempt, save_manual_review_filter, save_manual_review_rubric, save_manual_review_settings, save_manual_review_template, save_teacher_audit_filter, save_teacher_question, search_app_entities, set_analytics_consent, set_teacher_course_notification_preference, set_teacher_digest_preference, set_teacher_notifications_mute, set_teacher_support_preference, start_game_attempt, submit_answer_resumable, sync_student_badges, track_usage_event, verify_admin_audit_chain
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
| edge | `import-students` | `components/teacher/TeacherStudentImportModal.tsx` | 85 |
| edge | `manage-account-security` | `components/settings/ManagedSessionsCard.tsx` | 34 |
| edge | `process-question-media` | `lib/questionMedia.ts` | 378 |
| edge | `profile-update-avatar` | `components/student/profile/StudentAvatarCustomizationModal.tsx` | 118 |
| edge | `profile-update-avatar` | `hooks/teacher/useTeacherProfile.ts` | 231 |
| edge | `profile-update-avatar` | `lib/offlineMutations.ts` | 286 |
| edge | `student-reset-own-progress` | `hooks/useSettingsData.ts` | 295 |
| edge | `teacher-archive-subject` | `features/teacher-subject/api.ts` | 41 |
| edge | `teacher-create-topic` | `features/teacher-subject/api.ts` | 23 |
| edge | `teacher-delete-question` | `app/(teacher)/topic/[id].tsx` | 88 |
| edge | `teacher-delete-question` | `features/teacher-subject/api.ts` | 34 |
| edge | `teacher-delete-question` | `hooks/teacher/useQuestionReport.ts` | 84 |
| edge | `teacher-reset-own-data` | `hooks/useSettingsData.ts` | 312 |
| edge | `teacher-student-reminder` | `app/(teacher)/student/[id]/history.tsx` | 77 |
| edge | `teacher-student-reminder` | `components/teacher/TeacherStudentImportModal.tsx` | 171 |
| edge | `teacher-student-reminder` | `features/teacher-students/api.ts` | 46 |
| edge | `teacher-update-subject` | `components/teacher/TeacherSubjectForm.tsx` | 183 |
| edge | `teacher-update-topic` | `components/teacher/TeacherTopicForm.tsx` | 182 |
| rpc | `acknowledge_teacher_audit_alert` | `hooks/teacher/useTeacherAudit.ts` | 120 |
| rpc | `add_support_ticket_message` | `lib/support.ts` | 306 |
| rpc | `add_teacher_student_note` | `hooks/teacher/useTeacherStudentHistory.ts` | 168 |
| rpc | `admin_update_support_ticket_secured` | `components/admin/support/AdminSupportSection.tsx` | 123 |
| rpc | `archive_teacher_topic` | `hooks/teacher/useTeacherTopicDetail.ts` | 108 |
| rpc | `assign_admin_role` | `components/admin/api/adminApi.ts` | 123 |
| rpc | `assign_manual_review_attempts` | `hooks/teacher/useManualReview.ts` | 115 |
| rpc | `batch_review_manual_attempts` | `hooks/teacher/useManualReview.ts` | 150 |
| rpc | `cancel_account_deletion` | `components/settings/AccountDataRequestsCard.tsx` | 109 |
| rpc | `create_subject_with_default_topic` | `components/teacher/TeacherSubjectForm.tsx` | 218 |
| rpc | `create_teacher_classroom` | `features/teacher-subject/api.ts` | 4 |
| rpc | `create_teacher_notification` | `lib/notifications/teacher.ts` | 20 |
| rpc | `deactivate_push_token` | `lib/pushNotifications.ts` | 104 |
| rpc | `delete_notifications` | `lib/notifications/persistent.ts` | 149 |
| rpc | `duplicate_teacher_subject` | `features/teacher-subject/api.ts` | 48 |
| rpc | `equip_profile_cosmetics` | `lib/avatarCosmetics.ts` | 118 |
| rpc | `finish_game_attempt` | `hooks/useGame.ts` | 258 |
| rpc | `get_activity_attempt_detail` | `lib/studentSecureData.ts` | 231 |
| rpc | `get_admin_audit_logs_page_secured` | `components/admin/audit/AdminAuditSection.tsx` | 51 |
| rpc | `get_admin_audit_logs_page_secured` | `lib/adminExports.ts` | 230 |
| rpc | `get_admin_audit_policy` | `components/admin/audit/AdminAuditSection.tsx` | 48 |
| rpc | `get_admin_classrooms_page` | `components/admin/classrooms/AdminClassroomsSection.tsx` | 54 |
| rpc | `get_admin_dashboard_metrics` | `components/admin/hooks/useAdminData.ts` | 31 |
| rpc | `get_admin_directory_filters` | `components/admin/shared/AdminAdvancedFilters.tsx` | 42 |
| rpc | `get_admin_export_download_path` | `components/admin/api/adminApi.ts` | 90 |
| rpc | `get_admin_export_jobs_page` | `components/admin/api/adminApi.ts` | 84 |
| rpc | `get_admin_portal_context` | `components/admin/api/adminApi.ts` | 49 |
| rpc | `get_admin_profile_activity_page` | `components/admin/users/AdminProfileActivityScreen.tsx` | 47 |
| rpc | `get_admin_profiles_page` | `components/admin/hooks/useAdminData.ts` | 32 |
| rpc | `get_admin_profiles_page` | `components/admin/users/AdminStudentsSection.tsx` | 53 |
| rpc | `get_admin_profiles_page` | `components/admin/users/AdminTeachersSection.tsx` | 62 |
| rpc | `get_admin_push_delivery_metrics` | `components/admin/dashboard/AdminPushDeliveryPanel.tsx` | 68 |
| rpc | `get_admin_role_assignments_page` | `components/admin/api/adminApi.ts` | 117 |
| rpc | `get_admin_roles` | `components/admin/api/adminApi.ts` | 111 |
| rpc | `get_admin_subjects_page` | `components/admin/courses/AdminCoursesSection.tsx` | 54 |
| rpc | `get_admin_support_directory` | `lib/support.ts` | 193 |
| rpc | `get_admin_support_tickets_page_secured` | `components/admin/support/AdminSupportSection.tsx` | 56 |
| rpc | `get_admin_support_tickets_page_secured` | `lib/adminExports.ts` | 264 |
| rpc | `get_admin_usage_analytics` | `components/admin/dashboard/AdminUsageAnalyticsPanel.tsx` | 19 |
| rpc | `get_admin_user_change_history_page` | `components/admin/api/adminApi.ts` | 101 |
| rpc | `get_attempt_feedback` | `lib/studentSecureData.ts` | 222 |
| rpc | `get_avatar_customization_options` | `lib/avatarCosmetics.ts` | 83 |
| rpc | `get_class_ranking_profiles` | `app/(student)/class/[id].tsx` | 189 |
| rpc | `get_manual_review_configuration` | `hooks/teacher/useManualReview.ts` | 43 |
| rpc | `get_manual_review_history` | `hooks/teacher/useManualReview.ts` | 199 |
| rpc | `get_manual_review_thread` | `hooks/teacher/useManualReview.ts` | 198 |
| rpc | `get_notifications_page` | `lib/notifications/persistent.ts` | 49 |
| rpc | `get_own_support_email_history` | `lib/support.ts` | 224 |
| rpc | `get_own_support_tickets_page` | `lib/support.ts` | 135 |
| rpc | `get_profile_cosmetics` | `lib/avatarCosmetics.ts` | 138 |
| rpc | `get_question_media_manifest` | `lib/questionMedia.ts` | 269 |
| rpc | `get_ranking_profiles_page` | `hooks/student/useStudentRanking.ts` | 298 |
| rpc | `get_safe_game_questions` | `hooks/useGame.ts` | 169 |
| rpc | `get_student_attempt_history` | `lib/studentSecureData.ts` | 154 |
| rpc | `get_student_attempt_history_page` | `lib/studentSecureData.ts` | 179 |
| rpc | `get_student_badge_catalog` | `lib/studentBadges.ts` | 129 |
| rpc | `get_student_home_dashboard` | `features/student-home/api.ts` | 5 |
| rpc | `get_student_progress_summary` | `features/student-progress/api.ts` | 5 |
| rpc | `get_student_question_catalog` | `lib/studentSecureData.ts` | 137 |
| rpc | `get_support_contact_channels` | `lib/support.ts` | 210 |
| rpc | `get_support_thread_page` | `lib/support.ts` | 169 |
| rpc | `get_teacher_attention_students_page` | `features/teacher-dashboard/api.ts` | 13 |
| rpc | `get_teacher_audit_configuration` | `hooks/teacher/useTeacherAudit.ts` | 60 |
| rpc | `get_teacher_audit_logs_page_v2` | `hooks/teacher/useTeacherAudit.ts` | 49 |
| rpc | `get_teacher_classrooms_page` | `features/teacher-catalog/api.ts` | 22 |
| rpc | `get_teacher_courses_page` | `features/teacher-catalog/api.ts` | 12 |
| rpc | `get_teacher_dashboard_summary` | `features/teacher-dashboard/api.ts` | 12 |
| rpc | `get_teacher_manual_review_queue` | `hooks/teacher/useManualReview.ts` | 49 |
| rpc | `get_teacher_notification_center_summary` | `hooks/teacher/useTeacherNotifications.ts` | 64 |
| rpc | `get_teacher_notification_settings` | `hooks/teacher/useTeacherCommunicationSettings.ts` | 60 |
| rpc | `get_teacher_notifications_page` | `hooks/teacher/useTeacherNotifications.ts` | 88 |
| rpc | `get_teacher_profile_recent_questions_page` | `hooks/teacher/useTeacherProfile.ts` | 177 |
| rpc | `get_teacher_profile_recent_subjects_page` | `hooks/teacher/useTeacherProfile.ts` | 150 |
| rpc | `get_teacher_profile_summary` | `hooks/teacher/useTeacherProfile.ts` | 122 |
| rpc | `get_teacher_question_affected_students_page` | `hooks/teacher/useQuestionReport.ts` | 42 |
| rpc | `get_teacher_question_report` | `hooks/teacher/useQuestionReport.ts` | 36 |
| rpc | `get_teacher_recent_activity_page` | `features/teacher-dashboard/api.ts` | 14 |
| rpc | `get_teacher_student_history_metrics` | `hooks/teacher/useTeacherStudentHistory.ts` | 96 |
| rpc | `get_teacher_student_history_reviews_page` | `hooks/teacher/useTeacherStudentHistory.ts` | 84 |
| rpc | `get_teacher_student_history_summary` | `hooks/teacher/useTeacherStudentHistory.ts` | 51 |
| rpc | `get_teacher_student_history_timeline_page` | `hooks/teacher/useTeacherStudentHistory.ts` | 60 |
| rpc | `get_teacher_student_history_weaknesses` | `hooks/teacher/useTeacherStudentHistory.ts` | 74 |
| rpc | `get_teacher_students_page` | `features/teacher-students/api.ts` | 14 |
| rpc | `get_teacher_subject_analytics` | `hooks/teacher/subject/useTeacherSubjectAnalytics.ts` | 21 |
| rpc | `get_teacher_subject_overview` | `hooks/teacher/subject/useTeacherSubjectOverview.ts` | 28 |
| rpc | `get_teacher_subject_questions_page` | `hooks/teacher/subject/useTeacherSubjectQuestions.ts` | 16 |
| rpc | `get_teacher_subject_students_page` | `hooks/teacher/subject/useTeacherSubjectStudents.ts` | 35 |
| rpc | `get_teacher_subject_topics_page` | `hooks/teacher/subject/useTeacherSubjectTopics.ts` | 12 |
| rpc | `get_teacher_topic_questions_page` | `hooks/teacher/useTeacherTopicDetail.ts` | 47 |
| rpc | `get_teacher_topic_summary` | `hooks/teacher/useTeacherTopicDetail.ts` | 39 |
| rpc | `initialize_guest_profile` | `app/_layout.tsx` | 173 |
| rpc | `initialize_guest_profile` | `app/index.tsx` | 123 |
| rpc | `join_subject_by_code` | `lib/studentClassJoin.ts` | 31 |
| rpc | `mark_notifications_read` | `lib/notifications/persistent.ts` | 138 |
| rpc | `register_push_token` | `lib/pushNotifications.ts` | 82 |
| rpc | `register_user_session` | `lib/sessionSecurity.ts` | 21 |
| rpc | `request_account_data_export` | `components/settings/AccountDataRequestsCard.tsx` | 82 |
| rpc | `request_account_deletion` | `hooks/useSettingsData.ts` | 789 |
| rpc | `request_admin_export_job` | `components/admin/api/adminApi.ts` | 75 |
| rpc | `request_teacher_audit_export` | `hooks/teacher/useTeacherAudit.ts` | 115 |
| rpc | `review_manual_review_attempt` | `hooks/teacher/useManualReview.ts` | 131 |
| rpc | `save_manual_review_filter` | `hooks/teacher/useManualReview.ts` | 188 |
| rpc | `save_manual_review_rubric` | `hooks/teacher/useManualReview.ts` | 168 |
| rpc | `save_manual_review_settings` | `hooks/teacher/useManualReview.ts` | 163 |
| rpc | `save_manual_review_template` | `hooks/teacher/useManualReview.ts` | 178 |
| rpc | `save_teacher_audit_filter` | `hooks/teacher/useTeacherAudit.ts` | 106 |
| rpc | `save_teacher_question` | `components/teacher/question-form/useTeacherQuestionForm.ts` | 603 |
| rpc | `search_app_entities` | `components/search/GlobalSearchButton.tsx` | 66 |
| rpc | `set_analytics_consent` | `lib/analytics.ts` | 60 |
| rpc | `set_teacher_course_notification_preference` | `hooks/teacher/useTeacherCommunicationSettings.ts` | 132 |
| rpc | `set_teacher_digest_preference` | `hooks/teacher/useTeacherCommunicationSettings.ts` | 92 |
| rpc | `set_teacher_notifications_mute` | `hooks/teacher/useTeacherCommunicationSettings.ts` | 112 |
| rpc | `set_teacher_notifications_mute` | `hooks/teacher/useTeacherNotifications.ts` | 204 |
| rpc | `set_teacher_support_preference` | `hooks/teacher/useTeacherCommunicationSettings.ts` | 153 |
| rpc | `start_game_attempt` | `hooks/useGame.ts` | 192 |
| rpc | `submit_answer_resumable` | `hooks/useGame.ts` | 416 |
| rpc | `sync_student_badges` | `lib/offlineMutations.ts` | 295 |
| rpc | `sync_student_badges` | `lib/studentBadges.ts` | 503 |
| rpc | `track_usage_event` | `lib/analytics.ts` | 91 |
| rpc | `verify_admin_audit_chain` | `components/admin/audit/AdminAuditSection.tsx` | 61 |
| storage | `account-exports` | `components/settings/AccountDataRequestsCard.tsx` | 96 |
| storage | `admin-exports` | `components/admin/api/adminApi.ts` | 95 |
| storage | `avatars` | `components/student/profile/StudentAvatarCustomizationModal.tsx` | 115 |
| storage | `avatars` | `hooks/teacher/useTeacherProfile.ts` | 225 |
| storage | `avatars` | `lib/offlineMutations.ts` | 284 |
| storage | `teacher-audit-exports` | `hooks/teacher/useTeacherAudit.ts` | 125 |
| table | `account_deletion_requests` | `components/settings/AccountDataRequestsCard.tsx` | 57 |
| table | `attempt_history` | `hooks/student/useStudentProgress.ts` | 120 |
| table | `attempt_history` | `lib/weeklyGoal.ts` | 19 |
| table | `classrooms` | `lib/classCode.ts` | 46 |
| table | `data_export_requests` | `components/settings/AccountDataRequestsCard.tsx` | 52 |
| table | `enrollments` | `app/(student)/class/[id].tsx` | 140 |
| table | `enrollments` | `app/(student)/classes.tsx` | 166 |
| table | `enrollments` | `hooks/student/useStudentProfile.ts` | 101 |
| table | `enrollments` | `hooks/student/useStudentRanking.ts` | 328 |
| table | `enrollments` | `lib/notifications/derivedStudent.ts` | 23 |
| table | `enrollments` | `lib/notifications/derivedTeacher.ts` | 27 |
| table | `enrollments` | `lib/offlineMutations.ts` | 258 |
| table | `notification_state` | `lib/notifications/persistent.ts` | 168 |
| table | `notification_state` | `lib/notifications/persistent.ts` | 201 |
| table | `notification_state` | `lib/notifications/persistent.ts` | 213 |
| table | `notification_state` | `lib/notifications/persistent.ts` | 226 |
| table | `profiles` | `app/_layout.tsx` | 160 |
| table | `profiles` | `app/_layout.tsx` | 178 |
| table | `profiles` | `app/(auth)/login.tsx` | 122 |
| table | `profiles` | `app/(student)/badges.tsx` | 128 |
| table | `profiles` | `app/(student)/classes.tsx` | 165 |
| table | `profiles` | `app/(student)/notifications.tsx` | 95 |
| table | `profiles` | `components/admin/users/AdminProfileActivityScreen.tsx` | 35 |
| table | `profiles` | `components/teacher/TeacherSidebar.tsx` | 71 |
| table | `profiles` | `components/ui/RoleHeaderAvatar.tsx` | 35 |
| table | `profiles` | `hooks/student/useStudentActivity.ts` | 93 |
| table | `profiles` | `hooks/student/useStudentProfile.ts` | 96 |
| table | `profiles` | `hooks/student/useStudentProgress.ts` | 114 |
| table | `profiles` | `hooks/student/useStudentRanking.ts` | 118 |
| table | `profiles` | `hooks/student/useStudentRanking.ts` | 228 |
| table | `profiles` | `hooks/useNotifications.ts` | 94 |
| table | `profiles` | `hooks/useSettingsData.ts` | 202 |
| table | `profiles` | `hooks/useSettingsData.ts` | 212 |
| table | `profiles` | `hooks/useSettingsData.ts` | 360 |
| table | `profiles` | `hooks/useSettingsData.ts` | 388 |
| table | `profiles` | `hooks/useSettingsData.ts` | 724 |
| table | `profiles` | `lib/notifications/derivedTeacher.ts` | 75 |
| table | `profiles` | `lib/studentClassJoin.ts` | 18 |
| table | `questions` | `components/teacher/question-form/useTeacherQuestionForm.ts` | 286 |
| table | `questions` | `lib/notifications/derivedTeacher.ts` | 40 |
| table | `student_badges` | `lib/notifications/derivedStudent.ts` | 33 |
| table | `subject_scores` | `app/(student)/class/[id].tsx` | 177 |
| table | `subject_scores` | `components/NotificationBadge.tsx` | 53 |
| table | `subject_scores` | `hooks/student/useStudentProfile.ts` | 102 |
| table | `subject_scores` | `hooks/student/useStudentProgress.ts` | 115 |
| table | `subject_scores` | `lib/notifications/derivedStudent.ts` | 28 |
| table | `subject_scores` | `lib/notifications/derivedTeacher.ts` | 33 |
| table | `subject_topics` | `app/(student)/class/[id].tsx` | 159 |
| table | `subject_topics` | `components/teacher/question-form/useTeacherQuestionForm.ts` | 277 |
| table | `subject_topics` | `components/teacher/TeacherTopicForm.tsx` | 86 |
| table | `subject_topics` | `components/teacher/TeacherTopicForm.tsx` | 103 |
| table | `subjects` | `components/teacher/question-form/useTeacherQuestionForm.ts` | 268 |
| table | `subjects` | `components/teacher/TeacherSubjectForm.tsx` | 104 |
| table | `subjects` | `components/teacher/TeacherTopicForm.tsx` | 94 |
| table | `subjects` | `hooks/teacher/useQuestionReport.ts` | 59 |
| table | `subjects` | `hooks/teacher/useTeacherAudit.ts` | 70 |
| table | `subjects` | `hooks/useSettingsData.ts` | 403 |
| table | `subjects` | `hooks/useSettingsData.ts` | 637 |
| table | `subjects` | `lib/classCode.ts` | 33 |
| table | `subjects` | `lib/notifications/derivedTeacher.ts` | 13 |
| table | `support_ticket_attachments` | `lib/support.ts` | 393 |
| table | `topic_scores` | `app/(student)/class/[id].tsx` | 171 |
| table | `user_notification_preferences` | `hooks/useSettingsData.ts` | 594 |
| table | `user_notification_preferences` | `hooks/useSettingsData.ts` | 640 |
| table | `user_notification_preferences` | `hooks/useSettingsData.ts` | 647 |
| table | `user_notification_preferences` | `lib/notifications/preferences.ts` | 14 |
| table | `user_notification_preferences` | `lib/pushNotifications.ts` | 117 |
| table | `user_preferences` | `hooks/useSettingsData.ts` | 572 |
| table | `user_preferences` | `hooks/useSettingsData.ts` | 632 |
| table | `user_preferences` | `lib/analytics.ts` | 39 |
| table | `user_support_tickets` | `lib/support.ts` | 147 |
| table | `user_support_tickets` | `lib/support.ts` | 266 |

## Resultado

- PASS: no se detectaron huecos estructurales en el inventario estático.

