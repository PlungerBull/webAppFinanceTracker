Initialising login role...
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
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          color: string
          created_at: string
          currency_code: string
          current_balance: number
          group_id: string
          id: string
          is_visible: boolean
          name: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          currency_code?: string
          current_balance?: number
          group_id?: string
          id?: string
          is_visible?: boolean
          name: string
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          currency_code?: string
          current_balance?: number
          group_id?: string
          id?: string
          is_visible?: boolean
          name?: string
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "global_currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_categories_with_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      global_currencies: {
        Row: {
          code: string
          flag: string | null
          name: string
          symbol: string
        }
        Insert: {
          code: string
          flag?: string | null
          name: string
          symbol: string
        }
        Update: {
          code?: string
          flag?: string | null
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      reconciliations: {
        Row: {
          account_id: string
          beginning_balance: number
          created_at: string
          date_end: string | null
          date_start: string | null
          ending_balance: number
          id: string
          name: string
          status: Database["public"]["Enums"]["reconciliation_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          beginning_balance: number
          created_at?: string
          date_end?: string | null
          date_start?: string | null
          ending_balance: number
          id?: string
          name: string
          status?: Database["public"]["Enums"]["reconciliation_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          beginning_balance?: number
          created_at?: string
          date_end?: string | null
          date_start?: string | null
          ending_balance?: number
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["reconciliation_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_inbox: {
        Row: {
          account_id: string | null
          amount_original: number | null
          category_id: string | null
          created_at: string
          date: string | null
          description: string | null
          exchange_rate: number | null
          id: string
          notes: string | null
          source_text: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount_original?: number | null
          category_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          source_text?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount_original?: number | null
          category_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          source_text?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_inbox_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_inbox_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_inbox_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_inbox_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "parent_categories_with_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount_cents: number | null
          amount_home_cents: number | null
          category_id: string | null
          cleared: boolean
          created_at: string
          date: string
          deleted_at: string | null
          description: string | null
          exchange_rate: number
          id: string
          inbox_id: string | null
          notes: string | null
          reconciliation_id: string | null
          source_text: string | null
          transfer_id: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          account_id: string
          amount_cents?: number | null
          amount_home_cents?: number | null
          category_id?: string | null
          cleared?: boolean
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string | null
          exchange_rate?: number
          id?: string
          inbox_id?: string | null
          notes?: string | null
          reconciliation_id?: string | null
          source_text?: string | null
          transfer_id?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          account_id?: string
          amount_cents?: number | null
          amount_home_cents?: number | null
          category_id?: string | null
          cleared?: boolean
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string | null
          exchange_rate?: number
          id?: string
          inbox_id?: string | null
          notes?: string | null
          reconciliation_id?: string | null
          source_text?: string | null
          transfer_id?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_transactions_inbox"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "transaction_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_transactions_inbox"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "transaction_inbox_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "parent_categories_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          main_currency: string | null
          start_of_week: number | null
          theme: string | null
          transaction_sort_preference: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          main_currency?: string | null
          start_of_week?: number | null
          theme?: string | null
          transaction_sort_preference?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          main_currency?: string | null
          start_of_week?: number | null
          theme?: string | null
          transaction_sort_preference?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_main_currency_fkey"
            columns: ["main_currency"]
            isOneToOne: false
            referencedRelation: "global_currencies"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Views: {
      categories_with_counts: {
        Row: {
          id: string | null
          name: string | null
          parent_id: string | null
          transaction_count: number | null
          type: Database["public"]["Enums"]["transaction_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_categories_with_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_categories_with_counts: {
        Row: {
          color: string | null
          created_at: string | null
          id: string | null
          name: string | null
          parent_id: string | null
          transaction_count: number | null
          type: Database["public"]["Enums"]["transaction_type"] | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_categories_with_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_inbox_view: {
        Row: {
          account_color: string | null
          account_id: string | null
          account_name: string | null
          amount_original: number | null
          category_color: string | null
          category_id: string | null
          category_name: string | null
          category_type: Database["public"]["Enums"]["transaction_type"] | null
          created_at: string | null
          currency_original: string | null
          date: string | null
          description: string | null
          exchange_rate: number | null
          id: string | null
          notes: string | null
          source_text: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_currency_code_fkey"
            columns: ["currency_original"]
            isOneToOne: false
            referencedRelation: "global_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transaction_inbox_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_inbox_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_inbox_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_inbox_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "parent_categories_with_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions_view: {
        Row: {
          account_color: string | null
          account_currency: string | null
          account_id: string | null
          account_name: string | null
          amount_cents: number | null
          amount_home_cents: number | null
          category_color: string | null
          category_id: string | null
          category_name: string | null
          category_type: Database["public"]["Enums"]["transaction_type"] | null
          cleared: boolean | null
          created_at: string | null
          currency_original: string | null
          date: string | null
          deleted_at: string | null
          description: string | null
          exchange_rate: number | null
          id: string | null
          inbox_id: string | null
          notes: string | null
          reconciliation_id: string | null
          reconciliation_status:
            | Database["public"]["Enums"]["reconciliation_status"]
            | null
          source_text: string | null
          transfer_id: string | null
          updated_at: string | null
          user_id: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_currency_code_fkey"
            columns: ["currency_original"]
            isOneToOne: false
            referencedRelation: "global_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bank_accounts_currency_code_fkey"
            columns: ["account_currency"]
            isOneToOne: false
            referencedRelation: "global_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fk_transactions_inbox"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "transaction_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_transactions_inbox"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "transaction_inbox_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "parent_categories_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      bulk_update_transactions: {
        Args: {
          p_transaction_ids: string[]
          p_updates: Json
          p_versions: number[]
        }
        Returns: Json
      }
      cleanup_orphaned_categories: {
        Args: never
        Returns: {
          category_id: string
          category_name: string
          was_orphaned: boolean
        }[]
      }
      clear_user_data: { Args: { p_user_id: string }; Returns: undefined }
      create_account: {
        Args: {
          p_account_color: string
          p_account_name: string
          p_account_type?: Database["public"]["Enums"]["account_type"]
          p_currency_code: string
          p_starting_balance?: number
        }
        Returns: Json
      }
      create_account_group: {
        Args: {
          p_color: string
          p_currencies: string[]
          p_name: string
          p_type: Database["public"]["Enums"]["account_type"]
          p_user_id: string
        }
        Returns: Json
      }
      create_transfer:
        | {
            Args: {
              p_amount: number
              p_amount_received: number
              p_category_id?: string
              p_date: string
              p_description: string
              p_exchange_rate: number
              p_from_account_id: string
              p_to_account_id: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_amount: number
              p_amount_received: number
              p_category_id: string
              p_date: string
              p_description: string
              p_exchange_rate: number
              p_from_account_id: string
              p_from_currency: string
              p_to_account_id: string
              p_to_currency: string
              p_user_id: string
            }
            Returns: Json
          }
      create_transfer_transaction: {
        Args: {
          p_amount_cents: number
          p_date: string
          p_description?: string
          p_from_account_id: string
          p_notes?: string
          p_to_account_id: string
          p_user_id: string
        }
        Returns: Json
      }
      delete_transaction_with_version: {
        Args: { p_expected_version: number; p_transaction_id: string }
        Returns: Json
      }
      delete_transfer: {
        Args: { p_transfer_id: string; p_user_id: string }
        Returns: undefined
      }
      get_deleted_transactions: {
        Args: { p_since_version?: number; p_user_id: string }
        Returns: {
          account_color: string
          account_currency: string
          account_id: string
          account_name: string
          amount_home: number
          amount_original: number
          category_color: string
          category_id: string
          category_name: string
          category_type: string
          cleared: boolean
          created_at: string
          currency_original: string
          date: string
          deleted_at: string
          description: string
          exchange_rate: number
          id: string
          inbox_id: string
          notes: string
          reconciliation_id: string
          reconciliation_status: string
          source_text: string
          transfer_id: string
          updated_at: string
          user_id: string
          version: number
        }[]
      }
      get_monthly_spending_by_category:
        | {
            Args: { p_months_back?: number; p_user_id?: string }
            Returns: {
              category_color: string
              category_id: string
              category_name: string
              month_key: string
              total_amount: number
            }[]
          }
        | {
            Args: { p_months_back?: number; p_user_id: string }
            Returns: {
              category_icon: string
              category_id: string
              category_name: string
              month_key: string
              total_amount: number
            }[]
          }
      get_reconciliation_summary: {
        Args: { p_reconciliation_id: string }
        Returns: Json
      }
      import_transactions: {
        Args: {
          p_default_account_color: string
          p_default_category_color: string
          p_general_label?: string
          p_transactions: Json
          p_uncategorized_label?: string
          p_user_id: string
        }
        Returns: Json
      }
      link_transactions_to_reconciliation: {
        Args: { p_reconciliation_id: string; p_transaction_ids: string[] }
        Returns: Json
      }
      merge_categories: {
        Args: { p_source_ids: string[]; p_target_id: string }
        Returns: Json
      }
      promote_inbox_item:
        | {
            Args: {
              p_account_id: string
              p_category_id: string
              p_final_amount?: number
              p_final_date?: string
              p_final_description?: string
              p_inbox_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_account_id: string
              p_category_id: string
              p_exchange_rate?: number
              p_final_amount?: number
              p_final_date?: string
              p_final_description?: string
              p_inbox_id: string
            }
            Returns: Json
          }
      reconcile_account_balance: {
        Args: { p_account_id: string; p_date?: string; p_new_balance: number }
        Returns: string
      }
      replace_account_currency: {
        Args: {
          p_account_id: string
          p_new_currency_code: string
          p_old_currency_code: string
        }
        Returns: undefined
      }
      restore_transaction: { Args: { p_transaction_id: string }; Returns: Json }
      unlink_transactions_from_reconciliation: {
        Args: { p_transaction_ids: string[] }
        Returns: Json
      }
      update_transaction_with_version: {
        Args: {
          p_expected_version: number
          p_transaction_id: string
          p_updates: Json
        }
        Returns: Json
      }
    }
    Enums: {
      account_type:
        | "checking"
        | "savings"
        | "credit_card"
        | "investment"
        | "loan"
        | "cash"
        | "other"
      reconciliation_status: "draft" | "completed"
      transaction_type:
        | "expense"
        | "income"
        | "transfer"
        | "opening_balance"
        | "adjustment"
    }
    CompositeTypes: {
      transaction_import_input: {
        Date: string | null
        Amount: number | null
        Description: string | null
        Category: string | null
        Account: string | null
        Currency: string | null
        "Exchange Rate": number | null
        Notes: string | null
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_type: [
        "checking",
        "savings",
        "credit_card",
        "investment",
        "loan",
        "cash",
        "other",
      ],
      reconciliation_status: ["draft", "completed"],
      transaction_type: [
        "expense",
        "income",
        "transfer",
        "opening_balance",
        "adjustment",
      ],
    },
  },
} as const
A new version of Supabase CLI is available: v2.72.7 (currently installed v2.65.5)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
