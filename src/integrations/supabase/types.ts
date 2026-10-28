import type { Tournament, TournamentTeam, TournamentMatch } from "@/lib/tournaments";

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      pickleball_tournaments: {
        Row: Tournament
        Insert: Partial<Tournament>
        Update: Partial<Tournament>
        Relationships: []
      }
      pickleball_teams: {
        Row: TournamentTeam
        Insert: Partial<TournamentTeam>
        Update: Partial<TournamentTeam>
        Relationships: []
      }
      pickleball_team_contacts: {
        Row: { team_id: string; phone: string }
        Insert: { team_id: string; phone: string }
        Update: { team_id?: string; phone?: string }
        Relationships: []
      }
      pickleball_matches: {
        Row: TournamentMatch
        Insert: Partial<TournamentMatch>
        Update: Partial<TournamentMatch>
        Relationships: []
      }

      cafe_orders: {
        Row: {
          created_at: string | null
          id: number
          proof_of_delivery_url: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          proof_of_delivery_url?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          proof_of_delivery_url?: string | null
          status?: string | null
        }
        Relationships: []
      }
      court_bookings: {
        Row: {
          balls: boolean
          booking_date: string
          court_id: string
          created_at: string
          duration_minutes: number | null
          gcash_ref: string | null
          id: string
          paddles: number
          payment_method: string | null
          player_contact: string
          player_name: string
          receipt_url: string | null
          status: string | null
          time_slot: string
          timer_started_at: string | null
          total: number
          total_amount: number | null
        }
        Insert: {
          balls?: boolean
          booking_date: string
          court_id: string
          created_at?: string
          duration_minutes?: number | null
          gcash_ref?: string | null
          id?: string
          paddles?: number
          payment_method?: string | null
          player_contact: string
          player_name: string
          receipt_url?: string | null
          status?: string | null
          time_slot: string
          timer_started_at?: string | null
          total?: number
          total_amount?: number | null
        }
        Update: {
          balls?: boolean
          booking_date?: string
          court_id?: string
          created_at?: string
          duration_minutes?: number | null
          gcash_ref?: string | null
          id?: string
          paddles?: number
          payment_method?: string | null
          player_contact?: string
          player_name?: string
          receipt_url?: string | null
          status?: string | null
          time_slot?: string
          timer_started_at?: string | null
          total?: number
          total_amount?: number | null
        }
        Relationships: []
      }
      courts: {
        Row: {
          current_session_until: string | null
          id: string
          live_stream_url: string | null
          name: string
          next_slot: string | null
          rate_day: number | null
          rate_night: number | null
          status: string | null
          surface: string | null
          type: string | null
        }
        Insert: {
          current_session_until?: string | null
          id: string
          live_stream_url?: string | null
          name: string
          next_slot?: string | null
          rate_day?: number | null
          rate_night?: number | null
          status?: string | null
          surface?: string | null
          type?: string | null
        }
        Update: {
          current_session_until?: string | null
          id?: string
          live_stream_url?: string | null
          name?: string
          next_slot?: string | null
          rate_day?: number | null
          rate_night?: number | null
          status?: string | null
          surface?: string | null
          type?: string | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          available: boolean
          category: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          name: string
          price: number
        }
        Insert: {
          available?: boolean
          category?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          name: string
          price: number
        }
        Update: {
          available?: boolean
          category?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          name?: string
          price?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          menu_item_id: string | null
          name: string
          order_id: string
          price: number
          quantity: number
        }
        Insert: {
          id?: string
          menu_item_id?: string | null
          name: string
          order_id: string
          price: number
          quantity: number
        }
        Update: {
          id?: string
          menu_item_id?: string | null
          name?: string
          order_id?: string
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          created_at: string
          customer_id: string
          customer_name: string
          delivery_fee: number
          id: string
          notes: string | null
          order_type: "delivery" | "counter"
          payment_method: string
          phone: string
          proof_of_delivery_path: string | null
          proof_of_delivery_url: string | null
          rider_id: string | null
          rider_name: string | null
          rider_phone: string | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          customer_id: string
          customer_name?: string
          delivery_fee?: number
          id?: string
          notes?: string | null
          order_type?: "delivery" | "counter"
          payment_method?: string
          phone: string
          proof_of_delivery_path?: string | null
          proof_of_delivery_url?: string | null
          rider_id?: string | null
          rider_name?: string | null
          rider_phone?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          customer_id?: string
          customer_name?: string
          delivery_fee?: number
          id?: string
          notes?: string | null
          order_type?: "delivery" | "counter"
          payment_method?: string
          phone?: string
          proof_of_delivery_path?: string | null
          proof_of_delivery_url?: string | null
          rider_id?: string | null
          rider_name?: string | null
          rider_phone?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          profile_image_url: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          profile_image_url?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          profile_image_url?: string | null
        }
        Relationships: []
      }
      rider_applications: {
        Row: {
          address: string
          created_at: string
          experience: string | null
          full_name: string
          id: string
          license_number: string
          phone: string
          plate_number: string | null
          status: Database["public"]["Enums"]["application_status"]
          user_id: string
          vehicle_type: string
        }
        Insert: {
          address: string
          created_at?: string
          experience?: string | null
          full_name: string
          id?: string
          license_number: string
          phone: string
          plate_number?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id: string
          vehicle_type: string
        }
        Update: {
          address?: string
          created_at?: string
          experience?: string | null
          full_name?: string
          id?: string
          license_number?: string
          phone?: string
          plate_number?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id?: string
          vehicle_type?: string
        }
        Relationships: []
      }
      rider_verifications: {
        Row: {
          id_document_path: string | null
          id_type: string | null
          id_verification_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id_document_path?: string | null
          id_type?: string | null
          id_verification_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id_document_path?: string | null
          id_type?: string | null
          id_verification_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          kind: string
          order_id: string | null
          owner_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          order_id?: string | null
          owner_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          order_id?: string | null
          owner_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_reads: {
        Row: {
          conversation_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
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
      save_pickleball_tournament: {
        Args: { _title: string; _description: string; _venue: string; _starts_at: string; _max_teams: number; _points_to_win: number; _id?: string }
        Returns: string
      }
      register_pickleball_team: {
        Args: { _tournament: string; _name: string; _player_one: string; _player_two: string; _phone: string }
        Returns: string
      }
      withdraw_pickleball_team: { Args: { _team: string }; Returns: undefined }
      start_pickleball_tournament: { Args: { _tournament: string }; Returns: undefined }
      cancel_pickleball_tournament: { Args: { _tournament: string }; Returns: undefined }
      score_pickleball_match: { Args: { _match: string; _score_a: number; _score_b: number }; Returns: undefined }
      schedule_pickleball_match: { Args: { _match: string; _court: string; _scheduled_at: string | null }; Returns: undefined }

      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: undefined
      }
      book_court: {
        Args: {
          _balls: boolean
          _contact: string
          _court: string
          _date: string
          _name: string
          _paddles: number
          _slot: string
          _total: number
        }
        Returns: string
      }
      can_access_support: { Args: { _conversation: string }; Returns: boolean }
      cancel_my_order: { Args: { _order: string }; Returns: undefined }
      get_booked_slots: {
        Args: { _court: string; _date: string }
        Returns: string[]
      }
      has_rider_photo: { Args: { _user: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_support_conversations: {
        Args: never
        Returns: {
          display_name: string
          id: string
          kind: string
          last_message: string
          order_id: string
          status: string
          unread: boolean
          updated_at: string
        }[]
      }
      delete_support_conversation: { Args: { _conversation: string }; Returns: undefined }
      mark_support_read: { Args: { _conversation: string }; Returns: undefined }
      open_support_conversation: {
        Args: { _kind: string; _order?: string }
        Returns: string
      }
      order_rider: {
        Args: { _order: string }
        Returns: {
          full_name: string
          profile_image_url: string
        }[]
      }
      admin_claim_counter_order: { Args: { _order: string }; Returns: undefined }
      place_order: {
        Args: {
          _address: string
          _items: Json
          _name: string
          _notes: string
          _order_type?: "delivery" | "counter"
          _payment: string
          _phone: string
        }
        Returns: string
      }
      resolve_support_conversation: {
        Args: { _conversation: string; _resolved: boolean }
        Returns: undefined
      }
      review_rider_application: {
        Args: { _app: string; _approve: boolean }
        Returns: undefined
      }
      rider_accept_order: { Args: { _order: string }; Returns: undefined }
      rider_complete_delivery: {
        Args: { _order: string; _proof_path: string }
        Returns: undefined
      }
      rider_update_status: {
        Args: {
          _order: string
          _status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "rider" | "customer"
      application_status: "pending" | "approved" | "rejected"
      order_status:
        | "pending"
        | "preparing"
        | "ready"
        | "picked_up"
        | "delivered"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "rider", "customer"],
      application_status: ["pending", "approved", "rejected"],
      order_status: [
        "pending",
        "preparing",
        "ready",
        "picked_up",
        "delivered",
        "cancelled",
      ],
    },
  },
} as const
