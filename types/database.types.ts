export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          starting_balance: number;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          starting_balance?: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          starting_balance?: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          category_id: string | null;
          date: string;
          description: string | null;
          amount_original: number;
          currency_original: string;
          exchange_rate: number;
          amount_home: number;
          transfer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          category_id?: string | null;
          date?: string;
          description?: string | null;
          amount_original: number;
          currency_original: string;
          exchange_rate?: number;
          amount_home: number;
          transfer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          category_id?: string | null;
          date?: string;
          description?: string | null;
          amount_original?: number;
          currency_original?: string;
          exchange_rate?: number;
          amount_home?: number;
          transfer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          icon: string;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          icon: string;
          color: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          icon?: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      currencies: {
        Row: {
          id: string;
          user_id: string;
          code: string;
          is_main: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          code: string;
          is_main?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          code?: string;
          is_main?: boolean;
          created_at?: string;
        };
      };
      user_settings: {
        Row: {
          user_id: string;
          nickname: string | null;
          theme: 'light' | 'dark' | 'system';
          start_of_week: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          nickname?: string | null;
          theme?: 'light' | 'dark' | 'system';
          start_of_week?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          nickname?: string | null;
          theme?: 'light' | 'dark' | 'system';
          start_of_week?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      account_balances: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          currency: string;
          starting_balance: number;
          transaction_sum: number;
          current_balance: number;
        };
      };
    };
    Functions: {
      create_transfer: {
        Args: {
          p_user_id: string;
          p_from_account_id: string;
          p_to_account_id: string;
          p_amount: number;
          p_currency_original: string;
          p_exchange_rate: number;
          p_description: string;
          p_date: string;
          p_category_id?: string;
        };
        Returns: {
          transfer_id: string;
          debit_transaction_id: string;
          credit_transaction_id: string;
        };
      };
      delete_transfer: {
        Args: {
          p_user_id: string;
          p_transfer_id: string;
        };
        Returns: void;
      };
    };
  };
}
