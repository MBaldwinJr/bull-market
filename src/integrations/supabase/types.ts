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
      assets: {
        Row: {
          auto_trade_enabled: boolean
          base_asset: string
          created_at: string
          deleted_at: string | null
          id: string
          owner_id: string
          quote_asset: string
          source: string
          status: string
          symbol: string
          updated_at: string
        }
        Insert: {
          auto_trade_enabled?: boolean
          base_asset: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          owner_id: string
          quote_asset: string
          source?: string
          status?: string
          symbol: string
          updated_at?: string
        }
        Update: {
          auto_trade_enabled?: boolean
          base_asset?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          owner_id?: string
          quote_asset?: string
          source?: string
          status?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          entity: string | null
          id: string
          owner_id: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          entity?: string | null
          id?: string
          owner_id: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          entity?: string | null
          id?: string
          owner_id?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_config: {
        Row: {
          allow_withdrawals: boolean
          binance_testnet: boolean
          created_at: string
          id: string
          live_trading_enabled: boolean
          owner_id: string
          source: string
          status: string
          trading_mode: string
          updated_at: string
        }
        Insert: {
          allow_withdrawals?: boolean
          binance_testnet?: boolean
          created_at?: string
          id?: string
          live_trading_enabled?: boolean
          owner_id: string
          source?: string
          status?: string
          trading_mode?: string
          updated_at?: string
        }
        Update: {
          allow_withdrawals?: boolean
          binance_testnet?: boolean
          created_at?: string
          id?: string
          live_trading_enabled?: boolean
          owner_id?: string
          source?: string
          status?: string
          trading_mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      paper_accounts: {
        Row: {
          cash_balance: number
          created_at: string
          first_trade_at: string | null
          id: string
          initial_balance: number
          owner_id: string
          quote_currency: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          cash_balance?: number
          created_at?: string
          first_trade_at?: string | null
          id?: string
          initial_balance?: number
          owner_id: string
          quote_currency?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          cash_balance?: number
          created_at?: string
          first_trade_at?: string | null
          id?: string
          initial_balance?: number
          owner_id?: string
          quote_currency?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      paper_orders: {
        Row: {
          account_id: string
          client_order_id: string
          created_at: string
          executed_at: string | null
          executed_price: number | null
          fee: number
          id: string
          order_type: string
          owner_id: string
          position_id: string | null
          quantity: number
          requested_price: number | null
          side: string
          slippage: number
          source: string
          status: string
          symbol: string
          updated_at: string
        }
        Insert: {
          account_id: string
          client_order_id: string
          created_at?: string
          executed_at?: string | null
          executed_price?: number | null
          fee?: number
          id?: string
          order_type: string
          owner_id: string
          position_id?: string | null
          quantity: number
          requested_price?: number | null
          side: string
          slippage?: number
          source?: string
          status?: string
          symbol: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          client_order_id?: string
          created_at?: string
          executed_at?: string | null
          executed_price?: number | null
          fee?: number
          id?: string
          order_type?: string
          owner_id?: string
          position_id?: string | null
          quantity?: number
          requested_price?: number | null
          side?: string
          slippage?: number
          source?: string
          status?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "paper_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paper_orders_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "paper_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_positions: {
        Row: {
          account_id: string
          closed_at: string | null
          created_at: string
          entry_price: number
          exit_price: number | null
          fees_paid: number
          id: string
          opened_at: string
          owner_id: string
          quantity: number
          realized_pnl: number | null
          side: string
          source: string
          status: string
          stop_loss: number
          strategy_key: string | null
          symbol: string
          take_profit: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          closed_at?: string | null
          created_at?: string
          entry_price: number
          exit_price?: number | null
          fees_paid?: number
          id?: string
          opened_at?: string
          owner_id: string
          quantity: number
          realized_pnl?: number | null
          side?: string
          source?: string
          status?: string
          stop_loss: number
          strategy_key?: string | null
          symbol: string
          take_profit?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          closed_at?: string | null
          created_at?: string
          entry_price?: number
          exit_price?: number | null
          fees_paid?: number
          id?: string
          opened_at?: string
          owner_id?: string
          quantity?: number
          realized_pnl?: number | null
          side?: string
          source?: string
          status?: string
          stop_loss?: number
          strategy_key?: string | null
          symbol?: string
          take_profit?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_positions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "paper_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_snapshots: {
        Row: {
          captured_at: string
          cash: number
          created_at: string
          equity: number
          id: string
          owner_id: string
          realized_pnl: number
          source: string
          status: string
          unrealized_pnl: number
          updated_at: string
        }
        Insert: {
          captured_at?: string
          cash: number
          created_at?: string
          equity: number
          id?: string
          owner_id: string
          realized_pnl?: number
          source?: string
          status?: string
          unrealized_pnl?: number
          updated_at?: string
        }
        Update: {
          captured_at?: string
          cash?: number
          created_at?: string
          equity?: number
          id?: string
          owner_id?: string
          realized_pnl?: number
          source?: string
          status?: string
          unrealized_pnl?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      risk_events: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          message: string
          owner_id: string
          severity: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          message: string
          owner_id: string
          severity?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          message?: string
          owner_id?: string
          severity?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      risk_limits: {
        Row: {
          created_at: string
          id: string
          leverage: number
          max_daily_loss_pct: number
          max_open_positions: number
          max_risk_per_trade_pct: number
          owner_id: string
          source: string
          status: string
          stop_loss_required: boolean
          take_profit_pct: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          leverage?: number
          max_daily_loss_pct?: number
          max_open_positions?: number
          max_risk_per_trade_pct?: number
          owner_id: string
          source?: string
          status?: string
          stop_loss_required?: boolean
          take_profit_pct?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          leverage?: number
          max_daily_loss_pct?: number
          max_open_positions?: number
          max_risk_per_trade_pct?: number
          owner_id?: string
          source?: string
          status?: string
          stop_loss_required?: boolean
          take_profit_pct?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      trading_strategies: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          name: string
          owner_id: string
          parameters: Json
          source: string
          status: string
          strategy_key: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          owner_id: string
          parameters?: Json
          source?: string
          status?: string
          strategy_key: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          owner_id?: string
          parameters?: Json
          source?: string
          status?: string
          strategy_key?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      paper_account_has_activity: {
        Args: { p_account_id: string }
        Returns: boolean
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
