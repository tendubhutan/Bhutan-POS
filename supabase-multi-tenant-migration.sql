-- ============================================================================
-- SUPABASE MULTI-TENANT ISOLATION MIGRATION SCRIPT
-- Application: Bhutan POS / Deep POS Enterprise ERP
-- Target Database: PostgreSQL / Supabase
-- ============================================================================

-- Enable pgcrypto extension for UUID generation if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. COMPANIES TABLE & FINANCIAL YEARS TABLE (IDEMPOTENT)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  trade_license_no TEXT,
  tax_payer_id TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  currency_symbol TEXT DEFAULT 'Nu.',
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure required columns exist on companies
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'is_active') THEN
    ALTER TABLE public.companies ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'updated_at') THEN
    ALTER TABLE public.companies ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.financial_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fy_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure indices for fast lookup
CREATE INDEX IF NOT EXISTS idx_financial_years_company_id ON public.financial_years(company_id);

-- ----------------------------------------------------------------------------
-- 2. COMPANY_USERS TABLE (LINKS SUPABASE AUTH TO TENANT COMPANIES & ROLES)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'manager', 'cashier', 'accountant', 'auditor')),
  full_name TEXT NOT NULL,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_company UNIQUE (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_users_user_id ON public.company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON public.company_users(company_id);

-- ----------------------------------------------------------------------------
-- 3. RLS HELPER SECURITY DEFINER FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_company_id()
RETURNS UUID AS $$
  SELECT company_id 
  FROM public.company_users 
  WHERE user_id = auth.uid() 
    AND is_active = true 
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.company_users 
    WHERE user_id = auth.uid() 
      AND role = 'superadmin' 
      AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_company_access(target_company_id UUID)
RETURNS BOOLEAN AS $$
  SELECT (
    public.is_superadmin() 
    OR 
    public.get_auth_company_id() = target_company_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 4. AUTO-CONFIRM TRIGGER FOR SUPABASE AUTH SIGNUPS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();

-- Auto-confirm any pending unconfirmed accounts
UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) FOR CORE ERP TENANT TABLES
-- ----------------------------------------------------------------------------

-- A) COMPANIES TABLE RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select companies" ON public.companies;
CREATE POLICY "Allow select companies" ON public.companies
  FOR SELECT USING (
    public.is_superadmin() 
    OR id = public.get_auth_company_id()
    OR auth.role() = 'authenticated' -- Allow initial tenant discovery
  );

DROP POLICY IF EXISTS "Allow modify companies" ON public.companies;
CREATE POLICY "Allow modify companies" ON public.companies
  FOR ALL USING (public.is_superadmin());

-- B) FINANCIAL YEARS TABLE RLS
ALTER TABLE public.financial_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation financial_years select" ON public.financial_years;
CREATE POLICY "Tenant isolation financial_years select" ON public.financial_years
  FOR SELECT USING (public.has_company_access(company_id));

DROP POLICY IF EXISTS "Tenant isolation financial_years mutate" ON public.financial_years;
CREATE POLICY "Tenant isolation financial_years mutate" ON public.financial_years
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

-- C) COMPANY USERS TABLE RLS
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation company_users select" ON public.company_users;
CREATE POLICY "Tenant isolation company_users select" ON public.company_users
  FOR SELECT USING (
    user_id = auth.uid() 
    OR public.has_company_access(company_id)
  );

DROP POLICY IF EXISTS "Tenant isolation company_users mutate" ON public.company_users;
CREATE POLICY "Tenant isolation company_users mutate" ON public.company_users
  FOR ALL USING (
    public.is_superadmin() 
    OR (public.has_company_access(company_id) AND EXISTS (
      SELECT 1 FROM public.company_users cu 
      WHERE cu.user_id = auth.uid() AND cu.company_id = company_users.company_id AND cu.role = 'admin'
    ))
  );

-- D) ITEMS TABLE RLS
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation items select" ON public.items;
CREATE POLICY "Tenant isolation items select" ON public.items
  FOR SELECT USING (public.has_company_access(company_id));

DROP POLICY IF EXISTS "Tenant isolation items insert" ON public.items;
CREATE POLICY "Tenant isolation items insert" ON public.items
  FOR INSERT WITH CHECK (public.has_company_access(company_id));

DROP POLICY IF EXISTS "Tenant isolation items update" ON public.items;
CREATE POLICY "Tenant isolation items update" ON public.items
  FOR UPDATE USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

