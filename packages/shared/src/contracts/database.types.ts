
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "error_logs": {
                  Row: {
                    "created_at": string,"details": NonNullable<Json>,"id": string,"level": Database["public"]['Enums']["error_level"],"message": string,"org_id": string | null,"origin": string,"resolved_at": string | null,"resolved_by": string | null,"source": string,"status": Database["public"]['Enums']["error_status"],"trace_id": string,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"level": Database["public"]['Enums']["error_level"],"message": string,"org_id"?: string | null,"origin"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"source": string,"status"?: Database["public"]['Enums']["error_status"],"trace_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"level"?: Database["public"]['Enums']["error_level"],"message"?: string,"org_id"?: string | null,"origin"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"source"?: string,"status"?: Database["public"]['Enums']["error_status"],"trace_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "error_logs_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "error_logs_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slug": string,"timezone": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slug": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slug"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"deactivated_at": string | null,"email": string | null,"full_name": string,"id": string,"is_active": boolean,"org_id": string,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"email"?: string | null,"full_name": string,"id": string,"is_active"?: boolean,"org_id": string,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"email"?: string | null,"full_name"?: string,"id"?: string,"is_active"?: boolean,"org_id"?: string,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"areas": {
                  Row: {
                    "color": string,"created_at": string,"description": string | null,"id": string,"is_active": boolean,"is_default": boolean,"name": string,"org_id": string,"sla_critical_minutes": number | null,"sla_warning_minutes": number | null,"updated_at": string
                  }
                  Insert: {
                    "color"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_default"?: boolean,"name": string,"org_id": string,"sla_critical_minutes"?: number | null,"sla_warning_minutes"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_default"?: boolean,"name"?: string,"org_id"?: string,"sla_critical_minutes"?: number | null,"sla_warning_minutes"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "areas_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"area_members": {
                  Row: {
                    "area_id": string,"created_at": string,"is_lead": boolean,"user_id": string
                  }
                  Insert: {
                    "area_id": string,"created_at"?: string,"is_lead"?: boolean,"user_id": string
                  }
                  Update: {
                    "area_id"?: string,"created_at"?: string,"is_lead"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "area_members_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "area_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"org_settings": {
                  Row: {
                    "org_id": string,"send_mode": string,"allowlist_phones": string[],"registration_session_ttl_hours": number,"privacy_notice_version": string,"created_at": string,"updated_at": string
                  }
                  Insert: {
                    "org_id": string,"send_mode"?: string,"allowlist_phones"?: string[],"registration_session_ttl_hours"?: number,"privacy_notice_version"?: string,"created_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "org_id"?: string,"send_mode"?: string,"allowlist_phones"?: string[],"registration_session_ttl_hours"?: number,"privacy_notice_version"?: string,"created_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_settings_org_id_fkey"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"whatsapp_lines": {
                  Row: {
                    "id": string,"org_id": string,"name": string,"display_phone": string,"evolution_instance": string,"status": string
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"name": string,"display_phone": string,"evolution_instance": string,"status"?: string
                  }
                  Update: {
                    "id"?: string,"org_id"?: string,"name"?: string,"display_phone"?: string,"evolution_instance"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "whatsapp_lines_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"citizens": {
                  Row: {
                    "id": string,"org_id": string,"full_name": string | null,"document_id": string | null,"address_line": string | null,"neighborhood": string | null,"latitude": number | null,"longitude": number | null,"privacy_consent_at": string | null
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"full_name"?: string | null,"document_id"?: string | null,"address_line"?: string | null,"neighborhood"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"privacy_consent_at"?: string | null,"privacy_notice_version"?: string | null
                  }
                  Update: {
                    "id"?: string,"org_id"?: string,"full_name"?: string | null,"document_id"?: string | null,"address_line"?: string | null,"neighborhood"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"privacy_consent_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "citizens_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"animals": {
                  Row: {
                    "id": string,"org_id": string,"citizen_id": string,"name": string,"species": string,"municipal_id": string,"status": string,"traits_status": string,"distinctive_traits": Json | null
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"citizen_id": string,"name": string,"species": string,"municipal_id": string,"status"?: string,"traits_status"?: string,"distinctive_traits"?: Json | null
                  }
                  Update: {
                    "id"?: string,"org_id"?: string,"citizen_id"?: string,"name"?: string,"species"?: string,"municipal_id"?: string,"status"?: string,"traits_status"?: string,"distinctive_traits"?: Json | null
                  }
                  Relationships: []
                },"registration_sessions": {
                  Row: {
                    "id": string,"org_id": string,"line_id": string,"phone_normalized": string,"step": string,"payload": Json,"expires_at": string,"lock_version": number,"processing_owner": string | null,"processing_until": string | null
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"line_id": string,"phone_normalized": string,"step": string,"payload"?: Json,"expires_at"?: string,"lock_version"?: number,"processing_owner"?: string | null,"processing_until"?: string | null
                  }
                  Update: {
                    "id"?: string,"org_id"?: string,"line_id"?: string,"phone_normalized"?: string,"step"?: string,"payload"?: Json,"expires_at"?: string,"lock_version"?: number,"processing_owner"?: string | null,"processing_until"?: string | null
                  }
                  Relationships: []
                },"messages": {
                  Row: {
                    "id": string,"org_id": string,"line_id": string,"external_id": string,"direction": string,"phone_normalized": string,"kind": string,"body": string | null,"delivery_status": string | null
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"line_id": string,"external_id": string,"direction": string,"phone_normalized": string,"kind": string,"body"?: string | null,"media_url"?: string | null,"delivery_status"?: string | null,"raw"?: Json
                  }
                  Update: {
                    "id"?: string,"org_id"?: string,"line_id"?: string,"external_id"?: string,"direction"?: string,"phone_normalized"?: string,"kind"?: string,"body"?: string | null,"delivery_status"?: string | null
                  }
                  Relationships: []
                },"jobs": {
                  Row: {
                    "id": string,"org_id": string | null,"job_type": string,"payload": Json,"status": string,"attempts": number,"max_attempts": number,"available_at": string,"error": string | null
                  }
                  Insert: {
                    "id"?: string,"org_id"?: string | null,"job_type": string,"payload": Json,"status"?: string,"attempts"?: number,"max_attempts"?: number,"available_at"?: string
                  }
                  Update: {
                    "id"?: string,"org_id"?: string | null,"job_type"?: string,"payload"?: Json,"status"?: string,"attempts"?: number,"max_attempts"?: number,"available_at"?: string,"error"?: string | null
                  }
                  Relationships: []
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "current_org_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_user_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"current_area_ids":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"insert_client_error_report":
{ Args: { "p_details": Json,"p_limit": number,"p_message": string,"p_org_id": string,"p_trace_id": string,"p_user_id": string,"p_window_seconds": number }; Returns: string
                           },
"purge_error_logs":
{ Args: Record<PropertyKey, never>; Returns: number
                           },"complete_animal_registration":
{ Args: { "p_age_stage": string,"p_breed_color": string,"p_citizen_id": string,"p_latitude"?: number | null,"p_longitude"?: number | null,"p_microchip"?: string | null,"p_name": string,"p_neighborhood"?: string | null,"p_org_id": string,"p_rabies_status": string,"p_sex": string,"p_size": string,"p_species": string,"p_sterilized": string }; Returns: { "animal_id": string,"municipal_id": string }[]
                           },"claim_next_job":
{ Args: Record<PropertyKey, never>; Returns: { "id": string,"payload": Json,"attempts": number,"max_attempts": number }[]
                           },"lock_registration_session":
{ Args: { "p_line_id": string,"p_phone": string }; Returns: Database["public"]["Tables"]["registration_sessions"]["Row"][]
                           },"claim_session_processing":
{ Args: { "p_line_id": string,"p_owner": string,"p_phone": string,"p_ttl_seconds"?: number }; Returns: Database["public"]["Tables"]["registration_sessions"]["Row"] | null
                           },"release_session_processing":
{ Args: { "p_line_id": string,"p_owner": string,"p_phone": string }; Returns: undefined
                           },"upsert_registration_session":
{ Args: { "p_expires_at": string,"p_id": string,"p_line_id": string,"p_org_id": string,"p_payload": Json,"p_phone": string,"p_step": string }; Returns: Database["public"]["Tables"]["registration_sessions"]["Row"]
                           },"finalize_registration_completion":
{ Args: { "p_citizen_id": string,"p_payload": Json,"p_photos"?: Json,"p_session_id": string }; Returns: { "animal_id": string,"already_done": boolean,"municipal_id": string }[]
                           },"mark_session_completion":
{ Args: { "p_animal_id": string,"p_municipal_id": string,"p_payload"?: Json | null,"p_session_id": string }; Returns: { "animal_id": string,"already_done": boolean,"municipal_id": string }[]
                           }
          }
          Enums: {
            "error_level": "error"|"warn"|"info","error_status": "open"|"acknowledged"|"resolved","user_role": "admin"|"area_lead"|"operator"|"support"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "error_level": ["error", "warn", "info"],"error_status": ["open", "acknowledged", "resolved"],"user_role": ["admin", "area_lead", "operator", "support"]
          }
        }
} as const
