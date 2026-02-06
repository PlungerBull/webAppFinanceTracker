-- =============================================================================
-- E2E Test User Seed
-- =============================================================================
--
-- Creates a consistent test account for Playwright E2E tests.
-- Runs on `supabase db reset` (referenced in config.toml sql_paths).
--
-- CTO DIRECTIVE: Use crypt() + gen_salt('bf') for password hashing.
-- This matches Supabase Auth's native Bcrypt so the test user is "real"
-- in the eyes of Postgres auth triggers.
--
-- Auth config has enable_confirmations = false (config.toml:178)
-- so this user is immediately usable without email verification.
-- =============================================================================

-- Enable pgcrypto for password hashing (usually already enabled by Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert test user into auth.users with known UUID
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'e2e00000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'e2e-test@financetracker.local',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- Insert into auth.identities (required for Supabase auth sign-in)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'e2e00000-0000-0000-0000-000000000001',
  'e2e00000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'sub', 'e2e00000-0000-0000-0000-000000000001',
    'email', 'e2e-test@financetracker.local'
  ),
  'email',
  'e2e00000-0000-0000-0000-000000000001',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (provider_id, provider) DO NOTHING;

-- Insert required user_settings row (app expects this to exist)
INSERT INTO public.user_settings (
  user_id,
  theme,
  start_of_week,
  main_currency,
  transaction_sort_preference
) VALUES (
  'e2e00000-0000-0000-0000-000000000001',
  'system',
  0,
  'USD',
  'date'
)
ON CONFLICT (user_id) DO NOTHING;
