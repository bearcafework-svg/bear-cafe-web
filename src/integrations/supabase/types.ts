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
    PostgrestVersion: "14.5"
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
      archived_rent_house_settings: {
        Row: {
          archived_at: string
          channel_id: string
          id: number
          owner_id: string
          settings: Json
        }
        Insert: {
          archived_at?: string
          channel_id: string
          id?: number
          owner_id: string
          settings?: Json
        }
        Update: {
          archived_at?: string
          channel_id?: string
          id?: number
          owner_id?: string
          settings?: Json
        }
        Relationships: []
      }
      banned_name: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          word: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          word: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "banned_name_created_by_fkey"
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
        Relationships: []
      }
      campaign_messages: {
        Row: {
          created_at: string | null
          id: string
          internal_name: string
          is_active: boolean
          last_sent_at: string | null
          next_send_at: string | null
          payload: Json
          sort_order: number
          target_channels: string[]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          internal_name: string
          is_active?: boolean
          last_sent_at?: string | null
          next_send_at?: string | null
          payload: Json
          sort_order?: number
          target_channels?: string[]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          internal_name?: string
          is_active?: boolean
          last_sent_at?: string | null
          next_send_at?: string | null
          payload?: Json
          sort_order?: number
          target_channels?: string[]
          updated_at?: string | null
        }
        Relationships: []
      }
      campaign_schedule_config: {
        Row: {
          cron_expression: string
          id: string
          interval_hours: number
          interval_minutes: number
          is_enabled: boolean
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cron_expression?: string
          id?: string
          interval_hours?: number
          interval_minutes?: number
          is_enabled?: boolean
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cron_expression?: string
          id?: string
          interval_hours?: number
          interval_minutes?: number
          is_enabled?: boolean
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      channel_activity_stats: {
        Row: {
          channel_id: string
          count_24h: number
          count_30d: number
          count_7d: number
          oldest_sampled: string | null
          updated_at: string
        }
        Insert: {
          channel_id: string
          count_24h?: number
          count_30d?: number
          count_7d?: number
          oldest_sampled?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string
          count_24h?: number
          count_30d?: number
          count_7d?: number
          oldest_sampled?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      checkin_big_reward: {
        Row: {
          description: string | null
          id: string
          month: number
          reward_amount: number | null
          reward_type: Database["public"]["Enums"]["checkin_reward_type"]
          role_id: string | null
          updated_at: string
          updated_by: string | null
          year: number
        }
        Insert: {
          description?: string | null
          id?: string
          month: number
          reward_amount?: number | null
          reward_type: Database["public"]["Enums"]["checkin_reward_type"]
          role_id?: string | null
          updated_at?: string
          updated_by?: string | null
          year: number
        }
        Update: {
          description?: string | null
          id?: string
          month?: number
          reward_amount?: number | null
          reward_type?: Database["public"]["Enums"]["checkin_reward_type"]
          role_id?: string | null
          updated_at?: string
          updated_by?: string | null
          year?: number
        }
        Relationships: []
      }
      checkin_cycles: {
        Row: {
          big_reward_claimed: boolean
          completed_days: number[]
          created_at: string
          discord_id: string
          id: string
          makeup_days: number[]
          month: number
          year: number
        }
        Insert: {
          big_reward_claimed?: boolean
          completed_days?: number[]
          created_at?: string
          discord_id: string
          id?: string
          makeup_days?: number[]
          month: number
          year: number
        }
        Update: {
          big_reward_claimed?: boolean
          completed_days?: number[]
          created_at?: string
          discord_id?: string
          id?: string
          makeup_days?: number[]
          month?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "checkin_cycles_discord_id_fkey"
            columns: ["discord_id"]
            isOneToOne: false
            referencedRelation: "user_points"
            referencedColumns: ["discord_id"]
          },
        ]
      }
      checkin_daily_rewards: {
        Row: {
          day_number: number
          id: string
          is_active: boolean
          makeup_cost: number
          month: number
          reward_amount: number | null
          reward_type: Database["public"]["Enums"]["checkin_reward_type"]
          role_id: string | null
          updated_at: string
          updated_by: string | null
          year: number
        }
        Insert: {
          day_number: number
          id?: string
          is_active?: boolean
          makeup_cost?: number
          month: number
          reward_amount?: number | null
          reward_type: Database["public"]["Enums"]["checkin_reward_type"]
          role_id?: string | null
          updated_at?: string
          updated_by?: string | null
          year: number
        }
        Update: {
          day_number?: number
          id?: string
          is_active?: boolean
          makeup_cost?: number
          month?: number
          reward_amount?: number | null
          reward_type?: Database["public"]["Enums"]["checkin_reward_type"]
          role_id?: string | null
          updated_at?: string
          updated_by?: string | null
          year?: number
        }
        Relationships: []
      }
      checkin_logs: {
        Row: {
          action: Database["public"]["Enums"]["checkin_action"]
          created_at: string
          day_number: number
          discord_id: string
          id: string
          month: number
          points_cost: number | null
          reward_type: Database["public"]["Enums"]["checkin_reward_type"] | null
          reward_value: Json | null
          year: number
        }
        Insert: {
          action: Database["public"]["Enums"]["checkin_action"]
          created_at?: string
          day_number: number
          discord_id: string
          id?: string
          month: number
          points_cost?: number | null
          reward_type?:
            | Database["public"]["Enums"]["checkin_reward_type"]
            | null
          reward_value?: Json | null
          year: number
        }
        Update: {
          action?: Database["public"]["Enums"]["checkin_action"]
          created_at?: string
          day_number?: number
          discord_id?: string
          id?: string
          month?: number
          points_cost?: number | null
          reward_type?:
            | Database["public"]["Enums"]["checkin_reward_type"]
            | null
          reward_value?: Json | null
          year?: number
        }
        Relationships: []
      }
      contracts: {
        Row: {
          channel_deleted_at: string | null
          channel_id: string | null
          created_at: string
          discord_role_id: string | null
          edit_log: Json | null
          end_at: string | null
          id: string
          member_id: string
          operator_id: string | null
          operator_name: string | null
          package_name: string | null
          role_name: string | null
          room_link: string | null
          start_at: string
          type: string
          updated_at: string | null
        }
        Insert: {
          channel_deleted_at?: string | null
          channel_id?: string | null
          created_at?: string
          discord_role_id?: string | null
          edit_log?: Json | null
          end_at?: string | null
          id?: string
          member_id: string
          operator_id?: string | null
          operator_name?: string | null
          package_name?: string | null
          role_name?: string | null
          room_link?: string | null
          start_at: string
          type: string
          updated_at?: string | null
        }
        Update: {
          channel_deleted_at?: string | null
          channel_id?: string | null
          created_at?: string
          discord_role_id?: string | null
          edit_log?: Json | null
          end_at?: string | null
          id?: string
          member_id?: string
          operator_id?: string | null
          operator_name?: string | null
          package_name?: string | null
          role_name?: string | null
          room_link?: string | null
          start_at?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
        Relationships: []
      }
      daily_quest_analytics: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          quest_date: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          quest_date: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          quest_date?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_quest_bonuses: {
        Row: {
          awarded_at: string | null
          bonus_points: number
          id: string
          quest_date: string
          user_id: string
        }
        Insert: {
          awarded_at?: string | null
          bonus_points?: number
          id?: string
          quest_date: string
          user_id: string
        }
        Update: {
          awarded_at?: string | null
          bonus_points?: number
          id?: string
          quest_date?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_quest_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_progress: number
          id: string
          is_completed: boolean
          quest_date: string
          quest_id: string
          reward_claimed: boolean
          target_count: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_progress?: number
          id?: string
          is_completed?: boolean
          quest_date: string
          quest_id: string
          reward_claimed?: boolean
          target_count?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_progress?: number
          id?: string
          is_completed?: boolean
          quest_date?: string
          quest_id?: string
          reward_claimed?: boolean
          target_count?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_quest_progress_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "daily_quest_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_quest_sets: {
        Row: {
          announcement_message_id: string | null
          bonus_points: number
          created_at: string | null
          id: string
          published_at: string | null
          quest_date: string
          quest_ids: string[]
        }
        Insert: {
          announcement_message_id?: string | null
          bonus_points?: number
          created_at?: string | null
          id?: string
          published_at?: string | null
          quest_date: string
          quest_ids: string[]
        }
        Update: {
          announcement_message_id?: string | null
          bonus_points?: number
          created_at?: string | null
          id?: string
          published_at?: string | null
          quest_date?: string
          quest_ids?: string[]
        }
        Relationships: []
      }
      daily_quest_templates: {
        Row: {
          active: boolean
          category: string
          code: string
          created_at: string | null
          description: string
          id: string
          reward_points: number
          target_count: number
          title: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          created_at?: string | null
          description: string
          id?: string
          reward_points?: number
          target_count?: number
          title: string
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string | null
          description?: string
          id?: string
          reward_points?: number
          target_count?: number
          title?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      discord_server_bumps: {
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
            foreignKeyName: "discord_server_bumps_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "discord_servers"
            referencedColumns: ["id"]
          },
        ]
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
          activity_synced_at: string | null
          banner_url: string | null
          bump_count: number
          bumped_at: string | null
          carousel_order: number | null
          category_id: string | null
          click_count: number | null
          created_at: string
          description: string | null
          discord_id: string
          has_akari_bot: boolean | null
          highlight_color: string | null
          icon_url: string | null
          id: string
          impression_count: number | null
          invite_last_checked_at: string | null
          invite_status: string
          invite_url: string
          is_featured: boolean
          is_partner: boolean
          is_verified: boolean
          live_voice_count: number | null
          member_count: number | null
          name: string
          notify_channel_id: string | null
          owner_id: string
          qc_comment: string | null
          server_profile: Json | null
          server_type: string | null
          status: string
          traits: string[] | null
          updated_at: string
          weekly_joins_count: number | null
        }
        Insert: {
          activity_synced_at?: string | null
          banner_url?: string | null
          bump_count?: number
          bumped_at?: string | null
          carousel_order?: number | null
          category_id?: string | null
          click_count?: number | null
          created_at?: string
          description?: string | null
          discord_id: string
          has_akari_bot?: boolean | null
          highlight_color?: string | null
          icon_url?: string | null
          id?: string
          impression_count?: number | null
          invite_last_checked_at?: string | null
          invite_status?: string
          invite_url: string
          is_featured?: boolean
          is_partner?: boolean
          is_verified?: boolean
          live_voice_count?: number | null
          member_count?: number | null
          name: string
          notify_channel_id?: string | null
          owner_id: string
          qc_comment?: string | null
          server_profile?: Json | null
          server_type?: string | null
          status?: string
          traits?: string[] | null
          updated_at?: string
          weekly_joins_count?: number | null
        }
        Update: {
          activity_synced_at?: string | null
          banner_url?: string | null
          bump_count?: number
          bumped_at?: string | null
          carousel_order?: number | null
          category_id?: string | null
          click_count?: number | null
          created_at?: string
          description?: string | null
          discord_id?: string
          has_akari_bot?: boolean | null
          highlight_color?: string | null
          icon_url?: string | null
          id?: string
          impression_count?: number | null
          invite_last_checked_at?: string | null
          invite_status?: string
          invite_url?: string
          is_featured?: boolean
          is_partner?: boolean
          is_verified?: boolean
          live_voice_count?: number | null
          member_count?: number | null
          name?: string
          notify_channel_id?: string | null
          owner_id?: string
          qc_comment?: string | null
          server_profile?: Json | null
          server_type?: string | null
          status?: string
          traits?: string[] | null
          updated_at?: string
          weekly_joins_count?: number | null
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
      dm_broadcast_logs: {
        Row: {
          error_message: string | null
          id: string
          queue_id: string
          sent_at: string | null
          status: string
          user_id: string
          username: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          queue_id: string
          sent_at?: string | null
          status?: string
          user_id: string
          username?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          queue_id?: string
          sent_at?: string | null
          status?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_broadcast_logs_queue_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "dm_broadcast_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_broadcast_queues: {
        Row: {
          created_at: string
          failed_count: number
          id: string
          message_payload: Json
          sent_count: number
          status: string
          target_type: string
          target_value: string | null
          title: string
          token_type: string
          total_targets: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          failed_count?: number
          id?: string
          message_payload: Json
          sent_count?: number
          status?: string
          target_type: string
          target_value?: string | null
          title: string
          token_type?: string
          total_targets?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          failed_count?: number
          id?: string
          message_payload?: Json
          sent_count?: number
          status?: string
          target_type?: string
          target_value?: string | null
          title?: string
          token_type?: string
          total_targets?: number
          updated_at?: string
        }
        Relationships: []
      }
      dm_broadcast_system_logs: {
        Row: {
          created_at: string
          id: number
          level: string
          message_th: string
          queue_id: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          level?: string
          message_th: string
          queue_id?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          level?: string
          message_th?: string
          queue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_broadcast_system_logs_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "dm_broadcast_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      dms_options: {
        Row: {
          created_at: string
          id: string
          option_value: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_value: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_value?: string
          user_id?: string
        }
        Relationships: []
      }
      flower_sessions: {
        Row: {
          channel_id: string
          created_at: string | null
          expires_at: number
          flower_key: string
          id: string
          message_id: string
          sender_id: string
          target_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          expires_at: number
          flower_key: string
          id: string
          message_id: string
          sender_id: string
          target_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          expires_at?: number
          flower_key?: string
          id?: string
          message_id?: string
          sender_id?: string
          target_id?: string
        }
        Relationships: []
      }
      guild_structure_backups: {
        Row: {
          backup_name: string
          categories: Json
          channels: Json
          created_at: string | null
          created_by: string
          guild_id: string
          id: string
          roles: Json
          special_channels: Json
        }
        Insert: {
          backup_name?: string
          categories?: Json
          channels?: Json
          created_at?: string | null
          created_by: string
          guild_id: string
          id?: string
          roles?: Json
          special_channels?: Json
        }
        Update: {
          backup_name?: string
          categories?: Json
          channels?: Json
          created_at?: string | null
          created_by?: string
          guild_id?: string
          id?: string
          roles?: Json
          special_channels?: Json
        }
        Relationships: []
      }
      heal_jai_consents: {
        Row: {
          accepted_at: string | null
          consent_type: string
          created_at: string | null
          guild_id: string
          id: number
          metadata: Json | null
          role_assigned: boolean | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string | null
          consent_type?: string
          created_at?: string | null
          guild_id: string
          id?: number
          metadata?: Json | null
          role_assigned?: boolean | null
          user_id: string
          version?: string
        }
        Update: {
          accepted_at?: string | null
          consent_type?: string
          created_at?: string | null
          guild_id?: string
          id?: number
          metadata?: Json | null
          role_assigned?: boolean | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      heal_jai_counselors: {
        Row: {
          accumulated_earnings: number | null
          average_rating: number | null
          created_at: string | null
          display_name: string | null
          guild_id: string
          id: number
          is_silent_companion: boolean | null
          last_shift_at: string | null
          payout_account: string | null
          specialty_tags: string[] | null
          status: string
          total_reviews: number | null
          total_sessions: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accumulated_earnings?: number | null
          average_rating?: number | null
          created_at?: string | null
          display_name?: string | null
          guild_id: string
          id?: number
          is_silent_companion?: boolean | null
          last_shift_at?: string | null
          payout_account?: string | null
          specialty_tags?: string[] | null
          status?: string
          total_reviews?: number | null
          total_sessions?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accumulated_earnings?: number | null
          average_rating?: number | null
          created_at?: string | null
          display_name?: string | null
          guild_id?: string
          id?: number
          is_silent_companion?: boolean | null
          last_shift_at?: string | null
          payout_account?: string | null
          specialty_tags?: string[] | null
          status?: string
          total_reviews?: number | null
          total_sessions?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      heal_jai_orders_sessions: {
        Row: {
          counselor_id: string | null
          counselor_share: number
          created_at: string | null
          customer_id: string
          duration_minutes: number
          ended_at: string | null
          grace_period_minutes: number | null
          guild_id: string
          id: number
          is_booster: boolean | null
          is_silent: boolean | null
          is_specific_counselor: boolean | null
          order_code: string
          package_name: string | null
          package_tier: string
          payment_status: string
          platform_share: number
          session_channel_id: string | null
          session_status: string
          session_voice_id: string | null
          slip_url: string | null
          slip_verified_at: string | null
          started_at: string | null
          ticket_channel_id: string | null
          total_price: number
          updated_at: string | null
        }
        Insert: {
          counselor_id?: string | null
          counselor_share: number
          created_at?: string | null
          customer_id: string
          duration_minutes: number
          ended_at?: string | null
          grace_period_minutes?: number | null
          guild_id: string
          id?: number
          is_booster?: boolean | null
          is_silent?: boolean | null
          is_specific_counselor?: boolean | null
          order_code: string
          package_name?: string | null
          package_tier: string
          payment_status?: string
          platform_share: number
          session_channel_id?: string | null
          session_status?: string
          session_voice_id?: string | null
          slip_url?: string | null
          slip_verified_at?: string | null
          started_at?: string | null
          ticket_channel_id?: string | null
          total_price: number
          updated_at?: string | null
        }
        Update: {
          counselor_id?: string | null
          counselor_share?: number
          created_at?: string | null
          customer_id?: string
          duration_minutes?: number
          ended_at?: string | null
          grace_period_minutes?: number | null
          guild_id?: string
          id?: number
          is_booster?: boolean | null
          is_silent?: boolean | null
          is_specific_counselor?: boolean | null
          order_code?: string
          package_name?: string | null
          package_tier?: string
          payment_status?: string
          platform_share?: number
          session_channel_id?: string | null
          session_status?: string
          session_voice_id?: string | null
          slip_url?: string | null
          slip_verified_at?: string | null
          started_at?: string | null
          ticket_channel_id?: string | null
          total_price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      heal_jai_payouts: {
        Row: {
          amount: number
          counselor_id: string
          created_at: string | null
          guild_id: string
          id: number
          notes: string | null
          paid_at: string | null
          payout_account: string | null
          period_end: string
          status: string
        }
        Insert: {
          amount: number
          counselor_id: string
          created_at?: string | null
          guild_id: string
          id?: number
          notes?: string | null
          paid_at?: string | null
          payout_account?: string | null
          period_end: string
          status?: string
        }
        Update: {
          amount?: number
          counselor_id?: string
          created_at?: string | null
          guild_id?: string
          id?: number
          notes?: string | null
          paid_at?: string | null
          payout_account?: string | null
          period_end?: string
          status?: string
        }
        Relationships: []
      }
      heal_jai_reviews: {
        Row: {
          comment: string | null
          counselor_id: string
          created_at: string | null
          customer_id: string
          guild_id: string
          id: number
          is_anonymous: boolean | null
          order_id: number | null
          public_message_id: string | null
          rating: number
        }
        Insert: {
          comment?: string | null
          counselor_id: string
          created_at?: string | null
          customer_id: string
          guild_id: string
          id?: number
          is_anonymous?: boolean | null
          order_id?: number | null
          public_message_id?: string | null
          rating: number
        }
        Update: {
          comment?: string | null
          counselor_id?: string
          created_at?: string | null
          customer_id?: string
          guild_id?: string
          id?: number
          is_anonymous?: boolean | null
          order_id?: number | null
          public_message_id?: string | null
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "heal_jai_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "heal_jai_orders_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      heal_jai_tickets: {
        Row: {
          channel_id: string
          created_at: string | null
          guild_id: string
          id: number
          notice_message_id: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          guild_id: string
          id?: number
          notice_message_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          guild_id?: string
          id?: number
          notice_message_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      healing_messages: {
        Row: {
          author_id: string
          created_at: string
          id: string
          message: string
          status: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          message: string
          status?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          message?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "healing_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          item_key: string
          max_stack: number
          name: string
          rarity: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          item_key: string
          max_stack?: number
          name: string
          rarity?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          item_key?: string
          max_stack?: number
          name?: string
          rarity?: string
        }
        Relationships: []
      }
      lootlabs_box_transactions: {
        Row: {
          box_id: number
          click_id: string
          completed_at: string | null
          created_at: string | null
          discord_user_id: string
          expires_at: string
          guild_id: string | null
          id: number
          lootlabs_unique_id: string | null
          reward_amount: number | null
          reward_type: string | null
          status: string
        }
        Insert: {
          box_id: number
          click_id: string
          completed_at?: string | null
          created_at?: string | null
          discord_user_id: string
          expires_at: string
          guild_id?: string | null
          id?: number
          lootlabs_unique_id?: string | null
          reward_amount?: number | null
          reward_type?: string | null
          status?: string
        }
        Update: {
          box_id?: number
          click_id?: string
          completed_at?: string | null
          created_at?: string | null
          discord_user_id?: string
          expires_at?: string
          guild_id?: string | null
          id?: number
          lootlabs_unique_id?: string | null
          reward_amount?: number | null
          reward_type?: string | null
          status?: string
        }
        Relationships: []
      }
      member_dm_status: {
        Row: {
          dm_status: string
          last_checked_at: string
          last_error: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          dm_status?: string
          last_checked_at?: string
          last_error?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          dm_status?: string
          last_checked_at?: string
          last_error?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      member_roles: {
        Row: {
          discord_id: string
          granted_at: string
          role_id: string
          source: string
        }
        Insert: {
          discord_id: string
          granted_at?: string
          role_id: string
          source?: string
        }
        Update: {
          discord_id?: string
          granted_at?: string
          role_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["role_id"]
          },
        ]
      }
      minigame_active_sessions: {
        Row: {
          channel_id: string
          current_question: Json
          game_id: number
          message_id: string | null
          updated_at: string
        }
        Insert: {
          channel_id: string
          current_question: Json
          game_id: number
          message_id?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string
          current_question?: Json
          game_id?: number
          message_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      minigame_change_requests: {
        Row: {
          action_type: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          game_id: number
          id: string
          new_data: Json
          old_data: Json | null
          question_id: number | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requested_by: string
          requested_by_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_type: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          game_id: number
          id?: string
          new_data?: Json
          old_data?: Json | null
          question_id?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_by: string
          requested_by_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          game_id?: number
          id?: string
          new_data?: Json
          old_data?: Json | null
          question_id?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_by?: string
          requested_by_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "minigame_change_requests_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "minigame_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      minigame_questions: {
        Row: {
          answer: string
          category: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          deleted_by: string | null
          deleted_by_name: string | null
          difficulty: string | null
          game_id: number
          hints: Json | null
          id: number
          is_active: boolean | null
          options: Json | null
          pending_request_id: string | null
          pre_validated_mask: string | null
          status: string
          updated_at: string | null
          updated_by: string | null
          updated_by_name: string | null
          word_or_question: string
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
          difficulty?: string | null
          game_id: number
          hints?: Json | null
          id?: number
          is_active?: boolean | null
          options?: Json | null
          pending_request_id?: string | null
          pre_validated_mask?: string | null
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_by_name?: string | null
          word_or_question: string
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
          difficulty?: string | null
          game_id?: number
          hints?: Json | null
          id?: number
          is_active?: boolean | null
          options?: Json | null
          pending_request_id?: string | null
          pre_validated_mask?: string | null
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_by_name?: string | null
          word_or_question?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_minigame_questions_pending_request"
            columns: ["pending_request_id"]
            isOneToOne: false
            referencedRelation: "minigame_change_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      minigame_settings: {
        Row: {
          channel_id: string
          game_id: number
          game_name: string
          is_enabled: boolean | null
          max_points: number | null
          min_points: number | null
          updated_at: string | null
        }
        Insert: {
          channel_id: string
          game_id: number
          game_name: string
          is_enabled?: boolean | null
          max_points?: number | null
          min_points?: number | null
          updated_at?: string | null
        }
        Update: {
          channel_id?: string
          game_id?: number
          game_name?: string
          is_enabled?: boolean | null
          max_points?: number | null
          min_points?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      minigame_wins: {
        Row: {
          created_at: string | null
          discord_id: string
          game_id: number
          id: number
          points_earned: number
        }
        Insert: {
          created_at?: string | null
          discord_id: string
          game_id: number
          id?: number
          points_earned?: number
        }
        Update: {
          created_at?: string | null
          discord_id?: string
          game_id?: number
          id?: number
          points_earned?: number
        }
        Relationships: []
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
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          id: string
          log_timestamp: string
          member_id: string
          recipient_id: string | null
          slip_url: string | null
          slip_url_2: string | null
          staff_id: string | null
          total_amount: number
          transaction_date: string
          type_bill: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          log_timestamp?: string
          member_id: string
          recipient_id?: string | null
          slip_url?: string | null
          slip_url_2?: string | null
          staff_id?: string | null
          total_amount?: number
          transaction_date: string
          type_bill?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          log_timestamp?: string
          member_id?: string
          recipient_id?: string | null
          slip_url?: string | null
          slip_url_2?: string | null
          staff_id?: string | null
          total_amount?: number
          transaction_date?: string
          type_bill?: string | null
        }
        Relationships: []
      }
      processed_events: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: []
      }
      product_catalog: {
        Row: {
          created_at: string
          current_price: number | null
          display_name: string
          id: string
          is_active: boolean
          is_purchasable: boolean
          product_type: Database["public"]["Enums"]["product_type"]
          role_id: string | null
        }
        Insert: {
          created_at?: string
          current_price?: number | null
          display_name: string
          id?: string
          is_active?: boolean
          is_purchasable?: boolean
          product_type?: Database["public"]["Enums"]["product_type"]
          role_id?: string | null
        }
        Update: {
          created_at?: string
          current_price?: number | null
          display_name?: string
          id?: string
          is_active?: boolean
          is_purchasable?: boolean
          product_type?: Database["public"]["Enums"]["product_type"]
          role_id?: string | null
        }
        Relationships: []
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
          nickname: string | null
          role: string
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
          id: string
          is_banned?: boolean
          last_session_at?: string | null
          nickname?: string | null
          role?: string
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
          nickname?: string | null
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      promotion_reminder_logs: {
        Row: {
          id: string
          month: number
          reminder_type: string
          sent_at: string | null
          user_id: string | null
          week_number: number
          year: number
        }
        Insert: {
          id?: string
          month: number
          reminder_type: string
          sent_at?: string | null
          user_id?: string | null
          week_number: number
          year: number
        }
        Update: {
          id?: string
          month?: number
          reminder_type?: string
          sent_at?: string | null
          user_id?: string | null
          week_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotion_reminder_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_submissions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          count: number
          created_at: string | null
          discord_id: string
          id: string
          images: string[]
          month: number
          notes: string | null
          points_awarded: number | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          submission_type: string
          updated_at: string | null
          user_id: string | null
          week_number: number
          year: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          count?: number
          created_at?: string | null
          discord_id: string
          id?: string
          images?: string[]
          month: number
          notes?: string | null
          points_awarded?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          submission_type: string
          updated_at?: string | null
          user_id?: string | null
          week_number: number
          year: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          count?: number
          created_at?: string | null
          discord_id?: string
          id?: string
          images?: string[]
          month?: number
          notes?: string | null
          points_awarded?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          submission_type?: string
          updated_at?: string | null
          user_id?: string | null
          week_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotion_submissions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_submissions_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          id: string
          is_promotion: boolean
          order_id: string
          original_price: number | null
          price_paid: number
          product_id: string
        }
        Insert: {
          id?: string
          is_promotion?: boolean
          order_id: string
          original_price?: number | null
          price_paid?: number
          product_id: string
        }
        Update: {
          id?: string
          is_promotion?: boolean
          order_id?: string
          original_price?: number | null
          price_paid?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank: {
        Row: {
          choice_question: string | null
          created_at: string | null
          entertainment_question: string | null
          food_question: string | null
          funny_question: string | null
          game_internet_question: string | null
          general_question: string | null
          hypothetical_question: string | null
          id: number
          love_question: string | null
          preferences_question: string | null
          thoughts_question: string | null
          updated_at: string | null
        }
        Insert: {
          choice_question?: string | null
          created_at?: string | null
          entertainment_question?: string | null
          food_question?: string | null
          funny_question?: string | null
          game_internet_question?: string | null
          general_question?: string | null
          hypothetical_question?: string | null
          id?: never
          love_question?: string | null
          preferences_question?: string | null
          thoughts_question?: string | null
          updated_at?: string | null
        }
        Update: {
          choice_question?: string | null
          created_at?: string | null
          entertainment_question?: string | null
          food_question?: string | null
          funny_question?: string | null
          game_internet_question?: string | null
          general_question?: string | null
          hypothetical_question?: string | null
          id?: never
          love_question?: string | null
          preferences_question?: string | null
          thoughts_question?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      question_collect: {
        Row: {
          category: string
          created_at: string | null
          id: number
          question_text: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: never
          question_text: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: never
          question_text?: string
          updated_at?: string | null
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
        Relationships: []
      }
      rent_house_settings: {
        Row: {
          channel_id: string
          co_owner_ids: Json
          created_at: string
          hidden: boolean
          image_url: string | null
          locked: boolean
          owner_id: string
          permission_presets: Json
          trusted_user_ids: Json
          updated_at: string
        }
        Insert: {
          channel_id: string
          co_owner_ids?: Json
          created_at?: string
          hidden?: boolean
          image_url?: string | null
          locked?: boolean
          owner_id: string
          permission_presets?: Json
          trusted_user_ids?: Json
          updated_at?: string
        }
        Update: {
          channel_id?: string
          co_owner_ids?: Json
          created_at?: string
          hidden?: boolean
          image_url?: string | null
          locked?: boolean
          owner_id?: string
          permission_presets?: Json
          trusted_user_ids?: Json
          updated_at?: string
        }
        Relationships: []
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
        ]
      }
      role_migration_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_count: number
          id: string
          initiated_by: string | null
          is_dry_run: boolean
          processed: number
          skip_count: number
          started_at: string | null
          status: string
          success_count: number
          total_members: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_count?: number
          id?: string
          initiated_by?: string | null
          is_dry_run?: boolean
          processed?: number
          skip_count?: number
          started_at?: string | null
          status?: string
          success_count?: number
          total_members?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_count?: number
          id?: string
          initiated_by?: string | null
          is_dry_run?: boolean
          processed?: number
          skip_count?: number
          started_at?: string | null
          status?: string
          success_count?: number
          total_members?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "role_migration_jobs_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_migration_log: {
        Row: {
          discord_user_id: string
          error_message: string | null
          id: string
          job_id: string
          new_role_id: string | null
          old_role_ids: string[]
          processed_at: string
          resolved_old_role_id: string | null
          result_status: string
          username: string | null
        }
        Insert: {
          discord_user_id: string
          error_message?: string | null
          id?: string
          job_id: string
          new_role_id?: string | null
          old_role_ids?: string[]
          processed_at?: string
          resolved_old_role_id?: string | null
          result_status: string
          username?: string | null
        }
        Update: {
          discord_user_id?: string
          error_message?: string | null
          id?: string
          job_id?: string
          new_role_id?: string | null
          old_role_ids?: string[]
          processed_at?: string
          resolved_old_role_id?: string | null
          result_status?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_migration_log_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "role_migration_jobs"
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
      roles_to_delete_on_transfer: {
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
            foreignKeyName: "roles_to_delete_on_transfer_created_by_fkey"
            columns: ["created_by"]
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
      salmon_point_logs: {
        Row: {
          amount_after: number | null
          amount_before: number | null
          bill_id: string
          change_type: string
          created_at: string | null
          delta: number | null
          discord_id: string
          id: string
          new_salmon_point: number | null
          old_salmon_point: number | null
        }
        Insert: {
          amount_after?: number | null
          amount_before?: number | null
          bill_id: string
          change_type: string
          created_at?: string | null
          delta?: number | null
          discord_id: string
          id?: string
          new_salmon_point?: number | null
          old_salmon_point?: number | null
        }
        Update: {
          amount_after?: number | null
          amount_before?: number | null
          bill_id?: string
          change_type?: string
          created_at?: string | null
          delta?: number | null
          discord_id?: string
          id?: string
          new_salmon_point?: number | null
          old_salmon_point?: number | null
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "server_click_stats_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "discord_servers"
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
      server_discovery_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          server_id: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          server_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          server_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_discovery_events_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "discord_servers"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "server_ratings_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "discord_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_saves: {
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
            foreignKeyName: "server_saves_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "discord_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      session_ads: {
        Row: {
          button_emoji: string | null
          button_emoji_animated: boolean | null
          button_emoji_id: string | null
          button_emoji_name: string | null
          button_label: string | null
          created_at: string
          has_button: boolean
          id: string
          image_url: string
          is_active: boolean
          link_url: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          button_emoji?: string | null
          button_emoji_animated?: boolean | null
          button_emoji_id?: string | null
          button_emoji_name?: string | null
          button_label?: string | null
          created_at?: string
          has_button?: boolean
          id?: string
          image_url: string
          is_active?: boolean
          link_url: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          button_emoji?: string | null
          button_emoji_animated?: boolean | null
          button_emoji_id?: string | null
          button_emoji_name?: string | null
          button_label?: string | null
          created_at?: string
          has_button?: boolean
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
      smart_room_presets: {
        Row: {
          blocked_user_ids: string[]
          created_at: string
          hidden: boolean
          id: number
          image_url: string | null
          locked: boolean
          owner_id: string
          permission_presets: Json
          room_name: string | null
          trusted_user_ids: string[]
          updated_at: string
          user_limit: number | null
          zone_id: string
        }
        Insert: {
          blocked_user_ids?: string[]
          created_at?: string
          hidden?: boolean
          id?: number
          image_url?: string | null
          locked?: boolean
          owner_id: string
          permission_presets?: Json
          room_name?: string | null
          trusted_user_ids?: string[]
          updated_at?: string
          user_limit?: number | null
          zone_id?: string
        }
        Update: {
          blocked_user_ids?: string[]
          created_at?: string
          hidden?: boolean
          id?: number
          image_url?: string | null
          locked?: boolean
          owner_id?: string
          permission_presets?: Json
          room_name?: string | null
          trusted_user_ids?: string[]
          updated_at?: string
          user_limit?: number | null
          zone_id?: string
        }
        Relationships: []
      }
      staff_audit_logs: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          id: string
          operator_id: string | null
          operator_name: string | null
          staff_member_id: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          id?: string
          operator_id?: string | null
          operator_name?: string | null
          staff_member_id?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          id?: string
          operator_id?: string | null
          operator_name?: string | null
          staff_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_audit_logs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_audit_logs_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_level_history: {
        Row: {
          changed_at: string | null
          from_level_id: string | null
          id: string
          operator_id: string | null
          reason: string
          staff_member_id: string
          to_level_id: string | null
        }
        Insert: {
          changed_at?: string | null
          from_level_id?: string | null
          id?: string
          operator_id?: string | null
          reason: string
          staff_member_id: string
          to_level_id?: string | null
        }
        Update: {
          changed_at?: string | null
          from_level_id?: string | null
          id?: string
          operator_id?: string | null
          reason?: string
          staff_member_id?: string
          to_level_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_level_history_from_level_id_fkey"
            columns: ["from_level_id"]
            isOneToOne: false
            referencedRelation: "staff_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_level_history_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_level_history_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_level_history_to_level_id_fkey"
            columns: ["to_level_id"]
            isOneToOne: false
            referencedRelation: "staff_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_levels: {
        Row: {
          created_at: string | null
          discord_role_id: string | null
          id: string
          is_active: boolean
          name: string
          next_level_id: string | null
          prev_level_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          discord_role_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          next_level_id?: string | null
          prev_level_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          discord_role_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          next_level_id?: string | null
          prev_level_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_levels_next_level_id_fkey"
            columns: ["next_level_id"]
            isOneToOne: false
            referencedRelation: "staff_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_levels_prev_level_id_fkey"
            columns: ["prev_level_id"]
            isOneToOne: false
            referencedRelation: "staff_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          created_at: string | null
          discord_id: string
          id: string
          intern_end_at: string | null
          intern_start_at: string | null
          joined_at: string
          level_id: string | null
          nickname: string | null
          notes: string | null
          position_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          discord_id: string
          id?: string
          intern_end_at?: string | null
          intern_start_at?: string | null
          joined_at?: string
          level_id?: string | null
          nickname?: string | null
          notes?: string | null
          position_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          discord_id?: string
          id?: string
          intern_end_at?: string | null
          intern_start_at?: string | null
          joined_at?: string
          level_id?: string | null
          nickname?: string | null
          notes?: string | null
          position_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "staff_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "staff_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_positions: {
        Row: {
          color: string | null
          created_at: string | null
          discord_role_id: string
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          discord_role_id: string
          display_order: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          discord_role_id?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      staff_timeline: {
        Row: {
          created_at: string | null
          created_by: string | null
          details: string
          event_type: string
          id: string
          staff_member_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          details: string
          event_type: string
          id?: string
          staff_member_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          details?: string
          event_type?: string
          id?: string
          staff_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_timeline_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_timeline_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      sticky_channels: {
        Row: {
          channel_id: string
          created_at: string
          delay_ms: number
          last_message_id: string | null
          payload: Json
          refresh_trigger: number
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          delay_ms?: number
          last_message_id?: string | null
          payload: Json
          refresh_trigger?: number
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          delay_ms?: number
          last_message_id?: string | null
          payload?: Json
          refresh_trigger?: number
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
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
          request_note: string | null
          requested_by: string
          requested_by_name: string | null
          status: Database["public"]["Enums"]["tag_warn_cancel_status"]
          updated_at: string
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
          request_note?: string | null
          requested_by: string
          requested_by_name?: string | null
          status?: Database["public"]["Enums"]["tag_warn_cancel_status"]
          updated_at?: string
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
          request_note?: string | null
          requested_by?: string
          requested_by_name?: string | null
          status?: Database["public"]["Enums"]["tag_warn_cancel_status"]
          updated_at?: string
          warn_sequence?: string | null
          warn_timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_warn_cancel_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_warn_case_logs: {
        Row: {
          after_data: Json | null
          before_data: Json | null
          case_id: string
          created_at: string
          details: string
          id: string
          operator_avatar: string | null
          operator_id: string
          operator_name: string
        }
        Insert: {
          after_data?: Json | null
          before_data?: Json | null
          case_id: string
          created_at?: string
          details: string
          id?: string
          operator_avatar?: string | null
          operator_id: string
          operator_name: string
        }
        Update: {
          after_data?: Json | null
          before_data?: Json | null
          case_id?: string
          created_at?: string
          details?: string
          id?: string
          operator_avatar?: string | null
          operator_id?: string
          operator_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_warn_case_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "tag_warn_logs"
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
      tag_warn_templates: {
        Row: {
          created_at: string
          created_by: string
          id: string
          message: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          message: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          message?: string
          title?: string
          updated_at?: string
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
      trading_history_case_logs: {
        Row: {
          after_data: Json | null
          before_data: Json | null
          created_at: string
          details: string
          id: string
          operator_avatar: string | null
          operator_id: string
          operator_name: string
          record_id: string
          record_source: string
        }
        Insert: {
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          details: string
          id?: string
          operator_avatar?: string | null
          operator_id: string
          operator_name: string
          record_id: string
          record_source: string
        }
        Update: {
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          details?: string
          id?: string
          operator_avatar?: string | null
          operator_id?: string
          operator_name?: string
          record_id?: string
          record_source?: string
        }
        Relationships: []
      }
      user_color_roles: {
        Row: {
          color_code: string
          discord_id: string
          updated_at: string
        }
        Insert: {
          color_code: string
          discord_id: string
          updated_at?: string
        }
        Update: {
          color_code?: string
          discord_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_cooldowns: {
        Row: {
          command: string
          discord_id: string
          expires_at: number
        }
        Insert: {
          command: string
          discord_id: string
          expires_at: number
        }
        Update: {
          command?: string
          discord_id?: string
          expires_at?: number
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
            foreignKeyName: "fk_permission_id"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "custom_permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_inventories: {
        Row: {
          id: string
          item_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inventories_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inventories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notify_buffer: {
        Row: {
          last_sent_at: string
          pending_points: number
          user_id: string
        }
        Insert: {
          last_sent_at?: string
          pending_points?: number
          user_id: string
        }
        Update: {
          last_sent_at?: string
          pending_points?: number
          user_id?: string
        }
        Relationships: []
      }
      user_points: {
        Row: {
          cakes: number
          daily_points: number
          discord_id: string
          last_reset_date: string | null
          max_cap: number
          mission_claimed: boolean
          points: number
          salmon_point: number
          tarot_point: number
          ticket_piece_point: number
          ticket_point: number
          updated_at: string | null
        }
        Insert: {
          cakes?: number
          daily_points?: number
          discord_id: string
          last_reset_date?: string | null
          max_cap?: number
          mission_claimed?: boolean
          points?: number
          salmon_point?: number
          tarot_point?: number
          ticket_piece_point?: number
          ticket_point?: number
          updated_at?: string | null
        }
        Update: {
          cakes?: number
          daily_points?: number
          discord_id?: string
          last_reset_date?: string | null
          max_cap?: number
          mission_claimed?: boolean
          points?: number
          salmon_point?: number
          tarot_point?: number
          ticket_piece_point?: number
          ticket_point?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vip_active_rooms: {
        Row: {
          channel_id: string
          channel_name: string | null
          created_at: string
          empty_at: number | null
          guild_id: string | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          channel_name?: string | null
          created_at?: string
          empty_at?: number | null
          guild_id?: string | null
          owner_id: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          channel_name?: string | null
          created_at?: string
          empty_at?: number | null
          guild_id?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      voice_logs: {
        Row: {
          channel_id: string
          channel_name: string | null
          event_type: string
          from_channel_id: string | null
          from_channel_name: string | null
          id: number
          timestamp: string
          user_id: string
          username: string | null
        }
        Insert: {
          channel_id: string
          channel_name?: string | null
          event_type: string
          from_channel_id?: string | null
          from_channel_name?: string | null
          id?: number
          timestamp?: string
          user_id: string
          username?: string | null
        }
        Update: {
          channel_id?: string
          channel_name?: string | null
          event_type?: string
          from_channel_id?: string | null
          from_channel_name?: string | null
          id?: number
          timestamp?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
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
      web_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "web_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      minigame_leaderboard_summary: {
        Row: {
          discord_id: string | null
          last_win: string | null
          points: number | null
          wins: number | null
        }
        Relationships: []
      }
      v_all_bills: {
        Row: {
          bill_source: string | null
          created_at: string | null
          id: string | null
          log_timestamp: string | null
          member_id: string | null
          slip_url: string | null
          slip_url_2: string | null
          staff_id: string | null
          total_amount: number | null
          transaction_date_str: string | null
          type_bill: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_inventory_item_to_user: {
        Args: {
          p_item_id: string
          p_note?: string
          p_qty: number
          p_source?: string
          p_user_id: string
        }
        Returns: undefined
      }
      add_tarot_points: {
        Args: {
          p_discord_id: string
          p_points_delta: number
          p_tarot_delta: number
        }
        Returns: {
          new_points: number
          new_tarot_point: number
        }[]
      }
      approve_promotion_submission: {
        Args: { p_operator_id: string; p_submission_id: string }
        Returns: Json
      }
      attempt_match: {
        Args: { p_category_id: string; p_role_id: string; p_user_id: string }
        Returns: {
          matched_user_id: string
          session_id: string
          success: boolean
        }[]
      }
      batch_approve_minigame_requests: {
        Args: {
          _approver_id: string
          _approver_name?: string
          _request_ids: string[]
        }
        Returns: Json
      }
      batch_reject_minigame_requests: {
        Args: { _reason?: string; _rejecter_id: string; _request_ids: string[] }
        Returns: Json
      }
      clean_old_dm_broadcast_logs: {
        Args: { days_older?: number }
        Returns: number
      }
      cleanup_old_sessions: { Args: never; Returns: undefined }
      cleanup_stale_queue: { Args: never; Returns: undefined }
      deduct_points_safe: {
        Args: { p_amount: number; p_user_id: string }
        Returns: Json
      }
      get_discovery_analytics_summary: {
        Args: { p_days?: number }
        Returns: {
          authenticated_clicks: number
          ctr: number
          guest_clicks: number
          join_rate: number
          save_rate: number
          source: string
          total_clicks: number
          total_impressions: number
          total_saves: number
          total_views: number
          view_rate: number
        }[]
      }
      get_discovery_trending_scores: {
        Args: { p_days?: number }
        Returns: {
          discovery_score: number
          growth_rate: number
          is_new_breakout: boolean
          is_rising: boolean
          previous_clicks: number
          previous_saves: number
          recent_clicks: number
          recent_saves: number
          server_id: string
        }[]
      }
      get_jwt_discord_id: { Args: never; Returns: string }
      get_minigame_leaderboard: {
        Args: {
          days_limit?: number
          end_time?: string
          filter_game_id?: number
          start_time?: string
        }
        Returns: {
          discord_id: string
          last_win: string
          points: number
          wins: number
        }[]
      }
      get_personalized_recommendations: {
        Args: { p_limit?: number }
        Returns: {
          is_exploration: boolean
          recommendation_reason: string
          recommendation_score: number
          server_id: string
          user_state: string
        }[]
      }
      get_profile_by_discord_id: {
        Args: { _discord_id: string }
        Returns: string
      }
      get_random_healing_message: {
        Args: never
        Returns: {
          avatar_url: string
          discord_id: string
          message: string
          username: string
        }[]
      }
      has_any_page_access: {
        Args: { _pages: string[]; _user_id: string }
        Returns: boolean
      }
      has_page_access:
        | { Args: { _page: string }; Returns: boolean }
        | { Args: { _page: string; _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_impression: { Args: { _server_id: string }; Returns: undefined }
      is_owner: { Args: never; Returns: boolean }
      jwt_has_page_access: { Args: { _page: string }; Returns: boolean }
      release_bartender_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      release_stale_bartenders: { Args: never; Returns: number }
      rollback_promotion_approval: {
        Args: { p_operator_id: string; p_submission_id: string }
        Returns: boolean
      }
      toggle_server_save: {
        Args: { _server_id: string; _user_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      checkin_action: "daily" | "makeup" | "big_reward"
      checkin_reward_type:
        | "points"
        | "ticket_point"
        | "ticket_piece_point"
        | "role"
      product_type:
        | "class_role"
        | "decoration_role"
        | "rental"
        | "promo_package"
        | "other"
      report_status: "open" | "investigating" | "resolved" | "dismissed"
      report_type:
        | "inappropriate_behavior"
        | "adult_content"
        | "spam"
        | "harassment"
        | "other"
      secret_chat_event:
        | "session_start"
        | "session_end"
        | "user_leave"
        | "user_join_queue"
        | "user_cancel_queue"
        | "report_sent"
        | "report_claimed"
        | "channel_deleted"
      tag_warn_cancel_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "moderator", "user"],
      checkin_action: ["daily", "makeup", "big_reward"],
      checkin_reward_type: [
        "points",
        "ticket_point",
        "ticket_piece_point",
        "role",
      ],
      product_type: [
        "class_role",
        "decoration_role",
        "rental",
        "promo_package",
        "other",
      ],
      report_status: ["open", "investigating", "resolved", "dismissed"],
      report_type: [
        "inappropriate_behavior",
        "adult_content",
        "spam",
        "harassment",
        "other",
      ],
      secret_chat_event: [
        "session_start",
        "session_end",
        "user_leave",
        "user_join_queue",
        "user_cancel_queue",
        "report_sent",
        "report_claimed",
        "channel_deleted",
      ],
      tag_warn_cancel_status: ["pending", "approved", "rejected"],
    },
  },
} as const
