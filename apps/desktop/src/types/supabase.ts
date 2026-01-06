// Supabase Database Types
// These types match the database schema for type-safe queries

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          persona_id: string;
          model_id: string;
          title: string;
          active_context_ids: string[];
          total_tokens_used: number;
          created_at: string;
          updated_at: string;
          client_id: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["conversations"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Insert"]>;
      };
      messages: {
        Row: {
          id: string;
          user_id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          audio_path: string | null;
          model_id: string | null;
          persona_id: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          latency_ms: number | null;
          created_at: string;
          client_id: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["messages"]["Row"],
          "id" | "created_at"
        > & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          color: string;
          default_persona_id: string | null;
          default_context_ids: string[];
          created_at: string;
          updated_at: string;
          client_id: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["projects"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
      };
      personal_contexts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          content: string;
          token_count: number;
          is_default: boolean;
          created_at: string;
          updated_at: string;
          client_id: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["personal_contexts"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["personal_contexts"]["Insert"]
        >;
      };
      personas: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          icon: string;
          system_prompt: string;
          voice_id: string | null;
          preferred_model_id: string | null;
          knowledge_base_ids: string[];
          temperature: number;
          max_tokens: number;
          created_at: string;
          updated_at: string;
          client_id: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["personas"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["personas"]["Insert"]>;
      };
    };
  };
}

// Helper types for sync metadata
export interface SyncMetadata {
  clientId: string;
  userId?: string;
  syncedAt?: Date;
  pendingSync: boolean;
  deleted?: boolean;
}

// Extend existing types with sync metadata
export type SyncableConversation = Database["public"]["Tables"]["conversations"]["Row"] &
  SyncMetadata;
export type SyncableMessage = Database["public"]["Tables"]["messages"]["Row"] &
  SyncMetadata;
export type SyncableProject = Database["public"]["Tables"]["projects"]["Row"] &
  SyncMetadata;
export type SyncableContext = Database["public"]["Tables"]["personal_contexts"]["Row"] &
  SyncMetadata;
export type SyncablePersona = Database["public"]["Tables"]["personas"]["Row"] &
  SyncMetadata;
