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
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json
          empresa_id: string | null
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          empresa_id?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          empresa_id?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      gastos: {
        Row: {
          created_at: string | null
          descripcion: string | null
          empresa_id: string | null
          fecha: string
          id: string
          importe: number
          tipo: string
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          empresa_id?: string | null
          fecha: string
          id?: string
          importe: number
          tipo: string
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          empresa_id?: string | null
          fecha?: string
          id?: string
          importe?: number
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspecciones: {
        Row: {
          created_at: string | null
          fotos_urls: Json | null
          id: string
          observaciones: string | null
          tipo: string | null
          traslado_id: string | null
        }
        Insert: {
          created_at?: string | null
          fotos_urls?: Json | null
          id?: string
          observaciones?: string | null
          tipo?: string | null
          traslado_id?: string | null
        }
        Update: {
          created_at?: string | null
          fotos_urls?: Json | null
          id?: string
          observaciones?: string | null
          tipo?: string | null
          traslado_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspecciones_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados"
            referencedColumns: ["id"]
          },
        ]
      }
      invitaciones: {
        Row: {
          codigo: string
          created_at: string | null
          empresa_id: string | null
          expires_at: string
          id: string
          usado: boolean | null
        }
        Insert: {
          codigo: string
          created_at?: string | null
          empresa_id?: string | null
          expires_at?: string
          id?: string
          usado?: boolean | null
        }
        Update: {
          codigo?: string
          created_at?: string | null
          empresa_id?: string | null
          expires_at?: string
          id?: string
          usado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "invitaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          created_at: string | null
          email: string | null
          empresa_id: string | null
          fecha_compra: string | null
          id: string
          mp_subscription_id: string | null
          nombre_completo: string | null
          onboarding_completed: boolean
          plan: string | null
          plan_renovacion: string | null
          rol: string | null
          telefono: string | null
          traslados_mes_actual: number | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          empresa_id?: string | null
          fecha_compra?: string | null
          id: string
          mp_subscription_id?: string | null
          nombre_completo?: string | null
          onboarding_completed?: boolean
          plan?: string | null
          plan_renovacion?: string | null
          rol?: string | null
          telefono?: string | null
          traslados_mes_actual?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          empresa_id?: string | null
          fecha_compra?: string | null
          id?: string
          mp_subscription_id?: string | null
          nombre_completo?: string | null
          onboarding_completed?: boolean
          plan?: string | null
          plan_renovacion?: string | null
          rol?: string | null
          telefono?: string | null
          traslados_mes_actual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      planes: {
        Row: {
          descripcion: string | null
          duracion_dias: number
          id: string
          nombre: string
          precio: number
          puede_agregar_personas: boolean
          puede_exportar: boolean
          traslados_max: number | null
        }
        Insert: {
          descripcion?: string | null
          duracion_dias: number
          id: string
          nombre: string
          precio: number
          puede_agregar_personas: boolean
          puede_exportar: boolean
          traslados_max?: number | null
        }
        Update: {
          descripcion?: string | null
          duracion_dias?: number
          id?: string
          nombre?: string
          precio?: number
          puede_agregar_personas?: boolean
          puede_exportar?: boolean
          traslados_max?: number | null
        }
        Relationships: []
      }
      traslados: {
        Row: {
          chofer_id: string | null
          created_at: string | null
          departamento: string | null
          desde: string | null
          direccion: string | null
          empresa_id: string | null
          es_0km: boolean | null
          estado: string | null
          estado_pago: string | null
          foto_frontal: string | null
          foto_interior: string | null
          foto_lateral: string | null
          foto_trasera: string | null
          hasta: string | null
          id: string
          importe_total: number | null
          marca_modelo: string
          matricula: string | null
          observaciones: string | null
        }
        Insert: {
          chofer_id?: string | null
          created_at?: string | null
          departamento?: string | null
          desde?: string | null
          direccion?: string | null
          empresa_id?: string | null
          es_0km?: boolean | null
          estado?: string | null
          estado_pago?: string | null
          foto_frontal?: string | null
          foto_interior?: string | null
          foto_lateral?: string | null
          foto_trasera?: string | null
          hasta?: string | null
          id?: string
          importe_total?: number | null
          marca_modelo: string
          matricula?: string | null
          observaciones?: string | null
        }
        Update: {
          chofer_id?: string | null
          created_at?: string | null
          departamento?: string | null
          desde?: string | null
          direccion?: string | null
          empresa_id?: string | null
          es_0km?: boolean | null
          estado?: string | null
          estado_pago?: string | null
          foto_frontal?: string | null
          foto_interior?: string | null
          foto_lateral?: string | null
          foto_trasera?: string | null
          hasta?: string | null
          id?: string
          importe_total?: number | null
          marca_modelo?: string
          matricula?: string | null
          observaciones?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traslados_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      expulsar_chofer: { Args: { chofer_id: string }; Returns: boolean }
      get_empresa_id: { Args: never; Returns: string }
      get_traslados_counts: { Args: { p_empresa_id: string }; Returns: Json }
    }
    Enums: {
      plan_enum: "free" | "premium" | "admin"
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
      plan_enum: ["free", "premium", "admin"],
    },
  },
} as const
