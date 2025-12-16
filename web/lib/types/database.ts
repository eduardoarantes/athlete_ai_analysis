export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      activities: {
        Row: {
          average_heartrate: number | null
          average_watts: number | null
          created_at: string
          distance_meters: number | null
          elapsed_time_seconds: number | null
          fit_file_processed: boolean | null
          fit_file_url: string | null
          id: string
          max_heartrate: number | null
          max_watts: number | null
          metadata: Json | null
          moving_time_seconds: number | null
          name: string
          sport_type: string | null
          start_date: string
          strava_activity_id: number
          total_elevation_gain: number | null
          tss: number | null
          tss_method: string | null
          type: string
          updated_at: string
          user_id: string
          weighted_average_watts: number | null
        }
        Insert: {
          average_heartrate?: number | null
          average_watts?: number | null
          created_at?: string
          distance_meters?: number | null
          elapsed_time_seconds?: number | null
          fit_file_processed?: boolean | null
          fit_file_url?: string | null
          id?: string
          max_heartrate?: number | null
          max_watts?: number | null
          metadata?: Json | null
          moving_time_seconds?: number | null
          name: string
          sport_type?: string | null
          start_date: string
          strava_activity_id: number
          total_elevation_gain?: number | null
          tss?: number | null
          tss_method?: string | null
          type: string
          updated_at?: string
          user_id: string
          weighted_average_watts?: number | null
        }
        Update: {
          average_heartrate?: number | null
          average_watts?: number | null
          created_at?: string
          distance_meters?: number | null
          elapsed_time_seconds?: number | null
          fit_file_processed?: boolean | null
          fit_file_url?: string | null
          id?: string
          max_heartrate?: number | null
          max_watts?: number | null
          metadata?: Json | null
          moving_time_seconds?: number | null
          name?: string
          sport_type?: string | null
          start_date?: string
          strava_activity_id?: number
          total_elevation_gain?: number | null
          tss?: number | null
          tss_method?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          weighted_average_watts?: number | null
        }
        Relationships: []
      }
      athlete_profiles: {
        Row: {
          age: number | null
          created_at: string
          first_name: string
          ftp: number | null
          gender: string | null
          goals: Json | null
          id: string
          last_name: string
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
          first_name: string
          ftp?: number | null
          gender?: string | null
          goals?: Json | null
          id?: string
          last_name: string
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
          first_name?: string
          ftp?: number | null
          gender?: string | null
          goals?: Json | null
          id?: string
          last_name?: string
          max_hr?: number | null
          preferred_language?: string | null
          resting_hr?: number | null
          timezone?: string | null
          units_system?: string | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      training_plans: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          id: string
          name: string
          plan_data: Json
          start_date: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          name: string
          plan_data: Json
          start_date: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          plan_data?: Json
          start_date?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      job_status: ["pending", "running", "completed", "failed"],
      job_type: ["strava_sync"],
    },
  },
} as const

