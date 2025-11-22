-- Create a type for the transaction input to make parsing easier
create type transaction_import_input as (
  "Date" text,
  "Amount" numeric,
  "Description" text,
  "Category" text,
  "Account" text,
  "Currency" text,
  "Exchange Rate" numeric,
  "Notes" text
);

create or replace function import_transactions(
  p_user_id uuid,
  p_transactions jsonb,
  p_default_account_color text,
  p_default_category_color text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_transaction jsonb;
  v_date date;
  v_amount numeric;
  v_description text;
  v_category_name text;
  v_account_name text;
  v_currency_code text;
  v_exchange_rate numeric;
  v_notes text;
  
  v_account_id uuid;
  v_category_id uuid;
  v_currency_original text; -- This is just the code string in transactions table
  
  v_success_count integer := 0;
  v_error_count integer := 0;
  v_errors text[] := array[]::text[];
  v_row_index integer := 0;
begin
  -- Iterate through each transaction in the JSON array
  for v_transaction in select * from jsonb_array_elements(p_transactions)
  loop
    v_row_index := v_row_index + 1;
    
    begin
      -- Extract values
      v_date := (v_transaction->>'Date')::date;
      v_amount := (v_transaction->>'Amount')::numeric;
      v_description := v_transaction->>'Description';
      v_category_name := v_transaction->>'Category';
      v_account_name := v_transaction->>'Account';
      v_currency_code := coalesce(upper(v_transaction->>'Currency'), 'USD'); -- Default to USD if missing, logic handled in client usually but good fallback
      v_exchange_rate := coalesce((v_transaction->>'Exchange Rate')::numeric, 1.0);
      v_notes := v_transaction->>'Notes';

      -- Validate required fields
      if v_date is null then raise exception 'Date is required'; end if;
      if v_amount is null then raise exception 'Amount is required'; end if;
      if v_account_name is null or v_account_name = '' then raise exception 'Account is required'; end if;

      -- 1. Handle Account
      select id into v_account_id from bank_accounts 
      where user_id = p_user_id and lower(name) = lower(v_account_name);
      
      if v_account_id is null then
        insert into bank_accounts (user_id, name, color)
        values (p_user_id, v_account_name, p_default_account_color)
        returning id into v_account_id;
      end if;

      -- 2. Handle Category
      v_category_id := null;
      if v_category_name is not null and v_category_name <> '' then
        select id into v_category_id from categories
        where user_id = p_user_id and lower(name) = lower(v_category_name);
        
        if v_category_id is null then
          insert into categories (user_id, name, color, is_default)
          values (p_user_id, v_category_name, p_default_category_color, false)
          returning id into v_category_id;
        end if;
      end if;

      -- 3. Handle Currency (Ensure it exists in currencies table)
      -- We don't strictly need the ID for the transaction insert (it takes a string code), 
      -- but we should ensure the user has this currency in their list.
      if not exists (select 1 from currencies where user_id = p_user_id and code = v_currency_code) then
        insert into currencies (user_id, code, is_main)
        values (p_user_id, v_currency_code, false)
        on conflict (user_id, code) do nothing;
      end if;

      -- 4. Insert Transaction
      insert into transactions (
        user_id,
        date,
        amount_original,
        amount_home,
        currency_original,
        exchange_rate,
        description,
        notes,
        account_id,
        category_id
      ) values (
        p_user_id,
        v_date,
        v_amount,
        v_amount * v_exchange_rate, -- Simplified home amount calc
        v_currency_code,
        v_exchange_rate,
        v_description,
        v_notes,
        v_account_id,
        v_category_id
      );

      v_success_count := v_success_count + 1;

    exception when others then
      v_error_count := v_error_count + 1;
      v_errors := array_append(v_errors, 'Row ' || v_row_index || ': ' || SQLERRM);
    end;
  end loop;

  return jsonb_build_object(
    'success', v_success_count,
    'failed', v_error_count,
    'errors', v_errors
  );
end;
$$;
