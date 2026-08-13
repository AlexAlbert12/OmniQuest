export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      account_deletion_requests: {
        Row: {
          cancelled_at: string | null
          created_at: string
          error_message: string | null
          id: string
          processed_at: string | null
          requested_at: string
          scheduled_for: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          requested_at?: string
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          requested_at?: string
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_chain_checkpoints: {
        Row: {
          anchor_hash: string | null
          created_at: string
          final_hash: string
          first_chain_seq: number
          id: number
          last_chain_seq: number
          partition_name: string
          row_count: number
        }
        Insert: {
          anchor_hash?: string | null
          created_at?: string
          final_hash: string
          first_chain_seq: number
          id?: number
          last_chain_seq: number
          partition_name: string
          row_count: number
        }
        Update: {
          anchor_hash?: string | null
          created_at?: string
          final_hash?: string
          first_chain_seq?: number
          id?: number
          last_chain_seq?: number
          partition_name?: string
          row_count?: number
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_id_fkey1"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs_2024_08: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2024_09: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2024_10: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2024_11: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2024_12: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2025_01: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2025_02: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2025_03: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2025_04: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2025_05: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2025_06: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2025_07: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2025_08: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2025_09: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2025_10: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2025_11: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2025_12: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2026_01: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2026_02: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2026_03: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2026_04: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2026_05: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2026_06: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2026_07: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2026_08: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2026_09: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2026_10: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2026_11: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2026_12: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2027_01: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_2027_02: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_default: {
        Row: {
          action: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          chain_hash: string | null
          chain_seq: number
          context_capture_reason: string | null
          created_at: string
          id: number
          ip_hash: string | null
          metadata: Json
          previous_hash: string | null
          request_id: string | null
          retention_until: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          chain_hash?: string | null
          chain_seq?: number
          context_capture_reason?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          metadata?: Json
          previous_hash?: string | null
          request_id?: string | null
          retention_until?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      admin_audit_settings: {
        Row: {
          capture_request_context: boolean
          retention_months: number
          singleton: boolean
          strong_integrity: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          capture_request_context?: boolean
          retention_months?: number
          singleton?: boolean
          strong_integrity?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          capture_request_context?: boolean
          retention_months?: number
          singleton?: boolean
          strong_integrity?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_export_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          expires_at: string | null
          export_type: string
          filters: Json
          id: string
          processed_rows: number
          requested_by: string
          row_count: number | null
          started_at: string | null
          status: string
          storage_path: string | null
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          export_type: string
          filters?: Json
          id?: string
          processed_rows?: number
          requested_by: string
          row_count?: number | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          export_type?: string
          filters?: Json
          id?: string
          processed_rows?: number
          requested_by?: string
          row_count?: number | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_export_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_role_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          role_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          role_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          role_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_role_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          permissions: string[]
          system: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          name: string
          permissions?: string[]
          system?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          permissions?: string[]
          system?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      admin_user_change_history: {
        Row: {
          action: string
          after_state: Json | null
          before_state: Json | null
          change_source: string
          changed_by: string | null
          created_at: string
          id: number
          profile_id: string
          reason: string | null
        }
        Insert: {
          action: string
          after_state?: Json | null
          before_state?: Json | null
          change_source?: string
          changed_by?: string | null
          created_at?: string
          id?: number
          profile_id: string
          reason?: string | null
        }
        Update: {
          action?: string
          after_state?: Json | null
          before_state?: Json | null
          change_source?: string
          changed_by?: string | null
          created_at?: string
          id?: number
          profile_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_user_change_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_user_change_history_profile_id_fkey"
            columns: ["profile_id"]
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
          attempted_at: string
          created_at: string
          earned_points: number
          hint_used: boolean
          id: number
          is_correct: boolean
          manual_review_due_at: string | null
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
          attempted_at?: string
          created_at?: string
          earned_points?: number
          hint_used?: boolean
          id?: number
          is_correct: boolean
          manual_review_due_at?: string | null
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
          attempted_at?: string
          created_at?: string
          earned_points?: number
          hint_used?: boolean
          id?: number
          is_correct?: boolean
          manual_review_due_at?: string | null
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
          {
            foreignKeyName: "attempt_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_sensitive_data_retention_policy: {
        Row: {
          retention_days: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          retention_days?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          retention_days?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
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
          code_expires_at: string | null
          created_at: string
          deactivated_at: string | null
          deactivation_reason: string | null
          id: number
          name: string
          subject_id: number | null
        }
        Insert: {
          academic_year?: string | null
          active?: boolean
          code?: string | null
          code_expires_at?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          id?: number
          name: string
          subject_id?: number | null
        }
        Update: {
          academic_year?: string | null
          active?: boolean
          code?: string | null
          code_expires_at?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
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
      data_export_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          expires_at: string | null
          file_size_bytes: number | null
          id: string
          object_path: string | null
          requested_at: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          id?: string
          object_path?: string | null
          requested_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          id?: string
          object_path?: string | null
          requested_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_export_requests_user_id_fkey"
            columns: ["user_id"]
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
          joined_at: string
          student_id: string
          subject_id: number
        }
        Insert: {
          classroom_id?: number | null
          id?: number
          joined_at?: string
          student_id: string
          subject_id: number
        }
        Update: {
          classroom_id?: number | null
          id?: number
          joined_at?: string
          student_id?: string
          subject_id?: number
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
      manual_review_comment_templates: {
        Row: {
          active: boolean
          audience: string
          body: string
          created_at: string
          id: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience?: string
          body: string
          created_at?: string
          id?: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience?: string
          body?: string
          created_at?: string
          id?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_review_comment_templates_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      manual_review_history: {
        Row: {
          actor_id: string | null
          after_state: Json
          attempt_history_id: number
          before_state: Json
          created_at: string
          event_type: string
          from_status: string | null
          id: number
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          after_state?: Json
          attempt_history_id: number
          before_state?: Json
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: number
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          after_state?: Json
          attempt_history_id?: number
          before_state?: Json
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: number
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_review_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_review_history_attempt_history_id_fkey"
            columns: ["attempt_history_id"]
            isOneToOne: false
            referencedRelation: "attempt_history"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_review_settings: {
        Row: {
          sla_hours: number
          teacher_id: string
          updated_at: string
        }
        Insert: {
          sla_hours?: number
          teacher_id: string
          updated_at?: string
        }
        Update: {
          sla_hours?: number
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_review_settings_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
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
          created_at: string
          id: number
          is_deleted: boolean
          is_read: boolean
          notification_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_deleted?: boolean
          is_read?: boolean
          notification_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          is_deleted?: boolean
          is_read?: boolean
          notification_id?: string
          updated_at?: string
          user_id?: string
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
          deactivated_at: string | null
          deactivation_reason: string | null
          email: string | null
          expires_at: string | null
          id: string
          points: number | null
          reactivate_at: string | null
          role_id: string | null
          visibility: string
        }
        Insert: {
          active?: boolean | null
          alias: string
          avatar?: string | null
          converted_at?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          email?: string | null
          expires_at?: string | null
          id: string
          points?: number | null
          reactivate_at?: string | null
          role_id?: string | null
          visibility?: string
        }
        Update: {
          active?: boolean | null
          alias?: string
          avatar?: string | null
          converted_at?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          points?: number | null
          reactivate_at?: string | null
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
          hint: string | null
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
          hint?: string | null
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
          hint?: string | null
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
          reward_xp: number | null
          student_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          created_at?: string
          id?: number
          reward_xp?: number | null
          student_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          created_at?: string
          id?: number
          reward_xp?: number | null
          student_id?: string
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
          correct_answers: number | null
          created_at: string
          id: number
          max_score: number | null
          played_at: string | null
          played_days: string[] | null
          student_id: string
          subject_id: number
          updated_at: string
        }
        Insert: {
          classroom_id?: number | null
          correct_answers?: number | null
          created_at?: string
          id?: number
          max_score?: number | null
          played_at?: string | null
          played_days?: string[] | null
          student_id: string
          subject_id: number
          updated_at?: string
        }
        Update: {
          classroom_id?: number | null
          correct_answers?: number | null
          created_at?: string
          id?: number
          max_score?: number | null
          played_at?: string | null
          played_days?: string[] | null
          student_id?: string
          subject_id?: number
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
          sort_order: number | null
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
          sort_order?: number | null
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
          sort_order?: number | null
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
          archive_reason: string | null
          archived_at: string | null
          code: string
          created_at: string
          description: string | null
          education_level: string | null
          icon: string | null
          id: number
          is_archived: boolean
          name: string
          retention_until: string | null
          subject_label: string | null
          teacher_id: string | null
          theme_color: string | null
        }
        Insert: {
          academic_year?: string | null
          active?: boolean | null
          archive_reason?: string | null
          archived_at?: string | null
          code: string
          created_at?: string
          description?: string | null
          education_level?: string | null
          icon?: string | null
          id?: number
          is_archived?: boolean
          name: string
          retention_until?: string | null
          subject_label?: string | null
          teacher_id?: string | null
          theme_color?: string | null
        }
        Update: {
          academic_year?: string | null
          active?: boolean | null
          archive_reason?: string | null
          archived_at?: string | null
          code?: string
          created_at?: string
          description?: string | null
          education_level?: string | null
          icon?: string | null
          id?: number
          is_archived?: boolean
          name?: string
          retention_until?: string | null
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
      support_contact_channels: {
        Row: {
          channel_key: string
          channel_type: string
          description: string | null
          enabled: boolean
          label: string
          sort_order: number
          updated_at: string
          value: string | null
        }
        Insert: {
          channel_key: string
          channel_type: string
          description?: string | null
          enabled?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          value?: string | null
        }
        Update: {
          channel_key?: string
          channel_type?: string
          description?: string | null
          enabled?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      support_email_deliveries: {
        Row: {
          attempts: number
          created_at: string
          error_code: string | null
          error_message: string | null
          id: number
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          message_id: number | null
          next_attempt_at: string
          provider_message_id: string | null
          recipient_email: string
          recipient_id: string
          sent_at: string | null
          status: string
          subject: string
          ticket_id: number
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: number
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          message_id?: number | null
          next_attempt_at?: string
          provider_message_id?: string | null
          recipient_email: string
          recipient_id: string
          sent_at?: string | null
          status?: string
          subject: string
          ticket_id: number
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: number
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          message_id?: number | null
          next_attempt_at?: string
          provider_message_id?: string | null
          recipient_email?: string
          recipient_id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          ticket_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_email_deliveries_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_email_deliveries_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_email_deliveries_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "user_support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_response_templates: {
        Row: {
          active: boolean
          body: string
          category: string | null
          created_at: string
          created_by: string | null
          id: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_response_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tags: {
        Row: {
          active: boolean
          color: string
          created_at: string
          created_by: string | null
          id: number
          label: string
          slug: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          created_by?: string | null
          id?: number
          label: string
          slug: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          created_by?: string | null
          id?: number
          label?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          message_id: number | null
          mime_type: string
          size_bytes: number
          storage_path: string
          ticket_id: number
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          message_id?: number | null
          mime_type: string
          size_bytes: number
          storage_path: string
          ticket_id: number
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          message_id?: number | null
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          ticket_id?: number
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "user_support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_history: {
        Row: {
          after_state: Json | null
          before_state: Json | null
          changed_by: string | null
          comment: string | null
          created_at: string
          event_type: string
          id: number
          ticket_id: number
        }
        Insert: {
          after_state?: Json | null
          before_state?: Json | null
          changed_by?: string | null
          comment?: string | null
          created_at?: string
          event_type: string
          id?: number
          ticket_id: number
        }
        Update: {
          after_state?: Json | null
          before_state?: Json | null
          changed_by?: string | null
          comment?: string | null
          created_at?: string
          event_type?: string
          id?: number
          ticket_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "user_support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          author_id: string | null
          author_role: string
          body: string
          created_at: string
          id: number
          is_internal: boolean
          ticket_id: number
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_role: string
          body: string
          created_at?: string
          id?: number
          is_internal?: boolean
          ticket_id: number
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_role?: string
          body?: string
          created_at?: string
          id?: number
          is_internal?: boolean
          ticket_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "user_support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_tags: {
        Row: {
          added_by: string | null
          created_at: string
          tag_id: number
          ticket_id: number
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          tag_id: number
          ticket_id: number
        }
        Update: {
          added_by?: string | null
          created_at?: string
          tag_id?: number
          ticket_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_tags_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "support_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_tags_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "user_support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_audit_alerts: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          description: string
          event_count: number
          id: number
          pattern_key: string
          severity: string
          teacher_id: string
          title: string
          window_ended_at: string
          window_started_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          description: string
          event_count: number
          id?: number
          pattern_key: string
          severity: string
          teacher_id: string
          title: string
          window_ended_at: string
          window_started_at: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          description?: string
          event_count?: number
          id?: number
          pattern_key?: string
          severity?: string
          teacher_id?: string
          title?: string
          window_ended_at?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_audit_alerts_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_audit_export_requests: {
        Row: {
          completed_at: string | null
          error_message: string | null
          expires_at: string | null
          filters: Json
          id: string
          object_path: string | null
          requested_at: string
          row_count: number | null
          started_at: string | null
          status: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          filters?: Json
          id?: string
          object_path?: string | null
          requested_at?: string
          row_count?: number | null
          started_at?: string | null
          status?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          filters?: Json
          id?: string
          object_path?: string | null
          requested_at?: string
          row_count?: number | null
          started_at?: string | null
          status?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_audit_export_requests_teacher_id_fkey"
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
          after_state: Json
          before_state: Json
          created_at: string
          id: number
          metadata: Json
          request_id: string | null
          severity: string
          target_id: string | null
          target_table: string | null
          teacher_id: string
        }
        Insert: {
          action: string
          after_state?: Json
          before_state?: Json
          created_at?: string
          id?: number
          metadata?: Json
          request_id?: string | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
          teacher_id: string
        }
        Update: {
          action?: string
          after_state?: Json
          before_state?: Json
          created_at?: string
          id?: number
          metadata?: Json
          request_id?: string | null
          severity?: string
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
      teacher_audit_retention_policy: {
        Row: {
          retention_days: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          retention_days?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          retention_days?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
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
      teacher_notification_course_preferences: {
        Row: {
          created_at: string
          critical_enabled: boolean
          digest_enabled: boolean
          informative_enabled: boolean
          muted_until: string | null
          subject_id: number
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          critical_enabled?: boolean
          digest_enabled?: boolean
          informative_enabled?: boolean
          muted_until?: string | null
          subject_id: number
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          critical_enabled?: boolean
          digest_enabled?: boolean
          informative_enabled?: boolean
          muted_until?: string | null
          subject_id?: number
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_notification_course_preferences_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_notification_course_preferences_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_student_notes: {
        Row: {
          body: string
          classroom_id: number | null
          created_at: string
          id: number
          student_id: string
          subject_id: number | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          body: string
          classroom_id?: number | null
          created_at?: string
          id?: number
          student_id: string
          subject_id?: number | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          classroom_id?: number | null
          created_at?: string
          id?: number
          student_id?: string
          subject_id?: number | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_student_notes_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_notes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_notes_teacher_id_fkey"
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
          max_score: number | null
          played_at: string | null
          student_id: string
          subject_id: number
          topic_id: number
          updated_at: string
        }
        Insert: {
          classroom_id?: number | null
          created_at?: string
          id?: number
          max_score?: number | null
          played_at?: string | null
          student_id: string
          subject_id: number
          topic_id: number
          updated_at?: string
        }
        Update: {
          classroom_id?: number | null
          created_at?: string
          id?: number
          max_score?: number | null
          played_at?: string | null
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
          support_contact_email: string | null
          support_preferred_channel: string
          teacher_digest_frequency: string
          teacher_digest_hour: number
          teacher_digest_last_sent_at: string | null
          teacher_digest_unsubscribed_at: string | null
          teacher_digest_weekday: number
          teacher_inactive_student_alerts: boolean
          teacher_notifications_muted_until: string | null
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
          support_contact_email?: string | null
          support_preferred_channel?: string
          teacher_digest_frequency?: string
          teacher_digest_hour?: number
          teacher_digest_last_sent_at?: string | null
          teacher_digest_unsubscribed_at?: string | null
          teacher_digest_weekday?: number
          teacher_inactive_student_alerts?: boolean
          teacher_notifications_muted_until?: string | null
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
          support_contact_email?: string | null
          support_preferred_channel?: string
          teacher_digest_frequency?: string
          teacher_digest_hour?: number
          teacher_digest_last_sent_at?: string | null
          teacher_digest_unsubscribed_at?: string | null
          teacher_digest_weekday?: number
          teacher_inactive_student_alerts?: boolean
          teacher_notifications_muted_until?: string | null
          teacher_open_review_alerts?: boolean
          teacher_reminder_email?: string | null
          teacher_sensitive_action_alerts?: boolean
          updated_at?: string
          user_id?: string
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
      user_preferences: {
        Row: {
          analytics_consent_updated_at: string | null
          analytics_enabled: boolean
          created_at: string
          date_format: string | null
          haptics_enabled: boolean
          language: string | null
          time_format: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          week_start: string | null
        }
        Insert: {
          analytics_consent_updated_at?: string | null
          analytics_enabled?: boolean
          created_at?: string
          date_format?: string | null
          haptics_enabled?: boolean
          language?: string | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          week_start?: string | null
        }
        Update: {
          analytics_consent_updated_at?: string | null
          analytics_enabled?: boolean
          created_at?: string
          date_format?: string | null
          haptics_enabled?: boolean
          language?: string | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          week_start?: string | null
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
          auto_priority_score: number
          category: string
          contact_email: string | null
          created_at: string
          first_responded_at: string | null
          first_response_due_at: string | null
          id: number
          last_internal_note_at: string | null
          last_response_at: string | null
          message: string
          preferred_channel: string
          priority: string
          priority_source: string
          resolution_due_at: string | null
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
          auto_priority_score?: number
          category: string
          contact_email?: string | null
          created_at?: string
          first_responded_at?: string | null
          first_response_due_at?: string | null
          id?: number
          last_internal_note_at?: string | null
          last_response_at?: string | null
          message: string
          preferred_channel?: string
          priority?: string
          priority_source?: string
          resolution_due_at?: string | null
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
          auto_priority_score?: number
          category?: string
          contact_email?: string | null
          created_at?: string
          first_responded_at?: string | null
          first_response_due_at?: string | null
          id?: number
          last_internal_note_at?: string | null
          last_response_at?: string | null
          message?: string
          preferred_channel?: string
          priority?: string
          priority_source?: string
          resolution_due_at?: string | null
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
          {
            foreignKeyName: "user_support_tickets_user_id_fkey"
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
      acknowledge_teacher_audit_alert: {
        Args: { p_alert_id: number }
        Returns: boolean
      }
      add_manual_review_comment: {
        Args: {
          p_attempt_history_id: number
          p_audience?: string
          p_body: string
        }
        Returns: Json
      }
      add_support_ticket_message: {
        Args: { p_body: string; p_ticket_id: number }
        Returns: Json
      }
      add_teacher_student_note: {
        Args: {
          p_body: string
          p_classroom_id?: number
          p_student_id: string
          p_subject_id?: number
        }
        Returns: Json
      }
      admin_audit_severity: {
        Args: { p_action: string; p_metadata?: Json; p_target_table?: string }
        Returns: string
      }
      admin_cancel_push_delivery: {
        Args: { p_queue_id: number }
        Returns: Json
      }
      admin_has_permission: { Args: { p_permission: string }; Returns: boolean }
      admin_request_push_delivery_processing: {
        Args: { p_queue_id: number }
        Returns: Json
      }
      admin_retry_push_delivery: {
        Args: { p_queue_id: number }
        Returns: Json
      }
      admin_sha256_hex: { Args: { p_value: string }; Returns: string }
      admin_update_support_ticket: {
        Args: {
          p_admin_response?: string
          p_priority?: string
          p_status: string
          p_ticket_id: number
        }
        Returns: Json
      }
      admin_update_support_ticket_secured: {
        Args: {
          p_assigned_admin_id?: string
          p_internal_comment?: string
          p_priority?: string
          p_public_response?: string
          p_status: string
          p_tag_slugs?: string[]
          p_template_id?: number
          p_ticket_id: number
        }
        Returns: Json
      }
      analytics_allowed: { Args: { p_user_id: string }; Returns: boolean }
      apply_analytics_retention: { Args: never; Returns: Json }
      apply_attempt_sensitive_data_retention: { Args: never; Returns: Json }
      apply_teacher_audit_retention: { Args: never; Returns: number }
      archive_teacher_question: {
        Args: { p_question_id: number }
        Returns: Json
      }
      archive_teacher_topic: { Args: { p_topic_id: number }; Returns: Json }
      assert_topic_playable: {
        Args: { p_topic_id: number }
        Returns: undefined
      }
      assign_admin_role: {
        Args: { p_reason: string; p_role_id: string; p_user_id: string }
        Returns: Json
      }
      badge_metric_value: {
        Args: { p_metric_key: string; p_metrics: Json }
        Returns: number
      }
      batch_review_manual_attempts: {
        Args: {
          p_attempt_ids: number[]
          p_comment_audience?: string
          p_notes?: string
          p_status: string
        }
        Returns: Json
      }
      can_access_question_media: {
        Args: { p_classroom_id?: number; p_subject_id: number }
        Returns: boolean
      }
      can_read_profile: { Args: { p_profile_id: string }; Returns: boolean }
      cancel_account_deletion: { Args: { p_request_id: string }; Returns: Json }
      claim_admin_export_jobs: {
        Args: { p_limit?: number; p_worker_id: string }
        Returns: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          expires_at: string | null
          export_type: string
          filters: Json
          id: string
          processed_rows: number
          requested_by: string
          row_count: number | null
          started_at: string | null
          status: string
          storage_path: string | null
          updated_at: string
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "admin_export_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      claim_notification_delivery_item: {
        Args: { p_queue_id: number; p_worker_id: string }
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
      claim_support_email_delivery_batch: {
        Args: { p_limit?: number; p_worker_id: string }
        Returns: {
          attempts: number
          created_at: string
          error_code: string | null
          error_message: string | null
          id: number
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          message_id: number | null
          next_attempt_at: string
          provider_message_id: string | null
          recipient_email: string
          recipient_id: string
          sent_at: string | null
          status: string
          subject: string
          ticket_id: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "support_email_deliveries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_teacher_audit_export_requests: {
        Args: { p_limit?: number }
        Returns: {
          completed_at: string | null
          error_message: string | null
          expires_at: string | null
          filters: Json
          id: string
          object_path: string | null
          requested_at: string
          row_count: number | null
          started_at: string | null
          status: string
          teacher_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "teacher_audit_export_requests"
          isOneToOne: false
          isSetofReturn: true
        }
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
      complete_admin_export_job: {
        Args: { p_job_id: string; p_row_count: number; p_storage_path: string }
        Returns: undefined
      }
      complete_teacher_audit_export: {
        Args: {
          p_error_message?: string
          p_object_path?: string
          p_request_id: string
          p_row_count?: number
          p_status: string
        }
        Returns: undefined
      }
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
      delete_notifications: { Args: { p_ids: string[] }; Returns: number }
      delete_user_relational_data: {
        Args: { p_user_id: string }
        Returns: Json
      }
      detect_teacher_audit_anomalies: { Args: never; Returns: number }
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
      expire_admin_export_jobs: { Args: never; Returns: number }
      fail_admin_export_job: {
        Args: { p_error_message: string; p_job_id: string }
        Returns: undefined
      }
      finish_game_attempt: {
        Args: { p_attempt_id: string; p_status?: string }
        Returns: Json
      }
      finish_support_email_delivery: {
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
          after_state: Json
          before_state: Json
          chain_hash: string
          chain_seq: number
          created_at: string
          id: number
          metadata: Json
          previous_hash: string
          retention_until: string
          severity: string
          target_id: string
          target_table: string
          total_count: number
        }[]
      }
      get_admin_audit_logs_page_secured: {
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
          after_state: Json
          before_state: Json
          chain_hash: string
          chain_seq: number
          created_at: string
          id: number
          metadata: Json
          previous_hash: string
          retention_until: string
          severity: string
          target_id: string
          target_table: string
          total_count: number
        }[]
      }
      get_admin_audit_policy: { Args: never; Returns: Json }
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
          code_expires_at: string
          code_status: string
          created_at: string
          deactivated_at: string
          deactivation_reason: string
          duplicate_code_count: number
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
      get_admin_account_export_requests_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          completed_at: string | null
          error_message: string | null
          expires_at: string | null
          file_size_bytes: number | null
          id: string
          requested_at: string
          started_at: string | null
          status: string
          total_count: number
          user_alias: string
          user_id: string
          user_role: string
        }[]
      }
      get_admin_dashboard_metrics: { Args: never; Returns: Json }
      get_admin_directory_filters: { Args: never; Returns: Json }
      get_admin_enrollments_summary: { Args: never; Returns: Json }
      get_admin_export_download_path: {
        Args: { p_job_id: string }
        Returns: Json
      }
      get_admin_export_jobs_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          expires_at: string | null
          export_type: string
          filters: Json
          id: string
          processed_rows: number
          requested_by: string
          row_count: number | null
          started_at: string | null
          status: string
          storage_path: string | null
          total_count: number
          updated_at: string
          worker_id: string | null
        }[]
      }
      get_admin_portal_context: { Args: never; Returns: Json }
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
          admin_permissions: string[]
          admin_role_name: string
          alias: string
          change_count: number
          created_at: string
          deactivated_at: string
          deactivation_reason: string
          email: string
          enrollment_count: number
          id: string
          last_activity_at: string
          last_sign_in_at: string
          mfa_factor_count: number
          reactivate_at: string
          role_id: string
          security_status: string
          subject_count: number
          total_count: number
        }[]
      }
      get_admin_push_delivery_detail: {
        Args: { p_queue_id: number }
        Returns: Json
      }
      get_admin_push_delivery_metrics: {
        Args: { p_days?: number }
        Returns: Json
      }
      get_admin_push_delivery_page: {
        Args: {
          p_from?: string | null
          p_limit?: number
          p_offset?: number
          p_role?: string | null
          p_search?: string | null
          p_status?: string | null
          p_to?: string | null
          p_type?: string | null
        }
        Returns: {
          active_devices: number
          attempts: number
          audience: string
          created_at: string
          delivered_devices: number
          delivery_cycle: number
          delivery_devices: number
          failed_devices: number
          last_error_code: string
          max_attempts: number
          next_attempt_at: string
          notification_description: string
          notification_id: string
          notification_title: string
          notification_type: string
          priority: string
          queue_id: number
          queue_status: string
          recipient_alias: string
          recipient_id: string
          recipient_role: string
          skip_reason: string
          total_count: number
          updated_at: string
        }[]
      }
      get_admin_role_assignments_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          alias: string
          assigned_at: string
          assigned_by: string
          email: string
          permissions: string[]
          role_id: string
          role_name: string
          total_count: number
          user_id: string
        }[]
      }
      get_admin_roles: {
        Args: never
        Returns: {
          assigned_count: number
          description: string
          id: string
          name: string
          permissions: string[]
          system: boolean
        }[]
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
          p_subject_id?: number
          p_teacher_id?: string
        }
        Returns: {
          active: boolean
          archive_reason: string
          archived_at: string
          classes_count: number
          created_at: string
          deletion_eligible_at: string
          duplicate_code_count: number
          enrollments_count: number
          expired_code_count: number
          id: number
          inactive_classrooms_count: number
          incidents_count: number
          is_archived: boolean
          last_activity_at: string
          missing_code_count: number
          name: string
          orphaned: boolean
          pending_reviews_count: number
          retention_until: string
          teacher_alias: string
          teacher_email: string
          teacher_id: string
          total_count: number
        }[]
      }
      get_admin_support_directory: { Args: never; Returns: Json }
      get_admin_support_tickets_page: {
        Args: {
          p_assigned_admin_id?: string
          p_limit?: number
          p_offset?: number
          p_priority?: string
          p_role?: string
          p_search?: string
          p_sla_state?: string
          p_status?: string
          p_tag?: string
        }
        Returns: {
          admin_response: string
          assigned_admin_alias: string
          assigned_admin_id: string
          attachment_count: number
          auto_priority_score: number
          category: string
          contact_email: string
          created_at: string
          first_responded_at: string
          first_response_due_at: string
          id: number
          last_response_at: string
          message: string
          message_count: number
          priority: string
          priority_source: string
          resolution_due_at: string
          resolved_at: string
          role: string
          sla_state: string
          status: string
          subject: string
          tags: Json
          total_count: number
          updated_at: string
          user_alias: string
          user_email: string
          user_id: string
        }[]
      }
      get_admin_support_tickets_page_secured: {
        Args: {
          p_assigned_admin_id?: string
          p_limit?: number
          p_offset?: number
          p_priority?: string
          p_role?: string
          p_search?: string
          p_sla_state?: string
          p_status?: string
          p_tag?: string
        }
        Returns: {
          admin_response: string
          assigned_admin_alias: string
          assigned_admin_id: string
          attachment_count: number
          auto_priority_score: number
          category: string
          contact_email: string
          created_at: string
          first_responded_at: string
          first_response_due_at: string
          id: number
          last_response_at: string
          message: string
          message_count: number
          priority: string
          priority_source: string
          resolution_due_at: string
          resolved_at: string
          role: string
          sla_state: string
          status: string
          subject: string
          tags: Json
          total_count: number
          updated_at: string
          user_alias: string
          user_email: string
          user_id: string
        }[]
      }
      get_admin_usage_analytics: { Args: { p_days?: number }; Returns: Json }
      get_admin_user_change_history_page: {
        Args: { p_limit?: number; p_offset?: number; p_profile_id: string }
        Returns: {
          action: string
          actor_alias: string
          after_state: Json
          before_state: Json
          change_source: string
          changed_by: string
          created_at: string
          id: number
          profile_id: string
          reason: string
          total_count: number
        }[]
      }
      get_attempt_feedback: {
        Args: { p_attempt_history_id: number }
        Returns: Json
      }
      get_avatar_customization_options: { Args: never; Returns: Json }
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
      get_class_weekly_ranking_profiles: {
        Args: { p_classroom_id: number; p_limit?: number }
        Returns: {
          alias: string
          avatar: string
          id: string
          points: number
          visibility: string
          weekly_points: number
        }[]
      }
      get_game_attempt_review_index: {
        Args: {
          p_attempt_id?: string
          p_classroom_id?: number
          p_difficulty?: number
          p_general_topic?: boolean
          p_subject_id?: number
          p_topic_id?: number
        }
        Returns: Json
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
      get_manual_review_configuration: { Args: never; Returns: Json }
      get_manual_review_history: {
        Args: { p_attempt_history_id: number }
        Returns: Json
      }
      get_manual_review_thread: {
        Args: { p_attempt_history_id: number }
        Returns: Json
      }
      get_notifications_page: {
        Args: {
          p_audience: string
          p_cursor_created_at?: string
          p_cursor_id?: string
          p_limit?: number
        }
        Returns: Json
      }
      get_own_support_email_history: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          created_at: string
          error_message: string
          id: number
          message_id: number
          sent_at: string
          status: string
          subject: string
          ticket_id: number
          total_count: number
        }[]
      }
      get_own_support_tickets_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          attachment_count: number
          category: string
          contact_email: string
          created_at: string
          first_responded_at: string
          first_response_due_at: string
          id: number
          last_response_at: string
          message: string
          message_count: number
          preferred_channel: string
          priority: string
          resolution_due_at: string
          resolved_at: string
          role: string
          status: string
          subject: string
          total_count: number
          updated_at: string
          user_id: string
        }[]
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
      get_safe_game_questions_v2: {
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
      get_student_badge_catalog: {
        Args: {
          p_category_key?: string
          p_page?: number
          p_page_size?: number
          p_status?: string
        }
        Returns: Json
      }
      get_student_badge_metrics: { Args: never; Returns: Json }
      get_student_home_dashboard: { Args: never; Returns: Json }
      get_student_progress_summary: { Args: never; Returns: Json }
      get_student_question_catalog: {
        Args: { p_classroom_id?: number; p_subject_id?: number }
        Returns: Json
      }
      get_support_contact_channels: {
        Args: never
        Returns: {
          channel_key: string
          channel_type: string
          description: string | null
          enabled: boolean
          label: string
          sort_order: number
          updated_at: string
          value: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "support_contact_channels"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_support_thread_page: {
        Args: { p_before_id?: number; p_limit?: number; p_ticket_id: number }
        Returns: Json
      }
      get_teacher_attention_students_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      get_teacher_audit_configuration: { Args: never; Returns: Json }
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
      get_teacher_audit_logs_page_v2: {
        Args: {
          p_action?: string
          p_category?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_severity?: string
          p_target_table?: string
          p_to?: string
        }
        Returns: Json
      }
      get_teacher_classrooms_page: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: Json
      }
      get_teacher_courses_page: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_sort?: string
          p_status?: string
        }
        Returns: Json
      }
      get_teacher_dashboard_summary: { Args: never; Returns: Json }
      get_teacher_manual_review_queue: {
        Args: {
          p_attempt_id?: number
          p_classroom_id?: number
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
          p_student_id?: string
          p_subject_id?: number
        }
        Returns: Json
      }
      get_teacher_notification_center_summary: { Args: never; Returns: Json }
      get_teacher_notification_settings: { Args: never; Returns: Json }
      get_teacher_notifications_page: {
        Args: {
          p_bucket?: string
          p_category?: string
          p_cursor_created_at?: string
          p_cursor_id?: string
          p_limit?: number
          p_subject_id?: number
          p_unread_only?: boolean
        }
        Returns: Json
      }
      get_teacher_profile_recent_questions_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          created_at: string
          id: number
          question_type: string
          subject_id: number
          subject_name: string
          text: string
          total_count: number
        }[]
      }
      get_teacher_profile_recent_subjects_page: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          classroom_count: number
          code: string
          created_at: string
          description: string
          icon: string
          id: number
          name: string
          student_count: number
          total_count: number
        }[]
      }
      get_teacher_profile_summary: {
        Args: { p_period_days?: number }
        Returns: Json
      }
      get_teacher_question_affected_students_page: {
        Args: {
          p_classroom_id?: number
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_offset?: number
          p_question_id: number
        }
        Returns: Json
      }
      get_teacher_question_report: {
        Args: {
          p_classroom_id?: number
          p_date_from?: string
          p_date_to?: string
          p_question_id: number
        }
        Returns: Json
      }
      get_teacher_recent_activity_page: {
        Args: { p_limit?: number; p_offset?: number }
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
      get_teacher_student_history_metrics: {
        Args: {
          p_classroom_id?: number
          p_period_days?: number
          p_student_id: string
          p_subject_id?: number
        }
        Returns: Json
      }
      get_teacher_student_history_reviews_page: {
        Args: {
          p_classroom_id?: number
          p_limit?: number
          p_offset?: number
          p_student_id: string
          p_subject_id?: number
        }
        Returns: Json
      }
      get_teacher_student_history_summary: {
        Args: {
          p_classroom_id?: number
          p_period_days?: number
          p_student_id: string
          p_subject_id?: number
        }
        Returns: Json
      }
      get_teacher_student_history_timeline_page: {
        Args: {
          p_classroom_id?: number
          p_limit?: number
          p_offset?: number
          p_student_id: string
          p_subject_id?: number
        }
        Returns: Json
      }
      get_teacher_student_history_weaknesses: {
        Args: {
          p_classroom_id?: number
          p_period_days?: number
          p_student_id: string
          p_subject_id?: number
        }
        Returns: Json
      }
      get_teacher_students_page: {
        Args: {
          p_classroom_id?: number
          p_limit?: number
          p_offset?: number
          p_order?: string
          p_search?: string
          p_status?: string
          p_subject_id?: number
        }
        Returns: Json
      }
      get_teacher_subject_analytics: {
        Args: { p_classroom_id: number; p_subject_id: number }
        Returns: Json
      }
      get_teacher_subject_overview: {
        Args: { p_classroom_id?: number; p_subject_id: number }
        Returns: Json
      }
      get_teacher_subject_questions_page: {
        Args: {
          p_classroom_id: number
          p_difficulty?: number
          p_general_topic?: boolean
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_subject_id: number
          p_topic_id?: number
        }
        Returns: Json
      }
      get_teacher_subject_students_page: {
        Args: {
          p_classroom_id: number
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_sort?: string
          p_status?: string
          p_subject_id: number
        }
        Returns: Json
      }
      get_teacher_subject_topics_page: {
        Args: {
          p_classroom_id: number
          p_limit?: number
          p_offset?: number
          p_subject_id: number
        }
        Returns: Json
      }
      get_teacher_topic_questions_page: {
        Args: {
          p_difficulty?: number
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_topic_id: number
          p_visibility?: string
        }
        Returns: Json
      }
      get_teacher_topic_summary: { Args: { p_topic_id: number }; Returns: Json }
      get_weekly_ranking_profiles: {
        Args: { p_limit?: number }
        Returns: {
          alias: string
          avatar: string
          id: string
          points: number
          visibility: string
          weekly_points: number
        }[]
      }
      harden_admin_audit_partition_privileges: { Args: never; Returns: number }
      initialize_guest_profile: { Args: { p_alias: string }; Returns: Json }
      invoke_account_requests_processor: { Args: never; Returns: number }
      invoke_admin_export_processor: { Args: never; Returns: undefined }
      invoke_notification_delivery_worker: { Args: never; Returns: number }
      invoke_support_email_processor: { Args: never; Returns: undefined }
      invoke_teacher_digest_processor: { Args: never; Returns: undefined }
      is_active_teacher: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_classroom_enrolled: {
        Args: { p_classroom_id: number }
        Returns: boolean
      }
      is_classroom_teacher: {
        Args: { p_classroom_id: number }
        Returns: boolean
      }
      is_invite_code_available: {
        Args: {
          p_code: string
          p_exclude_classroom_id?: number
          p_exclude_subject_id?: number
        }
        Returns: boolean
      }
      is_own_avatar_storage_path: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      is_subject_enrolled: { Args: { p_subject_id: number }; Returns: boolean }
      is_subject_teacher: { Args: { p_subject_id: number }; Returns: boolean }
      join_subject_by_code: { Args: { p_code: string }; Returns: Json }
      maintain_admin_audit_partitions: { Args: never; Returns: Json }
      mark_all_notifications_read: { Args: { p_audience: string }; Returns: number }
      mark_notifications_read: { Args: { p_ids: string[] }; Returns: number }
      normalize_answer_text: { Args: { value: string }; Returns: string }
      reactivate_due_admin_users: { Args: never; Returns: number }
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
      request_account_data_export: { Args: never; Returns: Json }
      request_account_deletion: { Args: never; Returns: Json }
      request_admin_export_job: {
        Args: { p_export_type: string; p_filters?: Json }
        Returns: Json
      }
      request_teacher_audit_export: {
        Args: { p_filters?: Json }
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
      review_manual_review_attempt: {
        Args: {
          p_attempt_history_id: number
          p_comment_audience?: string
          p_notes?: string
          p_status: string
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
      sanitize_teacher_audit_payload: { Args: { p_value: Json }; Returns: Json }
      save_manual_review_settings: {
        Args: { p_sla_hours: number }
        Returns: Json
      }
      save_manual_review_template: {
        Args: {
          p_audience: string
          p_body: string
          p_id: string
          p_title: string
        }
        Returns: string
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
      save_teacher_question_v2: {
        Args: {
          p_answers?: Json
          p_classroom_id?: number
          p_difficulty?: number
          p_explanation?: string
          p_hint?: string
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
        Args: { p_limit?: number; p_offset?: number; p_query: string }
        Returns: {
          classroom_id: number
          entity_id: string
          entity_type: string
          relevance: number
          role_id: string
          subject_id: number
          subtitle: string
          title: string
          total_count: number
        }[]
      }
      set_analytics_consent: { Args: { p_enabled: boolean }; Returns: boolean }
      set_teacher_course_notification_preference: {
        Args: {
          p_critical_enabled: boolean
          p_digest_enabled: boolean
          p_informative_enabled: boolean
          p_muted_until?: string
          p_subject_id: number
        }
        Returns: Json
      }
      set_teacher_digest_preference: {
        Args: {
          p_frequency: string
          p_hour?: number
          p_recipient_email?: string
          p_weekday?: number
        }
        Returns: Json
      }
      set_teacher_notification_preferences: {
        Args: {
          p_inactive_student_alerts: boolean
          p_open_review_alerts: boolean
          p_push_enabled: boolean
          p_sensitive_action_alerts: boolean
        }
        Returns: Json
      }
      set_teacher_notifications_mute: {
        Args: { p_until?: string }
        Returns: Json
      }
      set_teacher_support_preference: {
        Args: { p_channel: string; p_contact_email?: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
      support_first_response_interval: {
        Args: { p_priority: string }
        Returns: string
      }
      support_priority_score: {
        Args: { p_category: string; p_message: string; p_subject: string }
        Returns: number
      }
      support_resolution_interval: {
        Args: { p_priority: string }
        Returns: string
      }
      sync_student_badges: { Args: never; Returns: Json }
      sync_student_points: { Args: { student_id: string }; Returns: number }
      teacher_notification_category: {
        Args: {
          p_action_url: string
          p_metadata: Json
          p_title: string
          p_type: string
        }
        Returns: string
      }
      teacher_notification_severity: {
        Args: { p_metadata: Json; p_title: string; p_type: string }
        Returns: string
      }
      teacher_notification_subject_id: {
        Args: { p_metadata: Json }
        Returns: number
      }
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
      verify_admin_audit_chain: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
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

