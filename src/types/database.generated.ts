// ============================================================================
// AUTO-GENERADO desde el esquema real de Supabase (proyecto njzqyttrlivipnkwmbbt).
// NO editar a mano. Regenerar con el MCP `supabase-sherpa`:
//   herramienta `generate_typescript_types` (o `supabase gen types typescript`).
// Los alias de dominio de la app viven en ./database.ts y derivan de aquí.
// ============================================================================

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
      anamnesis_forms: {
        Row: {
          clinic_id: string
          completed_at: string | null
          consent_ai_analysis: boolean | null
          consent_data_processing: boolean | null
          consent_timestamp: string | null
          created_at: string | null
          expires_at: string | null
          form_data: Json | null
          id: string
          patient_id: string
          started_at: string | null
          status: string | null
          token: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          completed_at?: string | null
          consent_ai_analysis?: boolean | null
          consent_data_processing?: boolean | null
          consent_timestamp?: string | null
          created_at?: string | null
          expires_at?: string | null
          form_data?: Json | null
          id?: string
          patient_id: string
          started_at?: string | null
          status?: string | null
          token?: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          completed_at?: string | null
          consent_ai_analysis?: boolean | null
          consent_data_processing?: boolean | null
          consent_timestamp?: string | null
          created_at?: string | null
          expires_at?: string | null
          form_data?: Json | null
          id?: string
          patient_id?: string
          started_at?: string | null
          status?: string | null
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_forms_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_forms_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_data: Json | null
          clinic_id: string
          created_at: string | null
          id: string
          notes: string | null
          patient_id: string
          physio_id: string
          session_number: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assessment_data?: Json | null
          clinic_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          physio_id: string
          session_number?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assessment_data?: Json | null
          clinic_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          physio_id?: string
          session_number?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_physio_id_fkey"
            columns: ["physio_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_recordings: {
        Row: {
          assessment_id: string
          clinic_id: string
          created_at: string | null
          duration_seconds: number | null
          id: string
          storage_path: string
          transcription: string | null
          transcription_status: string | null
        }
        Insert: {
          assessment_id: string
          clinic_id: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          storage_path: string
          transcription?: string | null
          transcription_status?: string | null
        }
        Update: {
          assessment_id?: string
          clinic_id?: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          storage_path?: string
          transcription?: string | null
          transcription_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_recordings_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_recordings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          clinic_id: string
          created_at: string | null
          doc_type: string
          extracted_data: Json | null
          extraction_status: string | null
          file_name: string
          id: string
          patient_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          doc_type: string
          extracted_data?: Json | null
          extraction_status?: string | null
          file_name: string
          id?: string
          patient_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          doc_type?: string
          extracted_data?: Json | null
          extraction_status?: string | null
          file_name?: string
          id?: string
          patient_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          activity_level: string | null
          body_region: string | null
          classification_confidence: number | null
          classification_source: string | null
          classified_at: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          notes: string | null
          pathology_label: string | null
          pathology_tag: string | null
          phone: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          activity_level?: string | null
          body_region?: string | null
          classification_confidence?: number | null
          classification_source?: string | null
          classified_at?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          notes?: string | null
          pathology_label?: string | null
          pathology_tag?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_level?: string | null
          body_region?: string | null
          classification_confidence?: number | null
          classification_source?: string | null
          classified_at?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          notes?: string | null
          pathology_label?: string | null
          pathology_tag?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          ai_completion_tokens: number | null
          ai_model: string | null
          ai_prompt_tokens: number | null
          anamnesis_id: string | null
          assessment_id: string | null
          clinic_id: string
          created_at: string | null
          generated_by: string | null
          id: string
          patient_id: string
          pdf_storage_path: string | null
          report_data: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ai_completion_tokens?: number | null
          ai_model?: string | null
          ai_prompt_tokens?: number | null
          anamnesis_id?: string | null
          assessment_id?: string | null
          clinic_id: string
          created_at?: string | null
          generated_by?: string | null
          id?: string
          patient_id: string
          pdf_storage_path?: string | null
          report_data?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_completion_tokens?: number | null
          ai_model?: string | null
          ai_prompt_tokens?: number | null
          anamnesis_id?: string | null
          assessment_id?: string | null
          clinic_id?: string
          created_at?: string | null
          generated_by?: string | null
          id?: string
          patient_id?: string
          pdf_storage_path?: string | null
          report_data?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_anamnesis_id_fkey"
            columns: ["anamnesis_id"]
            isOneToOne: false
            referencedRelation: "anamnesis_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          clinic_id: string
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          role: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          clinic_id: string
          created_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          clinic_id?: string
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_clinic_id: { Args: never; Returns: string }
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
