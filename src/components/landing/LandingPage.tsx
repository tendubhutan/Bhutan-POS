import React, { useState, useEffect } from 'react';
import { DrukErpLogo } from '../common/DrukErpLogo';
import {
  Receipt,
  ShoppingCart,
  Utensils,
  Smartphone,
  QrCode,
  Boxes,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  ArrowRight,
  Clock,
  Users,
  Sparkles,
  Calculator,
  ScanLine,
  Share2,
  MessageCircle,
  Phone,
  MapPin,
  Check,
  ChevronRight,
  Layers,
  Pill,
  Wrench,
  Shirt,
  LogIn,
  BarChart3,
  Calendar,
  Send,
  ExternalLink,
  X,
  BadgeDollarSign,
  Building2,
  ShieldCheck,
  HelpCircle,
  Laptop,
  KeyRound
} from 'lucide-react';
import {
  loadWebsiteConfig,
  WebsiteConfig,
  WebsiteAppItem,
  isWebsiteEditorAuthorized,
  unlockWebsiteEditor
} from '../../services/websiteConfigService';
import { WebsiteCustomizerModal } from './WebsiteCustomizerModal';

const ICON_MAP: Record<string, React.ElementType> = {
  ShieldCheck,
  ShoppingCart,
  Calculator,
  Utensils,
  Boxes,
  Smartphone,
  Pill,
  Wrench,
  Shirt,
  Users,
  Clock,
  ScanLine,
  BadgeDollarSign,
  Building2,
  MessageCircle,
  FileSpreadsheet,
  Layers,
  FileText
};

