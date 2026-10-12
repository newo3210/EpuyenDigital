// Database types - hand-maintained MVP types (replace via supabase gen types when CLI available)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
      };
      org_settings: {
        Row: {
          org_id: string;
          send_mode: "dry_run" | "allowlist" | "production";
          allowlist_phones: string[];
          registration_session_ttl_hours: number;
          privacy_notice_version: string;
        };
        Insert: {
          org_id: string;
          send_mode?: "dry_run" | "allowlist" | "production";
          allowlist_phones?: string[];
          registration_session_ttl_hours?: number;
          privacy_notice_version?: string;
        };
        Update: Partial<Database["public"]["Tables"]["org_settings"]["Insert"]>;
      };
      whatsapp_lines: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          display_phone: string;
          evolution_instance: string;
          status: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          display_phone: string;
          evolution_instance: string;
          status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["whatsapp_lines"]["Insert"]>;
      };
      citizens: {
        Row: {
          id: string;
          org_id: string;
          full_name: string | null;
          document_id: string | null;
          address_line: string | null;
          neighborhood: string | null;
          latitude: number | null;
          longitude: number | null;
          privacy_consent_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          full_name?: string | null;
          document_id?: string | null;
          address_line?: string | null;
          neighborhood?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          privacy_consent_at?: string | null;
          privacy_notice_version?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["citizens"]["Insert"]>;
      };
      animals: {
        Row: {
          id: string;
          org_id: string;
          citizen_id: string;
          name: string;
          species: "dog" | "cat" | "other";
          municipal_id: string;
          status: string;
          traits_status: "pending" | "ready" | "pending_manual";
          distinctive_traits: Json | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          citizen_id: string;
          name: string;
          species: "dog" | "cat" | "other";
          municipal_id: string;
          status?: string;
          traits_status?: "pending" | "ready" | "pending_manual";
          distinctive_traits?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["animals"]["Insert"]>;
      };
      registration_sessions: {
        Row: {
          id: string;
          org_id: string;
          line_id: string;
          phone_normalized: string;
          step: string;
          payload: Json;
          expires_at: string;
          lock_version: number;
          processing_owner: string | null;
          processing_until: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          line_id: string;
          phone_normalized: string;
          step: string;
          payload?: Json;
          expires_at?: string;
          lock_version?: number;
          processing_owner?: string | null;
          processing_until?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["registration_sessions"]["Insert"]>;
      };
      messages: {
        Row: {
          id: string;
          org_id: string;
          line_id: string;
          external_id: string;
          direction: "inbound" | "outbound";
          phone_normalized: string;
          kind: string;
          body: string | null;
          delivery_status: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          line_id: string;
          external_id: string;
          direction: "inbound" | "outbound";
          phone_normalized: string;
          kind: string;
          body?: string | null;
          media_url?: string | null;
          delivery_status?: string | null;
          raw?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
      };
      jobs: {
        Row: {
          id: string;
          org_id: string | null;
          job_type: string;
          payload: Json;
          status: "pending" | "processing" | "done" | "failed";
          attempts: number;
          max_attempts: number;
          available_at: string;
          error: string | null;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          job_type: string;
          payload: Json;
          status?: "pending" | "processing" | "done" | "failed";
          attempts?: number;
          max_attempts?: number;
          available_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
      };
    };
    Functions: {
      complete_animal_registration: {
        Args: {
          p_org_id: string;
          p_citizen_id: string;
          p_name: string;
          p_species: string;
          p_sex: string;
          p_breed_color: string;
          p_size: string;
          p_age_stage: string;
          p_sterilized: string;
          p_rabies_status: string;
          p_microchip?: string | null;
          p_latitude?: number | null;
          p_longitude?: number | null;
          p_neighborhood?: string | null;
        };
        Returns: { animal_id: string; municipal_id: string }[];
      };
      lock_registration_session: {
        Args: { p_line_id: string; p_phone: string };
        Returns: Database["public"]["Tables"]["registration_sessions"]["Row"][];
      };
      claim_session_processing: {
        Args: {
          p_line_id: string;
          p_phone: string;
          p_owner: string;
          p_ttl_seconds?: number;
        };
        Returns: Database["public"]["Tables"]["registration_sessions"]["Row"] | null;
      };
      release_session_processing: {
        Args: { p_line_id: string; p_phone: string; p_owner: string };
        Returns: undefined;
      };
      upsert_registration_session: {
        Args: {
          p_id: string;
          p_org_id: string;
          p_line_id: string;
          p_phone: string;
          p_step: string;
          p_payload: Json;
          p_expires_at: string;
        };
        Returns: Database["public"]["Tables"]["registration_sessions"]["Row"];
      };
      finalize_registration_completion: {
        Args: {
          p_session_id: string;
          p_citizen_id: string;
          p_payload: Json;
          p_photos?: Json;
        };
        Returns: {
          animal_id: string;
          municipal_id: string;
          already_done: boolean;
        }[];
      };
      mark_session_completion: {
        Args: {
          p_session_id: string;
          p_animal_id: string;
          p_municipal_id: string;
          p_payload?: Json | null;
        };
        Returns: {
          animal_id: string;
          municipal_id: string;
          already_done: boolean;
        }[];
      };
      claim_next_job: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          payload: Json;
          attempts: number;
          max_attempts: number;
        }[];
      };
    };
  };
};
