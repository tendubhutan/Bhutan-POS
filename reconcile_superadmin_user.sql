-- ============================================================================
-- RECONCILE SUPERADMIN USER IDENTITY MAPPING FOR TENDUBHUTAN@GMAIL.COM
-- Application: Bhutan Cloud POS & Multi-Tenant ERP
-- Database: Supabase PostgreSQL (public.company_users & auth.users)
-- ============================================================================

-- Step 1: Clean up any duplicate, legacy, or orphaned records for tendubhutan@gmail.com in company_users
DELETE FROM public.company_users 
WHERE LOWER(email) = 'tendubhutan@gmail.com'
   OR user_id IN (SELECT id FROM auth.users WHERE LOWER(email) = 'tendubhutan@gmail.com');

-- Step 2: Clean up any conflicting records in app_users
DELETE FROM public.app_users
WHERE id IN (SELECT id FROM auth.users WHERE LOWER(email) = 'tendubhutan@gmail.com');

-- Step 3: Insert the definitive, fresh Superadmin mapping linked to active auth.users record
INSERT INTO public.company_users (
  user_id,
  company_id,
  role,
  full_name,
  email,
  is_active
)
SELECT 
  u.id AS user_id,
  c.id AS company_id,
  'superadmin' AS role,
  'Platform Superadmin (Tendu)' AS full_name,
  'tendubhutan@gmail.com' AS email,
  true AS is_active
FROM (
  SELECT id 
  FROM auth.users 
  WHERE LOWER(email) = 'tendubhutan@gmail.com' 
  ORDER BY created_at DESC 
  LIMIT 1
) u
CROSS JOIN (
  SELECT id 
  FROM public.companies 
  ORDER BY created_at ASC 
  LIMIT 1
) c
ON CONFLICT (user_id, company_id) 
DO UPDATE SET
  role = 'superadmin',
  full_name = 'Platform Superadmin (Tendu)',
  email = 'tendubhutan@gmail.com',
  is_active = true,
  updated_at = now();

-- Step 4: Ensure auth.users user_metadata reflects superadmin role
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"superadmin"'
)
WHERE LOWER(email) = 'tendubhutan@gmail.com';

-- Step 5: Verification query to confirm the reconciled mapping
SELECT 
  cu.id AS company_user_id,
  cu.user_id,
  cu.email,
  cu.role,
  cu.is_active,
  c.company_name
FROM public.company_users cu
LEFT JOIN public.companies c ON cu.company_id = c.id
WHERE LOWER(cu.email) = 'tendubhutan@gmail.com';