interface LandingPageProps {
  onOpenLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenLogin }) => {
  const [siteConfig, setSiteConfig] = useState<WebsiteConfig>(() => loadWebsiteConfig());
  const [selectedApp, setSelectedApp] = useState<WebsiteAppItem | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isEditorUnlocked, setIsEditorUnlocked] = useState(() => isWebsiteEditorAuthorized());

  const [demoFormData, setDemoFormData] = useState({
    name: '',
    businessName: '',
    phone: '',
    dzongkhag: 'Thimphu',
    businessType: 'Retail & Supermarket',
    notes: ''
  });
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  // Sync with live customizer changes
  useEffect(() => {
    const handleConfigChange = (e: any) => {
      if (e.detail) {
        setSiteConfig(e.detail);
      }
    };
    window.addEventListener('drukerp_website_config_changed', handleConfigChange);
    return () => window.removeEventListener('drukerp_website_config_changed', handleConfigChange);
  }, []);

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoFormData.phone || !demoFormData.name) return;
    setDemoSubmitted(true);
  };

  const handleUnlockPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlockWebsiteEditor(adminPinInput)) {
      setIsEditorUnlocked(true);
      setShowAdminPinModal(false);
      setAdminPinInput('');
      setPinError(false);
      setShowCustomizer(true);
    } else {
      setPinError(true);
    }
  };

  // Nav menu action executor
  const handleNavAction = (action: string, targetAppId?: string, url?: string) => {
    if (action === 'scroll-apps') {
      const el = document.getElementById('apps');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (action === 'open-app' && targetAppId) {
      const app = siteConfig.apps.find(a => a.id === targetAppId);
      if (app) setSelectedApp(app);
    } else if (action === 'open-demo') {
      setShowDemoModal(true);
    } else if (action === 'login') {
      onOpenLogin();
    } else if (action === 'custom-link' && url) {
      window.open(url, '_blank');
    }
  };

  // Filter visible apps
  const visibleApps = siteConfig.apps.filter(a => a.isVisible);

  // Typography scale maps
  const headlineSizeClasses = {
    sm: 'text-3xl sm:text-5xl lg:text-6xl',
    md: 'text-4xl sm:text-6xl lg:text-7xl',
    lg: 'text-4xl sm:text-6xl lg:text-7xl',
    xl: 'text-5xl sm:text-7xl lg:text-8xl',
    '2xl': 'text-5xl sm:text-7xl lg:text-9xl'
  }[siteConfig.hero.headlineFontSize || 'lg'];

  const headlineFontClasses = {
    sans: 'font-sans tracking-tight',
    display: 'font-sans font-black tracking-tighter',
    serif: 'font-serif tracking-normal',
    mono: 'font-mono tracking-tight'
  }[siteConfig.hero.headlineFontFamily || 'sans'];

  const paragraphSizeClasses = {
    sm: 'text-xs sm:text-sm',
    md: 'text-sm sm:text-base',
    lg: 'text-base sm:text-lg'
  }[siteConfig.hero.paragraphFontSize || 'md'];

  const paragraphWidthClasses = {
    narrow: 'max-w-md',
    medium: 'max-w-xl',
    wide: 'max-w-3xl'
  }[siteConfig.hero.paragraphMaxWidth || 'medium'];

  const cardRadiusClass = {
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl',
    '2xl': 'rounded-2xl',
    '3xl': 'rounded-3xl'
  }[siteConfig.appsStyle.cardRadius || '2xl'];

  const cardShadowClass = {
    none: 'shadow-none',
    xs: 'shadow-xs hover:shadow-xl',
    md: 'shadow-md hover:shadow-2xl',
    xl: 'shadow-xl hover:shadow-2xl'
  }[siteConfig.appsStyle.cardShadow || 'xs'];

  const buttonRadiusClass = {
    pill: 'rounded-full',
    rounded: 'rounded-2xl',
    square: 'rounded-md'
  }[siteConfig.hero.buttonRadius || 'pill'];

  // Atmosphere background
  const getAtmosphereClasses = () => {
    switch (siteConfig.hero.bgAtmosphere) {
      case 'pure-white':
        return 'bg-white';
      case 'warm-amber':
        return 'bg-gradient-to-b from-amber-50/60 via-white to-amber-50/40';
      case 'emerald':
        return 'bg-gradient-to-b from-emerald-50/50 via-white to-slate-50/40';
      case 'custom':
        return '';
      case 'sky-amber':
      default:
        return 'bg-gradient-to-b from-sky-50/40 via-white to-slate-50/40';
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-sky-400 selection:text-slate-950">
      
      {/* ======================================================== */}
      {/* EDITABLE TOP HEADER                                      */}
      {/* ======================================================== */}
      <header 
        style={{ 
          backgroundColor: siteConfig.header.bgColor || '#ffffff' 
        }}
        className="sticky top-0 z-40 backdrop-blur-md border-b border-slate-100 shadow-xs transition-colors duration-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <div className="flex items-center">
            <DrukErpLogo size="md" variant="full" />
          </div>

          {/* Editable Navigation Menu */}
          {siteConfig.header.showNav && (
            <nav className="hidden md:flex items-center gap-7 text-sm font-semibold">
              {siteConfig.header.navItems
                .filter(item => item.isVisible)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavAction(item.action, item.targetAppId, item.url)}
                    style={{ color: siteConfig.header.textColor }}
                    className="hover:opacity-80 transition cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
            </nav>
          )}

          {/* Editable Header Action Buttons */}
          <div className="flex items-center gap-3">
            {siteConfig.header.showSignInBtn && (
              <button
                type="button"
                onClick={onOpenLogin}
                style={{ color: siteConfig.header.signInBtnColor || '#334155' }}
                className="text-xs sm:text-sm font-bold hover:opacity-80 px-3 py-2 transition cursor-pointer"
              >
                {siteConfig.header.signInBtnText || 'Sign In'}
              </button>
            )}

            {siteConfig.header.showLaunchBtn && (
              <button
                type="button"
                onClick={onOpenLogin}
                style={{
                  backgroundColor: siteConfig.header.launchBtnBgColor || '#2563eb',
                  color: siteConfig.header.launchBtnTextColor || '#ffffff'
                }}
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer hover:opacity-90"
              >
                <LogIn className="w-4 h-4" />
                <span>{siteConfig.header.launchBtnText || 'Launch ERP'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* EDITABLE HERO SECTION                                    */}
      {/* ======================================================== */}
      <section 
        style={siteConfig.hero.bgAtmosphere === 'custom' && siteConfig.hero.customHeroBgColor ? { backgroundColor: siteConfig.hero.customHeroBgColor } : undefined}
        className={`relative pt-12 pb-16 sm:pt-18 sm:pb-24 text-center overflow-hidden transition-all duration-200 ${getAtmosphereClasses()}`}
      >
        {/* Soft Ambient Corner Glows */}
        <div className="absolute -bottom-16 -left-16 w-80 h-80 rounded-full bg-amber-100/60 blur-3xl pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-96 h-96 rounded-full bg-sky-100/60 blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Main Headline */}
          <h1 
            style={{ color: siteConfig.hero.headlineColor }}
            className={`${headlineSizeClasses} ${headlineFontClasses} font-extrabold tracking-tight leading-[1.12]`}
          >
            {siteConfig.hero.headlineLine1}<br />
            {siteConfig.hero.headlineLine2}<br />
            <span 
              style={{
                backgroundColor: siteConfig.hero.capsuleBgColor,
                color: siteConfig.hero.capsuleTextColor
              }}
              className="inline-block px-8 sm:px-12 py-1.5 sm:py-2 rounded-full font-black mt-2 sm:mt-3 shadow-xs"
            >
              {siteConfig.hero.capsuleText}
            </span>
          </h1>

          {/* Sub-headline Slogan */}
          {siteConfig.hero.showSubheadline && (
            <p 
              style={{ color: siteConfig.hero.subheadlineColor }}
              className={`font-serif ${siteConfig.hero.subheadlineItalic ? 'italic' : ''} font-bold text-2xl sm:text-3xl lg:text-4xl mt-5 sm:mt-6`}
            >
              {siteConfig.hero.subheadlineText}
            </p>
          )}

          {/* Divider Line */}
          {siteConfig.hero.showDivider && (
            <div 
              style={{ backgroundColor: siteConfig.hero.dividerColor || siteConfig.hero.capsuleBgColor }}
              className={`h-1 rounded-full mx-auto my-4 sm:my-5 ${siteConfig.hero.dividerWidth === 'small' ? 'w-10' : siteConfig.hero.dividerWidth === 'large' ? 'w-24' : 'w-16'}`} 
            />
          )}

          {/* Explanatory Paragraph */}
          <p 
            style={{ color: siteConfig.hero.paragraphColor }}
            className={`${paragraphSizeClasses} ${paragraphWidthClasses} mx-auto font-normal leading-relaxed`}
          >
            {siteConfig.hero.paragraphText}
          </p>

          {/* Primary CTA Button */}
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={onOpenLogin}
              style={{
                backgroundColor: siteConfig.hero.buttonBgColor,
                color: siteConfig.hero.buttonTextColor
              }}
              className={`px-9 py-3.5 sm:py-4 ${buttonRadiusClass} font-bold text-sm sm:text-base shadow-xl hover:shadow-2xl transition-all duration-200 inline-flex items-center gap-2.5 cursor-pointer group hover:opacity-95`}
            >
              <span>{siteConfig.hero.buttonText}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* EDITABLE APPS GRID SECTION                              */}
      {/* ======================================================== */}
      <section 
        id="apps" 
        style={{ backgroundColor: siteConfig.appsStyle.sectionBgColor }}
        className="py-12 border-t border-slate-200/60 transition-colors duration-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-10">
            <span 
              style={{ color: siteConfig.appsStyle.sectionTitleColor }}
              className="text-xs font-black uppercase tracking-wider block"
            >
              {siteConfig.appsStyle.sectionTitle}
            </span>
            <h2 
              style={{ color: siteConfig.appsStyle.sectionHeadingColor }}
              className="text-2xl sm:text-3xl font-black mt-1"
            >
              {siteConfig.appsStyle.sectionHeading}
            </h2>
            <p 
              style={{ color: siteConfig.appsStyle.sectionSubheadingColor }}
              className="text-xs sm:text-sm mt-1"
            >
              {siteConfig.appsStyle.sectionSubheading}
            </p>
          </div>

          {/* Grid of Visible Apps (Wider cards with 5 columns on desktop and 2 on mobile) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {visibleApps.map((app) => {
              const Icon = ICON_MAP[app.iconName] || Boxes;
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setSelectedApp(app)}
                  style={{
                    backgroundColor: app.cardBgColor || siteConfig.appsStyle.cardBgColor,
                    borderColor: siteConfig.appsStyle.cardBorderColor
                  }}
                  className={`group flex flex-col items-center text-center p-4 sm:p-5 ${cardRadiusClass} border ${cardShadowClass} transition-all duration-200 hover:-translate-y-1 cursor-pointer w-full min-w-0`}
                >
                  {/* App Icon Tile with Gradient */}
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr ${app.color} p-0.5 shadow-md group-hover:scale-105 transition-transform duration-200 flex items-center justify-center text-white shrink-0`}>
                    <div className="w-full h-full rounded-[14px] bg-white/10 backdrop-blur-xs flex items-center justify-center">
                      <Icon className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-xs" />
                    </div>
                  </div>

                  {/* App Name - Centered, bold, multi-line wrapping so names are clearly visible */}
                  <span 
                    style={{ color: app.textColor || siteConfig.appsStyle.cardTextColor }}
                    className="mt-3 text-xs sm:text-sm font-extrabold group-hover:text-blue-600 transition-colors leading-tight text-center break-words text-wrap max-w-full min-h-[2.5rem] flex items-center justify-center"
                  >
                    {app.name}
                  </span>
                  <span 
                    style={{ color: siteConfig.appsStyle.cardCategoryColor }}
                    className="text-[10px] sm:text-[11px] transition-colors text-center truncate max-w-full mt-0.5"
                  >
                    {app.category}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bottom Compliance & Client bar */}
          <div className="mt-14 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-800">100% DRC BURS Tax &amp; GST Compliant</span>
              <span>· Built for Bhutan 🇧🇹</span>
            </div>

            <div className="flex items-center gap-4 font-bold text-slate-800">
              <button 
                type="button" 
                onClick={onOpenLogin}
                className="hover:text-blue-600 flex items-center gap-1 cursor-pointer"
              >
                <span>Client Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* EDITABLE DETAIL APP MODAL                                */}
      {/* ======================================================== */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div 
            style={{ backgroundColor: siteConfig.appsStyle.modalBgColor }}
            className="relative w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-200"
          >
            {/* Modal Top Header with App Gradient */}
            <div className={`p-6 sm:p-8 bg-gradient-to-r ${selectedApp.color} text-white relative`}>
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
                  {React.createElement(ICON_MAP[selectedApp.iconName] || Boxes, { className: 'w-9 h-9' })}
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-white/80 bg-black/15 px-2.5 py-0.5 rounded-md">
                    {selectedApp.category}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black mt-1">{selectedApp.name}</h3>
                  <p className="text-xs sm:text-sm text-white/90 font-medium mt-0.5">{selectedApp.tagline}</p>
                </div>
              </div>
            </div>

            {/* Modal Body: Complete Detail of Feature */}
            <div 
              style={{ color: siteConfig.appsStyle.modalTextColor }}
              className="p-6 sm:p-8 space-y-6 max-h-[65vh] overflow-y-auto text-sm"
            >
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Overview</h4>
                <p className="mt-1 leading-relaxed font-normal">
                  {selectedApp.description}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Key Capabilities</h4>
                <div className="space-y-2.5">
                  {selectedApp.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-snug">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bhutan Advantage Highlight Box */}
              {selectedApp.bhutanBenefit && (
                <div 
                  style={{
                    backgroundColor: siteConfig.appsStyle.modalHighlightBg,
                    color: siteConfig.appsStyle.modalHighlightText
                  }}
                  className="p-4 rounded-2xl border border-amber-200/80 text-xs"
                >
                  <div className="font-extrabold flex items-center gap-1.5 mb-1">
                    <span>🇧🇹 The Bhutan Advantage</span>
                  </div>
                  <p className="leading-relaxed opacity-95">{selectedApp.bhutanBenefit}</p>
                </div>
              )}
            </div>

            {/* Modal Footer with Launch Button */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                Close App Preview
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedApp(null);
                  onOpenLogin();
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Launch {selectedApp.name} in ERP</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Book a Demo Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto p-6 sm:p-8">
            <button
              type="button"
              onClick={() => {
                setShowDemoModal(false);
                setDemoSubmitted(false);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {demoSubmitted ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-black text-slate-900">Demo Request Received!</h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Thank you, <strong>{demoFormData.name}</strong>. Our local Bhutanese ERP specialist will contact you via WhatsApp / Phone at <strong>{demoFormData.phone}</strong> to schedule your demonstration.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowDemoModal(false);
                    setDemoSubmitted(false);
                  }}
                  className="px-6 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} className="space-y-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900">{siteConfig.contact.demoModalTitle}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{siteConfig.contact.demoModalSub}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Karma Dorji"
                    value={demoFormData.name}
                    onChange={(e) => setDemoFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Business Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Druk Store"
                      value={demoFormData.businessName}
                      onChange={(e) => setDemoFormData(prev => ({ ...prev, businessName: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Phone / WhatsApp</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +975 17123456"
                      value={demoFormData.phone}
                      onChange={(e) => setDemoFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Dzongkhag / City</label>
                    <select
                      value={demoFormData.dzongkhag}
                      onChange={(e) => setDemoFormData(prev => ({ ...prev, dzongkhag: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="Thimphu">Thimphu</option>
                      <option value="Phuntsholing">Phuntsholing</option>
                      <option value="Paro">Paro</option>
                      <option value="Gelephu">Gelephu</option>
                      <option value="Punakha">Punakha</option>
                      <option value="Wangdue">Wangdue</option>
                      <option value="Bumthang">Bumthang</option>
                      <option value="Samdrup Jongkhar">Samdrup Jongkhar</option>
                      <option value="Other">Other Dzongkhag</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Business Type</label>
                    <select
                      value={demoFormData.businessType}
                      onChange={(e) => setDemoFormData(prev => ({ ...prev, businessType: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="Retail & Supermarket">Retail &amp; Supermarket</option>
                      <option value="Restaurant / Cafe / Bar">Restaurant / Bar</option>
                      <option value="Electronics & Mobile">Electronics &amp; Mobile</option>
                      <option value="Pharmacy / Healthcare">Pharmacy</option>
                      <option value="Auto Spare Parts / Hardware">Auto Spare Parts</option>
                      <option value="Garments & Footwear">Garments &amp; Footwear</option>
                      <option value="Wholesale">Wholesale &amp; Distribution</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Demo Request</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EDITABLE FOOTER BAR                                      */}
      {/* ======================================================== */}
      <footer 
        style={{
          backgroundColor: siteConfig.contact.footerBgColor || '#ffffff',
          color: siteConfig.contact.footerTextColor || '#64748b',
          borderColor: siteConfig.contact.footerBorderColor || '#e2e8f0'
        }}
        className="border-t py-10 transition-colors duration-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <DrukErpLogo size="sm" variant="full" />
          </div>

          <div className="flex items-center gap-6">
            {siteConfig.contact.showWhatsApp && (
              <a 
                href={`https://wa.me/${siteConfig.contact.whatsappNumber.replace(/[^0-9]/g, '')}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-green-600 flex items-center gap-1 transition"
              >
                <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                <span>{siteConfig.contact.whatsappLabel}</span>
              </a>
            )}
            
            {siteConfig.contact.showDemoBtn && (
              <button type="button" onClick={() => setShowDemoModal(true)} className="hover:text-blue-600 cursor-pointer">
                Book Demo
              </button>
            )}

            {siteConfig.contact.showSignInBtn && (
              <button type="button" onClick={onOpenLogin} className="hover:text-blue-600 font-bold cursor-pointer">
                Client Sign In
              </button>
            )}
            
            {/* Discreet Admin Customizer Entry */}
            <button
              type="button"
              onClick={() => {
                if (isEditorUnlocked) {
                  setShowCustomizer(true);
                } else {
                  setShowAdminPinModal(true);
                }
              }}
              className="text-slate-400 hover:text-slate-700 flex items-center gap-1 transition cursor-pointer"
              title="Admin Website Customizer"
            >
              <span>⚙️ Admin Edit</span>
            </button>
          </div>

          <div>
            &copy; {new Date().getFullYear()} {siteConfig.contact.copyrightText}
          </div>
        </div>
      </footer>

      {/* Floating Website Customizer Button (Visible when Admin Unlocked or SuperAdmin) */}
      {isEditorUnlocked && (
        <div className="fixed bottom-6 right-6 z-40 animate-in fade-in">
          <button
            type="button"
            onClick={() => setShowCustomizer(true)}
            className="px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-2xl border border-slate-700/80 flex items-center gap-2 cursor-pointer transition-transform hover:scale-105"
            title="Open Website Customizer & Editor"
          >
            <span className="text-amber-400">⚙️</span>
            <span>Customize Website</span>
          </button>
        </div>
      )}

      {/* Visual Website Customizer Modal */}
      <WebsiteCustomizerModal
        isOpen={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        config={siteConfig}
        onConfigUpdated={(newConfig) => {
          setSiteConfig(newConfig);
        }}
      />

      {/* Admin Unlock Quick PIN Modal (Allows access even on new browser or incognito window) */}
      {showAdminPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl border border-slate-200 text-center space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">Unlock Website Editor</h4>
              <p className="text-xs text-slate-500 mt-1">Enter your Admin PIN to customize text, colors, and apps.</p>
            </div>
            <form onSubmit={handleUnlockPinSubmit} className="space-y-3">
              <input
                type="password"
                autoFocus
                placeholder="Enter PIN (e.g. 1234)"
                value={adminPinInput}
                onChange={(e) => {
                  setAdminPinInput(e.target.value);
                  setPinError(false);
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-center font-mono text-base tracking-widest outline-none ${pinError ? 'border-rose-500 bg-rose-50' : 'border-slate-300 focus:border-blue-500'}`}
              />
              {pinError && (
                <p className="text-[11px] text-rose-600 font-bold">Incorrect PIN. Please try again.</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdminPinModal(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
