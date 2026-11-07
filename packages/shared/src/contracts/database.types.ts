
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
                    "org_id": string,"send_mode": string,"allowlist_phones": string[],"registration_session_ttl_hours": number,"privacy_notice_version": string,"business_hours": Json,"holidays": string[],"bot_paused": boolean,"created_at": string,"updated_at": string
                  }
                  Insert: {
                    "org_id": string,"send_mode"?: string,"allowlist_phones"?: string[],"registration_session_ttl_hours"?: number,"privacy_notice_version"?: string,"business_hours"?: Json,"holidays"?: string[],"bot_paused"?: boolean,"created_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "org_id"?: string,"send_mode"?: string,"allowlist_phones"?: string[],"registration_session_ttl_hours"?: number,"privacy_notice_version"?: string,"business_hours"?: Json,"holidays"?: string[],"bot_paused"?: boolean,"created_at"?: string,"updated_at"?: string
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
                    "id": string,"org_id": string,"name": string,"display_phone": string,"evolution_base_url": string | null,"evolution_instance": string,"default_area_id": string | null,"status": string,"last_status_at": string | null,"created_at"?: string,"updated_at"?: string
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"name": string,"display_phone": string,"evolution_base_url"?: string | null,"evolution_instance": string,"default_area_id"?: string | null,"status"?: string,"last_status_at"?: string | null
                  }
                  Update: {
                    "id"?: string,"org_id"?: string,"name"?: string,"display_phone"?: string,"evolution_base_url"?: string | null,"evolution_instance"?: string,"default_area_id"?: string | null,"status"?: string,"last_status_at"?: string | null
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
                },"whatsapp_line_secrets": {
                  Row: {
                    "line_id": string,"webhook_secret": string | null,"webhook_secret_ciphertext": string | null,"api_key_ciphertext": string | null
                  }
                  Insert: {
                    "line_id": string,"webhook_secret"?: string | null,"webhook_secret_ciphertext"?: string | null,"api_key_ciphertext"?: string | null
                  }
                  Update: {
                    "line_id"?: string,"webhook_secret"?: string | null,"webhook_secret_ciphertext"?: string | null,"api_key_ciphertext"?: string | null
                  }
                  Relationships: []
                },"citizens": {
                  Row: {
                    "id": string,"org_id": string,"full_name": string | null,"document_id": string | null,"address_line": string | null,"neighborhood": string | null,"latitude": number | null,"longitude": number | null,"privacy_consent_at": string | null,"privacy_notice_version"?: string | null,"registration_status"?: string,"party_kind"?: string,"whatsapp_push_name"?: string | null,"whatsapp_avatar_url"?: string | null,"whatsapp_avatar_fetched_at"?: string | null
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"full_name"?: string | null,"document_id"?: string | null,"address_line"?: string | null,"neighborhood"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"privacy_consent_at"?: string | null,"privacy_notice_version"?: string | null,"registration_status"?: string,"party_kind"?: string,"whatsapp_push_name"?: string | null,"whatsapp_avatar_url"?: string | null,"whatsapp_avatar_fetched_at"?: string | null
                  }
                  Update: {
                    "id"?: string,"org_id"?: string,"full_name"?: string | null,"document_id"?: string | null,"address_line"?: string | null,"neighborhood"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"privacy_consent_at"?: string | null,"registration_status"?: string,"party_kind"?: string,"whatsapp_push_name"?: string | null,"whatsapp_avatar_url"?: string | null,"whatsapp_avatar_fetched_at"?: string | null
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
                },"conversations": {
                  Row: {
                    "id": string,"org_id": string,"line_id": string,"citizen_id": string | null,"phone_normalized": string,"area_id": string,"bot_state": string,"queue_column": string,"owner_user_id": string | null,"delegated_from_user_id": string | null,"pending_area_id": string | null,"awaiting_acceptance": boolean,"entered_queue_at": string,"resolved_at": string | null,"resolved_by": string | null,"last_message_at": string | null,"last_inbound_at": string | null,"last_outbound_at": string | null,"needs_response": boolean,"sla_due_at": string | null,"topic": string | null,"urgency": string | null,"inquiry_latitude": number | null,"inquiry_longitude": number | null,"last_message_preview": string | null,"has_attachments": boolean,"created_at"?: string,"updated_at"?: string
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"line_id": string,"citizen_id"?: string | null,"phone_normalized": string,"area_id": string,"bot_state"?: string,"queue_column"?: string,"owner_user_id"?: string | null,"delegated_from_user_id"?: string | null,"pending_area_id"?: string | null,"awaiting_acceptance"?: boolean,"entered_queue_at"?: string,"last_message_at"?: string | null,"last_inbound_at"?: string | null,"last_outbound_at"?: string | null,"needs_response"?: boolean,"inquiry_latitude"?: number | null,"inquiry_longitude"?: number | null,"last_message_preview"?: string | null,"has_attachments"?: boolean
                  }
                  Update: {
                    "id"?: string,"org_id"?: string,"line_id"?: string,"citizen_id"?: string | null,"phone_normalized"?: string,"area_id"?: string,"bot_state"?: string,"queue_column"?: string,"owner_user_id"?: string | null,"delegated_from_user_id"?: string | null,"pending_area_id"?: string | null,"awaiting_acceptance"?: boolean,"last_message_at"?: string | null,"last_inbound_at"?: string | null,"last_outbound_at"?: string | null,"needs_response"?: boolean,"inquiry_latitude"?: number | null,"inquiry_longitude"?: number | null,"last_message_preview"?: string | null,"has_attachments"?: boolean,"resolved_at"?: string | null,"resolved_by"?: string | null,"sla_due_at"?: string | null
                  }
                  Relationships: []
                },"conversation_events": {
                  Row: {
                    "id": string,"org_id": string,"conversation_id": string,"event_type": string,"actor_kind": string,"actor_user_id": string | null,"from_column": string | null,"to_column": string | null,"from_area_id": string | null,"to_area_id": string | null,"note": string | null,"metadata": Json,"created_at": string
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"conversation_id": string,"event_type": string,"actor_kind": string,"actor_user_id"?: string | null,"from_column"?: string | null,"to_column"?: string | null,"from_area_id"?: string | null,"to_area_id"?: string | null,"note"?: string | null,"metadata"?: Json,"created_at"?: string
                  }
                  Update: {
                    "id"?: string,"org_id"?: string,"conversation_id"?: string,"event_type"?: string,"actor_kind"?: string,"actor_user_id"?: string | null,"from_column"?: string | null,"to_column"?: string | null,"from_area_id"?: string | null,"to_area_id"?: string | null,"note"?: string | null,"metadata"?: Json
                  }
                  Relationships: []
                },"conversation_reads": {
                  Row: {
                    "conversation_id": string,"user_id": string,"org_id": string,"last_read_at": string,"last_read_message_id": string | null
                  }
                  Insert: {
                    "conversation_id": string,"user_id": string,"org_id": string,"last_read_at"?: string,"last_read_message_id"?: string | null
                  }
                  Update: {
                    "conversation_id"?: string,"user_id"?: string,"org_id"?: string,"last_read_at"?: string,"last_read_message_id"?: string | null
                  }
                  Relationships: []
                },"quick_replies": {
                  Row: {
                    "id": string,"org_id": string,"area_id": string | null,"shortcut": string,"title": string,"body": string,"is_active": boolean,"created_at"?: string,"updated_at"?: string
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"area_id"?: string | null,"shortcut": string,"title": string,"body": string,"is_active"?: boolean
                  }
                  Update: {
                    "id"?: string,"org_id"?: string,"area_id"?: string | null,"shortcut"?: string,"title"?: string,"body"?: string,"is_active"?: boolean
                  }
                  Relationships: []
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
                    "id": string,"org_id": string,"line_id": string,"conversation_id": string | null,"external_id": string,"direction": string,"sender_kind"?: string | null,"author_user_id"?: string | null,"phone_normalized": string,"kind": string,"body": string | null,"media_url"?: string | null,"media_mime"?: string | null,"storage_path"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"delivery_status": string | null,"delivered_at"?: string | null,"read_at"?: string | null,"created_at"?: string,"raw"?: Json
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"line_id": string,"conversation_id"?: string | null,"external_id": string,"direction": string,"sender_kind"?: string | null,"author_user_id"?: string | null,"phone_normalized": string,"kind": string,"body"?: string | null,"media_url"?: string | null,"media_mime"?: string | null,"storage_path"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"delivery_status"?: string | null,"delivered_at"?: string | null,"read_at"?: string | null,"raw"?: Json
                  }
                  Update: {
                    "id"?: string,"org_id"?: string,"line_id"?: string,"conversation_id"?: string | null,"external_id"?: string,"direction"?: string,"sender_kind"?: string | null,"author_user_id"?: string | null,"phone_normalized"?: string,"kind"?: string,"body"?: string | null,"delivery_status"?: string | null,"delivered_at"?: string | null,"read_at"?: string | null,"storage_path"?: string | null
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
"claim_conversation":
{ Args: { "p_conversation_id": string }; Returns: { "conversation_id": string,"owner_user_id": string,"queue_column": string,"bot_state": string,"event_id": string | null }[]
                           },
"delegate_conversation":
{ Args: { "p_conversation_id": string,"p_target_user_id"?: string | null,"p_target_area_id"?: string | null,"p_note"?: string | null }; Returns: { "conversation_id": string,"owner_user_id": string | null,"pending_area_id": string | null,"awaiting_acceptance": boolean,"event_id": string | null }[]
                           },
"accept_conversation_delegation":
{ Args: { "p_conversation_id": string }; Returns: { "conversation_id": string,"owner_user_id": string,"queue_column": string,"event_id": string | null }[]
                           },
"reject_conversation_delegation":
{ Args: { "p_conversation_id": string,"p_note": string }; Returns: { "conversation_id": string,"owner_user_id": string | null,"event_id": string | null }[]
                           },
"ensure_owner_for_reply":
{ Args: { "p_conversation_id": string }; Returns: { "conversation_id": string,"owner_user_id": string,"action": string,"event_id": string | null }[]
                           },
"move_conversation":
{ Args: { "p_conversation_id": string,"p_to_column": string }; Returns: { "conversation_id": string,"queue_column": string,"event_id": string | null }[]
                           },
"resolve_conversation":
{ Args: { "p_conversation_id": string }; Returns: { "conversation_id": string,"queue_column": string,"bot_state": string,"event_id": string | null }[]
                           },
"reopen_conversation":
{ Args: { "p_conversation_id": string }; Returns: { "conversation_id": string,"queue_column": string,"bot_state": string,"event_id": string | null }[]
                           },
"set_conversation_area":
{ Args: { "p_conversation_id": string,"p_area_id": string }; Returns: { "conversation_id": string,"area_id": string,"event_id": string | null }[]
                           },
"mark_conversation_read":
{ Args: { "p_conversation_id": string,"p_message_id"?: string | null }; Returns: undefined
                           },
"compute_conversation_sla_status":
{ Args: { "p_conversation_id": string,"p_now"?: string }; Returns: string
                           },
"replace_area_memberships":
{ Args: { "p_user_id": string,"p_memberships": Json }; Returns: undefined
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
