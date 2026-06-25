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
          id: number
          student_id: string
          question_id: number
          answer_id: number | null
          is_correct: boolean
          time_taken_seconds: number | null
          attempted_at: string
          created_at: string
          submitted_answer_text: string | null
          submitted_answer_payload: Json | null
          earned_points: number
          hint_used: boolean
          was_skipped: boolean
        }
        Insert: {
          id?: number
          student_id: string
          question_id: number
          answer_id?: number | null
          is_correct: boolean
          time_taken_seconds?: number | null
          attempted_at?: string
          created_at?: string
          submitted_answer_text?: string | null
          submitted_answer_payload?: Json | null
          earned_points?: number
          hint_used?: boolean
          was_skipped?: boolean
        }
        Update: {
          id?: number
          student_id?: string
          question_id?: number
          answer_id?: number | null
          is_correct?: boolean
          time_taken_seconds?: number | null
          attempted_at?: string
          created_at?: string
          submitted_answer_text?: string | null
          submitted_answer_payload?: Json | null
          earned_points?: number
          hint_used?: boolean
          was_skipped?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "attempt_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "attempt_history_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
        ]
      }
      game_attempts: {
        Row: {
          id: string
          student_id: string
          subject_id: number
          classroom_id: number | null
          topic_id: number | null
          status: string
          total_score: number
          correct_answers: number
          started_at: string
          updated_at: string
          finished_at: string | null
        }
        Insert: {
          id?: string
          student_id: string
          subject_id: number
          classroom_id?: number | null
          topic_id?: number | null
          status?: string
          total_score?: number
          correct_answers?: number
          started_at?: string
          updated_at?: string
          finished_at?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          subject_id?: number
          classroom_id?: number | null
          topic_id?: number | null
          status?: string
          total_score?: number
          correct_answers?: number
          started_at?: string
          updated_at?: string
          finished_at?: string | null
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
      classrooms: {
        Row: {
          active: boolean
          academic_year: string | null
          code: string | null
          created_at: string
          id: number
          name: string
          subject_id: number | null
        }
        Insert: {
          active?: boolean
          academic_year?: string | null
          code?: string | null
          created_at?: string
          id?: number
          name: string
          subject_id?: number | null
        }
        Update: {
          active?: boolean
          academic_year?: string | null
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
      profiles: {
        Row: {
          active: boolean | null
          alias: string
          avatar: string | null
          created_at: string
          email: string | null
          id: string
          points: number | null
          role_id: string | null
          visibility: string
        }
        Insert: {
          active?: boolean | null
          alias: string
          avatar?: string | null
          created_at?: string
          email?: string | null
          id: string
          points?: number | null
          role_id?: string | null
          visibility?: string
        }
        Update: {
          active?: boolean | null
          alias?: string
          avatar?: string | null
          created_at?: string
          email?: string | null
          id?: string
          points?: number | null
          role_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
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
          points_base: number | null
          subject_id: number | null
          topic_id: number | null
          text: string
          time_limit_seconds: number | null
          type: string
        }
        Insert: {
          active?: boolean | null
          classroom_id?: number | null
          created_at?: string
          difficulty?: number | null
          explanation?: string | null
          id?: number
          points_base?: number | null
          subject_id?: number | null
          topic_id?: number | null
          text: string
          time_limit_seconds?: number | null
          type: string
        }
        Update: {
          active?: boolean | null
          classroom_id?: number | null
          created_at?: string
          difficulty?: number | null
          explanation?: string | null
          id?: number
          points_base?: number | null
          subject_id?: number | null
          topic_id?: number | null
          text?: string
          time_limit_seconds?: number | null
          type?: string
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
      subjects: {
        Row: {
          active: boolean | null
          code: string
          created_at: string
          description: string | null
          academic_year: string | null
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
          active?: boolean | null
          code: string
          created_at?: string
          description?: string | null
          academic_year?: string | null
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
          active?: boolean | null
          code?: string
          created_at?: string
          description?: string | null
          academic_year?: string | null
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
      enrollments: {
        Row: {
          classroom_id: number | null
          id: number
          student_id: string
          subject_id: number
          joined_at: string
        }
        Insert: {
          classroom_id?: number | null
          id?: number
          student_id: string
          subject_id: number
          joined_at?: string
        }
        Update: {
          classroom_id?: number | null
          id?: number
          student_id?: string
          subject_id?: number
          joined_at?: string
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
      subject_topics: {
        Row: {
          classroom_id: number | null
          id: number
          subject_id: number
          title: string
          description: string | null
          icon: string | null
          sort_order: number | null
          active: boolean
          created_at: string
        }
        Insert: {
          classroom_id?: number | null
          id?: number
          subject_id: number
          title: string
          description?: string | null
          icon?: string | null
          sort_order?: number | null
          active?: boolean
          created_at?: string
        }
        Update: {
          classroom_id?: number | null
          id?: number
          subject_id?: number
          title?: string
          description?: string | null
          icon?: string | null
          sort_order?: number | null
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_scores: {
        Row: {
          classroom_id: number | null
          id: number
          student_id: string
          subject_id: number
          max_score: number | null
          correct_answers: number | null
          played_days: string[] | null
          played_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          classroom_id?: number | null
          id?: number
          student_id: string
          subject_id: number
          max_score?: number | null
          correct_answers?: number | null
          played_days?: string[] | null
          played_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          classroom_id?: number | null
          id?: number
          student_id?: string
          subject_id?: number
          max_score?: number | null
          correct_answers?: number | null
          played_days?: string[] | null
          played_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
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
      topic_scores: {
        Row: {
          classroom_id: number | null
          id: number
          student_id: string
          subject_id: number
          topic_id: number
          max_score: number | null
          played_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          classroom_id?: number | null
          id?: number
          student_id: string
          subject_id: number
          topic_id: number
          max_score?: number | null
          played_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          classroom_id?: number | null
          id?: number
          student_id?: string
          subject_id?: number
          topic_id?: number
          max_score?: number | null
          played_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
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
      student_badges: {
        Row: {
          id: number
          student_id: string
          badge_id: string
          reward_xp: number | null
          awarded_at: string
          created_at: string
        }
        Insert: {
          id?: number
          student_id: string
          badge_id: string
          reward_xp?: number | null
          awarded_at?: string
          created_at?: string
        }
        Update: {
          id?: number
          student_id?: string
          badge_id?: string
          reward_xp?: number | null
          awarded_at?: string
          created_at?: string
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
      user_support_tickets: {
        Row: {
          id: number
          user_id: string
          role: string
          category: string
          subject: string
          message: string
          contact_email: string | null
          priority: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          role?: string
          category: string
          subject: string
          message: string
          contact_email?: string | null
          priority?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          role?: string
          category?: string
          subject?: string
          message?: string
          contact_email?: string | null
          priority?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          user_id: string
          language: string | null
          timezone: string | null
          date_format: string | null
          time_format: string | null
          week_start: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          language?: string | null
          timezone?: string | null
          date_format?: string | null
          time_format?: string | null
          week_start?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          language?: string | null
          timezone?: string | null
          date_format?: string | null
          time_format?: string | null
          week_start?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          user_id: string
          push_enabled: boolean
          email_enabled: boolean
          daily_summary_enabled: boolean
          activity_enabled: boolean
          news_enabled: boolean
          frequency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          push_enabled?: boolean
          email_enabled?: boolean
          daily_summary_enabled?: boolean
          activity_enabled?: boolean
          news_enabled?: boolean
          frequency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          push_enabled?: boolean
          email_enabled?: boolean
          daily_summary_enabled?: boolean
          activity_enabled?: boolean
          news_enabled?: boolean
          frequency?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_state: {
        Row: {
          id: number
          user_id: string
          notification_id: string
          is_read: boolean
          is_deleted: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          notification_id: string
          is_read?: boolean
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          notification_id?: string
          is_read?: boolean
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_state_user_id_fkey"
            columns: ["user_id"]
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
      create_teacher_classroom: {
        Args: {
          p_subject_id: number
          p_name: string
          p_academic_year?: string | null
        }
        Returns: Json
      }
      create_subject_with_default_topic: {
        Args: {
          p_name: string
          p_description?: string | null
          p_icon?: string | null
          p_code?: string | null
          p_education_level?: string | null
          p_academic_year?: string | null
          p_subject_label?: string | null
          p_theme_color?: string | null
        }
        Returns: Json
      }
      delete_user_relational_data: {
        Args: {
          p_user_id: string
        }
        Returns: Json
      }
      duplicate_teacher_subject: {
        Args: {
          p_subject_id: number
          p_name_suffix?: string | null
        }
        Returns: Json
      }
      ensure_default_classroom: {
        Args: {
          p_subject_id: number
        }
        Returns: number
      }
      generate_unique_subject_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_game_questions: {
        Args: {
          p_subject_id: number
          p_classroom_id?: number | null
          p_topic_id?: number | null
          p_general_topic?: boolean
        }
        Returns: Json
      }
      join_subject_by_code: {
        Args: {
          p_code: string
        }
        Returns: Json
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      start_game_attempt: {
        Args: {
          p_subject_id: number
          p_classroom_id?: number | null
          p_topic_id?: number | null
          p_general_topic?: boolean
        }
        Returns: string
      }
      submit_answer: {
        Args: {
          p_question_id: number
          p_answer_id?: number | null
          p_answer_text?: string | null
          p_answer_payload?: Json | null
          p_time_taken_seconds?: number | null
          p_hint_used?: boolean
          p_skipped?: boolean
          p_attempt_id?: string | null
        }
        Returns: Json
      }
      sync_student_badges: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      save_teacher_question: {
        Args: {
          p_subject_id: number
          p_question_id?: number | null
          p_classroom_id?: number | null
          p_topic_id?: number | null
          p_type?: string
          p_text?: string
          p_points_base?: number
          p_time_limit_seconds?: number
          p_explanation?: string | null
          p_answers?: Json
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
