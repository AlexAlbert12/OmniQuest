export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_backup_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: number
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: number
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: number
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_backup_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: number
          metadata: Json
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: number
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: number
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: number
          metadata: Json
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: number
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: number
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          attempt_id: string | null
          classroom_id: number | null
          event_name: string
          id: number
          occurred_at: string
          properties: Json
          purpose: string
          reporting_id: string | null
          role: string | null
          session_id: string | null
          subject_id: number | null
          topic_id: number | null
          user_id: string | null
        }
        Insert: {
          attempt_id?: string | null
          classroom_id?: number | null
          event_name: string
          id?: number
          occurred_at?: string
          properties?: Json
          purpose?: string
          reporting_id?: string | null
          role?: string | null
          session_id?: string | null
          subject_id?: number | null
          topic_id?: number | null
          user_id?: string | null
        }
        Update: {
          attempt_id?: string | null
          classroom_id?: number | null
          event_name?: string
          id?: number
          occurred_at?: string
          properties?: Json
          purpose?: string
          reporting_id?: string | null
          role?: string | null
          session_id?: string | null
          subject_id?: number | null
          topic_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "game_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_reporting_identities: {
        Row: {
          created_at: string
          reporting_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reporting_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          reporting_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_reporting_identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_retention_policy: {
        Row: {
          anonymize_after_days: number
          retention_days: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          anonymize_after_days?: number
          retention_days?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          anonymize_after_days?: number
          retention_days?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      answers: {
        Row: {
          id: number
          is_correct: boolean | null
          question_id: number | null
          sort_order: number | null
          text: string
        }
        Insert: {
          id?: number
          is_correct?: boolean | null
          question_id?: number | null
          sort_order?: number | null
          text: string
        }
        Update: {
          id?: number
          is_correct?: boolean | null
          question_id?: number | null
          sort_order?: number | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_history: {
        Row: {
          answer_id: number | null
          attempt_id: string | null
          attempted_at: string | null
          created_at: string | null
          earned_points: number
          hint_used: boolean
          id: number
          is_correct: boolean
          manual_review_status: string
          question_id: number
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          student_id: string
          submitted_answer_payload: Json | null
          submitted_answer_text: string | null
          time_taken_seconds: number | null
          was_skipped: boolean
        }
        Insert: {
          answer_id?: number | null
          attempt_id?: string | null
          attempted_at?: string | null
          created_at?: string | null
          earned_points?: number
          hint_used?: boolean
          id?: number
          is_correct: boolean
          manual_review_status?: string
          question_id: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          student_id: string
          submitted_answer_payload?: Json | null
          submitted_answer_text?: string | null
          time_taken_seconds?: number | null
          was_skipped?: boolean
        }
        Update: {
          answer_id?: number | null
          attempt_id?: string | null
          attempted_at?: string | null
          created_at?: string | null
          earned_points?: number
          hint_used?: boolean
          id?: number
          is_correct?: boolean
          manual_review_status?: string
          question_id?: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          student_id?: string
          submitted_answer_payload?: Json | null
          submitted_answer_text?: string | null
          time_taken_seconds?: number | null
          was_skipped?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "attempt_history_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_history_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "game_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_history_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_history_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_rate_limits: {
        Row: {
          action: string
          attempts: number
          blocked_until: string | null
          key_hash: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          action: string
          attempts?: number
          blocked_until?: string | null
          key_hash: string
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          action?: string
          attempts?: number
          blocked_until?: string | null
          key_hash?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      avatar_frames: {
        Row: {
          created_at: string
          description: string | null
          frame_key: string
          is_active: boolean
          minimum_level: number
          name: string
          primary_color: string
          rarity: string
          required_badge_id: string | null
          secondary_color: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          frame_key: string
          is_active?: boolean
          minimum_level?: number
          name: string
          primary_color: string
          rarity?: string
          required_badge_id?: string | null
          secondary_color: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          frame_key?: string
          is_active?: boolean
          minimum_level?: number
          name?: string
          primary_color?: string
          rarity?: string
          required_badge_id?: string | null
          secondary_color?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatar_frames_required_badge_id_fkey"
            columns: ["required_badge_id"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["badge_id"]
          },
        ]
      }
      badge_categories: {
        Row: {
          category_key: string
          color: string
          created_at: string
          description: string | null
          icon: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_key: string
          color: string
          created_at?: string
          description?: string | null
          icon: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_key?: string
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      badge_definitions: {
        Row: {
          badge_id: string
          category_key: string
          color: string
          created_at: string
          description: string
          icon: string
          is_active: boolean
          metric_key: string
          minimum_samples: number
          requirement: string
          reward_xp: number
          sort_order: number
          target_value: number
          title: string
          unit_plural: string
          unit_singular: string
          updated_at: string
        }
        Insert: {
          badge_id: string
          category_key: string
          color: string
          created_at?: string
          description: string
          icon: string
          is_active?: boolean
          metric_key: string
          minimum_samples?: number
          requirement: string
          reward_xp?: number
          sort_order?: number
          target_value: number
          title: string
          unit_plural: string
          unit_singular: string
          updated_at?: string
        }
        Update: {
          badge_id?: string
          category_key?: string
          color?: string
          created_at?: string
          description?: string
          icon?: string
          is_active?: boolean
          metric_key?: string
          minimum_samples?: number
          requirement?: string
          reward_xp?: number
          sort_order?: number
          target_value?: number
          title?: string
          unit_plural?: string
          unit_singular?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "badge_definitions_category_key_fkey"
            columns: ["category_key"]
            isOneToOne: false
            referencedRelation: "badge_categories"
            referencedColumns: ["category_key"]
          },
        ]
      }
      classrooms: {
        Row: {
          academic_year: string | null
          active: boolean
          code: string | null
          created_at: string
          id: number
          name: string
          subject_id: number | null
        }
        Insert: {
          academic_year?: string | null
          active?: boolean
          code?: string | null
          created_at?: string
          id?: number
          name: string
          subject_id?: number | null
        }
        Update: {
          academic_year?: string | null
          active?: boolean
          code?: string | null
          created_at?: string
          id?: number
          name?: string
          subject_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "classrooms_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          classroom_id: number | null
          id: number
          joined_at: string
          student_id: string | null
          subject_id: number | null
        }
        Insert: {
          classroom_id?: number | null
          id?: number
          joined_at?: string
          student_id?: string | null
          subject_id?: number | null
        }
        Update: {
          classroom_id?: number | null
          id?: number
          joined_at?: string
          student_id?: string | null
          subject_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      game_answer_submission_receipts: {
        Row: {
          created_at: string
          result: Json
          student_id: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          result: Json
          student_id: string
          submission_id: string
        }
        Update: {
          created_at?: string
          result?: Json
          student_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_answer_submission_receipts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_attempts: {
        Row: {
          classroom_id: number | null
          correct_answers: number
          finished_at: string | null
          id: string
          started_at: string
          status: string
          student_id: string
          subject_id: number
          topic_id: number | null
          total_score: number
          updated_at: string
        }
        Insert: {
          classroom_id?: number | null
          correct_answers?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          student_id: string
          subject_id: number
          topic_id?: number | null
          total_score?: number
          updated_at?: string
        }
        Update: {
          classroom_id?: number | null
          correct_answers?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          student_id?: string
          subject_id?: number
          topic_id?: number | null
          total_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_attempts_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_attempts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_attempts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_review_comments: {
        Row: {
          attempt_history_id: number
          audience: string
          author_id: string
          body: string
          created_at: string
          id: number
        }
        Insert: {
          attempt_history_id: number
          audience?: string
          author_id: string
          body: string
          created_at?: string
          id?: number
        }
        Update: {
          attempt_history_id?: number
          audience?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "manual_review_comments_attempt_history_id_fkey"
            columns: ["attempt_history_id"]
            isOneToOne: false
            referencedRelation: "attempt_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_review_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_queue: {
        Row: {
          attempts: number
          channel: string
          completed_at: string | null
          created_at: string
          delivery_cycle: number
          enqueued_at: string
          id: number
          last_error_code: string | null
          last_error_message: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string
          notification_id: string
          priority: string
          skip_reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel?: string
          completed_at?: string | null
          created_at?: string
          delivery_cycle?: number
          enqueued_at?: string
          id?: number
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_attempt_at?: string
          notification_id: string
          priority?: string
          skip_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          completed_at?: string | null
          created_at?: string
          delivery_cycle?: number
          enqueued_at?: string
          id?: number
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_attempt_at?: string
          notification_id?: string
          priority?: string
          skip_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_queue_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_delivery_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_push_deliveries: {
        Row: {
          attempt_number: number
          created_at: string
          delivered_at: string | null
          delivery_cycle: number
          error_code: string | null
          error_message: string | null
          expo_ticket_id: string | null
          id: number
          push_token_id: number | null
          queue_id: number
          receipt_checked_at: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          delivered_at?: string | null
          delivery_cycle: number
          error_code?: string | null
          error_message?: string | null
          expo_ticket_id?: string | null
          id?: number
          push_token_id?: number | null
          queue_id: number
          receipt_checked_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          delivered_at?: string | null
          delivery_cycle?: number
          error_code?: string | null
          error_message?: string | null
          expo_ticket_id?: string | null
          id?: number
          push_token_id?: number | null
          queue_id?: number
          receipt_checked_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_push_deliveries_push_token_id_fkey"
            columns: ["push_token_id"]
            isOneToOne: false
            referencedRelation: "push_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_push_deliveries_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "notification_delivery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_push_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_state: {
        Row: {
          created_at: string | null
          id: number
          is_deleted: boolean
          is_read: boolean
          notification_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          is_deleted?: boolean
          is_read?: boolean
          notification_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          is_deleted?: boolean
          is_read?: boolean
          notification_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          audience: string
          color: string
          created_at: string
          deleted_at: string | null
          description: string
          fingerprint: string
          icon: string
          id: string
          metadata: Json
          read_at: string | null
          related_id: string | null
          related_table: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          audience: string
          color?: string
          created_at?: string
          deleted_at?: string | null
          description: string
          fingerprint: string
          icon?: string
          id?: string
          metadata?: Json
          read_at?: string | null
          related_id?: string | null
          related_table?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          audience?: string
          color?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          fingerprint?: string
          icon?: string
          id?: string
          metadata?: Json
          read_at?: string | null
          related_id?: string | null
          related_table?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_cosmetics: {
        Row: {
          created_at: string
          equipped_frame_key: string | null
          featured_badge_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipped_frame_key?: string | null
          featured_badge_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipped_frame_key?: string | null
          featured_badge_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_cosmetics_equipped_frame_key_fkey"
            columns: ["equipped_frame_key"]
            isOneToOne: false
            referencedRelation: "avatar_frames"
            referencedColumns: ["frame_key"]
          },
          {
            foreignKeyName: "profile_cosmetics_featured_badge_id_fkey"
            columns: ["featured_badge_id"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["badge_id"]
          },
          {
            foreignKeyName: "profile_cosmetics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean | null
          alias: string
          avatar: string | null
          converted_at: string | null
          created_at: string
          email: string | null
          expires_at: string | null
          id: string
          points: number | null
          role_id: string | null
          visibility: string
        }
        Insert: {
          active?: boolean | null
          alias: string
          avatar?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id: string
          points?: number | null
          role_id?: string | null
          visibility?: string
        }
        Update: {
          active?: boolean | null
          alias?: string
          avatar?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          points?: number | null
          role_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["badge_id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          active: boolean
          app_version: string | null
          created_at: string
          device_name: string | null
          expo_push_token: string
          id: number
          last_seen_at: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          app_version?: string | null
          created_at?: string
          device_name?: string | null
          expo_push_token: string
          id?: number
          last_seen_at?: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          app_version?: string | null
          created_at?: string
          device_name?: string | null
          expo_push_token?: string
          id?: number
          last_seen_at?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      question_media_assets: {
        Row: {
          attached_question_id: number | null
          created_at: string
          duration_seconds: number | null
          media_type: string
          mime_type: string
          orphaned_at: string | null
          owner_id: string
          path: string
          processed_at: string | null
          processed_path: string | null
          processing_error: string | null
          processing_status: string
          scan_status: string
          size_bytes: number
          subject_id: number
          subtitles_vtt: string | null
          thumbnail_path: string | null
          transcript: string | null
        }
        Insert: {
          attached_question_id?: number | null
          created_at?: string
          duration_seconds?: number | null
          media_type: string
          mime_type: string
          orphaned_at?: string | null
          owner_id: string
          path: string
          processed_at?: string | null
          processed_path?: string | null
          processing_error?: string | null
          processing_status?: string
          scan_status?: string
          size_bytes: number
          subject_id: number
          subtitles_vtt?: string | null
          thumbnail_path?: string | null
          transcript?: string | null
        }
        Update: {
          attached_question_id?: number | null
          created_at?: string
          duration_seconds?: number | null
          media_type?: string
          mime_type?: string
          orphaned_at?: string | null
          owner_id?: string
          path?: string
          processed_at?: string | null
          processed_path?: string | null
          processing_error?: string | null
          processing_status?: string
          scan_status?: string
          size_bytes?: number
          subject_id?: number
          subtitles_vtt?: string | null
          thumbnail_path?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_media_assets_attached_question_id_fkey"
            columns: ["attached_question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_media_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_media_assets_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          active: boolean | null
          classroom_id: number | null
          created_at: string
          difficulty: number | null
          explanation: string | null
          id: number
          media_alt_text: string | null
          media_caption: string | null
          media_path: string | null
          media_type: string | null
          media_url: string | null
          points_base: number | null
          subject_id: number | null
          text: string
          time_limit_seconds: number | null
          topic_id: number | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          classroom_id?: number | null
          created_at?: string
          difficulty?: number | null
          explanation?: string | null
          id?: number
          media_alt_text?: string | null
          media_caption?: string | null
          media_path?: string | null
          media_type?: string | null
          media_url?: string | null
          points_base?: number | null
          subject_id?: number | null
          text: string
          time_limit_seconds?: number | null
          topic_id?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          classroom_id?: number | null
          created_at?: string
          difficulty?: number | null
          explanation?: string | null
          id?: number
          media_alt_text?: string | null
          media_caption?: string | null
          media_path?: string | null
          media_type?: string | null
          media_url?: string | null
          points_base?: number | null
          subject_id?: number | null
          text?: string
          time_limit_seconds?: number | null
          topic_id?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_seasons: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string
          id: string
          name: string
          reset_at: string
          starts_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at: string
          id?: string
          name: string
          reset_at: string
          starts_at: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string
          id?: string
          name?: string
          reset_at?: string
          starts_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      student_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          created_at: string
          id: number
          reward_xp: number
          student_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          created_at?: string
          id?: number
          reward_xp?: number
          student_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          created_at?: string
          id?: number
          reward_xp?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_scores: {
        Row: {
          classroom_id: number | null
          correct_answers: number
          created_at: string
          id: number
          max_score: number | null
          played_at: string
          played_days: string[]
          student_id: string | null
          subject_id: number | null
          updated_at: string
        }
        Insert: {
          classroom_id?: number | null
          correct_answers?: number
          created_at?: string
          id?: number
          max_score?: number | null
          played_at?: string
          played_days?: string[]
          student_id?: string | null
          subject_id?: number | null
          updated_at?: string
        }
        Update: {
          classroom_id?: number | null
          correct_answers?: number
          created_at?: string
          id?: number
          max_score?: number | null
          played_at?: string
          played_days?: string[]
          student_id?: string | null
          subject_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_scores_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_scores_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_topics: {
        Row: {
          active: boolean
          available_until: string | null
          classroom_id: number | null
          created_at: string
          description: string | null
          icon: string | null
          id: number
          sort_order: number
          subject_id: number
          title: string
        }
        Insert: {
          active?: boolean
          available_until?: string | null
          classroom_id?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: number
          sort_order?: number
          subject_id: number
          title: string
        }
        Update: {
          active?: boolean
          available_until?: string | null
          classroom_id?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: number
          sort_order?: number
          subject_id?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_topics_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          academic_year: string | null
          active: boolean | null
          code: string
          created_at: string
          description: string | null
          education_level: string | null
          icon: string | null
          id: number
          is_archived: boolean
          name: string
          subject_label: string | null
          teacher_id: string | null
          theme_color: string | null
        }
        Insert: {
          academic_year?: string | null
          active?: boolean | null
          code: string
          created_at?: string
          description?: string | null
          education_level?: string | null
          icon?: string | null
          id?: number
          is_archived?: boolean
          name: string
          subject_label?: string | null
          teacher_id?: string | null
          theme_color?: string | null
        }
        Update: {
          academic_year?: string | null
          active?: boolean | null
          code?: string
          created_at?: string
          description?: string | null
          education_level?: string | null
          icon?: string | null
          id?: number
          is_archived?: boolean
          name?: string
          subject_label?: string | null
          teacher_id?: string | null
          theme_color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_audit_logs: {
        Row: {
          action: string
          created_at: string
          id: number
          metadata: Json
          target_id: string | null
          target_table: string | null
          teacher_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
          teacher_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_audit_logs_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_digest_deliveries: {
        Row: {
          attempts: number
          created_at: string
          frequency: string
          id: number
          last_error_code: string | null
          last_error_message: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string
          period_end: string
          period_start: string
          provider_message_id: string | null
          recipient_email: string
          sent_at: string | null
          snapshot: Json
          status: string
          teacher_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          frequency: string
          id?: number
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_attempt_at?: string
          period_end: string
          period_start: string
          provider_message_id?: string | null
          recipient_email: string
          sent_at?: string | null
          snapshot?: Json
          status?: string
          teacher_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          frequency?: string
          id?: number
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_attempt_at?: string
          period_end?: string
          period_start?: string
          provider_message_id?: string | null
          recipient_email?: string
          sent_at?: string | null
          snapshot?: Json
          status?: string
          teacher_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_digest_deliveries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_student_recovery_requests: {
        Row: {
          classroom_id: number | null
          created_at: string
          delivery_mode: string | null
          error_code: string | null
          error_message: string | null
          expires_at: string
          id: string
          sent_at: string | null
          status: string
          student_id: string
          subject_id: number
          teacher_id: string
          updated_at: string
        }
        Insert: {
          classroom_id?: number | null
          created_at?: string
          delivery_mode?: string | null
          error_code?: string | null
          error_message?: string | null
          expires_at?: string
          id?: string
          sent_at?: string | null
          status?: string
          student_id: string
          subject_id: number
          teacher_id: string
          updated_at?: string
        }
        Update: {
          classroom_id?: number | null
          created_at?: string
          delivery_mode?: string | null
          error_code?: string | null
          error_message?: string | null
          expires_at?: string
          id?: string
          sent_at?: string | null
          status?: string
          student_id?: string
          subject_id?: number
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_student_recovery_requests_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_recovery_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_recovery_requests_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_recovery_requests_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_scores: {
        Row: {
          classroom_id: number | null
          created_at: string
          id: number
          max_score: number
          played_at: string
          student_id: string
          subject_id: number
          topic_id: number
          updated_at: string
        }
        Insert: {
          classroom_id?: number | null
          created_at?: string
          id?: number
          max_score?: number
          played_at?: string
          student_id: string
          subject_id: number
          topic_id: number
          updated_at?: string
        }
        Update: {
          classroom_id?: number | null
          created_at?: string
          id?: number
          max_score?: number
          played_at?: string
          student_id?: string
          subject_id?: number
          topic_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_scores_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_scores_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_scores_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          activity_enabled: boolean
          created_at: string
          daily_summary_enabled: boolean
          email_enabled: boolean
          frequency: string
          news_enabled: boolean
          push_enabled: boolean
          teacher_digest_frequency: string
          teacher_digest_last_sent_at: string | null
          teacher_digest_unsubscribed_at: string | null
          teacher_inactive_student_alerts: boolean
          teacher_open_review_alerts: boolean
          teacher_reminder_email: string | null
          teacher_sensitive_action_alerts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_enabled?: boolean
          created_at?: string
          daily_summary_enabled?: boolean
          email_enabled?: boolean
          frequency?: string
          news_enabled?: boolean
          push_enabled?: boolean
          teacher_digest_frequency?: string
          teacher_digest_last_sent_at?: string | null
          teacher_digest_unsubscribed_at?: string | null
          teacher_inactive_student_alerts?: boolean
          teacher_open_review_alerts?: boolean
          teacher_reminder_email?: string | null
          teacher_sensitive_action_alerts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_enabled?: boolean
          created_at?: string
          daily_summary_enabled?: boolean
          email_enabled?: boolean
          frequency?: string
          news_enabled?: boolean
          push_enabled?: boolean
          teacher_digest_frequency?: string
          teacher_digest_last_sent_at?: string | null
          teacher_digest_unsubscribed_at?: string | null
          teacher_inactive_student_alerts?: boolean
          teacher_open_review_alerts?: boolean
          teacher_reminder_email?: string | null
          teacher_sensitive_action_alerts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          analytics_consent_updated_at: string | null
          analytics_enabled: boolean
          created_at: string
          date_format: string
          haptics_enabled: boolean
          language: string
          time_format: string
          timezone: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          analytics_consent_updated_at?: string | null
          analytics_enabled?: boolean
          created_at?: string
          date_format?: string
          haptics_enabled?: boolean
          language?: string
          time_format?: string
          timezone?: string
          updated_at?: string
          user_id: string
          week_start?: string
        }
        Update: {
          analytics_consent_updated_at?: string | null
          analytics_enabled?: boolean
          created_at?: string
          date_format?: string
          haptics_enabled?: boolean
          language?: string
          time_format?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          device_id: string
          device_name: string
          first_seen_at: string
          id: string
          ip_hash: string | null
          last_seen_at: string
          new_device_notified_at: string | null
          platform: string
          revoked_at: string | null
          revoked_by: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          device_name: string
          first_seen_at?: string
          id?: string
          ip_hash?: string | null
          last_seen_at?: string
          new_device_notified_at?: string | null
          platform: string
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          device_name?: string
          first_seen_at?: string
          id?: string
          ip_hash?: string | null
          last_seen_at?: string
          new_device_notified_at?: string | null
          platform?: string
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_support_tickets: {
        Row: {
          admin_response: string | null
          assigned_admin_id: string | null
          category: string
          contact_email: string | null
          created_at: string
          id: number
          last_response_at: string | null
          message: string
          priority: string
          resolved_at: string | null
          role: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          assigned_admin_id?: string | null
          category: string
          contact_email?: string | null
          created_at?: string
          id?: number
          last_response_at?: string | null
          message: string
          priority?: string
          resolved_at?: string | null
          role?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          assigned_admin_id?: string | null
          category?: string
          contact_email?: string | null
          created_at?: string
          id?: number
          last_response_at?: string | null
          message?: string
          priority?: string
          resolved_at?: string | null
          role?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_support_tickets_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_manual_review_comment: {
        Args: {
          p_attempt_history_id: number
          p_audience?: string
          p_body: string
        }
        Returns: Json
      }
      admin_update_support_ticket: {
        Args: {
          p_admin_response?: string
          p_priority?: string
          p_status: string
          p_ticket_id: number
        }
        Returns: Json
      }
      analytics_allowed: { Args: { p_user_id: string }; Returns: boolean }
      apply_analytics_retention: { Args: never; Returns: Json }
      assert_topic_playable: {
        Args: { p_topic_id: number }
        Returns: undefined
      }
      can_access_question_media: {
        Args: { p_classroom_id?: number; p_subject_id: number }
        Returns: boolean
      }
      can_read_profile: { Args: { p_profile_id: string }; Returns: boolean }
      claim_notification_delivery_batch: {
        Args: { p_limit?: number; p_worker_id: string }
        Returns: {
          attempts: number
          delivery_cycle: number
          max_attempts: number
          notification_id: string
          priority: string
          queue_id: number
          user_id: string
        }[]
      }
      claim_open_answer_attempt: {
        Args: { p_attempt_history_id: number }
        Returns: Json
      }
      claim_teacher_digest_batch: {
        Args: { p_limit?: number; p_worker_id: string }
        Returns: {
          attempts: number
          created_at: string
          frequency: string
          id: number
          last_error_code: string | null
          last_error_message: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string
          period_end: string
          period_start: string
          provider_message_id: string | null
          recipient_email: string
          sent_at: string | null
          snapshot: Json
          status: string
          teacher_id: string
          timezone: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "teacher_digest_deliveries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_auth_rate_limits: { Args: never; Returns: number }
      cleanup_expired_guests: { Args: { p_limit?: number }; Returns: number }
      consume_auth_rate_limit: {
        Args: {
          p_action: string
          p_block_seconds: number
          p_key_hash: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: Json
      }
      convert_current_guest_to_student: {
        Args: { p_alias?: string }
        Returns: Json
      }
      create_notification: {
        Args: {
          p_action_url?: string
          p_audience: string
          p_color?: string
          p_description: string
          p_fingerprint?: string
          p_icon?: string
          p_metadata?: Json
          p_related_id?: string
          p_related_table?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      create_subject_with_default_topic: {
        Args: {
          p_academic_year?: string
          p_code?: string
          p_description?: string
          p_education_level?: string
          p_icon?: string
          p_name: string
          p_subject_label?: string
          p_theme_color?: string
        }
        Returns: Json
      }
      create_teacher_classroom: {
        Args: { p_academic_year?: string; p_name: string; p_subject_id: number }
        Returns: Json
      }
      create_teacher_notification: {
        Args: {
          p_classroom_id?: number
          p_message?: string
          p_student_id: string
          p_subject_id: number
          p_type: string
        }
        Returns: Json
      }
      deactivate_push_token: {
        Args: { p_expo_push_token?: string }
        Returns: number
      }
      delete_my_account: { Args: never; Returns: undefined }
      delete_user_relational_data: {
        Args: { p_user_id: string }
        Returns: Json
      }
      duplicate_teacher_subject: {
        Args: { p_name_suffix?: string; p_subject_id: number }
        Returns: Json
      }
      enqueue_due_teacher_digests: { Args: { p_now?: string }; Returns: number }
      ensure_analytics_reporting_id: {
        Args: { p_user_id: string }
        Returns: string
      }
      ensure_current_ranking_season: {
        Args: never
        Returns: {
          active: boolean
          created_at: string
          ends_at: string
          id: string
          name: string
          reset_at: string
          starts_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ranking_seasons"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_default_classroom: {
        Args: { p_subject_id: number }
        Returns: number
      }
      equip_profile_cosmetics: {
        Args: { p_featured_badge_id?: string; p_frame_key?: string }
        Returns: Json
      }
      finish_game_attempt: {
        Args: { p_attempt_id: string; p_status?: string }
        Returns: Json
      }
      finish_teacher_digest: {
        Args: {
          p_error_code?: string
          p_error_message?: string
          p_id: number
          p_provider_message_id?: string
          p_retry_after_seconds?: number
          p_status: string
        }
        Returns: undefined
      }
      finish_teacher_student_recovery_request: {
        Args: {
          p_delivery_mode?: string
          p_error_code?: string
          p_error_message?: string
          p_request_id: string
          p_status: string
        }
        Returns: undefined
      }
      generate_unique_subject_code: { Args: never; Returns: string }
      get_activity_attempt_detail: {
        Args: { p_attempt_history_id: number }
        Returns: Json
      }
      get_admin_audit_logs_page: {
        Args: {
          p_action?: string
          p_actor_id?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_severity?: string
          p_target_id?: string
          p_target_table?: string
          p_to?: string
        }
        Returns: {
          action: string
          actor_alias: string
          actor_email: string
          admin_id: string
          created_at: string
          id: number
          metadata: Json
          severity: string
          target_id: string
          target_table: string
          total_count: number
        }[]
      }
      get_admin_classrooms_page: {
        Args: {
          p_active?: boolean
          p_created_from?: string
          p_created_to?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_student_id?: string
          p_subject_id?: number
          p_teacher_id?: string
        }
        Returns: {
          active: boolean
          code: string
          created_at: string
          enrollments_count: number
          id: number
          incidents_count: number
          last_activity_at: string
          name: string
          pending_reviews_count: number
          subject_id: number
          subject_name: string
          teacher_alias: string
          teacher_email: string
          teacher_id: string
          total_count: number
        }[]
      }
      get_admin_dashboard_metrics: { Args: never; Returns: Json }
      get_admin_directory_filters: { Args: never; Returns: Json }
      get_admin_enrollments_summary: { Args: never; Returns: Json }
      get_admin_profile_activity_page: {
        Args: {
          p_event_type?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_profile_id: string
          p_search?: string
          p_to?: string
        }
        Returns: {
          description: string
          entity_id: string
          entity_table: string
          event_id: string
          event_type: string
          metadata: Json
          occurred_at: string
          profile_id: string
          severity: string
          title: string
          total_count: number
        }[]
      }
      get_admin_profiles_page: {
        Args: {
          p_active?: boolean
          p_activity_state?: string
          p_classroom_id?: number
          p_created_from?: string
          p_created_to?: string
          p_limit?: number
          p_offset?: number
          p_profile_id?: string
          p_role?: string
          p_search?: string
          p_subject_id?: number
        }
        Returns: {
          active: boolean
          activity_state: string
          alias: string
          created_at: string
          email: string
          enrollment_count: number
          id: string
          last_activity_at: string
          role_id: string
          subject_count: number
          total_count: number
        }[]
      }
      get_admin_push_delivery_metrics: {
        Args: { p_days?: number }
        Returns: Json
      }
      get_admin_subjects_page: {
        Args: {
          p_active?: boolean
          p_archived?: boolean
          p_created_from?: string
          p_created_to?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_teacher_id?: string
        }
        Returns: {
          active: boolean
          classes_count: number
          created_at: string
          enrollments_count: number
          id: number
          inactive_classrooms_count: number
          incidents_count: number
          is_archived: boolean
          last_activity_at: string
          missing_code_count: number
          name: string
          pending_reviews_count: number
          teacher_alias: string
          teacher_email: string
          teacher_id: string
          total_count: number
        }[]
      }
      get_admin_support_tickets_page: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_priority?: string
          p_role?: string
          p_search?: string
          p_status?: string
        }
        Returns: {
          admin_response: string
          assigned_admin_id: string
          category: string
          contact_email: string
          created_at: string
          id: number
          last_response_at: string
          message: string
          priority: string
          resolved_at: string
          role: string
          status: string
          subject: string
          total_count: number
          updated_at: string
          user_alias: string
          user_email: string
          user_id: string
        }[]
      }
      get_admin_usage_analytics: { Args: { p_days?: number }; Returns: Json }
      get_attempt_feedback: {
        Args: { p_attempt_history_id: number }
        Returns: Json
      }
      get_avatar_customization_options: { Args: never; Returns: Json }
      get_student_badge_catalog: {
        Args: {
          p_category_key?: string
          p_page?: number
          p_page_size?: number
          p_status?: string
        }
        Returns: Json
      }
      get_class_ranking_profiles: {
        Args: { p_classroom_id: number; p_limit?: number }
        Returns: {
          alias: string
          avatar: string
          id: string
          points: number
          visibility: string
        }[]
      }
      get_game_questions: {
        Args: {
          p_classroom_id?: number
          p_difficulty?: number
          p_general_topic?: boolean
          p_subject_id: number
          p_topic_id?: number
        }
        Returns: Json
      }
      get_manual_review_thread: {
        Args: { p_attempt_history_id: number }
        Returns: Json
      }
      get_profile_cosmetics: {
        Args: { p_user_ids?: string[] }
        Returns: {
          description: string
          featured_badge_id: string
          frame_key: string
          minimum_level: number
          name: string
          primary_color: string
          rarity: string
          required_badge_id: string
          secondary_color: string
          user_id: string
        }[]
      }
      get_question_media_manifest: {
        Args: { p_question_ids: number[] }
        Returns: {
          duration_seconds: number
          media_path: string
          media_type: string
          processing_status: string
          question_id: number
          subtitles_vtt: string
          thumbnail_path: string
          transcript: string
        }[]
      }
      get_ranking_profiles: {
        Args: { p_limit?: number }
        Returns: {
          alias: string
          avatar: string
          id: string
          points: number
          visibility: string
        }[]
      }
      get_ranking_profiles_page: {
        Args: {
          p_classroom_id?: number
          p_limit?: number
          p_max_points?: number
          p_min_points?: number
          p_offset?: number
          p_scope?: string
        }
        Returns: Json
      }
      get_safe_game_questions: {
        Args: {
          p_classroom_id?: number
          p_difficulty?: number
          p_general_topic?: boolean
          p_review_failed?: boolean
          p_subject_id: number
          p_topic_id?: number
        }
        Returns: Json
      }
      get_student_attempt_history: {
        Args: {
          p_classroom_id?: number
          p_difficulty?: number
          p_limit?: number
          p_since?: string
          p_subject_id?: number
          p_topic_id?: number
        }
        Returns: Json
      }
      get_student_attempt_history_page: {
        Args: {
          p_classroom_id?: number
          p_difficulty?: number
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
          p_subject_id?: number
          p_topic_id?: number
        }
        Returns: Json
      }
      get_student_question_catalog: {
        Args: { p_classroom_id?: number; p_subject_id?: number }
        Returns: Json
      }
      get_teacher_audit_logs_page: {
        Args: {
          p_category?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: {
          action: string
          created_at: string
          id: number
          metadata: Json
          target_id: string
          target_table: string
          teacher_id: string
          total_count: number
        }[]
      }
      get_teacher_manual_review_queue: {
        Args: {
          p_classroom_id?: number
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
          p_subject_id?: number
        }
        Returns: Json
      }
      get_teacher_student_attempts_page: {
        Args: {
          p_classroom_id?: number
          p_limit?: number
          p_offset?: number
          p_student_id: string
          p_subject_id?: number
        }
        Returns: Json
      }
      initialize_guest_profile: { Args: { p_alias: string }; Returns: Json }
      invoke_notification_delivery_worker: { Args: never; Returns: number }
      invoke_teacher_digest_processor: { Args: never; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_classroom_enrolled: {
        Args: { p_classroom_id: number }
        Returns: boolean
      }
      is_classroom_teacher: {
        Args: { p_classroom_id: number }
        Returns: boolean
      }
      is_enrolled_in_subject: {
        Args: { p_subject_id: number; p_user_id: string }
        Returns: boolean
      }
      is_own_avatar_storage_path: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      is_subject_enrolled: { Args: { p_subject_id: number }; Returns: boolean }
      is_subject_teacher:
        | { Args: { p_subject_id: number }; Returns: boolean }
        | {
            Args: { p_subject_id: number; p_user_id: string }
            Returns: boolean
          }
      join_subject_by_code: { Args: { p_code: string }; Returns: Json }
      normalize_answer_text: { Args: { value: string }; Returns: string }
      recalculate_student_points: {
        Args: { p_student_id: string }
        Returns: number
      }
      register_push_token: {
        Args: {
          p_app_version?: string
          p_device_name?: string
          p_expo_push_token: string
          p_platform: string
        }
        Returns: Json
      }
      register_user_session: {
        Args: {
          p_device_id: string
          p_device_name: string
          p_ip_hash?: string
          p_platform: string
          p_user_agent?: string
        }
        Returns: Json
      }
      reserve_teacher_student_recovery_request: {
        Args: {
          p_classroom_id?: number
          p_student_id: string
          p_subject_id: number
          p_teacher_id: string
        }
        Returns: Json
      }
      review_open_answer_attempt: {
        Args: {
          p_attempt_history_id: number
          p_is_correct: boolean
          p_notes?: string
        }
        Returns: Json
      }
      review_open_answer_attempt_v2: {
        Args: {
          p_attempt_history_id: number
          p_comment_audience?: string
          p_notes?: string
          p_status: string
        }
        Returns: Json
      }
      revoke_other_user_sessions: {
        Args: { p_current_device_id: string }
        Returns: number
      }
      revoke_user_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      sanitize_analytics_properties: {
        Args: { p_properties: Json }
        Returns: Json
      }
      save_teacher_question: {
        Args: {
          p_answers?: Json
          p_classroom_id?: number
          p_difficulty?: number
          p_explanation?: string
          p_media_alt_text?: string
          p_media_caption?: string
          p_media_duration_seconds?: number
          p_media_path?: string
          p_media_subtitles_vtt?: string
          p_media_transcript?: string
          p_media_type?: string
          p_media_url?: string
          p_points_base?: number
          p_question_id?: number
          p_subject_id: number
          p_text?: string
          p_time_limit_seconds?: number
          p_topic_id?: number
          p_type?: string
        }
        Returns: number
      }
      search_app_entities: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          classroom_id: number
          entity_id: string
          entity_type: string
          relevance: number
          role_id: string
          subject_id: number
          subtitle: string
          title: string
        }[]
      }
      set_analytics_consent: { Args: { p_enabled: boolean }; Returns: boolean }
      start_game_attempt: {
        Args: {
          p_classroom_id?: number
          p_difficulty?: number
          p_general_topic?: boolean
          p_subject_id: number
          p_topic_id?: number
        }
        Returns: string
      }
      submit_answer: {
        Args: {
          p_answer_id?: number
          p_answer_payload?: Json
          p_answer_text?: string
          p_attempt_id?: string
          p_hint_used?: boolean
          p_question_id: number
          p_skipped?: boolean
          p_time_taken_seconds?: number
        }
        Returns: Json
      }
      submit_answer_resumable: {
        Args: {
          p_answer_id?: number
          p_answer_payload?: Json
          p_answer_text?: string
          p_attempt_id?: string
          p_hint_used?: boolean
          p_question_id: number
          p_skipped?: boolean
          p_submission_id: string
          p_time_taken_seconds?: number
        }
        Returns: Json
      }
      sync_student_badges: { Args: never; Returns: Json }
      sync_student_points: { Args: { student_id: string }; Returns: number }
      track_usage_event: {
        Args: {
          p_attempt_id?: string
          p_classroom_id?: number
          p_event_name: string
          p_properties?: Json
          p_session_id?: string
          p_subject_id?: number
          p_topic_id?: number
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