DROP POLICY IF EXISTS "Tenant isolation items delete" ON public.items;
CREATE POLICY "Tenant isolation items delete" ON public.items
  FOR DELETE USING (public.has_company_access(company_id));

-- E) LEDGERS TABLE RLS
ALTER TABLE public.ledgers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation ledgers select" ON public.ledgers;
CREATE POLICY "Tenant isolation ledgers select" ON public.ledgers
  FOR SELECT USING (public.has_company_access(company_id));

DROP POLICY IF EXISTS "Tenant isolation ledgers insert" ON public.ledgers;
CREATE POLICY "Tenant isolation ledgers insert" ON public.ledgers
  FOR INSERT WITH CHECK (public.has_company_access(company_id));

DROP POLICY IF EXISTS "Tenant isolation ledgers update" ON public.ledgers;
CREATE POLICY "Tenant isolation ledgers update" ON public.ledgers
  FOR UPDATE USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

DROP POLICY IF EXISTS "Tenant isolation ledgers delete" ON public.ledgers;
CREATE POLICY "Tenant isolation ledgers delete" ON public.ledgers
  FOR DELETE USING (public.has_company_access(company_id));

-- F) VOUCHERS TABLE RLS
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation vouchers select" ON public.vouchers;
CREATE POLICY "Tenant isolation vouchers select" ON public.vouchers
  FOR SELECT USING (public.has_company_access(company_id));

DROP POLICY IF EXISTS "Tenant isolation vouchers insert" ON public.vouchers;
CREATE POLICY "Tenant isolation vouchers insert" ON public.vouchers
  FOR INSERT WITH CHECK (public.has_company_access(company_id));

DROP POLICY IF EXISTS "Tenant isolation vouchers update" ON public.vouchers;
CREATE POLICY "Tenant isolation vouchers update" ON public.vouchers
  FOR UPDATE USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

DROP POLICY IF EXISTS "Tenant isolation vouchers delete" ON public.vouchers;
CREATE POLICY "Tenant isolation vouchers delete" ON public.vouchers
  FOR DELETE USING (public.has_company_access(company_id));

-- G) APP USERS TABLE RLS (Legacy / Compatibility table)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation app_users select" ON public.app_users;
CREATE POLICY "Tenant isolation app_users select" ON public.app_users
  FOR SELECT USING (public.has_company_access(company_id));

DROP POLICY IF EXISTS "Tenant isolation app_users mutate" ON public.app_users;
CREATE POLICY "Tenant isolation app_users mutate" ON public.app_users
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

-- ----------------------------------------------------------------------------
-- 6. ADDITIONAL TENANT TABLES CREATION (IF NOT ALREADY CREATED)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_no TEXT NOT NULL,
  date DATE NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  total_amount NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  payment_mode TEXT DEFAULT 'Cash',
  status TEXT DEFAULT 'Completed',
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation sales_invoices" ON public.sales_invoices;
CREATE POLICY "Tenant isolation sales_invoices" ON public.sales_invoices
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_no TEXT NOT NULL,
  date DATE NOT NULL,
  supplier_name TEXT,
  total_amount NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'Completed',
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "Tenant isolation purchase_invoices" ON public.purchase_invoices
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE TABLE IF NOT EXISTS public.stock_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL,
  date DATE NOT NULL,
  movement_type TEXT NOT NULL,
  qty NUMERIC(12,2) NOT NULL,
  rate NUMERIC(12,2) DEFAULT 0,
  ref_no TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation stock_ledger" ON public.stock_ledger;
CREATE POLICY "Tenant isolation stock_ledger" ON public.stock_ledger
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation audit_logs" ON public.audit_logs;
CREATE POLICY "Tenant isolation audit_logs" ON public.audit_logs
  FOR ALL USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

-- ----------------------------------------------------------------------------
-- 7. DEMO COMPANY & EZEE SHOP INTEGRITY VERIFICATION
-- ----------------------------------------------------------------------------
-- Ensure Demo Company is present with the correct actual UUID
INSERT INTO public.companies (id, company_name, trade_license_no, tax_payer_id, phone, email, address, currency_symbol)
VALUES (
  '30a4e773-585a-45a3-8fce-a32f94bbc7e0',
  'Bhutan Retail Enterprise',
  'TRD-2024-8891',
  'TPN-1029384',
  '+975 17 654 321',
  'accounts@bhutanretail.bt',
  'Norzin Lam, Sector 2, Thimphu, Bhutan',
  'Nu.'
)
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name;

