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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["entity_type"] | null
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["entity_type"] | null
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["entity_type"] | null
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      part_images: {
        Row: {
          display_order: number
          file_name: string
          file_size: number | null
          id: string
          is_primary: boolean
          mime_type: string | null
          part_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          display_order?: number
          file_name: string
          file_size?: number | null
          id?: string
          is_primary?: boolean
          mime_type?: string | null
          part_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          display_order?: number
          file_name?: string
          file_size?: number | null
          id?: string
          is_primary?: boolean
          mime_type?: string | null
          part_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_images_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          },
        ]
      }
      part_reports: {
        Row: {
          created_at: string
          description: string
          id: string
          issue_type: Database["public"]["Enums"]["report_issue_type"]
          part_id: string
          reporter_id: string
          resolution_comment: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          issue_type: Database["public"]["Enums"]["report_issue_type"]
          part_id: string
          reporter_id: string
          resolution_comment?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          issue_type?: Database["public"]["Enums"]["report_issue_type"]
          part_id?: string
          reporter_id?: string
          resolution_comment?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_reports_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          },
        ]
      }
      part_requests: {
        Row: {
          conformity: Database["public"]["Enums"]["conformity_status"] | null
          created_at: string
          description: string | null
          equipment_location: string | null
          equipment_name: string | null
          erp_reference: string | null
          erp_transmitted_at: string | null
          id: string
          justification: string | null
          part_id: string
          power_plant_id: string | null
          quantity_requested: number
          reason: Database["public"]["Enums"]["request_reason"]
          rejection_reason: string | null
          request_number: string
          requester_id: string
          status: Database["public"]["Enums"]["request_status"]
          submitted_at: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
          validated_at: string | null
          validation_comment: string | null
          validator_id: string | null
        }
        Insert: {
          conformity?: Database["public"]["Enums"]["conformity_status"] | null
          created_at?: string
          description?: string | null
          equipment_location?: string | null
          equipment_name?: string | null
          erp_reference?: string | null
          erp_transmitted_at?: string | null
          id?: string
          justification?: string | null
          part_id: string
          power_plant_id?: string | null
          quantity_requested: number
          reason: Database["public"]["Enums"]["request_reason"]
          rejection_reason?: string | null
          request_number: string
          requester_id: string
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          validated_at?: string | null
          validation_comment?: string | null
          validator_id?: string | null
        }
        Update: {
          conformity?: Database["public"]["Enums"]["conformity_status"] | null
          created_at?: string
          description?: string | null
          equipment_location?: string | null
          equipment_name?: string | null
          erp_reference?: string | null
          erp_transmitted_at?: string | null
          id?: string
          justification?: string | null
          part_id?: string
          power_plant_id?: string | null
          quantity_requested?: number
          reason?: Database["public"]["Enums"]["request_reason"]
          rejection_reason?: string | null
          request_number?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          validated_at?: string | null
          validation_comment?: string | null
          validator_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_requests_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_requests_power_plant_id_fkey"
            columns: ["power_plant_id"]
            isOneToOne: false
            referencedRelation: "power_plants"
            referencedColumns: ["id"]
          },
        ]
      }
      power_plants: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          location: string | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          employee_id: string | null
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          employee_id?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          employee_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      spare_parts: {
        Row: {
          category: string
          code: string
          created_at: string
          created_by: string | null
          current_quantity: number
          description: string | null
          equipment_compatibility: string[] | null
          id: string
          is_critical: boolean
          is_non_conform: boolean
          location: string | null
          manufacturer: string | null
          manufacturer_ref: string | null
          minimum_quantity: number
          name: string
          non_conform_reason: string | null
          sap_article_number: string | null
          supplier: string | null
          unit: string
          unit_price: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          created_by?: string | null
          current_quantity?: number
          description?: string | null
          equipment_compatibility?: string[] | null
          id?: string
          is_critical?: boolean
          is_non_conform?: boolean
          location?: string | null
          manufacturer?: string | null
          manufacturer_ref?: string | null
          minimum_quantity?: number
          name: string
          non_conform_reason?: string | null
          sap_article_number?: string | null
          supplier?: string | null
          unit?: string
          unit_price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          created_by?: string | null
          current_quantity?: number
          description?: string | null
          equipment_compatibility?: string[] | null
          id?: string
          is_critical?: boolean
          is_non_conform?: boolean
          location?: string | null
          manufacturer?: string | null
          manufacturer_ref?: string | null
          minimum_quantity?: number
          name?: string
          non_conform_reason?: string | null
          sap_article_number?: string | null
          supplier?: string | null
          unit?: string
          unit_price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_audit_log: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: Database["public"]["Enums"]["entity_type"]
          p_new_values?: Json
          p_old_values?: Json
        }
        Returns: string
      }
      ensure_user_setup: {
        Args: { p_first_name?: string; p_last_name?: string }
        Returns: undefined
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager_or_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "operator" | "maintenance_manager" | "admin"
      conformity_status: "conform" | "non_conform"
      entity_type: "request" | "part" | "user" | "stock" | "report"
      notification_type:
        | "request_created"
        | "request_approved"
        | "request_rejected"
        | "stock_low"
        | "part_non_conform"
        | "role_assigned"
        | "report_submitted"
      report_issue_type: "damaged" | "defective" | "wrong_reference" | "other"
      report_status: "pending" | "in_progress" | "resolved" | "closed"
      request_reason:
        | "missing"
        | "insufficient"
        | "non_conform"
        | "preventive"
        | "corrective"
      request_status: "draft" | "pending" | "approved" | "rejected"
      urgency_level: "low" | "medium" | "high" | "critical"
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
      app_role: ["operator", "maintenance_manager", "admin"],
      conformity_status: ["conform", "non_conform"],
      entity_type: ["request", "part", "user", "stock", "report"],
      notification_type: [
        "request_created",
        "request_approved",
        "request_rejected",
        "stock_low",
        "part_non_conform",
        "role_assigned",
        "report_submitted",
      ],
      report_issue_type: ["damaged", "defective", "wrong_reference", "other"],
      report_status: ["pending", "in_progress", "resolved", "closed"],
      request_reason: [
        "missing",
        "insufficient",
        "non_conform",
        "preventive",
        "corrective",
      ],
      request_status: ["draft", "pending", "approved", "rejected"],
      urgency_level: ["low", "medium", "high", "critical"],
    },
  },
} as const
