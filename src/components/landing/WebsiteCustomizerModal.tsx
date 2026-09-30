import React, { useState } from 'react';
import {
  X,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Plus,
  Check,
  Palette,
  Layout,
  Layers,
  Phone,
  HelpCircle,
  FileJson,
  Upload,
  ArrowRight,
  Type,
  Maximize2,
  Sliders,
  Sparkles,
  Menu,
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
  FileText
} from 'lucide-react';
import {
  WebsiteConfig,
  WebsiteAppItem,
  WebsiteNavMenuItem,
  saveWebsiteConfig,
  resetWebsiteConfig
} from '../../services/websiteConfigService';

interface WebsiteCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WebsiteConfig;
  onConfigUpdated: (newConfig: WebsiteConfig) => void;
}

const AVAILABLE_ICONS = [
  'ShieldCheck', 'ShoppingCart', 'Calculator', 'Utensils', 'Boxes',
  'Smartphone', 'Pill', 'Wrench', 'Shirt', 'Users', 'Clock', 'ScanLine',
  'BadgeDollarSign', 'Building2', 'MessageCircle', 'FileSpreadsheet',
  'Layers', 'FileText'
];

const GRADIENT_PRESETS = [
  { label: 'Emerald Mint', value: 'from-emerald-500 to-teal-600' },
  { label: 'Royal Blue', value: 'from-blue-600 to-indigo-600' },
  { label: 'Vibrant Orange', value: 'from-amber-500 to-orange-600' },
  { label: 'Warm Rose', value: 'from-rose-500 to-orange-500' },
  { label: 'Deep Purple', value: 'from-violet-600 to-purple-600' },
  { label: 'Electric Sky', value: 'from-sky-500 to-blue-600' },
  { label: 'Forest Green', value: 'from-emerald-600 to-green-700' },
  { label: 'Gold Amber', value: 'from-yellow-500 to-amber-600' },
  { label: 'Fashion Pink', value: 'from-pink-500 to-rose-600' },
  { label: 'Cyan Electric', value: 'from-cyan-500 to-blue-600' },
  { label: 'Enterprise Navy', value: 'from-blue-700 to-indigo-800' }
];

