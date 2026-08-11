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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      approval_history: {
        Row: {
          action: string
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          registration_id: string
          to_status: string
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          registration_id: string
          to_status: string
          user_name?: string
        }
        Update: {
          action?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          registration_id?: string
          to_status?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_history_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "vehicle_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string
          file_size: number
          id: string
          mime_type: string | null
          registration_id: string
          status: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name: string
          file_size?: number
          id?: string
          mime_type?: string | null
          registration_id: string
          status?: string
          storage_path: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          registration_id?: string
          status?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "vehicle_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          cnh: string | null
          cnh_category: string | null
          cpf: string
          created_at: string
          id: string
          name: string
          phone: string | null
          registration_id: string
        }
        Insert: {
          cnh?: string | null
          cnh_category?: string | null
          cpf: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          registration_id: string
        }
        Update: {
          cnh?: string | null
          cnh_category?: string | null
          cpf?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "vehicle_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_devices: {
        Row: {
          created_at: string
          has_tracker: boolean
          id: string
          identifier: string | null
          provider: string | null
          registration_id: string
          status: string | null
        }
        Insert: {
          created_at?: string
          has_tracker?: boolean
          id?: string
          identifier?: string | null
          provider?: string | null
          registration_id: string
          status?: string | null
        }
        Update: {
          created_at?: string
          has_tracker?: boolean
          id?: string
          identifier?: string | null
          provider?: string | null
          registration_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_devices_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "vehicle_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      transporters: {
        Row: {
          city: string
          created_at: string
          doc_number: string
          doc_type: string
          email: string
          id: string
          link_type: string
          name: string
          phone: string
          uf: string
        }
        Insert: {
          city: string
          created_at?: string
          doc_number: string
          doc_type: string
          email: string
          id?: string
          link_type: string
          name: string
          phone: string
          uf: string
        }
        Update: {
          city?: string
          created_at?: string
          doc_number?: string
          doc_type?: string
          email?: string
          id?: string
          link_type?: string
          name?: string
          phone?: string
          uf?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_registrations: {
        Row: {
          axles: number | null
          body_type: string | null
          brand_model: string | null
          chassis: string | null
          codveiculo_sankhya: string | null
          color: string | null
          company_vehicle: boolean
          created_at: string
          declaration_accepted: boolean
          engine_number: string | null
          fuel: string | null
          id: string
          is_demo: boolean
          manufacture_year: number | null
          max_capacity_kg: number | null
          max_weight_kg: number | null
          mensagem_integracao: string | null
          model_year: number | null
          pallets: number | null
          plate: string
          plate_city: string | null
          plate_uf: string | null
          protocol: string
          renavam: string | null
          species: string | null
          status: string
          status_integracao: string
          submitted_at: string
          tare_kg: number | null
          transporter_id: string
          updated_at: string
          vehicle_type: string | null
          wheel_type: string | null
        }
        Insert: {
          axles?: number | null
          body_type?: string | null
          brand_model?: string | null
          chassis?: string | null
          codveiculo_sankhya?: string | null
          color?: string | null
          company_vehicle?: boolean
          created_at?: string
          declaration_accepted?: boolean
          engine_number?: string | null
          fuel?: string | null
          id?: string
          is_demo?: boolean
          manufacture_year?: number | null
          max_capacity_kg?: number | null
          max_weight_kg?: number | null
          mensagem_integracao?: string | null
          model_year?: number | null
          pallets?: number | null
          plate: string
          plate_city?: string | null
          plate_uf?: string | null
          protocol: string
          renavam?: string | null
          species?: string | null
          status?: string
          status_integracao?: string
          submitted_at?: string
          tare_kg?: number | null
          transporter_id: string
          updated_at?: string
          vehicle_type?: string | null
          wheel_type?: string | null
        }
        Update: {
          axles?: number | null
          body_type?: string | null
          brand_model?: string | null
          chassis?: string | null
          codveiculo_sankhya?: string | null
          color?: string | null
          company_vehicle?: boolean
          created_at?: string
          declaration_accepted?: boolean
          engine_number?: string | null
          fuel?: string | null
          id?: string
          is_demo?: boolean
          manufacture_year?: number | null
          max_capacity_kg?: number | null
          max_weight_kg?: number | null
          mensagem_integracao?: string | null
          model_year?: number | null
          pallets?: number | null
          plate?: string
          plate_city?: string | null
          plate_uf?: string | null
          protocol?: string
          renavam?: string | null
          species?: string | null
          status?: string
          status_integracao?: string
          submitted_at?: string
          tare_kg?: number | null
          transporter_id?: string
          updated_at?: string
          vehicle_type?: string | null
          wheel_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_registrations_transporter_id_fkey"
            columns: ["transporter_id"]
            isOneToOne: false
            referencedRelation: "transporters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "analista" | "user"
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
      app_role: ["admin", "analista", "user"],
    },
  },
} as const
