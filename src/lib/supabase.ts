import { createClient } from '@supabase/supabase-js';

// Read credentials from environment variables or local storage configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://awtabqzljuhbjblrlcmv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseAnonKey.length > 20 &&
  supabaseUrl.startsWith('https://')
);

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey || 'dummy-anon-key-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export interface SupabaseCompany {
  id: string;
  company_name: string;
  trade_license_no?: string;
  tax_payer_id?: string;
  phone?: string;
  email?: string;
  address?: string;
  currency_symbol?: string;
  logo_url?: string;
  created_at?: string;
}

export interface SupabaseFinancialYear {
  id: string;
  company_id: string;
  fy_name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_locked: boolean;
  created_at?: string;
}

export interface SupabaseAppUser {
  id: string;
  company_id: string;
  full_name: string;
  role: 'superadmin' | 'admin' | 'manager' | 'cashier' | 'auditor';
  is_active: boolean;
  created_at?: string;
}
