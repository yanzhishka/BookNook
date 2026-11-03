export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type WatchRoomRow = {
  id: string
  owner_id: string
  title: string
  provider: string
  media_url: string
  video_id: string | null
  position_seconds: number
  playing: boolean
  playback_rate: number
  playback_at: string
  version: number
  members_version: number
  last_client_id: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
}

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      watch_queue_items: {
        Row: { id: string; room_id: string; sort_order: number; title: string; provider: string; media_url: string; video_id: string | null }
        Insert: never
        Update: never
        Relationships: []
      }
      watch_rooms: {
        Row: WatchRoomRow
        Insert: never
        Update: never
        Relationships: []
      }
      watch_room_members: {
        Row: { room_id: string; user_id: string; joined_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      access_requests: {
        Row: {
          avatar_url: string | null
          created_at: string
          discord_name: string
          status: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          discord_name: string
          status?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          discord_name?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          book_id: string | null
          book_snapshot: Json | null
          content: string | null
          created_at: string
          id: string
          timestamp: string | null
          type: string
          user_id: string
        }
        Insert: {
          book_id?: string | null
          book_snapshot?: Json | null
          content?: string | null
          created_at?: string
          id?: string
          timestamp?: string | null
          type?: string
          user_id: string
        }
        Update: {
          book_id?: string | null
          book_snapshot?: Json | null
          content?: string | null
          created_at?: string
          id?: string
          timestamp?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_comments: {
        Row: {
          activity_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          activity_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_comments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_likes: {
        Row: {
          activity_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_likes_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          author: string | null
          content: string | null
          cover_url: string | null
          created_at: string
          current_page: number
          document: Json | null
          id: string
          is_lendable: boolean
          my_rating: number
          progress: number
          reading_offset: number | null
          status: string
          title: string
          total_pages: number
          user_id: string
        }
        Insert: {
          author?: string | null
          content?: string | null
          cover_url?: string | null
          created_at?: string
          current_page?: number
          document?: Json | null
          id?: string
          is_lendable?: boolean
          my_rating?: number
          progress?: number
          reading_offset?: number | null
          status?: string
          title: string
          total_pages?: number
          user_id: string
        }
        Update: {
          author?: string | null
          content?: string | null
          cover_url?: string | null
          created_at?: string
          current_page?: number
          document?: Json | null
          id?: string
          is_lendable?: boolean
          my_rating?: number
          progress?: number
          reading_offset?: number | null
          status?: string
          title?: string
          total_pages?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          content_id: string | null
          content_type: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reported_user_id: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          content_id?: string | null
          content_type: string
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          content_id?: string | null
          content_type?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: string | null
          banner_url: string | null
          bio: string | null
          completed_count: number
          email: string | null
          handle: string | null
          id: string
          joined_date: string | null
          level: number
          location: string | null
          name: string | null
          role: string
          streak_days: number
          terms_accepted_at: string | null
          xp: number
        }
        Insert: {
          avatar?: string | null
          banner_url?: string | null
          bio?: string | null
          completed_count?: number
          email?: string | null
          handle?: string | null
          id: string
          joined_date?: string | null
          level?: number
          location?: string | null
          name?: string | null
          role?: string
          streak_days?: number
          terms_accepted_at?: string | null
          xp?: number
        }
        Update: {
          avatar?: string | null
          banner_url?: string | null
          bio?: string | null
          completed_count?: number
          email?: string | null
          handle?: string | null
          id?: string
          joined_date?: string | null
          level?: number
          location?: string | null
          name?: string | null
          role?: string
          streak_days?: number
          terms_accepted_at?: string | null
          xp?: number
        }
        Relationships: []
      }
      quotes: {
        Row: {
          book_id: string | null
          book_title: string | null
          color: string | null
          comment: string | null
          created_at: string
          id: string
          text: string
          timestamp: number | null
          user_id: string
        }
        Insert: {
          book_id?: string | null
          book_title?: string | null
          color?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          text: string
          timestamp?: number | null
          user_id: string
        }
        Update: {
          book_id?: string | null
          book_title?: string | null
          color?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          text?: string
          timestamp?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_access: {
        Row: {
          active: boolean
          approved_at: string
          role: string
          user_id: string
        }
        Insert: {
          active?: boolean
          approved_at?: string
          role: string
          user_id: string
        }
        Update: {
          active?: boolean
          approved_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_actions: {
        Row: {
          action_title: string
          action_type: string
          actor_name: string
          actor_role: string
          command_text: string | null
          id: number
          occurred_at: string
          severity: string
          target_name: string | null
        }
        Insert: {
          action_title: string
          action_type: string
          actor_name: string
          actor_role: string
          command_text?: string | null
          id?: number
          occurred_at?: string
          severity?: string
          target_name?: string | null
        }
        Update: {
          action_title?: string
          action_type?: string
          actor_name?: string
          actor_role?: string
          command_text?: string | null
          id?: number
          occurred_at?: string
          severity?: string
          target_name?: string | null
        }
        Relationships: []
      }
      thread_likes: {
        Row: {
          created_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_likes_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_replies: {
        Row: {
          author_id: string | null
          author_name: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          thread_id: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          thread_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          author_id: string | null
          author_name: string
          book_id: string | null
          book_snapshot: Json | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          kind: string
          title: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          book_id?: string | null
          book_snapshot?: Json | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          title: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          book_id?: string | null
          book_snapshot?: Json | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      book_shelf: {
        Row: {
          id: string
          user_id: string
          title: string
          author: string | null
          cover_url: string | null
          progress: number
          status: string
          my_rating: number
          is_lendable: boolean
          current_page: number
          reading_offset: number | null
          total_pages: number
          created_at: string
          has_content: boolean
          annotation_count: number
        }
        Relationships: []
      }
      community_topics: {
        Row: {
          author_avatar: string | null
          author_id: string | null
          author_name: string | null
          book_snapshot: Json | null
          content: string | null
          created_at: string | null
          id: string | null
          image_url: string | null
          kind: string | null
          last_activity_at: string | null
          liked_by_me: boolean | null
          likes_count: number | null
          replies_count: number | null
          source: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      watch_player_command: {
        Args: { p_room_id: string; p_version: number; p_action: string; p_rate?: number | null;
          p_item_id?: string | null; p_direction?: number | null; p_title?: string | null;
          p_provider?: string | null; p_video_id?: string | null; p_media_url?: string | null;
          p_position?: number | null; p_playing?: boolean | null; p_client_id?: string | null }
        Returns: Json
      }
      get_watch_room: { Args: { p_room_id: string }; Returns: Json }
      create_watch_room: {
        Args: { p_title: string; p_provider: string; p_video_id: string | null; p_media_url: string }
        Returns: Json
      }
      join_watch_room: { Args: { p_room_id: string }; Returns: Json }
      control_watch_room: {
        Args: {
          p_room_id: string; p_version: number; p_action: string
          p_position?: number | null; p_playing?: boolean | null; p_provider?: string | null
          p_video_id?: string | null; p_media_url?: string | null; p_client_id?: string | null
        }
        Returns: Json
      }
      search_community_topics: {
        Args: {
          p_kind?: string
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_scope?: string
          p_sort?: string
        }
        Returns: {
          author_avatar: string | null
          author_id: string | null
          author_name: string | null
          book_snapshot: Json | null
          content: string | null
          created_at: string | null
          id: string | null
          image_url: string | null
          kind: string | null
          last_activity_at: string | null
          liked_by_me: boolean | null
          likes_count: number | null
          replies_count: number | null
          source: string | null
          title: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "community_topics"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
    Enums: {},
  },
} as const
