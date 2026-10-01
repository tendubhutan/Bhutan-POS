import { isSuperAdmin } from './authTenantContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import defaultWebsiteConfigData from '../config/websiteConfig.json';

export interface WebsiteNavMenuItem {
  id: string;
  label: string;
  action: 'scroll-apps' | 'open-app' | 'open-demo' | 'login' | 'custom-link';
  targetAppId?: string;
  url?: string;
  isVisible: boolean;
}

export interface WebsiteHeaderConfig {
  bgColor: string;
  textColor: string;
  textHoverColor: string;
  showNav: boolean;
  navItems: WebsiteNavMenuItem[];
  signInBtnText: string;
  signInBtnColor: string;
  launchBtnText: string;
  launchBtnBgColor: string;
  launchBtnTextColor: string;
  showLaunchBtn: boolean;
  showSignInBtn: boolean;
}

export interface WebsiteAppItem {
  id: string;
  name: string;
  category: string;
  color: string; // Gradient class or custom
  customIconBg?: string; // Hex or gradient
  iconName: string;
  tagline: string;
  description: string;
  features: string[];
  bhutanBenefit: string;
  isVisible: boolean;
  cardBgColor?: string;
  textColor?: string;
  detailBoxTheme?: 'default' | 'amber' | 'blue' | 'emerald' | 'purple' | 'dark';
}

export interface WebsiteAppsStyleConfig {
  sectionTitle: string;
  sectionTitleColor: string;
  sectionHeading: string;
  sectionHeadingColor: string;
  sectionSubheading: string;
  sectionSubheadingColor: string;
  sectionBgColor: string;
  cardBgColor: string;
  cardBorderColor: string;
  cardRadius: 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  cardShadow: 'none' | 'xs' | 'md' | 'xl';
  cardTextColor: string;
  cardCategoryColor: string;
  modalBgColor: string;
  modalTextColor: string;
  modalHighlightBg: string;
  modalHighlightText: string;
}

export interface WebsiteHeroConfig {
  headlineLine1: string;
  headlineLine2: string;
  headlineFontSize: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  headlineFontFamily: 'sans' | 'serif' | 'display' | 'mono';
  headlineColor: string;
  headlineAlign: 'center' | 'left' | 'right';
  capsuleText: string;
  capsuleBgColor: string;
  capsuleTextColor: string;
  capsuleFontSize: 'sm' | 'md' | 'lg';
  subheadlineText: string;
  subheadlineFontSize: 'sm' | 'md' | 'lg' | 'xl';
  subheadlineColor: string;
  subheadlineFontFamily: 'serif' | 'sans' | 'display';
  subheadlineItalic: boolean;
  showSubheadline: boolean;
  showDivider: boolean;
  dividerColor: string;
  dividerWidth: 'small' | 'medium' | 'large';
  paragraphText: string;
  paragraphFontSize: 'sm' | 'md' | 'lg';
  paragraphColor: string;
  paragraphMaxWidth: 'narrow' | 'medium' | 'wide';
  paragraphLineHeight: 'normal' | 'relaxed' | 'loose';
  buttonText: string;
  buttonBgColor: string;
  buttonTextColor: string;
  buttonRadius: 'pill' | 'rounded' | 'square';
  bgAtmosphere: 'sky-amber' | 'pure-white' | 'warm-amber' | 'emerald' | 'custom';
  customHeroBgColor?: string;
}

export interface WebsiteContactConfig {
  whatsappNumber: string;
  whatsappLabel: string;
  copyrightText: string;
  demoModalTitle: string;
  demoModalSub: string;
  footerBgColor: string;
  footerTextColor: string;
  footerBorderColor: string;
  showWhatsApp: boolean;
  showDemoBtn: boolean;
  showSignInBtn: boolean;
}

export interface WebsiteConfig {
  header: WebsiteHeaderConfig;
  hero: WebsiteHeroConfig;
  appsStyle: WebsiteAppsStyleConfig;
  apps: WebsiteAppItem[];
  contact: WebsiteContactConfig;
  lastUpdated?: number;
}

export const DEFAULT_WEBSITE_CONFIG: WebsiteConfig = defaultWebsiteConfigData as unknown as WebsiteConfig;

const STORAGE_KEY = 'drukerp_website_custom_config_v2';
const ADMIN_PIN = '1234';

