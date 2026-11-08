
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
                    "org_id": string,"send_mode": string,"allowlist_phones": string[],"registration_session_ttl_hours": number,"privacy_notice_version": string,"business_hours": Json,"holidays": string[],"bot_paused"?: boolean,"mesa_bot_enabled"?: boolean,"bot_confidence_threshold"?: number,"privacy_notice_text"?: string,"out_of_hours_message"?: string,"created_at": string,"updated_at": string
                  }
                  Insert: {
                    "org_id": string,"send_mode"?: string,"allowlist_phones"?: string[],"registration_session_ttl_hours"?: number,"privacy_notice_version"?: string,"business_hours"?: Json,"holidays"?: string[],"bot_paused"?: boolean,"mesa_bot_enabled"?: boolean,"bot_confidence_threshold"?: number,"privacy_notice_text"?: string,"out_of_hours_message"?: string,"created_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "org_id"?: string,"send_mode"?: string,"allowlist_phones"?: string[],"registration_session_ttl_hours"?: number,"privacy_notice_version"?: string,"business_hours"?: Json,"holidays"?: string[],"bot_paused"?: boolean,"mesa_bot_enabled"?: boolean,"bot_confidence_threshold"?: number,"privacy_notice_text"?: string,"out_of_hours_message"?: string,"created_at"?: string,"updated_at"?: string
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
                    "id": string,"org_id": string,"full_name": string | null,"document_id": string | null,"address_line": string | null,"neighborhood": string | null,"email": string | null,"tags": string[],"observations": string | null,"field_sources": Json,"latitude": number | null,"longitude": number | null,"privacy_consent_at": string | null,"privacy_notice_version"?: string | null,"registration_status"?: string,"party_kind"?: string,"whatsapp_push_name"?: string | null,"whatsapp_avatar_url"?: string | null,"whatsapp_avatar_fetched_at"?: string | null,"merged_into_id": string | null,"merge_note": string | null,"registered_at": string | null,"registered_by": string | null
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"full_name"?: string | null,"document_id"?: string | null,"address_line"?: string | null,"neighborhood"?: string | null,"email"?: string | null,"tags"?: string[],"observations"?: string | null,"field_sources"?: Json,"latitude"?: number | null,"longitude"?: number | null,"privacy_consent_at"?: string | null,"privacy_notice_version"?: string | null,"registration_status"?: string,"party_kind"?: string,"whatsapp_push_name"?: string | null,"whatsapp_avatar_url"?: string | null,"whatsapp_avatar_fetched_at"?: string | null,"merged_into_id"?: string | null,"merge_note"?: string | null,"registered_at"?: string | null,"registered_by"?: string | null
                  }
                  Update: {
                    "id"?: string,"org_id"?: string,"full_name"?: string | null,"document_id"?: string | null,"address_line"?: string | null,"neighborhood"?: string | null,"email"?: string | null,"tags"?: string[],"observations"?: string | null,"field_sources"?: Json,"latitude"?: number | null,"longitude"?: number | null,"privacy_consent_at"?: string | null,"registration_status"?: string,"party_kind"?: string,"whatsapp_push_name"?: string | null,"whatsapp_avatar_url"?: string | null,"whatsapp_avatar_fetched_at"?: string | null,"merged_into_id"?: string | null,"merge_note"?: string | null,"registered_at"?: string | null,"registered_by"?: string | null
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
                },"citizen_phones": {
                  Row: {
                    "id": string,"org_id": string,"citizen_id": string,"phone_normalized": string,"created_at"?: string
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"citizen_id": string,"phone_normalized": string,"created_at"?: string
                  }
                  Update: {
                    "citizen_id"?: string,"phone_normalized"?: string
                  }
                  Relationships: []
                },"tasks": {
                  Row: {
                    "id": string,"org_id": string,"conversation_id": string | null,"citizen_id": string | null,"title": string,"body": string | null,"kind": string,"priority": number,"status": string,"outcome": string | null,"audience": string,"area_id": string | null,"assigned_user_id": string | null,"external_contact_id": string | null,"awaiting_acceptance": boolean,"delegated_from_user_id": string | null,"created_by": string,"due_at": string | null,"public_ref": string,"notify_citizen_on_close": boolean,"last_activity_at": string,"created_at"?: string
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"conversation_id"?: string | null,"citizen_id"?: string | null,"title": string,"body"?: string | null,"kind"?: string,"priority"?: number,"status"?: string,"audience": string,"area_id"?: string | null,"assigned_user_id"?: string | null,"external_contact_id"?: string | null,"created_by": string,"due_at"?: string | null,"public_ref": string,"notify_citizen_on_close"?: boolean
                  }
                  Update: {
                    "title"?: string,"status"?: string,"assigned_user_id"?: string | null,"outcome"?: string | null
                  }
                  Relationships: []
                },"task_history": {
                  Row: {
                    "id": string,"org_id": string,"task_id": string,"event": string,"actor_kind": string,"actor_user_id": string | null,"note": string | null,"created_at": string
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"task_id": string,"event": string,"actor_kind": string,"actor_user_id"?: string | null,"note"?: string | null
                  }
                  Update: {
                    "note"?: string | null
                  }
                  Relationships: []
                },"notes": {
                  Row: {
                    "id": string,"org_id": string,"body": string,"kind": string,"author_user_id": string | null,"conversation_id": string | null,"citizen_id": string | null,"task_id": string | null,"parent_note_id": string | null,"sealed_at": string | null,"created_at": string
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"body": string,"kind"?: string,"author_user_id"?: string | null,"conversation_id"?: string | null,"citizen_id"?: string | null,"task_id"?: string | null,"parent_note_id"?: string | null
                  }
                  Update: {
                    "body"?: string
                  }
                  Relationships: []
                },"external_contacts": {
                  Row: {
                    "id": string,"org_id": string,"area_id": string,"full_name": string,"phone_normalized": string,"is_active": boolean
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"area_id": string,"full_name": string,"phone_normalized": string,"is_active"?: boolean
                  }
                  Update: {
                    "full_name"?: string,"phone_normalized"?: string,"is_active"?: boolean,"area_id"?: string
                  }
                  Relationships: []
                },"conversations": {
                  Row: {
                    "id": string,"org_id": string,"line_id": string,"citizen_id": string | null,"phone_normalized": string,"area_id": string,"bot_state": string,"queue_column": string,"owner_user_id": string | null,"delegated_from_user_id": string | null,"pending_area_id": string | null,"awaiting_acceptance": boolean,"entered_queue_at": string,"resolved_at": string | null,"resolved_by": string | null,"last_message_at": string | null,"last_inbound_at": string | null,"last_outbound_at": string | null,"last_message_preview": string | null,"last_message_kind": string | null,"has_attachments": boolean,"needs_response": boolean,"sla_due_at": string | null,"created_at"?: string,"updated_at"?: string
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"line_id": string,"citizen_id"?: string | null,"phone_normalized": string,"area_id": string,"bot_state"?: string,"queue_column"?: string,"owner_user_id"?: string | null,"delegated_from_user_id"?: string | null,"pending_area_id"?: string | null,"awaiting_acceptance"?: boolean,"entered_queue_at"?: string,"last_message_at"?: string | null,"last_inbound_at"?: string | null,"last_outbound_at"?: string | null,"last_message_preview"?: string | null,"last_message_kind"?: string | null,"has_attachments"?: boolean,"needs_response"?: boolean,"sla_due_at"?: string | null
                  }
                  Update: {
                    "id"?: string,"org_id"?: string,"line_id"?: string,"citizen_id"?: string | null,"phone_normalized"?: string,"area_id"?: string,"bot_state"?: string,"queue_column"?: string,"owner_user_id"?: string | null,"delegated_from_user_id"?: string | null,"pending_area_id"?: string | null,"awaiting_acceptance"?: boolean,"entered_queue_at"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"last_message_at"?: string | null,"last_inbound_at"?: string | null,"last_outbound_at"?: string | null,"last_message_preview"?: string | null,"last_message_kind"?: string | null,"has_attachments"?: boolean,"needs_response"?: boolean,"sla_due_at"?: string | null
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
                    "note"?: string | null
                  }
                  Relationships: []
                },"conversation_reads": {
                  Row: {
                    "conversation_id": string,"user_id": string,"last_read_at": string,"last_read_message_id": string | null
                  }
                  Insert: {
                    "conversation_id": string,"user_id": string,"last_read_at"?: string,"last_read_message_id"?: string | null
                  }
                  Update: {
                    "last_read_at"?: string,"last_read_message_id"?: string | null
                  }
                  Relationships: []
                },"quick_replies": {
                  Row: {
                    "id": string,"org_id": string,"area_id": string | null,"shortcut": string,"title": string,"body": string,"is_active": boolean,"created_at": string,"updated_at": string
                  }
                  Insert: {
                    "id"?: string,"org_id": string,"area_id"?: string | null,"shortcut": string,"title": string,"body": string,"is_active"?: boolean
                  }
                  Update: {
                    "area_id"?: string | null,"shortcut"?: string,"title"?: string,"body"?: string,"is_active"?: boolean
                  }
                  Relationships: []
                },"animals": {
                  Row: {
                    "id": string,"org_id": string,"citizen_id": string,"name": string,"species": string,"municipal_id": string,"status": string,"traits_status": string,"distinctive_traits": Json | null,"created_at"?: string
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
"list_inbox_queue":
{ Args: { "p_area_id"?: string | null,"p_line_id"?: string | null,"p_owner"?: string | null,"p_awaiting_mine"?: boolean,"p_unanswered"?: boolean,"p_with_attachments"?: boolean }; Returns: { "id": string,"phone_normalized": string,"area_id": string,"area_name": string,"line_id": string,"owner_user_id": string | null,"owner_name": string | null,"queue_column": string,"bot_state": string,"needs_response": boolean,"awaiting_acceptance": boolean,"has_attachments": boolean,"last_message_at": string | null,"last_message_preview": string | null,"last_inbound_at": string | null,"entered_queue_at": string,"sla_level": string,"registration_status": string | null,"citizen_push_name": string | null,"unread": boolean }[]
                           },
"inbox_attention_count":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"ensure_owner_for_reply":
{ Args: { "p_conversation_id": string }; Returns: { "result_conversation_id": string,"result_owner_user_id": string | null,"result_owner_name": string | null,"result_queue_column": string,"result_hint": string }[]
                           },
"claim_conversation":
{ Args: { "p_conversation_id": string }; Returns: { "result_conversation_id": string,"result_owner_user_id": string | null,"result_owner_name": string | null,"result_queue_column": string,"result_hint": string }[]
                           },
"delegate_conversation":
{ Args: { "p_conversation_id": string,"p_target_user": string | null,"p_target_area": string | null,"p_note": string }; Returns: { "result_hint": string }[]
                           },
"accept_conversation_delegation":
{ Args: { "p_conversation_id": string }; Returns: { "result_hint": string }[]
                           },
"reject_conversation_delegation":
{ Args: { "p_conversation_id": string,"p_note": string }; Returns: { "result_owner_name": string | null,"result_hint": string }[]
                           },
"move_conversation":
{ Args: { "p_conversation_id": string,"p_column": string }; Returns: { "result_hint": string }[]
                           },
"resolve_conversation":
{ Args: { "p_conversation_id": string }; Returns: { "result_hint": string }[]
                           },
"set_conversation_area":
{ Args: { "p_conversation_id": string,"p_area_id": string }; Returns: { "result_hint": string }[]
                           },
"reopen_conversation":
{ Args: { "p_conversation_id": string,"p_at": string,"p_message_id": string }; Returns: { "result_hint": string }[]
                           },
"mark_conversation_read":
{ Args: { "p_conversation_id": string }; Returns: undefined
                           },
"set_business_calendar":
{ Args: { "p_hours": Json,"p_holidays": string[] }; Returns: undefined
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
                           },
"update_citizen_profile":
{ Args: { "p_id": string,"p_full_name": string | null,"p_document_id": string | null,"p_address_line": string | null,"p_neighborhood": string | null,"p_email": string | null,"p_tags": string[] | null,"p_observations": string | null,"p_party_kind": string,"p_latitude": number | null,"p_longitude": number | null }; Returns: { "result_id": string,"result_hint": string }[]
                           },
"register_citizen":
{ Args: { "p_id": string }; Returns: { "result_id": string,"result_hint": string }[]
                           },
"search_citizens":
{ Args: { "p_query": string }; Returns: { "result_id": string,"result_full_name": string | null,"result_document_id": string | null,"result_phone": string | null,"result_registration_status": string | null,"result_party_kind": string | null,"result_push_name": string | null }[]
                           },
"merge_citizens":
{ Args: { "p_keep": string,"p_drop": string,"p_note": string }; Returns: { "result_id": string,"result_hint": string }[]
                           },

"create_task":
{ Args: { "p_conversation_id": string,"p_title": string,"p_body": string | null,"p_kind": string,"p_priority": number,"p_audience": string,"p_area_id": string | null,"p_assigned_user_id": string | null,"p_external_contact_id": string | null,"p_due_at": string | null,"p_notify_citizen_on_close": boolean,"p_source_note_id"?: string | null }; Returns: { "result_id": string,"result_public_ref": string,"result_hint": string }[]
                           },
"claim_task":
{ Args: { "p_task_id": string }; Returns: { "result_id": string,"result_hint": string }[]
                           },
"accept_task":
{ Args: { "p_task_id": string }; Returns: { "result_id": string,"result_hint": string }[]
                           },
"reject_task":
{ Args: { "p_task_id": string,"p_note": string }; Returns: { "result_id": string,"result_hint": string }[]
                           },
"start_task":
{ Args: { "p_task_id": string }; Returns: { "result_id": string,"result_hint": string }[]
                           },
"delegate_task":
{ Args: { "p_task_id": string,"p_audience": string,"p_area_id": string | null,"p_assigned_user_id": string | null,"p_external_contact_id": string | null,"p_note": string }; Returns: { "result_id": string,"result_hint": string }[]
                           },
"complete_task":
{ Args: { "p_task_id": string,"p_outcome": string }; Returns: { "result_id": string,"result_hint": string }[]
                           },
"cancel_task":
{ Args: { "p_task_id": string,"p_reason": string,"p_reason_text": string | null }; Returns: { "result_id": string,"result_hint": string }[]
                           },
"reopen_task":
{ Args: { "p_task_id": string }; Returns: { "result_id": string,"result_hint": string }[]
                           },
"abandon_stale_tasks":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"create_note":
{ Args: { "p_body": string,"p_conversation_id": string | null,"p_citizen_id": string | null,"p_task_id": string | null,"p_parent_note_id": string | null,"p_kind"?: string }; Returns: { "result_id": string,"result_hint": string }[]
                           },
"convert_note_to_task":
{ Args: { "p_note_id": string,"p_title": string | null,"p_kind": string | null,"p_priority": number | null,"p_audience": string | null,"p_area_id": string | null }; Returns: { "result_id": string,"result_public_ref": string,"result_hint": string }[]
                           },
"list_tasks":
{ Args: { "p_status"?: string | null,"p_area_id"?: string | null }; Returns: { "result_id": string,"result_public_ref": string,"result_title": string,"result_status": string,"result_kind": string,"result_priority": number,"result_area_id": string | null,"result_assigned_user_id": string | null,"result_due_at": string | null,"result_overdue": boolean,"result_conversation_id": string | null,"result_citizen_id": string | null,"result_awaiting_acceptance": boolean }[]
                           },
"export_case":
{ Args: { "p_conversation_id": string }; Returns: Json
                           },
"upsert_external_contact":
{ Args: { "p_id": string | null,"p_area_id": string,"p_full_name": string,"p_phone": string,"p_is_active": boolean }; Returns: { "result_id": string,"result_hint": string }[]
                           },
"apply_external_task_command":
{ Args: { "p_org_id": string,"p_phone": string,"p_text": string }; Returns: { "result_hint": string,"result_reply": string | null }[]
                           },
"list_citizen_timeline":
{ Args: { "p_id": string }; Returns: { "result_kind": string,"result_id": string,"result_at": string,"result_label": string | null,"result_detail": string | null }[]
                           },
"upsert_knowledge_document":
{ Args: { "p_id": string | null,"p_title": string,"p_source_kind": string,"p_body_text": string | null,"p_storage_path": string | null,"p_area_id": string | null,"p_is_active": boolean,"p_valid_until": string | null }; Returns: { "result_id": string,"result_hint": string }[]
                           },
"set_org_bot_paused":
{ Args: { "p_paused": boolean }; Returns: { "result_hint": string }[]
                           },
"list_knowledge_documents":
{ Args: Record<PropertyKey, never>; Returns: { "result_id": string,"result_title": string,"result_source_kind": string,"result_is_active": boolean,"result_index_status": string,"result_valid_until": string | null,"result_area_id": string | null,"result_updated_at": string }[]
                           },
"list_bot_runs":
{ Args: { "p_conversation_id": string }; Returns: { "result_id": string,"result_decision": string,"result_answer": string | null,"result_confidence": number | null,"result_handoff_reason": string | null,"result_sources": Json,"result_topic": string | null,"result_urgency": string | null,"result_created_at": string }[]
                           },
"search_knowledge_chunks":
{ Args: { "p_org_id": string,"p_query": string,"p_limit"?: number }; Returns: { "result_chunk_id": string,"result_document_id": string,"result_title": string,"result_content": string,"result_score": number }[]
                           },
"insert_bot_run":
{ Args: { "p_org_id": string,"p_conversation_id": string,"p_trigger_message_id": string | null,"p_decision": string,"p_answer": string | null,"p_sources": Json,"p_confidence": number | null,"p_handoff_reason": string | null,"p_suggested_area_id": string | null,"p_topic": string | null,"p_urgency": string | null,"p_extracted_fields": Json,"p_model": string | null,"p_latency_ms": number | null,"p_tokens_in": number | null,"p_tokens_out": number | null }; Returns: string
                           },
"replace_knowledge_chunks":
{ Args: { "p_document_id": string,"p_chunks": Json }; Returns: number
                           },
"set_knowledge_document_active":
{ Args: { "p_id": string,"p_is_active": boolean }; Returns: { "result_id": string,"result_hint": string }[]
                           },
"reindex_knowledge_document":
{ Args: { "p_id": string }; Returns: { "result_id": string,"result_hint": string }[]
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
