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
    public: {
        Tables: {
            bank_accounts: {
                Row: {
                    color: string
                    created_at: string
                    current_balance: number
                    currency_code: string
                    group_id: string
                    id: string
                    is_visible: boolean
                    name: string
                    type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'cash' | 'other'
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    color?: string
                    created_at?: string
                    current_balance?: number
                    currency_code: string
                    group_id?: string
                    id?: string
                    is_visible?: boolean
                    name: string
                    type?: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'cash' | 'other'
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    color?: string
                    created_at?: string
                    current_balance?: number
                    currency_code?: string
                    group_id?: string
                    id?: string
                    is_visible?: boolean
                    name?: string
                    type?: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'cash' | 'other'
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
                    }
                ]
            }
            categories: {
                Row: {
                    color: string
                    created_at: string
                    id: string
                    name: string
                    parent_id: string | null
                    type: 'income' | 'expense'
                    updated_at: string
                    user_id: string | null
                }
                Insert: {
                    color: string
                    created_at?: string
                    id?: string
                    name: string
                    parent_id?: string | null
                    type?: 'income' | 'expense'
                    updated_at?: string
                    user_id?: string | null
                }
                Update: {
                    color?: string
                    created_at?: string
                    id?: string
                    name?: string
                    parent_id?: string | null
                    type?: 'income' | 'expense'
                    updated_at?: string
                    user_id?: string | null
                }
                Relationships: []
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
            transaction_inbox: {
                Row: {
                    id: string
                    user_id: string
                    amount: number
                    currency: string
                    description: string
                    date: string | null
                    source_text: string | null
                    account_id: string | null
                    category_id: string | null
                    exchange_rate: number | null
                    status: 'pending' | 'processed' | 'ignored'
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    amount: number
                    currency?: string
                    description: string
                    date?: string | null
                    source_text?: string | null
                    account_id?: string | null
                    category_id?: string | null
                    exchange_rate?: number | null
                    status?: 'pending' | 'processed' | 'ignored'
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    amount?: number
                    currency?: string
                    description?: string
                    date?: string | null
                    source_text?: string | null
                    account_id?: string | null
                    category_id?: string | null
                    exchange_rate?: number | null
                    status?: 'pending' | 'processed' | 'ignored'
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            }
            transactions: {
                Row: {
                    account_id: string
                    amount_home: number
                    amount_original: number
                    category_id: string | null
                    created_at: string
                    currency_original: string
                    date: string
                    description: string | null
                    exchange_rate: number
                    id: string
                    notes: string | null
                    transfer_id: string | null
                    type: 'income' | 'expense' | 'opening_balance' | null
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    account_id: string
                    amount_home: number
                    amount_original: number
                    category_id?: string | null
                    created_at?: string
                    currency_original: string
                    date?: string
                    description?: string | null
                    exchange_rate?: number
                    id?: string
                    notes?: string | null
                    transfer_id?: string | null
                    type?: 'income' | 'expense' | 'opening_balance' | null
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    account_id?: string
                    amount_home?: number
                    amount_original?: number
                    category_id?: string | null
                    created_at?: string
                    currency_original?: string
                    date?: string
                    description?: string | null
                    exchange_rate?: number
                    id?: string
                    notes?: string | null
                    transfer_id?: string | null
                    type?: 'income' | 'expense' | 'opening_balance' | null
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "transactions_account_id_fkey"
                        columns: ["account_id"]
                        isOneToOne: false
                        referencedRelation: "account_balances"
                        referencedColumns: ["account_id"]
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
                ]
            }
            user_settings: {
                Row: {
                    created_at: string
                    main_currency: string | null
                    start_of_week: number | null
                    theme: string | null
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    main_currency?: string | null
                    start_of_week?: number | null
                    theme?: string | null
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    main_currency?: string | null
                    start_of_week?: number | null
                    theme?: string | null
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
            account_balances: {
                Row: {
                    account_id: string | null
                    group_id: string | null
                    name: string | null
                    currency_code: string | null
                    type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'cash' | 'other' | null
                    current_balance: number | null
                }
                Relationships: []
            }
            categories_with_counts: {
                Row: {
                    color: string | null
                    created_at: string | null
                    id: string | null
                    name: string | null
                    parent_id: string | null
                    transaction_count: number | null
                    type: 'income' | 'expense' | null
                    updated_at: string | null
                    user_id: string | null
                }
                Relationships: []
            }
            parent_categories_with_counts: {
                Row: {
                    color: string
                    created_at: string
                    id: string
                    name: string
                    parent_id: string | null
                    transaction_count: number
                    type: 'income' | 'expense'
                    updated_at: string
                    user_id: string | null
                }
                Relationships: []
            }
            transactions_view: {
                Row: {
                    account_id: string | null
                    account_name: string | null
                    amount_home: number | null
                    amount_original: number | null
                    category_color: string | null
                    category_id: string | null
                    category_name: string | null
                    created_at: string | null
                    currency_original: string | null
                    date: string | null
                    description: string | null
                    exchange_rate: number | null
                    id: string | null
                    notes: string | null
                    updated_at: string | null
                    user_id: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "transactions_account_id_fkey"
                        columns: ["account_id"]
                        isOneToOne: false
                        referencedRelation: "account_balances"
                        referencedColumns: ["account_id"]
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
                ]
            }
        }
        Functions: {
            clear_user_data: { Args: { p_user_id: string }; Returns: undefined }
            create_account_group: {
                Args: {
                    p_user_id: string
                    p_name: string
                    p_color: string
                    p_type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'cash' | 'other'
                    p_currencies: string[]
                }
                Returns: Json
            }
            create_transfer: {
                Args: {
                    p_amount: number
                    p_category_id?: string
                    p_currency_original: string
                    p_date: string
                    p_description: string
                    p_exchange_rate: number
                    p_from_account_id: string
                    p_to_account_id: string
                    p_user_id: string
                }
                Returns: Json
            }
            delete_transfer: {
                Args: { p_transfer_id: string; p_user_id: string }
                Returns: undefined
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
            import_transactions: {
                Args: {
                    p_default_account_color: string
                    p_default_category_color: string
                    p_transactions: Json
                    p_user_id: string
                }
                Returns: Json
            }
            replace_account_currency: {
                Args: {
                    p_account_id: string
                    p_new_currency_code: string
                    p_new_starting_balance: number
                    p_old_currency_code: string
                }
                Returns: undefined
            }
            promote_inbox_item: {
                Args: {
                    p_inbox_id: string
                    p_account_id: string
                    p_category_id: string
                    p_final_description?: string
                    p_final_date?: string
                    p_final_amount?: number
                }
                Returns: Json
            }
            reconcile_account_balance: {
                Args: {
                    p_account_id: string
                    p_new_balance: number
                    p_date?: string
                }
                Returns: string
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
            transaction_type:
            | "income"
            | "expense"
            | "opening_balance"
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
            transaction_type: [
                "income",
                "expense",
                "opening_balance",
            ],
        },
    },
} as const
