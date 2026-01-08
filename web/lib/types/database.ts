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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      athlete_profiles: {
        Row: {
          age: number | null
          created_at: string
          custom_power_zones: Json | null
          first_name: string
          ftp: number | null
          gender: string | null
          goals: Json | null
          id: string
          last_name: string
          lthr: number | null
          max_hr: number | null
          preferred_language: string | null
          resting_hr: number | null
          timezone: string | null
          units_system: string | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          created_at?: string
          custom_power_zones?: Json | null
          first_name: string
          ftp?: number | null
          gender?: string | null
          goals?: Json | null
          id?: string
          last_name: string
          lthr?: number | null
          max_hr?: number | null
          preferred_language?: string | null
          resting_hr?: number | null
          timezone?: string | null
          units_system?: string | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          created_at?: string
          custom_power_zones?: Json | null
          first_name?: string
          ftp?: number | null
          gender?: string | null
          goals?: Json | null
          id?: string
          last_name?: string
          lthr?: number | null
          max_hr?: number | null
          preferred_language?: string | null
          resting_hr?: number | null
          timezone?: string | null
          units_system?: string | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      coach_chat_sessions: {
        Row: {
          created_at: string | null
          id: string
          messages: Json[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          messages?: Json[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          messages?: Json[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      custom_plan_weeks: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          phase: string
          plan_id: string
          updated_at: string | null
          week_number: number
          weekly_tss: number | null
          workouts_data: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          phase: string
          plan_id: string
          updated_at?: string | null
          week_number: number
          weekly_tss?: number | null
          workouts_data?: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          phase?: string
          plan_id?: string
          updated_at?: string | null
          week_number?: number
          weekly_tss?: number | null
          workouts_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "custom_plan_weeks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_generation_jobs: {
        Row: {
          created_at: string | null
          error: string | null
          id: string
          params: Json | null
          plan_id: string | null
          progress: Json | null
          result: Json | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          id: string
          params?: Json | null
          plan_id?: string | null
          progress?: Json | null
          result?: Json | null
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error?: string | null
          id?: string
          params?: Json | null
          plan_id?: string | null
          progress?: Json | null
          result?: Json | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_generation_jobs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_generation_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      plan_instance_notes: {
        Row: {
          attachment_content_type: string | null
          attachment_filename: string | null
          attachment_s3_key: string | null
          attachment_size_bytes: number | null
          created_at: string
          description: string | null
          id: string
          note_date: string
          plan_instance_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_content_type?: string | null
          attachment_filename?: string | null
          attachment_s3_key?: string | null
          attachment_size_bytes?: number | null
          created_at?: string
          description?: string | null
          id?: string
          note_date: string
          plan_instance_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachment_content_type?: string | null
          attachment_filename?: string | null
          attachment_s3_key?: string | null
          attachment_size_bytes?: number | null
          created_at?: string
          description?: string | null
          id?: string
          note_date?: string
          plan_instance_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_instance_notes_plan_instance_id_fkey"
            columns: ["plan_instance_id"]
            isOneToOne: false
            referencedRelation: "plan_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_instance_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      plan_instances: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          name: string
          plan_data: Json
          start_date: string
          status: string | null
          template_id: string | null
          updated_at: string | null
          user_id: string
          weeks_total: number
          workout_overrides: Json | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          name: string
          plan_data: Json
          start_date: string
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
          user_id: string
          weeks_total: number
          workout_overrides?: Json | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          name?: string
          plan_data?: Json
          start_date?: string
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
          user_id?: string
          weeks_total?: number
          workout_overrides?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_instances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      reports: {
        Row: {
          completed_at: string | null
          config: Json
          created_at: string
          error_message: string | null
          id: string
          period_end: string | null
          period_start: string | null
          report_data: Json | null
          report_type: string
          report_url: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          config: Json
          created_at?: string
          error_message?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          report_data?: Json | null
          report_type: string
          report_url?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          config?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          report_data?: Json | null
          report_type?: string
          report_url?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      strava_activities: {
        Row: {
          average_heartrate: number | null
          average_watts: number | null
          created_at: string | null
          distance: number | null
          elapsed_time: number | null
          fit_file_path: string | null
          id: string
          max_heartrate: number | null
          max_watts: number | null
          moving_time: number | null
          name: string
          raw_data: Json | null
          sport_type: string
          start_date: string
          strava_activity_id: number
          total_elevation_gain: number | null
          tss: number | null
          tss_method: string | null
          type: string
          updated_at: string | null
          user_id: string
          weighted_average_watts: number | null
        }
        Insert: {
          average_heartrate?: number | null
          average_watts?: number | null
          created_at?: string | null
          distance?: number | null
          elapsed_time?: number | null
          fit_file_path?: string | null
          id?: string
          max_heartrate?: number | null
          max_watts?: number | null
          moving_time?: number | null
          name: string
          raw_data?: Json | null
          sport_type: string
          start_date: string
          strava_activity_id: number
          total_elevation_gain?: number | null
          tss?: number | null
          tss_method?: string | null
          type: string
          updated_at?: string | null
          user_id: string
          weighted_average_watts?: number | null
        }
        Update: {
          average_heartrate?: number | null
          average_watts?: number | null
          created_at?: string | null
          distance?: number | null
          elapsed_time?: number | null
          fit_file_path?: string | null
          id?: string
          max_heartrate?: number | null
          max_watts?: number | null
          moving_time?: number | null
          name?: string
          raw_data?: Json | null
          sport_type?: string
          start_date?: string
          strava_activity_id?: number
          total_elevation_gain?: number | null
          tss?: number | null
          tss_method?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
          weighted_average_watts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "strava_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      strava_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          last_sync_at: string | null
          refresh_token: string
          scope: string
          strava_athlete_id: number
          sync_error: string | null
          sync_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          last_sync_at?: string | null
          refresh_token: string
          scope: string
          strava_athlete_id: number
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_sync_at?: string | null
          refresh_token?: string
          scope?: string
          strava_athlete_id?: number
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strava_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      strava_webhook_events: {
        Row: {
          aspect_type: string
          created_at: string | null
          error: string | null
          event_time: string
          object_id: number
          object_type: string
          owner_id: number
          processed: boolean | null
          processed_at: string | null
          raw_data: Json
          retry_count: number | null
          subscription_id: number
        }
        Insert: {
          aspect_type: string
          created_at?: string | null
          error?: string | null
          event_time: string
          object_id: number
          object_type: string
          owner_id: number
          processed?: boolean | null
          processed_at?: string | null
          raw_data: Json
          retry_count?: number | null
          subscription_id: number
        }
        Update: {
          aspect_type?: string
          created_at?: string | null
          error?: string | null
          event_time?: string
          object_id?: number
          object_type?: string
          owner_id?: number
          processed?: boolean | null
          processed_at?: string | null
          raw_data?: Json
          retry_count?: number | null
          subscription_id?: number
        }
        Relationships: []
      }
      strava_webhook_subscriptions: {
        Row: {
          callback_url: string
          created_at: string | null
          id: string
          subscription_id: number
          updated_at: string | null
          verify_token: string
        }
        Insert: {
          callback_url: string
          created_at?: string | null
          id?: string
          subscription_id: number
          updated_at?: string | null
          verify_token: string
        }
        Update: {
          callback_url?: string
          created_at?: string | null
          id?: string
          subscription_id?: number
          updated_at?: string | null
          verify_token?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          features: Json
          id: string
          is_active: boolean
          limits: Json
          name: string
          price_monthly_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          name: string
          price_monthly_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          name?: string
          price_monthly_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          max_attempts: number
          payload: Json
          result: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          type: Database["public"]["Enums"]["job_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          max_attempts?: number
          payload?: Json
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          type?: Database["public"]["Enums"]["job_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          max_attempts?: number
          payload?: Json
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          type?: Database["public"]["Enums"]["job_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      training_plans: {
        Row: {
          created_at: string
          created_from: string | null
          description: string | null
          goal: string
          id: string
          is_draft: boolean | null
          metadata: Json | null
          name: string
          plan_data: Json
          status: string | null
          target_ftp: number | null
          updated_at: string
          user_id: string
          weeks_total: number | null
        }
        Insert: {
          created_at?: string
          created_from?: string | null
          description?: string | null
          goal?: string
          id?: string
          is_draft?: boolean | null
          metadata?: Json | null
          name: string
          plan_data: Json
          status?: string | null
          target_ftp?: number | null
          updated_at?: string
          user_id: string
          weeks_total?: number | null
        }
        Update: {
          created_at?: string
          created_from?: string | null
          description?: string | null
          goal?: string
          id?: string
          is_draft?: boolean | null
          metadata?: Json | null
          name?: string
          plan_data?: Json
          status?: string | null
          target_ftp?: number | null
          updated_at?: string
          user_id?: string
          weeks_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      trainingpeaks_connections: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          is_premium: boolean | null
          refresh_token: string
          scope: string
          tp_athlete_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          is_premium?: boolean | null
          refresh_token: string
          scope: string
          tp_athlete_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          is_premium?: boolean | null
          refresh_token?: string
          scope?: string
          tp_athlete_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainingpeaks_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      trainingpeaks_workout_syncs: {
        Row: {
          created_at: string | null
          id: string
          last_sync_at: string | null
          plan_instance_id: string
          sync_error: string | null
          sync_status: string | null
          tp_workout_id: string | null
          updated_at: string | null
          user_id: string
          week_number: number
          workout_date: string
          workout_index: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          plan_instance_id: string
          sync_error?: string | null
          sync_status?: string | null
          tp_workout_id?: string | null
          updated_at?: string | null
          user_id: string
          week_number: number
          workout_date: string
          workout_index: number
        }
        Update: {
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          plan_instance_id?: string
          sync_error?: string | null
          sync_status?: string | null
          tp_workout_id?: string | null
          updated_at?: string | null
          user_id?: string
          week_number?: number
          workout_date?: string
          workout_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "trainingpeaks_workout_syncs_plan_instance_id_fkey"
            columns: ["plan_instance_id"]
            isOneToOne: false
            referencedRelation: "plan_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainingpeaks_workout_syncs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          metadata: Json | null
          plan_id: string
          started_at: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          metadata?: Json | null
          plan_id: string
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          metadata?: Json | null
          plan_id?: string
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "admin_user_view"
            referencedColumns: ["subscription_plan_id"]
          },
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wizard_sessions: {
        Row: {
          created_at: string | null
          current_step: number | null
          id: string
          status: string | null
          updated_at: string | null
          user_id: string
          wizard_data: Json | null
        }
        Insert: {
          created_at?: string | null
          current_step?: number | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
          wizard_data?: Json | null
        }
        Update: {
          created_at?: string | null
          current_step?: number | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
          wizard_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "wizard_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      workout_activity_matches: {
        Row: {
          created_at: string | null
          id: string
          match_score: number | null
          match_type: string
          plan_instance_id: string
          strava_activity_id: string
          updated_at: string | null
          user_id: string
          workout_date: string
          workout_index: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          match_score?: number | null
          match_type: string
          plan_instance_id: string
          strava_activity_id: string
          updated_at?: string | null
          user_id: string
          workout_date: string
          workout_index?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          match_score?: number | null
          match_type?: string
          plan_instance_id?: string
          strava_activity_id?: string
          updated_at?: string | null
          user_id?: string
          workout_date?: string
          workout_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_activity_matches_plan_instance_id_fkey"
            columns: ["plan_instance_id"]
            isOneToOne: false
            referencedRelation: "plan_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_activity_matches_strava_activity_id_fkey"
            columns: ["strava_activity_id"]
            isOneToOne: true
            referencedRelation: "strava_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_activity_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      workout_compliance_analyses: {
        Row: {
          algorithm_version: string
          analysis_data: Json
          analyzed_at: string
          athlete_ftp: number
          athlete_lthr: number | null
          coach_feedback: Json | null
          coach_generated_at: string | null
          coach_model: string | null
          coach_prompt_version: string | null
          created_at: string
          hr_data_quality: string | null
          id: string
          match_id: string
          overall_grade: string
          overall_score: number
          overall_summary: string
          power_data_quality: string
          segments_completed: number
          segments_skipped: number
          segments_total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          algorithm_version?: string
          analysis_data: Json
          analyzed_at?: string
          athlete_ftp: number
          athlete_lthr?: number | null
          coach_feedback?: Json | null
          coach_generated_at?: string | null
          coach_model?: string | null
          coach_prompt_version?: string | null
          created_at?: string
          hr_data_quality?: string | null
          id?: string
          match_id: string
          overall_grade: string
          overall_score: number
          overall_summary: string
          power_data_quality: string
          segments_completed?: number
          segments_skipped?: number
          segments_total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          algorithm_version?: string
          analysis_data?: Json
          analyzed_at?: string
          athlete_ftp?: number
          athlete_lthr?: number | null
          coach_feedback?: Json | null
          coach_generated_at?: string | null
          coach_model?: string | null
          coach_prompt_version?: string | null
          created_at?: string
          hr_data_quality?: string | null
          id?: string
          match_id?: string
          overall_grade?: string
          overall_score?: number
          overall_summary?: string
          power_data_quality?: string
          segments_completed?: number
          segments_skipped?: number
          segments_total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_compliance_analyses_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "workout_activity_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_compliance_analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      admin_stats_view: {
        Row: {
          active_subscriptions: number | null
          active_training_plans: number | null
          active_users_30_days: number | null
          active_users_7_days: number | null
          activities_last_30_days: number | null
          activities_last_7_days: number | null
          cancelled_subscriptions: number | null
          completed_reports: number | null
          expired_subscriptions: number | null
          failed_reports: number | null
          failed_syncs: number | null
          free_plan_users: number | null
          pro_plan_users: number | null
          successful_syncs: number | null
          suspended_subscriptions: number | null
          syncs_last_24h: number | null
          team_plan_users: number | null
          total_activities: number | null
          total_profiles_created: number | null
          total_reports: number | null
          total_strava_connections: number | null
          total_training_plans: number | null
          total_users: number | null
          users_last_30_days: number | null
          users_last_7_days: number | null
        }
        Relationships: []
      }
      admin_user_view: {
        Row: {
          account_created_at: string | null
          email: string | null
          email_confirmed_at: string | null
          first_name: string | null
          last_name: string | null
          last_sign_in_at: string | null
          plan_display_name: string | null
          plan_name: string | null
          preferred_language: string | null
          profile_exists: boolean | null
          role: string | null
          strava_connected: boolean | null
          strava_last_sync_at: string | null
          strava_sync_error: string | null
          strava_sync_status: string | null
          subscription_ends_at: string | null
          subscription_plan_id: string | null
          subscription_started_at: string | null
          subscription_status: string | null
          timezone: string | null
          total_activities: number | null
          total_reports: number | null
          total_training_plans: number | null
          units_system: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_admin_stats: {
        Args: never
        Returns: {
          active_subscriptions: number
          active_users_7_days: number
          activities_last_7_days: number
          free_plan_users: number
          pro_plan_users: number
          total_activities: number
          total_strava_connections: number
          total_users: number
        }[]
      }
      get_admin_user_by_id: {
        Args: { target_user_id: string }
        Returns: {
          account_created_at: string
          email: string
          email_confirmed_at: string
          first_name: string
          last_name: string
          last_sign_in_at: string
          plan_display_name: string
          plan_name: string
          preferred_language: string
          profile_exists: boolean
          role: string
          strava_connected: boolean
          strava_last_sync_at: string
          strava_sync_error: string
          strava_sync_status: string
          subscription_ends_at: string
          subscription_plan_id: string
          subscription_started_at: string
          subscription_status: string
          timezone: string
          total_activities: number
          total_reports: number
          total_training_plans: number
          units_system: string
          user_id: string
        }[]
      }
      get_admin_users: {
        Args: {
          limit_count?: number
          offset_count?: number
          role_filter?: string
          search_query?: string
          strava_filter?: boolean
          subscription_filter?: string
        }
        Returns: {
          account_created_at: string
          email: string
          last_sign_in_at: string
          plan_name: string
          role: string
          strava_connected: boolean
          subscription_status: string
          total_activities: number
          total_training_plans: number
          user_id: string
        }[]
      }
      get_admin_users_count: {
        Args: {
          role_filter?: string
          search_query?: string
          strava_filter?: boolean
          subscription_filter?: string
        }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      job_status: "pending" | "running" | "completed" | "failed"
      job_type: "strava_sync"
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
    Enums: {
      job_status: ["pending", "running", "completed", "failed"],
      job_type: ["strava_sync"],
    },
  },
} as const