-- Ensure Ezee Shop is present with its correct UUID
INSERT INTO public.companies (id, company_name, trade_license_no, tax_payer_id, phone, email, address, currency_symbol)
VALUES (
  'cf58c9aa-28eb-4436-95a1-0da44af394ba',
  'Ezee Shop',
  'TRD-2024-9922',
  'TPN-9988776',
  '+975 17 111 222',
  'admin@ezeeshop.bt',
  'Clock Tower Square, Thimphu, Bhutan',
  'Nu.'
)
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name;

-- ----------------------------------------------------------------------------
-- 8. SEED TEST USERS IN AUTH.USERS AND COMPANY_USERS
-- ----------------------------------------------------------------------------
-- Helper function to safely create or update auth users directly without email rate limits
CREATE OR REPLACE FUNCTION public.seed_auth_user(
  p_email TEXT,
  p_password TEXT,
  p_role TEXT,
  p_full_name TEXT,
  p_company_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Check if user already exists in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      p_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      json_build_object('full_name', p_full_name, 'role', p_role, 'company_id', p_company_id)::jsonb,
      now(),
      now()
    );
  ELSE
    -- Update password and ensure email confirmed
    UPDATE auth.users 
    SET 
      encrypted_password = crypt(p_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data = json_build_object('full_name', p_full_name, 'role', p_role, 'company_id', p_company_id)::jsonb,
      updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- Upsert company_users record
  INSERT INTO public.company_users (user_id, company_id, role, full_name, email, is_active)
  VALUES (v_user_id, p_company_id, p_role, p_full_name, p_email, true)
  ON CONFLICT (user_id, company_id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    is_active = true,
    updated_at = now();

  -- Also sync with app_users for backward compatibility
  IF p_company_id IS NOT NULL THEN
    INSERT INTO public.app_users (id, company_id, full_name, role, is_active)
    VALUES (v_user_id, p_company_id, p_full_name, p_role, true)
    ON CONFLICT (id) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      role = EXCLUDED.role,
      full_name = EXCLUDED.full_name,
      is_active = true;
  END IF;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Seed System Administrator (Platform superadmin, access to all companies)
SELECT public.seed_auth_user(
  'admin@bhutanerp.bt',
  'SuperAdminPass2026!',
  'superadmin',
  'Platform System Administrator',
  NULL
);

-- 2. Seed Demo Company Admin (Strictly locked to Bhutan Retail Enterprise)
SELECT public.seed_auth_user(
  'demo.admin@bhutanretail.bt',
  'DemoAdminPass2026!',
  'admin',
  'Bhutan Retail Administrator',
  '30a4e773-585a-45a3-8fce-a32f94bbc7e0'
);

-- 3. Seed Ezee Shop Admin (Strictly locked to Ezee Shop)
SELECT public.seed_auth_user(
  'admin@ezeeshop.bt',
  'EzeeAdminPass2026!',
  'admin',
  'Ezee Shop Administrator',
  'cf58c9aa-28eb-4436-95a1-0da44af394ba'
);

-- 4. Seed Ezee Shop Cashier (Strictly locked to Ezee Shop)
SELECT public.seed_auth_user(
  'cashier@ezeeshop.bt',
  'EzeeCashierPass2026!',
  'cashier',
  'Ezee Shop Cashier Staff',
  'cf58c9aa-28eb-4436-95a1-0da44af394ba'
);

-- 5. Reconcile & Seed Platform Owner Superadmin (tendubhutan@gmail.com)
DELETE FROM public.company_users 
WHERE LOWER(email) = 'tendubhutan@gmail.com'
   OR user_id IN (SELECT id FROM auth.users WHERE LOWER(email) = 'tendubhutan@gmail.com');

INSERT INTO public.company_users (user_id, company_id, role, full_name, email, is_active)
SELECT 
  u.id AS user_id,
  c.id AS company_id,
  'superadmin' AS role,
  'Platform Superadmin (Tendu)' AS full_name,
  'tendubhutan@gmail.com' AS email,
  true AS is_active
FROM (
  SELECT id FROM auth.users WHERE LOWER(email) = 'tendubhutan@gmail.com' ORDER BY created_at DESC LIMIT 1
) u
CROSS JOIN (
  SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1
) c
ON CONFLICT (user_id, company_id) DO UPDATE SET
  role = 'superadmin',
  full_name = 'Platform Superadmin (Tendu)',
  email = 'tendubhutan@gmail.com',
  is_active = true,
  updated_at = now();