export const WebsiteCustomizerModal: React.FC<WebsiteCustomizerModalProps> = ({
  isOpen,
  onClose,
  config,
  onConfigUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'header' | 'hero' | 'appsStyle' | 'appsList' | 'footer' | 'backup'>('header');
  const [formData, setFormData] = useState<WebsiteConfig>(() => JSON.parse(JSON.stringify(config)));
  const [editingApp, setEditingApp] = useState<WebsiteAppItem | null>(null);
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);
  const [appsSearch, setAppsSearch] = useState('');
  const [jsonExportText, setJsonExportText] = useState('');
  const [showJsonModal, setShowJsonModal] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    saveWebsiteConfig(formData);
    onConfigUpdated(formData);
    setSaveSuccessToast(true);
    setTimeout(() => setSaveSuccessToast(false), 2500);
  };

  const handleResetDefaults = () => {
    if (confirm('Are you sure you want to reset all website text, header, colors, and apps to the default original layout?')) {
      const reset = resetWebsiteConfig();
      setFormData(JSON.parse(JSON.stringify(reset)));
      onConfigUpdated(reset);
      setSaveSuccessToast(true);
      setTimeout(() => setSaveSuccessToast(false), 2500);
    }
  };

  const handleToggleAppVisibility = (appId: string) => {
    setFormData(prev => ({
      ...prev,
      apps: prev.apps.map(a => a.id === appId ? { ...a, isVisible: !a.isVisible } : a)
    }));
  };

  const handleDeleteApp = (appId: string, appName: string) => {
    if (confirm(`Remove "${appName}" from the website apps grid completely?`)) {
      setFormData(prev => ({
        ...prev,
        apps: prev.apps.filter(a => a.id !== appId)
      }));
    }
  };

  const handleSaveEditedApp = () => {
    if (!editingApp) return;
    setFormData(prev => {
      const exists = prev.apps.some(a => a.id === editingApp.id);
      if (exists) {
        return {
          ...prev,
          apps: prev.apps.map(a => a.id === editingApp.id ? editingApp : a)
        };
      } else {
        return {
          ...prev,
          apps: [...prev.apps, editingApp]
        };
      }
    });
    setEditingApp(null);
  };

  const handleAddNewApp = () => {
    const newId = `custom-app-${Date.now()}`;
    const newApp: WebsiteAppItem = {
      id: newId,
      name: 'New Custom App',
      category: 'Business Module',
      color: 'from-blue-600 to-indigo-600',
      iconName: 'Boxes',
      tagline: 'Custom enterprise capability for your business',
      description: 'Describe this application module and what it helps clients accomplish.',
      features: [
        'Key capability feature 1',
        'Key capability feature 2',
        'Key capability feature 3'
      ],
      bhutanBenefit: 'How this specifically helps Bhutanese companies.',
      isVisible: true,
      detailBoxTheme: 'blue'
    };
    setEditingApp(newApp);
  };

  // Nav menu handlers
  const handleAddNavItem = () => {
    const newId = `nav-${Date.now()}`;
    const newItem: WebsiteNavMenuItem = {
      id: newId,
      label: 'New Link',
      action: 'scroll-apps',
      isVisible: true
    };
    setFormData(p => ({
      ...p,
      header: {
        ...p.header,
        navItems: [...p.header.navItems, newItem]
      }
    }));
  };

  const handleRemoveNavItem = (id: string) => {
    setFormData(p => ({
      ...p,
      header: {
        ...p.header,
        navItems: p.header.navItems.filter(item => item.id !== id)
      }
    }));
  };

  // Preset Palettes
  const colorPresets = [
    '#ffffff', '#f8fafc', '#f1f5f9', '#0a1e44', '#0f172a',
    '#2563eb', '#38bdf8', '#0284c7', '#fec84b', '#f59e0b',
    '#10b981', '#059669', '#8b5cf6', '#714b67', '#f43f5e'
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[94vh]">
        
        {/* Top Header Banner */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center font-black shadow-md">
              ⚙️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg tracking-tight text-white">DrukERP Website Studio</h3>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Full Control Mode
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Customize Header, Navigation, Hero, 18 Apps, Colors, Font &amp; Styling</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save &amp; Apply Changes</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Studio Tab Navigation */}
        <div className="flex items-center px-6 bg-slate-50 border-b border-slate-200 overflow-x-auto shrink-0 text-xs font-bold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('header')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${activeTab === 'header' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-900'}`}
          >
            <Menu className="w-4 h-4" />
            <span>Header &amp; Nav Menu</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hero')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${activeTab === 'hero' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-900'}`}
          >
            <Type className="w-4 h-4" />
            <span>Hero &amp; Typography</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('appsStyle')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${activeTab === 'appsStyle' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-900'}`}
          >
            <Palette className="w-4 h-4" />
            <span>Apps Cards &amp; Theme</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('appsList')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${activeTab === 'appsList' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-900'}`}
          >
            <Layers className="w-4 h-4" />
            <span>18 Apps Icons &amp; Details ({formData.apps.filter(a => a.isVisible).length}/{formData.apps.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('footer')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${activeTab === 'footer' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-900'}`}
          >
            <Phone className="w-4 h-4" />
            <span>Footer &amp; Contact</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${activeTab === 'backup' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-900'}`}
          >
            <FileJson className="w-4 h-4" />
            <span>Backup &amp; Reset</span>
          </button>
        </div>

        {/* Success Toast */}
        {saveSuccessToast && (
          <div className="bg-emerald-500 text-white text-xs font-bold py-2.5 px-4 text-center animate-in fade-in shrink-0 flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            <span>Changes applied live to the website!</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* ======================================================== */}
          {/* TAB 1: HEADER & NAVIGATION                               */}
          {/* ======================================================== */}
          {activeTab === 'header' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h4 className="text-sm font-black text-slate-900">Header Styling &amp; Navigation Menu</h4>
                <p className="text-xs text-slate-500">Edit the top bar background, link colors, menu items, and CTA buttons.</p>
              </div>

              {/* Header Colors & Background */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h5 className="text-xs font-extrabold text-slate-800">Header Bar Appearance</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Header Background</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.header.bgColor}
                        onChange={(e) => setFormData(p => ({ ...p, header: { ...p.header, bgColor: e.target.value } }))}
                        className="w-8 h-8 rounded-lg border border-slate-300 p-0.5 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.header.bgColor}
                        onChange={(e) => setFormData(p => ({ ...p, header: { ...p.header, bgColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Menu Text Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.header.textColor}
                        onChange={(e) => setFormData(p => ({ ...p, header: { ...p.header, textColor: e.target.value } }))}
                        className="w-8 h-8 rounded-lg border border-slate-300 p-0.5 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.header.textColor}
                        onChange={(e) => setFormData(p => ({ ...p, header: { ...p.header, textColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Link Hover Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.header.textHoverColor}
                        onChange={(e) => setFormData(p => ({ ...p, header: { ...p.header, textHoverColor: e.target.value } }))}
                        className="w-8 h-8 rounded-lg border border-slate-300 p-0.5 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.header.textHoverColor}
                        onChange={(e) => setFormData(p => ({ ...p, header: { ...p.header, textHoverColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Menu Items Editor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-extrabold text-slate-800">Navigation Menu Links</h5>
                  <button
                    type="button"
                    onClick={handleAddNavItem}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-100 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Link</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.header.navItems.map((item, idx) => (
                    <div key={item.id} className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(p => ({
                              ...p,
                              header: {
                                ...p.header,
                                navItems: p.header.navItems.map((it, i) => i === idx ? { ...it, label: val } : it)
                              }
                            }));
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                          placeholder="Menu Label"
                        />
                        <select
                          value={item.action}
                          onChange={(e) => {
                            const act = e.target.value as any;
                            setFormData(p => ({
                              ...p,
                              header: {
                                ...p.header,
                                navItems: p.header.navItems.map((it, i) => i === idx ? { ...it, action: act } : it)
                              }
                            }));
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium"
                        >
                          <option value="scroll-apps">Scroll to All Apps</option>
                          <option value="open-app">Open App Detail (DRC Tax / Restaurant)</option>
                          <option value="open-demo">Open Demo Booking Modal</option>
                          <option value="login">Open Client Login</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(p => ({
                              ...p,
                              header: {
                                ...p.header,
                                navItems: p.header.navItems.map((it, i) => i === idx ? { ...it, isVisible: !it.isVisible } : it)
                              }
                            }));
                          }}
                          className={`p-1.5 rounded-lg border transition ${item.isVisible ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}
                          title={item.isVisible ? "Visible" : "Hidden"}
                        >
                          {item.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveNavItem(item.id)}
                          className="p-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Header Action Buttons (Sign In & Launch ERP) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <h5 className="text-xs font-extrabold text-slate-800">Header Buttons</h5>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Sign In Button */}
                  <div className="space-y-2 p-3 rounded-xl bg-white border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Sign In Button</span>
                      <label className="flex items-center gap-1 text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={formData.header.showSignInBtn}
                          onChange={(e) => setFormData(p => ({ ...p, header: { ...p.header, showSignInBtn: e.target.checked } }))}
                          className="rounded text-blue-600"
                        />
                        <span>Visible</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={formData.header.signInBtnText}
                      onChange={(e) => setFormData(p => ({ ...p, header: { ...p.header, signInBtnText: e.target.value } }))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                      placeholder="Sign In"
                    />
                  </div>

                  {/* Launch ERP Button */}
                  <div className="space-y-2 p-3 rounded-xl bg-white border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Launch ERP Button</span>
                      <label className="flex items-center gap-1 text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={formData.header.showLaunchBtn}
                          onChange={(e) => setFormData(p => ({ ...p, header: { ...p.header, showLaunchBtn: e.target.checked } }))}
                          className="rounded text-blue-600"
                        />
                        <span>Visible</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={formData.header.launchBtnText}
                      onChange={(e) => setFormData(p => ({ ...p, header: { ...p.header, launchBtnText: e.target.value } }))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                      placeholder="Launch ERP"
                    />
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex items-center gap-1.5 flex-1">
                        <span className="text-[10px] text-slate-500 font-bold">Button BG:</span>
                        <input
                          type="color"
                          value={formData.header.launchBtnBgColor}
                          onChange={(e) => setFormData(p => ({ ...p, header: { ...p.header, launchBtnBgColor: e.target.value } }))}
                          className="w-6 h-6 rounded border cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-1">
                        <span className="text-[10px] text-slate-500 font-bold">Text:</span>
                        <input
                          type="color"
                          value={formData.header.launchBtnTextColor}
                          onChange={(e) => setFormData(p => ({ ...p, header: { ...p.header, launchBtnTextColor: e.target.value } }))}
                          className="w-6 h-6 rounded border cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: HERO & TYPOGRAPHY                                 */}
          {/* ======================================================== */}
          {activeTab === 'hero' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h4 className="text-sm font-black text-slate-900">Hero Section, Text &amp; Typography</h4>
                <p className="text-xs text-slate-500">Fine-tune font family, font size, text alignment, colors, and line spacing.</p>
              </div>

              {/* Typography Options (Font Family & Alignment) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h5 className="text-xs font-extrabold text-slate-800">Global Typography &amp; Alignment</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Headline Font Family</label>
                    <select
                      value={formData.hero.headlineFontFamily}
                      onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, headlineFontFamily: e.target.value as any } }))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                    >
                      <option value="sans">Clean Modern Sans (Inter)</option>
                      <option value="display">Geometric Display (Jakarta)</option>
                      <option value="serif">Classic Editorial Serif</option>
                      <option value="mono">Technical Monospace</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Headline Scale / Size</label>
                    <select
                      value={formData.hero.headlineFontSize}
                      onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, headlineFontSize: e.target.value as any } }))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                    >
                      <option value="sm">Small (Compact)</option>
                      <option value="md">Medium (Balanced)</option>
                      <option value="lg">Large (Default Impact)</option>
                      <option value="xl">Extra Large (High Energy)</option>
                      <option value="2xl">Massive (Hero Impact)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Headline Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.hero.headlineColor}
                        onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, headlineColor: e.target.value } }))}
                        className="w-8 h-8 rounded-lg border border-slate-300 p-0.5 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.hero.headlineColor}
                        onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, headlineColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Headline Texts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Headline Line 1</label>
                  <input
                    type="text"
                    value={formData.hero.headlineLine1}
                    onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, headlineLine1: e.target.value } }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Headline Line 2</label>
                  <input
                    type="text"
                    value={formData.hero.headlineLine2}
                    onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, headlineLine2: e.target.value } }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-black"
                  />
                </div>
              </div>

              {/* Capsule Pill Text, Background & Text Color */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
                <h5 className="text-xs font-extrabold text-amber-950">Capsule Pill Badge Style</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">Capsule Badge Text</label>
                    <input
                      type="text"
                      value={formData.hero.capsuleText}
                      onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, capsuleText: e.target.value } }))}
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">Pill Size</label>
                    <select
                      value={formData.hero.capsuleFontSize}
                      onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, capsuleFontSize: e.target.value as any } }))}
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-bold"
                    >
                      <option value="sm">Small</option>
                      <option value="md">Medium (Default)</option>
                      <option value="lg">Large</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Pill Background Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.hero.capsuleBgColor}
                        onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, capsuleBgColor: e.target.value } }))}
                        className="w-7 h-7 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.hero.capsuleBgColor}
                        onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, capsuleBgColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Pill Text Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.hero.capsuleTextColor}
                        onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, capsuleTextColor: e.target.value } }))}
                        className="w-7 h-7 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.hero.capsuleTextColor}
                        onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, capsuleTextColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-headline Slogan & Divider Line */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-extrabold text-slate-800">Slogan &amp; Divider Line</h5>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={formData.hero.showSubheadline}
                      onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, showSubheadline: e.target.checked } }))}
                      className="rounded text-blue-600"
                    />
                    <span>Show Slogan</span>
                  </label>
                </div>

                {formData.hero.showSubheadline && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Slogan Text</label>
                      <input
                        type="text"
                        value={formData.hero.subheadlineText}
                        onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, subheadlineText: e.target.value } }))}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-serif italic font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Slogan Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.hero.subheadlineColor}
                          onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, subheadlineColor: e.target.value } }))}
                          className="w-7 h-7 rounded border cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.hero.subheadlineColor}
                          onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, subheadlineColor: e.target.value } }))}
                          className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-2 border-t border-slate-200">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
                    <input
                      type="checkbox"
                      checked={formData.hero.showDivider}
                      onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, showDivider: e.target.checked } }))}
                      className="rounded text-blue-600"
                    />
                    <span>Show Divider Line</span>
                  </label>
                  {formData.hero.showDivider && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-600">Color:</span>
                      <input
                        type="color"
                        value={formData.hero.dividerColor}
                        onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, dividerColor: e.target.value } }))}
                        className="w-6 h-6 rounded border cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Explanatory Paragraph Style */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h5 className="text-xs font-extrabold text-slate-800">Paragraph Content &amp; Layout</h5>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Paragraph Text</label>
                  <textarea
                    rows={3}
                    value={formData.hero.paragraphText}
                    onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, paragraphText: e.target.value } }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Font Size</label>
                    <select
                      value={formData.hero.paragraphFontSize}
                      onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, paragraphFontSize: e.target.value as any } }))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                    >
                      <option value="sm">Small</option>
                      <option value="md">Medium (Default)</option>
                      <option value="lg">Large</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Max Column Width</label>
                    <select
                      value={formData.hero.paragraphMaxWidth}
                      onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, paragraphMaxWidth: e.target.value as any } }))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                    >
                      <option value="narrow">Narrow (Centered)</option>
                      <option value="medium">Medium (Standard)</option>
                      <option value="wide">Wide (Expansive)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Text Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.hero.paragraphColor}
                        onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, paragraphColor: e.target.value } }))}
                        className="w-7 h-7 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.hero.paragraphColor}
                        onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, paragraphColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Primary CTA Button */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h5 className="text-xs font-extrabold text-slate-800">Primary Hero Button</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Button Label</label>
                    <input
                      type="text"
                      value={formData.hero.buttonText}
                      onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, buttonText: e.target.value } }))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Button Background</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.hero.buttonBgColor}
                        onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, buttonBgColor: e.target.value } }))}
                        className="w-7 h-7 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.hero.buttonBgColor}
                        onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, buttonBgColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Corner Shape</label>
                    <select
                      value={formData.hero.buttonRadius}
                      onChange={(e) => setFormData(p => ({ ...p, hero: { ...p.hero, buttonRadius: e.target.value as any } }))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                    >
                      <option value="pill">Pill (Full Rounded)</option>
                      <option value="rounded">Rounded Box</option>
                      <option value="square">Modern Square</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: APPS CARDS & THEME                                */}
          {/* ======================================================== */}
          {activeTab === 'appsStyle' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h4 className="text-sm font-black text-slate-900">Apps Grid Section &amp; Card Appearance</h4>
                <p className="text-xs text-slate-500">Configure background colors, card corner radius, borders, and modal detail box theme.</p>
              </div>

              {/* Section Headers */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h5 className="text-xs font-extrabold text-slate-800">Grid Section Headers</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Top Badge Title</label>
                    <input
                      type="text"
                      value={formData.appsStyle.sectionTitle}
                      onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, sectionTitle: e.target.value } }))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Badge Text Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.appsStyle.sectionTitleColor}
                        onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, sectionTitleColor: e.target.value } }))}
                        className="w-7 h-7 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.appsStyle.sectionTitleColor}
                        onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, sectionTitleColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Main Heading</label>
                  <input
                    type="text"
                    value={formData.appsStyle.sectionHeading}
                    onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, sectionHeading: e.target.value } }))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Subheading Line</label>
                  <input
                    type="text"
                    value={formData.appsStyle.sectionSubheading}
                    onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, sectionSubheading: e.target.value } }))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              {/* Grid Section & Card Style */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h5 className="text-xs font-extrabold text-slate-800">Card Design &amp; Section Colors</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Section Background</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.appsStyle.sectionBgColor}
                        onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, sectionBgColor: e.target.value } }))}
                        className="w-7 h-7 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.appsStyle.sectionBgColor}
                        onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, sectionBgColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Card Background</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.appsStyle.cardBgColor}
                        onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, cardBgColor: e.target.value } }))}
                        className="w-7 h-7 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.appsStyle.cardBgColor}
                        onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, cardBgColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Card Border Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.appsStyle.cardBorderColor}
                        onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, cardBorderColor: e.target.value } }))}
                        className="w-7 h-7 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.appsStyle.cardBorderColor}
                        onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, cardBorderColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Card Corner Radius</label>
                    <select
                      value={formData.appsStyle.cardRadius}
                      onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, cardRadius: e.target.value as any } }))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                    >
                      <option value="md">Subtle (md)</option>
                      <option value="lg">Rounded (lg)</option>
                      <option value="xl">Pill-Soft (xl)</option>
                      <option value="2xl">Odoo Style Smooth (2xl - Default)</option>
                      <option value="3xl">Extra Curved (3xl)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Card Shadow Intensity</label>
                    <select
                      value={formData.appsStyle.cardShadow}
                      onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, cardShadow: e.target.value as any } }))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                    >
                      <option value="none">Flat (No Shadow)</option>
                      <option value="xs">Subtle Shadow (Default)</option>
                      <option value="md">Medium Elevated</option>
                      <option value="xl">Floating Deep Shadow</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Detail Modal Text Box Theme */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h5 className="text-xs font-extrabold text-slate-800">Detail Feature Modal Theme</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Modal Card Background</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.appsStyle.modalBgColor}
                        onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, modalBgColor: e.target.value } }))}
                        className="w-7 h-7 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.appsStyle.modalBgColor}
                        onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, modalBgColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Advantage Box Background</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.appsStyle.modalHighlightBg}
                        onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, modalHighlightBg: e.target.value } }))}
                        className="w-7 h-7 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.appsStyle.modalHighlightBg}
                        onChange={(e) => setFormData(p => ({ ...p, appsStyle: { ...p.appsStyle, modalHighlightBg: e.target.value } }))}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: 18 APPS ICONS & DETAILS MANAGER                   */}
          {/* ======================================================== */}
          {activeTab === 'appsList' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-slate-900">18 Apps Icon &amp; Detail Text Box Manager</h4>
                  <p className="text-xs text-slate-500">
                    Change app icons, icon colors, card background, detail modal theme, or hide unwanted apps.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search apps..."
                    value={appsSearch}
                    onChange={(e) => setAppsSearch(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none w-36 sm:w-48"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewApp}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New App</span>
                  </button>
                </div>
              </div>

              {/* Grid of Apps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formData.apps
                  .filter(app => !appsSearch || app.name.toLowerCase().includes(appsSearch.toLowerCase()) || app.category.toLowerCase().includes(appsSearch.toLowerCase()))
                  .map(app => (
                    <div
                      key={app.id}
                      className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${app.isVisible ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-100/80 border-slate-200 opacity-60'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Icon preview */}
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${app.color} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs`}>
                          <span className="text-[10px] font-mono">{app.iconName.slice(0, 2)}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-xs text-slate-900 truncate">{app.name}</span>
                            {!app.isVisible && (
                              <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded">
                                Hidden
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">
                            {app.category} · Icon: <code className="text-[9px] text-blue-600">{app.iconName}</code>
                          </p>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleAppVisibility(app.id)}
                          title={app.isVisible ? "Hide this app from the website grid" : "Show this app on the website grid"}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${app.isVisible ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'}`}
                        >
                          {app.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingApp({ ...app })}
                          title="Edit icon, colors, and detail text"
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteApp(app.id, app.name)}
                          title="Delete app"
                          className="p-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: FOOTER & CONTACT                                  */}
          {/* ======================================================== */}
          {activeTab === 'footer' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h4 className="text-sm font-black text-slate-900">Footer Bar &amp; Contact Information</h4>
                <p className="text-xs text-slate-500">Edit footer background, text colors, and WhatsApp contact link.</p>
              </div>

              {/* Footer Background & Text Color */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h5 className="text-xs font-extrabold text-slate-800">Footer Bar Appearance</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Footer Background</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.contact.footerBgColor}
                        onChange={(e) => setFormData(p => ({ ...p, contact: { ...p.contact, footerBgColor: e.target.value } }))}
                        className="w-7 h-7 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.contact.footerBgColor}
                        onChange={(e) => setFormData(p => ({ ...p, contact: { ...p.contact, footerBgColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Footer Text Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.contact.footerTextColor}
                        onChange={(e) => setFormData(p => ({ ...p, contact: { ...p.contact, footerTextColor: e.target.value } }))}
                        className="w-7 h-7 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.contact.footerTextColor}
                        onChange={(e) => setFormData(p => ({ ...p, contact: { ...p.contact, footerTextColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Top Border Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.contact.footerBorderColor}
                        onChange={(e) => setFormData(p => ({ ...p, contact: { ...p.contact, footerBorderColor: e.target.value } }))}
                        className="w-7 h-7 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.contact.footerBorderColor}
                        onChange={(e) => setFormData(p => ({ ...p, contact: { ...p.contact, footerBorderColor: e.target.value } }))}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* WhatsApp Contact Details */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h5 className="text-xs font-extrabold text-slate-800">WhatsApp Support Link</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">WhatsApp Phone Number</label>
                    <input
                      type="text"
                      value={formData.contact.whatsappNumber}
                      onChange={(e) => setFormData(p => ({ ...p, contact: { ...p.contact, whatsappNumber: e.target.value } }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                      placeholder="e.g. +975 17123456"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">WhatsApp Label Text</label>
                    <input
                      type="text"
                      value={formData.contact.whatsappLabel}
                      onChange={(e) => setFormData(p => ({ ...p, contact: { ...p.contact, whatsappLabel: e.target.value } }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                      placeholder="WhatsApp Support (+975)"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Copyright Line</label>
                  <input
                    type="text"
                    value={formData.contact.copyrightText}
                    onChange={(e) => setFormData(p => ({ ...p, contact: { ...p.contact, copyrightText: e.target.value } }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    placeholder="DrukERP · All rights reserved."
                  />
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 6: BACKUP & RESET                                    */}
          {/* ======================================================== */}
          {activeTab === 'backup' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h4 className="text-sm font-black text-slate-900">Backup &amp; Reset to Factory Layout</h4>
                <p className="text-xs text-slate-500">Restore default layouts or export your customized website configuration.</p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                <h5 className="text-xs font-extrabold text-rose-900">Reset to Factory Defaults</h5>
                <p className="text-xs text-rose-800 leading-relaxed">
                  This will discard all custom header styles, modified text, custom app cards, and color customizations, reverting the website back to the original layout.
                </p>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-xs transition cursor-pointer mt-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All to Defaults</span>
                </button>
              </div>

              {/* JSON Export */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h5 className="text-xs font-extrabold text-slate-800">Export Configuration Backup (JSON)</h5>
                <p className="text-xs text-slate-600">Copy your configuration to save a local backup or transfer to another site.</p>
                <textarea
                  readOnly
                  rows={4}
                  value={JSON.stringify(formData, null, 2)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-[10px] bg-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            Cancel / Close
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save &amp; Apply Changes</span>
          </button>
        </div>
      </div>

      {/* SUB-MODAL: ADVANCED EDIT INDIVIDUAL APP */}
      {editingApp && (
        <div className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-black text-sm text-slate-900">Edit App: {editingApp.name}</h4>
              <button
                type="button"
                onClick={() => setEditingApp(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* App Icon Picker & Gradient Color */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <h5 className="text-xs font-extrabold text-slate-800">Icon &amp; Gradient Color</h5>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Choose Icon</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {AVAILABLE_ICONS.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setEditingApp(p => p ? { ...p, iconName: icon } : null)}
                      className={`p-2 rounded-xl border text-center transition cursor-pointer ${editingApp.iconName === icon ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'}`}
                      title={icon}
                    >
                      <div className="text-[10px] font-mono font-bold truncate">{icon.slice(0, 4)}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Icon Gradient Theme</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {GRADIENT_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setEditingApp(p => p ? { ...p, color: preset.value } : null)}
                      className={`p-2 rounded-xl text-left border text-xs font-bold transition flex items-center gap-2 cursor-pointer ${editingApp.color === preset.value ? 'ring-2 ring-blue-600 border-transparent bg-white shadow-xs' : 'bg-white border-slate-200'}`}
                    >
                      <div className={`w-4 h-4 rounded-md bg-gradient-to-tr ${preset.value} shrink-0`} />
                      <span className="text-[10px] truncate">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* App Name & Category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">App Name</label>
                <input
                  type="text"
                  value={editingApp.name}
                  onChange={(e) => setEditingApp(p => p ? { ...p, name: e.target.value } : null)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  value={editingApp.category}
                  onChange={(e) => setEditingApp(p => p ? { ...p, category: e.target.value } : null)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tagline</label>
              <input
                type="text"
                value={editingApp.tagline}
                onChange={(e) => setEditingApp(p => p ? { ...p, tagline: e.target.value } : null)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Overview Description</label>
              <textarea
                rows={2}
                value={editingApp.description}
                onChange={(e) => setEditingApp(p => p ? { ...p, description: e.target.value } : null)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Key Capabilities (1 per line)</label>
              <textarea
                rows={3}
                value={editingApp.features.join('\n')}
                onChange={(e) => setEditingApp(p => p ? { ...p, features: e.target.value.split('\n').filter(Boolean) } : null)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">The Bhutan Advantage Highlight</label>
              <input
                type="text"
                value={editingApp.bhutanBenefit}
                onChange={(e) => setEditingApp(p => p ? { ...p, bhutanBenefit: e.target.value } : null)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingApp(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditedApp}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Save App Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
