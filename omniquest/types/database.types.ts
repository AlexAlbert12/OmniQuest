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
      classrooms: {
        Row: {
          academic_year: string | null
          created_at: string
          id: number
          name: string
          subject_id: number | null
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          id?: number
          name: string
          subject_id?: number | null
        }
        Update: {
          academic_year?: string | null
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
          id: string
          points: number | null
          role_id: string | null
        }
        Insert: {
          active?: boolean | null
          alias: string
          avatar?: string | null
          created_at?: string
          id: string
          points?: number | null
          role_id?: string | null
        }
        Update: {
          active?: boolean | null
          alias?: string
          avatar?: string | null
          created_at?: string
          id?: string
          points?: number | null
          role_id?: string | null
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
          created_at: string
          difficulty: number | null
          explanation: string | null
          id: number
          points_base: number | null
          subject_id: number | null
          text: string
          time_limit_seconds: number | null
          type: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          difficulty?: number | null
          explanation?: string | null
          id?: number
          points_base?: number | null
          subject_id?: number | null
          text: string
          time_limit_seconds?: number | null
          type: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          difficulty?: number | null
          explanation?: string | null
          id?: number
          points_base?: number | null
          subject_id?: number | null
          text?: string
          time_limit_seconds?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
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
          icon: string | null
          id: number
          name: string
          teacher_id: string | null
          theme_color: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: number
          name: string
          teacher_id?: string | null
          theme_color?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: number
          name?: string
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
      [_ in never]: never
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
