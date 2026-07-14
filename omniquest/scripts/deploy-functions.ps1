$ErrorActionPreference = "Stop"

$Functions = @(
  "admin-archive-course",
  "admin-create-teacher",
  "admin-deactivate-classroom",
  "admin-delete-student-progress",
  "admin-reset-password",
  "admin-toggle-user",
  "delete-account",
  "import-students",
  "profile-update-avatar",
  "student-reset-own-progress",
  "teacher-archive-subject",
  "teacher-create-topic",
  "teacher-delete-question",
  "teacher-regenerate-class-code",
  "teacher-remove-student-from-class",
  "teacher-reset-student-progress",
  "teacher-student-reminder",
  "teacher-update-subject",
  "teacher-update-topic"
)

Write-Host "Deploying $($Functions.Count) Supabase Edge Functions..."
supabase functions deploy @Functions
Write-Host "Edge Functions deployed successfully."
