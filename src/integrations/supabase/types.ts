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
      action_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string | null
          key: string
          value: Json | null
        }
        Insert: {
          created_at?: string | null
          key: string
          value?: Json | null
        }
        Update: {
          created_at?: string | null
          key?: string
          value?: Json | null
        }
        Relationships: []
      }
      banned_discord_roles: {
        Row: {
          created_at: string
          created_by: string | null
          discord_role_id: string
          id: string
          reason: string | null
          role_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discord_role_id: string
          id?: string
          reason?: string | null
          role_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discord_role_id?: string
          id?: string
          reason?: string | null
          role_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "banned_discord_roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banned_words: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          id: string
          word: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          word: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "banned_words_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banned_words_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          button_text: string | null
          button_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          sort_order: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          button_text?: string | null
          button_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          button_text?: string | null
          button_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          allow_voice_channel: boolean
          created_at: string
          description: string | null
          do_dont_examples: Json | null
          fields_schema: Json | null
          icon: string
          id: string
          is_active: boolean
          mode: string | null
          name: string
          require_role_selection: boolean
          rules_text: string | null
          sort_order: number | null
          subtitle: string | null
          tldr_points: Json | null
          updated_at: string
        }
        Insert: {
          allow_voice_channel?: boolean
          created_at?: string
          description?: string | null
          do_dont_examples?: Json | null
          fields_schema?: Json | null
          icon?: string
          id?: string
          is_active?: boolean
          mode?: string | null
          name: string
          require_role_selection?: boolean
          rules_text?: string | null
          sort_order?: number | null
          subtitle?: string | null
          tldr_points?: Json | null
          updated_at?: string
        }
        Update: {
          allow_voice_channel?: boolean
          created_at?: string
          description?: string | null
          do_dont_examples?: Json | null
          fields_schema?: Json | null
          icon?: string
          id?: string
          is_active?: boolean
          mode?: string | null
          name?: string
          require_role_selection?: boolean
          rules_text?: string | null
          sort_order?: number | null
          subtitle?: string | null
          tldr_points?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      category_roles: {
        Row: {
          category_id: string
          created_at: string
          id: string
          role_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          role_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_roles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "discord_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_permissions: {
        Row: {
          allowed_pages: string[]
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          allowed_pages?: string[]
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          allowed_pages?: string[]
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discord_roles: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          discord_role_id: string
          display_name: string
          emoji: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          discord_role_id: string
          display_name: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          discord_role_id?: string
          display_name?: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      discord_server_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      discord_servers: {
        Row: {
          banner_url: string | null
          bumped_at: string | null
          carousel_order: number | null
          category_id: string | null
          click_count: number | null
          created_at: string
          description: string | null
          discord_id: string
          highlight_color: string | null
          icon_url: string | null
          id: string
          invite_url: string
          is_featured: boolean | null
          is_partner: boolean
          is_verified: boolean
          member_count: number | null
          name: string
          notify_channel_id: string | null
          owner_id: string
          qc_comment: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          bumped_at?: string | null
          carousel_order?: number | null
          category_id?: string | null
          click_count?: number | null
          created_at?: string
          description?: string | null
          discord_id: string
          highlight_color?: string | null
          icon_url?: string | null
          id?: string
          invite_url: string
          is_featured?: boolean | null
          is_partner?: boolean
          is_verified?: boolean
          member_count?: number | null
          name: string
          notify_channel_id?: string | null
          owner_id: string
          qc_comment?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          bumped_at?: string | null
          carousel_order?: number | null
          category_id?: string | null
          click_count?: number | null
          created_at?: string
          description?: string | null
          discord_id?: string
          highlight_color?: string | null
          icon_url?: string | null
          id?: string
          invite_url?: string
          is_featured?: boolean | null
          is_partner?: boolean
          is_verified?: boolean
          member_count?: number | null
          name?: string
          notify_channel_id?: string | null
          owner_id?: string
          qc_comment?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discord_servers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "discord_server_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_rewards: {
        Row: {
          claimed_count: number | null
          created_at: string
          drop_rate: number
          id: string
          is_active: boolean | null
          max_limit: number | null
          name: string
          type: Database["public"]["Enums"]["gacha_reward_type"]
          updated_at: string
          value: string | null
        }
        Insert: {
          claimed_count?: number | null
          created_at?: string
          drop_rate: number
          id?: string
          is_active?: boolean | null
          max_limit?: number | null
          name: string
          type: Database["public"]["Enums"]["gacha_reward_type"]
          updated_at?: string
          value?: string | null
        }
        Update: {
          claimed_count?: number | null
          created_at?: string
          drop_rate?: number
          id?: string
          is_active?: boolean | null
          max_limit?: number | null
          name?: string
          type?: Database["public"]["Enums"]["gacha_reward_type"]
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          id: string
          leave_date: string
          leave_type: string
          reason: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leave_date: string
          leave_type: string
          reason: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leave_date?: string
          leave_type?: string
          reason?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      lottery_rounds: {
        Row: {
          created_at: string | null
          draw_date: string
          id: string
          prize_details: Json | null
          round_number: number
          status: string | null
          ticket_price: number | null
          winning_number: string | null
        }
        Insert: {
          created_at?: string | null
          draw_date: string
          id?: string
          prize_details?: Json | null
          round_number?: number
          status?: string | null
          ticket_price?: number | null
          winning_number?: string | null
        }
        Update: {
          created_at?: string | null
          draw_date?: string
          id?: string
          prize_details?: Json | null
          round_number?: number
          status?: string | null
          ticket_price?: number | null
          winning_number?: string | null
        }
        Relationships: []
      }
      match_queue: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          matched_session_id: string | null
          matched_with: string | null
          selected_role_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          matched_session_id?: string | null
          matched_with?: string | null
          selected_role_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          matched_session_id?: string | null
          matched_with?: string | null
          selected_role_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_queue_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_queue_matched_session_id_fkey"
            columns: ["matched_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_queue_selected_role_id_fkey"
            columns: ["selected_role_id"]
            isOneToOne: false
            referencedRelation: "discord_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      non_transferable_roles: {
        Row: {
          created_at: string
          created_by: string | null
          discord_role_id: string
          id: string
          reason: string | null
          role_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discord_role_id: string
          id?: string
          reason?: string | null
          role_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discord_role_id?: string
          id?: string
          reason?: string | null
          role_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "non_transferable_roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          banner_url: string | null
          created_at: string
          discord_id: string
          discord_username: string | null
          id: string
          is_banned: boolean
          last_session_at: string | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          banner_url?: string | null
          created_at?: string
          discord_id: string
          discord_username?: string | null
          id?: string
          is_banned?: boolean
          last_session_at?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          banner_url?: string | null
          created_at?: string
          discord_id?: string
          discord_username?: string | null
          id?: string
          is_banned?: boolean
          last_session_at?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      promotion_tasks: {
        Row: {
          admin_note: string | null
          id: string
          image_url: string | null
          post_url: string
          status: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          id?: string
          image_url?: string | null
          post_url: string
          status?: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          id?: string
          image_url?: string | null
          post_url?: string
          status?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: []
      }
      redeem_codes: {
        Row: {
          code: string
          created_at: string | null
          end_at: string | null
          is_enabled: boolean | null
          max_uses: number | null
          points: number | null
          reward_type: string | null
          role_id: string | null
          start_at: string | null
          used_count: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          end_at?: string | null
          is_enabled?: boolean | null
          max_uses?: number | null
          points?: number | null
          reward_type?: string | null
          role_id?: string | null
          start_at?: string | null
          used_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          end_at?: string | null
          is_enabled?: boolean | null
          max_uses?: number | null
          points?: number | null
          reward_type?: string | null
          role_id?: string | null
          start_at?: string | null
          used_count?: number | null
        }
        Relationships: []
      }
      redeem_logs: {
        Row: {
          code: string | null
          discord_id: string | null
          id: string
          redeemed_at: string | null
          reward_details: Json | null
        }
        Insert: {
          code?: string | null
          discord_id?: string | null
          id?: string
          redeemed_at?: string | null
          reward_details?: Json | null
        }
        Update: {
          code?: string | null
          discord_id?: string | null
          id?: string
          redeemed_at?: string | null
          reward_details?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "redeem_logs_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "redeem_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "redeem_logs_discord_id_fkey"
            columns: ["discord_id"]
            isOneToOne: false
            referencedRelation: "user_points"
            referencedColumns: ["discord_id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string
          evidence_url: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          report_type: Database["public"]["Enums"]["report_type"]
          reported_user_id: string
          reporter_id: string
          session_id: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description: string
          evidence_url?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          report_type: Database["public"]["Enums"]["report_type"]
          reported_user_id: string
          reporter_id: string
          session_id: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string
          evidence_url?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          report_type?: Database["public"]["Enums"]["report_type"]
          reported_user_id?: string
          reporter_id?: string
          session_id?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      role_transfer_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          roles_skipped: string[]
          roles_transferred: string[]
          source_discord_id: string
          source_username: string | null
          status: string
          target_discord_id: string
          target_username: string | null
          transferred_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          roles_skipped?: string[]
          roles_transferred?: string[]
          source_discord_id: string
          source_username?: string | null
          status?: string
          target_discord_id: string
          target_username?: string | null
          transferred_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          roles_skipped?: string[]
          roles_transferred?: string[]
          source_discord_id?: string
          source_username?: string | null
          status?: string
          target_discord_id?: string
          target_username?: string | null
          transferred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_transfer_logs_transferred_by_fkey"
            columns: ["transferred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rules_presets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          rules_text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          rules_text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          rules_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rules_presets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      server_clicks: {
        Row: {
          created_at: string
          id: string
          server_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          server_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          server_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_clicks_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "discord_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_click_stats: {
        Row: {
          click_count: number
          created_at: string
          id: string
          server_id: string
          stat_date: string
          updated_at: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          id?: string
          server_id: string
          stat_date?: string
          updated_at?: string
        }
        Update: {
          click_count?: number
          created_at?: string
          id?: string
          server_id?: string
          stat_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      server_ratings: {
        Row: {
          created_at: string
          id: string
          rating: number
          server_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating: number
          server_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number
          server_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          category_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          discord_message_id: string | null
          duration_minutes: number
          ends_at: string
          id: string
          include_voice_channel: boolean
          max_participants: number | null
          note: string | null
          selected_role_id: string | null
          session_mode: string
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          title: string | null
          user_id: string
          voice_channel_id: string | null
          voice_channel_name: string | null
        }
        Insert: {
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          discord_message_id?: string | null
          duration_minutes?: number
          ends_at: string
          id?: string
          include_voice_channel?: boolean
          max_participants?: number | null
          note?: string | null
          selected_role_id?: string | null
          session_mode?: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          title?: string | null
          user_id: string
          voice_channel_id?: string | null
          voice_channel_name?: string | null
        }
        Update: {
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          discord_message_id?: string | null
          duration_minutes?: number
          ends_at?: string
          id?: string
          include_voice_channel?: boolean
          max_participants?: number | null
          note?: string | null
          selected_role_id?: string | null
          session_mode?: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          title?: string | null
          user_id?: string
          voice_channel_id?: string | null
          voice_channel_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_selected_role_id_fkey"
            columns: ["selected_role_id"]
            isOneToOne: false
            referencedRelation: "discord_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: []
      }
      tag_warn_cancel_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          external_sync_error: string | null
          external_sync_status: string
          external_synced_at: string | null
          id: string
          member_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          requested_by: string
          requested_by_name: string | null
          status: string
          warn_sequence: string | null
          warn_timestamp: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          external_sync_error?: string | null
          external_sync_status?: string
          external_synced_at?: string | null
          id?: string
          member_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          requested_by: string
          requested_by_name?: string | null
          status?: string
          warn_sequence?: string | null
          warn_timestamp: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          external_sync_error?: string | null
          external_sync_status?: string
          external_synced_at?: string | null
          id?: string
          member_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          requested_by?: string
          requested_by_name?: string | null
          status?: string
          warn_sequence?: string | null
          warn_timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_warn_cancel_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_warn_cancel_requests_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_warn_cancel_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_warn_logs: {
        Row: {
          barista_id: string | null
          created_at: string
          id: string
          image_url: string | null
          image_url_2: string | null
          is_spoiler: boolean
          is_spoiler_2: boolean
          log_timestamp: string
          member_id: string | null
          message: string | null
          punish: string | null
          sequence: number
        }
        Insert: {
          barista_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          is_spoiler?: boolean
          is_spoiler_2?: boolean
          log_timestamp?: string
          member_id?: string | null
          message?: string | null
          punish?: string | null
          sequence?: number
        }
        Update: {
          barista_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          is_spoiler?: boolean
          is_spoiler_2?: boolean
          log_timestamp?: string
          member_id?: string | null
          message?: string | null
          punish?: string | null
          sequence?: number
        }
        Relationships: []
      }
      trading_history: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          item: string | null
          log_timestamp: string
          member_id: string
          service_id: string | null
          slip_url: string | null
          slip_url_2: string | null
          transaction: string | null
          type_bill: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          item?: string | null
          log_timestamp?: string
          member_id: string
          service_id?: string | null
          slip_url?: string | null
          slip_url_2?: string | null
          transaction?: string | null
          type_bill?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          item?: string | null
          log_timestamp?: string
          member_id?: string
          service_id?: string | null
          slip_url?: string | null
          slip_url_2?: string | null
          transaction?: string | null
          type_bill?: string | null
        }
        Relationships: []
      }
      user_custom_permissions: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          permission_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          permission_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_permissions_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_custom_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "custom_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_custom_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_gacha_stats: {
        Row: {
          created_at: string
          discord_id: string
          gacha_coins: number | null
          match_count: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          discord_id: string
          gacha_coins?: number | null
          match_count?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          discord_id?: string
          gacha_coins?: number | null
          match_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_points: {
        Row: {
          discord_id: string
          max_cap: number
          points: number
          ticket_point: number
          ticket_piece_point: number
          updated_at: string | null
        }
        Insert: {
          discord_id: string
          max_cap?: number
          points?: number
          ticket_point?: number
          ticket_piece_point?: number
          updated_at?: string | null
        }
        Update: {
          discord_id?: string
          max_cap?: number
          points?: number
          ticket_point?: number
          ticket_piece_point?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          allowed_pages: string[]
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          allowed_pages?: string[]
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          allowed_pages?: string[]
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_states: {
        Row: {
          channel_id: string | null
          channel_name: string | null
          discord_user_id: string
          guild_id: string
          id: string
          is_connected: boolean
          joined_at: string | null
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          channel_name?: string | null
          discord_user_id: string
          guild_id: string
          id?: string
          is_connected?: boolean
          joined_at?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          channel_name?: string | null
          discord_user_id?: string
          guild_id?: string
          id?: string
          is_connected?: boolean
          joined_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      work_sessions: {
        Row: {
          check_in_time: string
          check_out_time: string | null
          id: string
          nickname: string
          note: string | null
          position: string
          status: string
          user_id: string
          work_detail: string | null
        }
        Insert: {
          check_in_time?: string
          check_out_time?: string | null
          id?: string
          nickname: string
          note?: string | null
          position: string
          status?: string
          user_id: string
          work_detail?: string | null
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          id?: string
          nickname?: string
          note?: string | null
          position?: string
          status?: string
          user_id?: string
          work_detail?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attempt_match: {
        Args: { p_category_id: string; p_role_id: string; p_user_id: string }
        Returns: {
          matched_user_id: string
          session_id: string
          success: boolean
        }[]
      }
      cleanup_old_sessions: { Args: never; Returns: undefined }
      complete_expired_sessions: { Args: never; Returns: number }
      get_jwt_discord_id: { Args: never; Returns: string }
      get_profile_by_discord_id: {
        Args: { _discord_id: string }
        Returns: string
      }
      has_active_session: { Args: { _user_id: string }; Returns: boolean }
      has_page_access:
        | { Args: { _page: string; _user_id: string }; Returns: boolean }
        | { Args: { page_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_gacha_claimed_count: {
        Args: { reward_id: string }
        Returns: undefined
      }
      is_owner: { Args: never; Returns: boolean }
      jwt_has_page_access: { Args: { _page: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      gacha_reward_type: "point" | "role" | "money" | "item" | "other"
      report_status: "open" | "investigating" | "resolved" | "dismissed"
      report_type:
        | "inappropriate_behavior"
        | "adult_content"
        | "spam"
        | "harassment"
        | "other"
      session_status: "active" | "completed" | "cancelled" | "flagged" | "open"
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
      app_role: ["admin", "moderator", "user"],
      gacha_reward_type: ["point", "role", "money", "item", "other"],
      report_status: ["open", "investigating", "resolved", "dismissed"],
      report_type: [
        "inappropriate_behavior",
        "adult_content",
        "spam",
        "harassment",
        "other",
      ],
      session_status: ["active", "completed", "cancelled", "flagged", "open"],
    },
  },
} as const
