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
      agent_assignment_history: {
        Row: {
          agent_id: string
          assigned_at: string
          conversation_id: string
          id: string
          unassigned_at: string | null
        }
        Insert: {
          agent_id: string
          assigned_at?: string
          conversation_id: string
          id?: string
          unassigned_at?: string | null
        }
        Update: {
          agent_id?: string
          assigned_at?: string
          conversation_id?: string
          id?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_assignment_history_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_assignment_history_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          conversation_id: string | null
          created_at: string
          function_name: string
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          total_tokens: number
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          function_name: string
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          total_tokens?: number
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          function_name?: string
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          total_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_edges: {
        Row: {
          created_at: string
          flow_id: string
          id: string
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          created_at?: string
          flow_id: string
          id?: string
          source_node_id: string
          target_node_id: string
        }
        Update: {
          created_at?: string
          flow_id?: string
          id?: string
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_edges_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "automation_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "automation_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_flows: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          niche_id: string | null
          trigger_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          niche_id?: string | null
          trigger_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          niche_id?: string | null
          trigger_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_flows_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_nodes: {
        Row: {
          config: Json
          created_at: string
          flow_id: string
          id: string
          label: string
          node_type: string
          position_x: number
          position_y: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          flow_id: string
          id?: string
          label?: string
          node_type?: string
          position_x?: number
          position_y?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          flow_id?: string
          id?: string
          label?: string
          node_type?: string
          position_x?: number
          position_y?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_configs: {
        Row: {
          config: Json
          connection_id: string
          created_at: string
          id: string
          is_connected: boolean
          label: string
          last_checked_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          connection_id: string
          created_at?: string
          id?: string
          is_connected?: boolean
          label?: string
          last_checked_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          connection_id?: string
          created_at?: string
          id?: string
          is_connected?: boolean
          label?: string
          last_checked_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_tags: {
        Row: {
          contact_phone: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          contact_phone: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          contact_phone?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ad_title: string | null
          assigned_agent_id: string | null
          connection_config_id: string | null
          contact_avatar: string | null
          contact_name: string
          contact_phone: string
          created_at: string
          ctwa_clid: string | null
          id: string
          niche_id: string | null
          resolved_at: string | null
          source_id: string | null
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          ad_title?: string | null
          assigned_agent_id?: string | null
          connection_config_id?: string | null
          contact_avatar?: string | null
          contact_name: string
          contact_phone: string
          created_at?: string
          ctwa_clid?: string | null
          id?: string
          niche_id?: string | null
          resolved_at?: string | null
          source_id?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          ad_title?: string | null
          assigned_agent_id?: string | null
          connection_config_id?: string | null
          contact_avatar?: string | null
          contact_name?: string
          contact_phone?: string
          created_at?: string
          ctwa_clid?: string | null
          id?: string
          niche_id?: string | null
          resolved_at?: string | null
          source_id?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_connection_config_id_fkey"
            columns: ["connection_config_id"]
            isOneToOne: false
            referencedRelation: "connection_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_executions: {
        Row: {
          completed_at: string | null
          completed_nodes: number
          conversation_id: string
          created_at: string
          failed_at_node_id: string | null
          flow_id: string
          id: string
          started_at: string
          status: string
          total_nodes: number
        }
        Insert: {
          completed_at?: string | null
          completed_nodes?: number
          conversation_id: string
          created_at?: string
          failed_at_node_id?: string | null
          flow_id: string
          id?: string
          started_at?: string
          status?: string
          total_nodes?: number
        }
        Update: {
          completed_at?: string | null
          completed_nodes?: number
          conversation_id?: string
          created_at?: string
          failed_at_node_id?: string | null
          flow_id?: string
          id?: string
          started_at?: string
          status?: string
          total_nodes?: number
        }
        Relationships: [
          {
            foreignKeyName: "flow_executions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_executions_failed_at_node_id_fkey"
            columns: ["failed_at_node_id"]
            isOneToOne: false
            referencedRelation: "automation_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_step_logs: {
        Row: {
          error_message: string | null
          executed_at: string
          execution_id: string
          id: string
          node_id: string
          node_label: string
          node_type: string
          sort_order: number
          status: string
        }
        Insert: {
          error_message?: string | null
          executed_at?: string
          execution_id: string
          id?: string
          node_id: string
          node_label?: string
          node_type: string
          sort_order?: number
          status?: string
        }
        Update: {
          error_message?: string | null
          executed_at?: string
          execution_id?: string
          id?: string
          node_id?: string
          node_label?: string
          node_type?: string
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_step_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "flow_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_step_logs_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "automation_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_items: {
        Row: {
          content: string
          created_at: string
          file_url: string | null
          id: string
          niche_id: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          file_url?: string | null
          id?: string
          niche_id?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          file_url?: string | null
          id?: string
          niche_id?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_items_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          media_url: string | null
          message_type: string
          provider_error: string | null
          provider_message_id: string | null
          provider_status: string | null
          sender_agent_id: string | null
          sender_type: string
          status: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          media_url?: string | null
          message_type?: string
          provider_error?: string | null
          provider_message_id?: string | null
          provider_status?: string | null
          sender_agent_id?: string | null
          sender_type: string
          status?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          media_url?: string | null
          message_type?: string
          provider_error?: string | null
          provider_message_id?: string | null
          provider_status?: string | null
          sender_agent_id?: string | null
          sender_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_agent_id_fkey"
            columns: ["sender_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      niche_connections: {
        Row: {
          connection_config_id: string
          created_at: string
          id: string
          niche_id: string
        }
        Insert: {
          connection_config_id: string
          created_at?: string
          id?: string
          niche_id: string
        }
        Update: {
          connection_config_id?: string
          created_at?: string
          id?: string
          niche_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "niche_connections_connection_config_id_fkey"
            columns: ["connection_config_id"]
            isOneToOne: false
            referencedRelation: "connection_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "niche_connections_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      niches: {
        Row: {
          auto_reply_enabled: boolean
          created_at: string
          flow_selector_enabled: boolean
          flow_selector_instructions: string
          id: string
          name: string
          system_prompt: string
          updated_at: string
          whatsapp_phone_number_id: string | null
          zapi_instance_id: string | null
        }
        Insert: {
          auto_reply_enabled?: boolean
          created_at?: string
          flow_selector_enabled?: boolean
          flow_selector_instructions?: string
          id?: string
          name: string
          system_prompt?: string
          updated_at?: string
          whatsapp_phone_number_id?: string | null
          zapi_instance_id?: string | null
        }
        Update: {
          auto_reply_enabled?: boolean
          created_at?: string
          flow_selector_enabled?: boolean
          flow_selector_instructions?: string
          id?: string
          name?: string
          system_prompt?: string
          updated_at?: string
          whatsapp_phone_number_id?: string | null
          zapi_instance_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_approved: boolean
          job_title: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_approved?: boolean
          job_title?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_approved?: boolean
          job_title?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quick_messages: {
        Row: {
          audio_url: string | null
          content: string
          created_at: string
          id: string
          shortcut: string | null
          sort_order: number
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          content?: string
          created_at?: string
          id?: string
          shortcut?: string | null
          sort_order?: number
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          content?: string
          created_at?: string
          id?: string
          shortcut?: string | null
          sort_order?: number
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_conversations_with_last_message: {
        Args: never
        Returns: {
          assigned_agent_id: string
          contact_name: string
          contact_phone: string
          id: string
          last_message: string
          last_message_sender: string
          niche_id: string
          status: string
          tags: string[]
          unread_count: number
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "agent"
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
      app_role: ["admin", "supervisor", "agent"],
    },
  },
} as const
