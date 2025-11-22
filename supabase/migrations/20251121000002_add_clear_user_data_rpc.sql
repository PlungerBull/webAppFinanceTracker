create or replace function clear_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Delete all transactions for the user
  delete from transactions where user_id = p_user_id;
  
  -- Delete all categories for the user
  delete from categories where user_id = p_user_id;
  
  -- Delete account currencies (child of bank_accounts)
  delete from account_currencies 
  where account_id in (select id from bank_accounts where user_id = p_user_id);

  -- Delete all bank accounts for the user
  delete from bank_accounts where user_id = p_user_id;
  
  -- Delete all currencies for the user
  delete from currencies where user_id = p_user_id;
end;
$$;
