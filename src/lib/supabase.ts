import { createClient } from '@supabase/supabase-js';

// Primary Default Project Configuration for Bhutan POS Multi-Tenant
// Note: Supabase Anon Public Key is designed for client-side use guarded by Row-Level Security (RLS) policies.
export const DEFAULT_SUPABASE_URL = 'https://awtabqzljuhbjblrlcmv.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_BGkgQB1b_oPLEs_RlF4wag_FOvyXuGd';

export function getStoredSupabaseUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('supabase_custom_url') || localStorage.getItem('VITE_SUPABASE_URL');
    if (custom && custom.startsWith('https://')) return custom.trim();
  }
  return (import.meta.env.VITE_SUPABASE_URL as string) || DEFAULT_SUPABASE_URL;
}

export function getStoredSupabaseAnonKey(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('supabase_anon_key') || localStorage.getItem('VITE_SUPABASE_ANON_KEY');
    if (custom && custom.trim().length > 10) return custom.trim();
  }
  return (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || DEFAULT_SUPABASE_ANON_KEY;
}

export const supabaseUrl = getStoredSupabaseUrl();
export const supabaseAnonKey = getStoredSupabaseAnonKey();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseAnonKey.length > 20 &&
  supabaseUrl.startsWith('https://')
);

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    if (url && url.trim()) localStorage.setItem('supabase_custom_url', url.trim());
    if (anonKey && anonKey.trim()) localStorage.setItem('supabase_anon_key', anonKey.trim());
    window.dispatchEvent(new CustomEvent('supabase:credentials_updated'));
  }
}

export function clearSupabaseCredentials() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('supabase_custom_url');
    localStorage.removeItem('supabase_anon_key');
    window.dispatchEvent(new CustomEvent('supabase:credentials_updated'));
  }
}

// Instantiate client with live project credentials and automatic session persistence
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
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
  is_active?: boolean;
  subscription_plan?: string;
  subscription_expires_at?: string;
  created_at?: string;
  admin_username?: string;
  admin_name?: string;
  admin_pin?: string;
  admin_password?: string;
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