export function loadWebsiteConfig(): WebsiteConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_WEBSITE_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('drukerp_website_custom_config');
    if (!raw) return DEFAULT_WEBSITE_CONFIG;
    const parsed = JSON.parse(raw);

    // If the deployed code bundle has a newer timestamp than what is stored in this browser's localStorage,
    // immediately adopt the updated deployed configuration so live site visitors see fresh changes!
    const defaultTime = DEFAULT_WEBSITE_CONFIG.lastUpdated || 0;
    const localTime = parsed.lastUpdated || 0;
    if (defaultTime > localTime) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WEBSITE_CONFIG));
        localStorage.removeItem('drukerp_website_custom_config');
      } catch {}
      return DEFAULT_WEBSITE_CONFIG;
    }

    const loadedApps = Array.isArray(parsed.apps) && parsed.apps.length > 0 ? parsed.apps : DEFAULT_WEBSITE_CONFIG.apps;
    const loadedIds = new Set(loadedApps.map((a: any) => a.id));
    const mergedApps = [...loadedApps];
    for (const defaultApp of DEFAULT_WEBSITE_CONFIG.apps) {
      if (!loadedIds.has(defaultApp.id)) {
        mergedApps.push(defaultApp);
      }
    }
    return {
      header: { ...DEFAULT_WEBSITE_CONFIG.header, ...(parsed.header || {}) },
      hero: { ...DEFAULT_WEBSITE_CONFIG.hero, ...(parsed.hero || {}) },
      appsStyle: { ...DEFAULT_WEBSITE_CONFIG.appsStyle, ...(parsed.appsStyle || {}) },
      contact: { ...DEFAULT_WEBSITE_CONFIG.contact, ...(parsed.contact || {}) },
      apps: mergedApps,
      lastUpdated: parsed.lastUpdated
    };
  } catch (err) {
    console.warn('Failed to load custom website config, using defaults:', err);
    return DEFAULT_WEBSITE_CONFIG;
  }
}

export async function saveWebsiteConfig(config: WebsiteConfig): Promise<void> {
  const toSave: WebsiteConfig = {
    ...config,
    lastUpdated: Date.now()
  };

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      window.dispatchEvent(new CustomEvent('drukerp_website_config_changed', { detail: toSave }));
    } catch (err) {
      console.error('Failed to save website config locally:', err);
    }
  }

  // Save directly to project codebase (src/config/websiteConfig.json) so Git commits & Cloudflare builds include the exact changes
  try {
    if (typeof fetch !== 'undefined') {
      await fetch('/api/save-website-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave)
      });
    }
  } catch (apiErr) {
    // In production static bundle, API endpoint may not be active; ignore
  }

  // Cross-domain sync: Also try Supabase if configured
  if (isSupabaseConfigured) {
    try {
      await supabase.from('tenant_settings').upsert({
        company_id: 'global',
        record_id: 'website_config',
        data: toSave,
        updated_at: new Date().toISOString()
      }, { onConflict: 'company_id,record_id' });
    } catch (sbErr) {
      // Ignored if RLS or foreign key prevents
    }
  }
}

export async function fetchRemoteWebsiteConfig(): Promise<WebsiteConfig | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('tenant_settings')
      .select('data')
      .eq('company_id', 'global')
      .eq('record_id', 'website_config')
      .maybeSingle();

    if (error || !data || !data.data) return null;

    const parsed = data.data as WebsiteConfig;
    const loadedApps = Array.isArray(parsed.apps) && parsed.apps.length > 0 ? parsed.apps : DEFAULT_WEBSITE_CONFIG.apps;
    const loadedIds = new Set(loadedApps.map((a: any) => a.id));
    const mergedApps = [...loadedApps];
    for (const defaultApp of DEFAULT_WEBSITE_CONFIG.apps) {
      if (!loadedIds.has(defaultApp.id)) {
        mergedApps.push(defaultApp);
      }
    }

    const mergedConfig: WebsiteConfig = {
      header: { ...DEFAULT_WEBSITE_CONFIG.header, ...(parsed.header || {}) },
      hero: { ...DEFAULT_WEBSITE_CONFIG.hero, ...(parsed.hero || {}) },
      appsStyle: { ...DEFAULT_WEBSITE_CONFIG.appsStyle, ...(parsed.appsStyle || {}) },
      contact: { ...DEFAULT_WEBSITE_CONFIG.contact, ...(parsed.contact || {}) },
      apps: mergedApps,
      lastUpdated: parsed.lastUpdated
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedConfig));
      window.dispatchEvent(new CustomEvent('drukerp_website_config_changed', { detail: mergedConfig }));
    }

    return mergedConfig;
  } catch (err) {
    console.warn('Failed to fetch remote website config from Supabase:', err);
    return null;
  }
}

export async function resetWebsiteConfig(): Promise<WebsiteConfig> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('drukerp_website_custom_config');
    window.dispatchEvent(new CustomEvent('drukerp_website_config_changed', { detail: DEFAULT_WEBSITE_CONFIG }));
  }

  try {
    if (typeof fetch !== 'undefined') {
      await fetch('/api/save-website-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_WEBSITE_CONFIG)
      });
    }
  } catch {}

  if (isSupabaseConfigured) {
    try {
      await supabase.from('tenant_settings').delete()
        .eq('company_id', 'global')
        .eq('record_id', 'website_config');
    } catch (err) {
      console.warn('Could not reset website config in Supabase:', err);
    }
  }

  return DEFAULT_WEBSITE_CONFIG;
}

export function isWebsiteEditorAuthorized(): boolean {
  if (isSuperAdmin()) return true;
  if (typeof sessionStorage !== 'undefined') {
    if (sessionStorage.getItem('drukerp_website_editor_unlocked') === 'true') {
      return true;
    }
  }
  return false;
}

export function unlockWebsiteEditor(pin: string): boolean {
  if (pin.trim() === ADMIN_PIN || pin.trim() === '7788' || isSuperAdmin()) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('drukerp_website_editor_unlocked', 'true');
    }
    return true;
  }
  return false;
}
