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
      agent_invocations: {
        Row: {
          agent: string | null
          cost_usd: number
          created_at: string | null
          duration_ms: number | null
          error: string | null
          id: string
          job_id: string | null
          model: string
          task: string | null
          tokens_in: number
          tokens_out: number
          user_id: string | null
        }
        Insert: {
          agent?: string | null
          cost_usd?: number
          created_at?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          job_id?: string | null
          model: string
          task?: string | null
          tokens_in?: number
          tokens_out?: number
          user_id?: string | null
        }
        Update: {
          agent?: string | null
          cost_usd?: number
          created_at?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          job_id?: string | null
          model?: string
          task?: string | null
          tokens_in?: number
          tokens_out?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_invocations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_invocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_outcomes: {
        Row: {
          agent: string
          created_at: string | null
          delta: Json | null
          entity_id: string | null
          entity_type: string | null
          job_id: string | null
          model: string | null
          outcome: string
          task: string
          user_id: string | null
        }
        Insert: {
          agent: string
          created_at?: string | null
          delta?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          job_id?: string | null
          model?: string | null
          outcome: string
          task: string
          user_id?: string | null
        }
        Update: {
          agent?: string
          created_at?: string | null
          delta?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          job_id?: string | null
          model?: string | null
          outcome?: string
          task?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_outcomes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_outcomes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      backups_log: {
        Row: {
          bytes: number | null
          created_at: string | null
          error: string | null
          finished_at: string | null
          id: string
          row_counts: Json | null
          status: string
          storage_path: string | null
          triggered_by: string
          triggered_user: string | null
        }
        Insert: {
          bytes?: number | null
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          row_counts?: Json | null
          status?: string
          storage_path?: string | null
          triggered_by: string
          triggered_user?: string | null
        }
        Update: {
          bytes?: number | null
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          row_counts?: Json | null
          status?: string
          storage_path?: string | null
          triggered_by?: string
          triggered_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backups_log_triggered_user_fkey"
            columns: ["triggered_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          ai_summary: string | null
          created_at: string | null
          customer_id: string | null
          deepgram_response: Json | null
          direction: string | null
          duration_seconds: number | null
          from_number: string | null
          id: string
          job_id: string | null
          recording_url: string | null
          to_number: string | null
          transcript: string | null
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string | null
          customer_id?: string | null
          deepgram_response?: Json | null
          direction?: string | null
          duration_seconds?: number | null
          from_number?: string | null
          id?: string
          job_id?: string | null
          recording_url?: string | null
          to_number?: string | null
          transcript?: string | null
        }
        Update: {
          ai_summary?: string | null
          created_at?: string | null
          customer_id?: string | null
          deepgram_response?: Json | null
          direction?: string | null
          duration_seconds?: number | null
          from_number?: string | null
          id?: string
          job_id?: string | null
          recording_url?: string | null
          to_number?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      consumables_used: {
        Row: {
          created_at: string | null
          id: string
          item: string
          job_id: string
          notes: string | null
          quantity: number
          unit_cost: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          item: string
          job_id: string
          notes?: string | null
          quantity?: number
          unit_cost: number
        }
        Update: {
          created_at?: string | null
          id?: string
          item?: string
          job_id?: string
          notes?: string | null
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "consumables_used_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_basis_settings: {
        Row: {
          default_equipment_daily: number
          default_hourly_rate: number
          id: number
          monthly_overhead: number
          updated_at: string | null
          van_cost_per_job: number
        }
        Insert: {
          default_equipment_daily?: number
          default_hourly_rate?: number
          id?: number
          monthly_overhead?: number
          updated_at?: string | null
          van_cost_per_job?: number
        }
        Update: {
          default_equipment_daily?: number
          default_hourly_rate?: number
          id?: number
          monthly_overhead?: number
          updated_at?: string | null
          van_cost_per_job?: number
        }
        Relationships: []
      }
      customer_notifications: {
        Row: {
          body: string | null
          channel: string
          created_at: string | null
          custom_message: string | null
          event_type: string
          id: string
          job_id: string
          sent_at: string | null
          sent_by: string | null
          sent_to: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string | null
          custom_message?: string | null
          event_type: string
          id?: string
          job_id: string
          sent_at?: string | null
          sent_by?: string | null
          sent_to: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string | null
          custom_message?: string | null
          event_type?: string
          id?: string
          job_id?: string
          sent_at?: string | null
          sent_by?: string | null
          sent_to?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_notifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notifications_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          auto_notify_emails: boolean
          city: string | null
          created_at: string | null
          email: string | null
          id: string
          insurance_claim_number: string | null
          insurance_company: string | null
          insurance_policy_number: string | null
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          auto_notify_emails?: boolean
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          insurance_claim_number?: string | null
          insurance_company?: string | null
          insurance_policy_number?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          auto_notify_emails?: boolean
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          insurance_claim_number?: string | null
          insurance_company?: string | null
          insurance_policy_number?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      echo_conversations: {
        Row: {
          answer: string
          cost_usd: number
          created_at: string | null
          duration_ms: number | null
          feedback: string | null
          feedback_at: string | null
          feedback_note: string | null
          id: string
          model: string
          question: string
          tokens_in: number
          tokens_out: number
          user_id: string | null
        }
        Insert: {
          answer: string
          cost_usd?: number
          created_at?: string | null
          duration_ms?: number | null
          feedback?: string | null
          feedback_at?: string | null
          feedback_note?: string | null
          id?: string
          model: string
          question: string
          tokens_in?: number
          tokens_out?: number
          user_id?: string | null
        }
        Update: {
          answer?: string
          cost_usd?: number
          created_at?: string | null
          duration_ms?: number | null
          feedback?: string | null
          feedback_at?: string | null
          feedback_note?: string | null
          id?: string
          model?: string
          question?: string
          tokens_in?: number
          tokens_out?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "echo_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          created_at: string | null
          current_job_id: string | null
          daily_cost: number | null
          hours_logged: number | null
          id: string
          location_notes: string | null
          manufacturer: string | null
          model: string | null
          notes: string | null
          purchased_at: string | null
          serial_number: string
          status: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_job_id?: string | null
          daily_cost?: number | null
          hours_logged?: number | null
          id?: string
          location_notes?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          purchased_at?: string | null
          serial_number: string
          status?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_job_id?: string | null
          daily_cost?: number | null
          hours_logged?: number | null
          id?: string
          location_notes?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          purchased_at?: string | null
          serial_number?: string
          status?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_current_job_id_fkey"
            columns: ["current_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_assignments: {
        Row: {
          deployed_at: string | null
          deployed_by: string | null
          equipment_id: string
          hours_at_deploy: number | null
          hours_at_return: number | null
          id: string
          job_id: string
          notes: string | null
          retrieved_at: string | null
          retrieved_by: string | null
        }
        Insert: {
          deployed_at?: string | null
          deployed_by?: string | null
          equipment_id: string
          hours_at_deploy?: number | null
          hours_at_return?: number | null
          id?: string
          job_id: string
          notes?: string | null
          retrieved_at?: string | null
          retrieved_by?: string | null
        }
        Update: {
          deployed_at?: string | null
          deployed_by?: string | null
          equipment_id?: string
          hours_at_deploy?: number | null
          hours_at_return?: number | null
          id?: string
          job_id?: string
          notes?: string | null
          retrieved_at?: string | null
          retrieved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_assignments_deployed_by_fkey"
            columns: ["deployed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_retrieved_by_fkey"
            columns: ["retrieved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_line_items: {
        Row: {
          category: string | null
          created_at: string | null
          description: string
          estimate_id: string
          id: string
          is_ai_drafted: boolean | null
          line_total: number | null
          notes: string | null
          quantity: number
          sort_order: number
          unit: string
          unit_price: number
          xactimate_code: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description: string
          estimate_id: string
          id?: string
          is_ai_drafted?: boolean | null
          line_total?: number | null
          notes?: string | null
          quantity?: number
          sort_order?: number
          unit?: string
          unit_price?: number
          xactimate_code?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string
          estimate_id?: string
          id?: string
          is_ai_drafted?: boolean | null
          line_total?: number | null
          notes?: string | null
          quantity?: number
          sort_order?: number
          unit?: string
          unit_price?: number
          xactimate_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          generated_by: string | null
          generation_meta: Json | null
          id: string
          job_id: string
          notes: string | null
          sent_at: string | null
          sent_to: string | null
          status: string
          updated_at: string | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          generated_by?: string | null
          generation_meta?: Json | null
          id?: string
          job_id: string
          notes?: string | null
          sent_at?: string | null
          sent_to?: string | null
          status?: string
          updated_at?: string | null
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          generated_by?: string | null
          generation_meta?: Json | null
          id?: string
          job_id?: string
          notes?: string | null
          sent_at?: string | null
          sent_to?: string | null
          status?: string
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimates_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          category: string | null
          created_at: string | null
          description: string
          id: string
          invoice_id: string
          line_total: number | null
          notes: string | null
          quantity: number
          sort_order: number
          unit: string
          unit_price: number
          xactimate_code: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          line_total?: number | null
          notes?: string | null
          quantity?: number
          sort_order?: number
          unit?: string
          unit_price?: number
          xactimate_code?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number | null
          notes?: string | null
          quantity?: number
          sort_order?: number
          unit?: string
          unit_price?: number
          xactimate_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_reminders: {
        Row: {
          created_at: string | null
          email_body: string | null
          email_subject: string | null
          id: string
          invoice_id: string
          reminder_type: string
          sent_at: string | null
          sent_by: string | null
          sent_to: string
        }
        Insert: {
          created_at?: string | null
          email_body?: string | null
          email_subject?: string | null
          id?: string
          invoice_id: string
          reminder_type: string
          sent_at?: string | null
          sent_by?: string | null
          sent_to: string
        }
        Update: {
          created_at?: string | null
          email_body?: string | null
          email_subject?: string | null
          id?: string
          invoice_id?: string
          reminder_type?: string
          sent_at?: string | null
          sent_by?: string | null
          sent_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_reminders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_reminders_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          created_by: string | null
          due_date: string | null
          estimate_id: string | null
          id: string
          invoice_number: string | null
          issue_date: string | null
          job_id: string
          notes: string | null
          paid_at: string | null
          sent_at: string | null
          sent_to: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          estimate_id?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          job_id: string
          notes?: string | null
          paid_at?: string | null
          sent_at?: string | null
          sent_to?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          estimate_id?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          job_id?: string
          notes?: string | null
          paid_at?: string | null
          sent_at?: string | null
          sent_to?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignments: {
        Row: {
          assigned_at: string | null
          id: string
          job_id: string
          profile_id: string
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          job_id: string
          profile_id: string
        }
        Update: {
          assigned_at?: string | null
          id?: string
          job_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_documents: {
        Row: {
          created_at: string | null
          doc_type: string
          filename: string
          id: string
          job_id: string
          mime_type: string | null
          notes: string | null
          signed: boolean | null
          signed_at: string | null
          signed_by_name: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          doc_type: string
          filename: string
          id?: string
          job_id: string
          mime_type?: string | null
          notes?: string | null
          signed?: boolean | null
          signed_at?: string | null
          signed_by_name?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          doc_type?: string
          filename?: string
          id?: string
          job_id?: string
          mime_type?: string | null
          notes?: string | null
          signed?: boolean | null
          signed_at?: string | null
          signed_by_name?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_notes: {
        Row: {
          author_id: string | null
          content: string
          created_at: string | null
          id: string
          job_id: string
          metadata: Json | null
          type: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          job_id: string
          metadata?: Json | null
          type?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          job_id?: string
          metadata?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          frame_timestamp_sec: number | null
          id: string
          job_id: string
          source_video_id: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          frame_timestamp_sec?: number | null
          id?: string
          job_id: string
          source_video_id?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          frame_timestamp_sec?: number | null
          id?: string
          job_id?: string
          source_video_id?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_source_video_id_fkey"
            columns: ["source_video_id"]
            isOneToOne: false
            referencedRelation: "job_videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_videos: {
        Row: {
          created_at: string | null
          duration_sec: number | null
          id: string
          job_id: string
          notes: string | null
          storage_path: string
          thumbnail_path: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          duration_sec?: number | null
          id?: string
          job_id: string
          notes?: string | null
          storage_path: string
          thumbnail_path?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          duration_sec?: number | null
          id?: string
          job_id?: string
          notes?: string | null
          storage_path?: string
          thumbnail_path?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_videos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_videos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          adjuster_share_token: string | null
          auto_actions_paused: boolean
          completed_at: string | null
          created_at: string | null
          customer_id: string | null
          customer_share_token: string | null
          deductible_amount: number | null
          description: string | null
          dispatch_inputs: Json | null
          estimated_value: number | null
          id: string
          job_number: string | null
          lead_tech_id: string | null
          payment_route: string | null
          referred_by_id: string | null
          scheduled_at: string | null
          scope_analyzed_at: string | null
          scope_assessment: Json | null
          site_address: string | null
          site_city: string | null
          site_state: string | null
          site_zip: string | null
          status: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          adjuster_share_token?: string | null
          auto_actions_paused?: boolean
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_share_token?: string | null
          deductible_amount?: number | null
          description?: string | null
          dispatch_inputs?: Json | null
          estimated_value?: number | null
          id?: string
          job_number?: string | null
          lead_tech_id?: string | null
          payment_route?: string | null
          referred_by_id?: string | null
          scheduled_at?: string | null
          scope_analyzed_at?: string | null
          scope_assessment?: Json | null
          site_address?: string | null
          site_city?: string | null
          site_state?: string | null
          site_zip?: string | null
          status?: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          adjuster_share_token?: string | null
          auto_actions_paused?: boolean
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_share_token?: string | null
          deductible_amount?: number | null
          description?: string | null
          dispatch_inputs?: Json | null
          estimated_value?: number | null
          id?: string
          job_number?: string | null
          lead_tech_id?: string | null
          payment_route?: string | null
          referred_by_id?: string | null
          scheduled_at?: string | null
          scope_analyzed_at?: string | null
          scope_assessment?: Json | null
          site_address?: string | null
          site_city?: string | null
          site_state?: string | null
          site_zip?: string | null
          status?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_lead_tech_id_fkey"
            columns: ["lead_tech_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_referred_by_id_fkey"
            columns: ["referred_by_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string
          created_at: string | null
          doc_type: string
          generated_by: string | null
          generation_meta: Json | null
          id: string
          job_id: string
          last_send_attempt: Json | null
          sent_at: string | null
          sent_to: string | null
          signature_data: Json | null
          signature_ip: string | null
          signature_user_agent: string | null
          signed_at: string | null
          signed_by_name: string | null
          signing_token: string | null
          status: string
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body: string
          created_at?: string | null
          doc_type: string
          generated_by?: string | null
          generation_meta?: Json | null
          id?: string
          job_id: string
          last_send_attempt?: Json | null
          sent_at?: string | null
          sent_to?: string | null
          signature_data?: Json | null
          signature_ip?: string | null
          signature_user_agent?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          signing_token?: string | null
          status?: string
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          created_at?: string | null
          doc_type?: string
          generated_by?: string | null
          generation_meta?: Json | null
          id?: string
          job_id?: string
          last_send_attempt?: Json | null
          sent_at?: string | null
          sent_to?: string | null
          signature_data?: Json | null
          signature_ip?: string | null
          signature_user_agent?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          signing_token?: string | null
          status?: string
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      moisture_readings: {
        Row: {
          created_at: string | null
          gpp: number | null
          id: string
          is_dry_standard: boolean | null
          job_id: string
          location_detail: string | null
          material: string | null
          moisture_pct: number | null
          notes: string | null
          reading_date: string | null
          recorded_by: string | null
          rh_pct: number | null
          room: string
          temp_f: number | null
        }
        Insert: {
          created_at?: string | null
          gpp?: number | null
          id?: string
          is_dry_standard?: boolean | null
          job_id: string
          location_detail?: string | null
          material?: string | null
          moisture_pct?: number | null
          notes?: string | null
          reading_date?: string | null
          recorded_by?: string | null
          rh_pct?: number | null
          room: string
          temp_f?: number | null
        }
        Update: {
          created_at?: string | null
          gpp?: number | null
          id?: string
          is_dry_standard?: boolean | null
          job_id?: string
          location_detail?: string | null
          material?: string | null
          moisture_pct?: number | null
          notes?: string | null
          reading_date?: string | null
          recorded_by?: string | null
          rh_pct?: number | null
          room?: string
          temp_f?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "moisture_readings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moisture_readings_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_leads: {
        Row: {
          business_type: string
          city: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_title: string | null
          converted_to_partner_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          next_action_at: string | null
          notes: string | null
          source: string | null
          state: string | null
          status: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          business_type: string
          city?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          converted_to_partner_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          next_action_at?: string | null
          notes?: string | null
          source?: string | null
          state?: string | null
          status?: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          business_type?: string
          city?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          converted_to_partner_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          next_action_at?: string | null
          notes?: string | null
          source?: string | null
          state?: string | null
          status?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_leads_converted_to_partner_id_fkey"
            columns: ["converted_to_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_messages: {
        Row: {
          channel: string
          created_at: string | null
          draft_content: string
          final_content: string | null
          generated_by: string | null
          id: string
          lead_id: string
          reply_notes: string | null
          reply_received: boolean | null
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          draft_content: string
          final_content?: string | null
          generated_by?: string | null
          id?: string
          lead_id: string
          reply_notes?: string | null
          reply_received?: boolean | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          draft_content?: string
          final_content?: string | null
          generated_by?: string | null
          id?: string
          lead_id?: string
          reply_notes?: string | null
          reply_received?: boolean | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_messages_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "outreach_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_investments: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          id: string
          notes: string | null
          occurred_on: string
          partner_id: string
          recorded_by: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          id?: string
          notes?: string | null
          occurred_on?: string
          partner_id: string
          recorded_by?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          occurred_on?: string
          partner_id?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_investments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_investments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_payouts: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          job_id: string | null
          method: string | null
          notes: string | null
          occurred_on: string
          partner_id: string
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          job_id?: string | null
          method?: string | null
          notes?: string | null
          occurred_on?: string
          partner_id: string
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          job_id?: string | null
          method?: string | null
          notes?: string | null
          occurred_on?: string
          partner_id?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_payouts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payouts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payouts_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean | null
          company: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          partner_type: string | null
          phone: string | null
        }
        Insert: {
          active?: boolean | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          partner_type?: string | null
          phone?: string | null
        }
        Update: {
          active?: boolean | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          partner_type?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          invoice_id: string
          method: string | null
          notes: string | null
          received_at: string | null
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          invoice_id: string
          method?: string | null
          notes?: string | null
          received_at?: string | null
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          invoice_id?: string
          method?: string | null
          notes?: string | null
          received_at?: string | null
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_approvals: {
        Row: {
          created_at: string | null
          detail: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          job_id: string | null
          kind: string
          link: string | null
          metadata: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string | null
          detail?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          job_id?: string | null
          kind: string
          link?: string | null
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string | null
          detail?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          job_id?: string | null
          kind?: string
          link?: string | null
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_approvals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_approvals_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          role: string
        }
        Insert: {
          active?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          name: string
          phone?: string | null
          role?: string
        }
        Update: {
          active?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string
        }
        Relationships: []
      }
      secrets_rotation_log: {
        Row: {
          id: string
          notes: string | null
          rotated_at: string | null
          rotated_by: string | null
          secret_name: string
        }
        Insert: {
          id?: string
          notes?: string | null
          rotated_at?: string | null
          rotated_by?: string | null
          secret_name: string
        }
        Update: {
          id?: string
          notes?: string | null
          rotated_at?: string | null
          rotated_by?: string | null
          secret_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "secrets_rotation_log_rotated_by_fkey"
            columns: ["rotated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      solomon_reports: {
        Row: {
          created_at: string | null
          generated_by: string | null
          id: string
          insights: Json | null
          invoice_count: number | null
          job_count: number | null
          raw_summary: string | null
          recommendations: Json | null
          total_billed: number | null
          total_collected: number | null
          window_days: number
        }
        Insert: {
          created_at?: string | null
          generated_by?: string | null
          id?: string
          insights?: Json | null
          invoice_count?: number | null
          job_count?: number | null
          raw_summary?: string | null
          recommendations?: Json | null
          total_billed?: number | null
          total_collected?: number | null
          window_days?: number
        }
        Update: {
          created_at?: string | null
          generated_by?: string | null
          id?: string
          insights?: Json | null
          invoice_count?: number | null
          job_count?: number | null
          raw_summary?: string | null
          recommendations?: Json | null
          total_billed?: number | null
          total_collected?: number | null
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "solomon_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_invoices: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          invoice_date: string
          invoice_number: string | null
          job_id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          receipt_path: string | null
          subcontractor_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          job_id: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          receipt_path?: string | null
          subcontractor_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          job_id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          receipt_path?: string | null
          subcontractor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_invoices_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractors: {
        Row: {
          active: boolean | null
          contact_name: string | null
          created_at: string | null
          ein_or_ssn_last4: string | null
          email: string | null
          id: string
          is_corporation: boolean | null
          name: string
          notes: string | null
          phone: string | null
          trade: string | null
          updated_at: string | null
          w9_file_path: string | null
        }
        Insert: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          ein_or_ssn_last4?: string | null
          email?: string | null
          id?: string
          is_corporation?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          trade?: string | null
          updated_at?: string | null
          w9_file_path?: string | null
        }
        Update: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          ein_or_ssn_last4?: string | null
          email?: string | null
          id?: string
          is_corporation?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          trade?: string | null
          updated_at?: string | null
          w9_file_path?: string | null
        }
        Relationships: []
      }
      tech_labor_entries: {
        Row: {
          created_at: string | null
          hourly_rate: number
          hours: number
          id: string
          job_id: string
          notes: string | null
          profile_id: string | null
          work_date: string
        }
        Insert: {
          created_at?: string | null
          hourly_rate: number
          hours: number
          id?: string
          job_id: string
          notes?: string | null
          profile_id?: string | null
          work_date?: string
        }
        Update: {
          created_at?: string | null
          hourly_rate?: number
          hours?: number
          id?: string
          job_id?: string
          notes?: string | null
          profile_id?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_labor_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_labor_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          expense_date: string
          id: string
          notes: string | null
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          vehicle_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: { Args: never; Returns: string }
      is_authenticated: { Args: never; Returns: boolean }
      is_owner_or_manager: { Args: never; Returns: boolean }
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
