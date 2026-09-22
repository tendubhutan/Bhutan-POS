import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Monitor,
  Download,
  Copy,
  Check,
  QrCode,
  Sparkles,
  Zap,
  ExternalLink,
  ShieldCheck,
  Layers,
  Laptop,
  Radio,
  CheckCircle2,
  X,
  Share2
} from 'lucide-react';
import { getDeviceCounterId, setDeviceCounterId } from '../services/storageService';
import { promptPwaInstall, isPwaInstalled, subscribePwaState, canInstallPwa } from '../services/pwaService';

interface ClientLinkAndPwaModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCompanyName?: string;
}

export const ClientLinkAndPwaModal: React.FC<ClientLinkAndPwaModalProps> = ({
  isOpen,
  onClose,
  activeCompanyName = 'Ezee ERP'
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('C1');
  const [customCounter, setCustomCounter] = useState<string>('');
  const [customRole, setCustomRole] = useState<string>('Cashier');
  const [customView, setCustomView] = useState<string>('pos');
  const [hasPrompt, setHasPrompt] = useState<boolean>(() => canInstallPwa());
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(() => isPwaInstalled());
  const [activeTab, setActiveTab] = useState<'links' | 'pwa'>('links');

  const currentDeviceId = getDeviceCounterId();

  // Listen for PWA state updates
  useEffect(() => {
    setIsAppInstalled(isPwaInstalled());
    setHasPrompt(canInstallPwa());
    const unsub = subscribePwaState(() => {
      setIsAppInstalled(isPwaInstalled());
      setHasPrompt(canInstallPwa());
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  // Base URL calculation
  const getBaseAppUrl = () => {
    if (typeof window === 'undefined') return 'https://pos.store';
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}`;
  };

  const generateLink = (counter: string, role: string, view: string = 'pos') => {
    const base = getBaseAppUrl();
    const params = new URLSearchParams();
    if (counter) params.set('counter', counter);
    if (role) params.set('role', role);
    if (view && view !== 'dashboard') params.set('view', view);
    return `${base}?${params.toString()}`;
  };

  const handleCopy = (key: string, text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {}
  };

  const handleInstallPwa = async () => {
    if (canInstallPwa()) {
      const result = await promptPwaInstall();
      if (result === 'accepted') {
        setIsAppInstalled(true);
      }
    } else {
      // Direct copy or guidance
      handleCopy('appUrl', getBaseAppUrl());
    }
  };

  const PRESETS = [
    {
      id: 'C1',
      title: 'Counter 1 (Billing PC)',
      role: 'Cashier',
      view: 'pos',
      desc: 'Main Billing Desk 1 with rapid barcode scanning',
      tag: 'Counter 1',
      color: 'from-blue-600 to-indigo-600'
    },
    {
      id: 'C2',
      title: 'Counter 2 (Billing PC)',
      role: 'Cashier',
      view: 'pos',
      desc: 'Second Billing Terminal with synchronized offline safety',
      tag: 'Counter 2',
      color: 'from-indigo-600 to-violet-600'
    },
    {
      id: 'C3',
      title: 'Counter 3 (Billing PC)',
      role: 'Cashier',
      view: 'pos',
      desc: 'Third Billing Counter for peak rush hours',
      tag: 'Counter 3',
      color: 'from-violet-600 to-purple-600'
    },
    {
      id: 'C4',
      title: 'Counter 4 (Express Checkout)',
      role: 'Cashier',
      view: 'pos',
      desc: 'Express Checkout / Quick Grocery Desk',
      tag: 'Counter 4',
      color: 'from-purple-600 to-fuchsia-600'
    },
    {
      id: 'ACC1',
      title: 'Accountant Desk 1',
      role: 'Accountant',
      view: 'vouchers',
      desc: 'Full Accounting Suite, Vouchers, Reports & GST',
      tag: 'Accountant 1',
      color: 'from-emerald-600 to-teal-600'
    },
    {
      id: 'ACC2',
      title: 'Accountant Desk 2',
      role: 'Accountant',
      view: 'reports',
      desc: 'Secondary Accounts Desk for Audits & Verification',
      tag: 'Accountant 2',
      color: 'from-teal-600 to-cyan-600'
    },
    {
      id: 'MOB',
      title: 'Owner / Mobile Phone',
      role: 'Manager',
      view: 'dashboard',
      desc: 'Executive Phone App for live sales tracking & instant billing',
      tag: 'Owner Mobile',
      color: 'from-amber-600 to-orange-600'
    }
  ];

  const activePreset = PRESETS.find(p => p.id === selectedPreset) || PRESETS[0];
  const activeLink = generateLink(activePreset.id, activePreset.role, activePreset.view);

  // Generate SVG QR Code URL using standard public QR encoder for crisp rendering
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(activeLink)}&margin=1`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl border border-white/20 backdrop-blur-md">
              <Laptop className="h-6 w-6 text-blue-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">Dedicated Client Link & PWA Desktop App</h2>
                <span className="px-2 py-0.5 bg-emerald-400 text-slate-950 font-black text-[10px] rounded-full uppercase tracking-wider">
                  Zero Setup
                </span>
              </div>
              <p className="text-xs text-blue-100">
                Instantly connect 4 counters, accountants, & mobile phones with pre-assigned terminal parameters.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('links')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-black border-b-2 transition cursor-pointer ${
              activeTab === 'links'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Share2 className="h-4 w-4" />
            <span>Dedicated Client Links & QR Codes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pwa')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-black border-b-2 transition cursor-pointer ${
              activeTab === 'pwa'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="h-4 w-4" />
            <span>Install PWA Desktop App</span>
            {isAppInstalled && (
              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-100 text-emerald-800 rounded-md">
                Installed
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-800 flex-1">
          {activeTab === 'links' ? (
            <div className="space-y-4">
              {/* Presets Grid */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Select Target Terminal / Device:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {PRESETS.map((preset) => {
                    const isSelected = selectedPreset === preset.id;
                    const isCurrent = currentDeviceId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedPreset(preset.id)}
                        className={`p-2.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-mono font-black text-xs text-slate-900">
                            {preset.id}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-bold text-[9px] rounded">
                              This PC
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {preset.title}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {preset.role} • {preset.view.toUpperCase()}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Link & QR Code Card */}
              <div className="p-4 bg-gradient-to-br from-slate-50 via-indigo-50/40 to-blue-50/40 rounded-2xl border border-indigo-100 space-y-3.5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-indigo-100">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                      <span>{activePreset.title}</span>
                      <span className="text-xs font-mono font-normal text-indigo-700">
                        [{activePreset.id}]
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">{activePreset.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy('active', activeLink)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition active:scale-95 cursor-pointer shadow-xs"
                    >
                      {copiedKey === 'active' ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Dedicated URL</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  {/* QR Code Container */}
                  <div className="bg-white p-3 rounded-2xl border border-indigo-100 shadow-2xs flex flex-col items-center justify-center text-center">
                    <img
                      src={qrCodeUrl}
                      alt={`QR Code for ${activePreset.title}`}
                      className="h-32 w-32 rounded-xl object-contain shadow-2xs"
                      loading="lazy"
                    />
                    <div className="text-[10px] font-bold text-slate-600 mt-2 flex items-center gap-1">
                      <QrCode className="h-3 w-3 text-indigo-600" />
                      <span>Scan with Phone Camera</span>
                    </div>
                  </div>

                  {/* URL Text & Direct Launcher */}
                  <div className="md:col-span-2 space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Direct Client Access URL:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={activeLink}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 shadow-2xs outline-none"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-white/90 rounded-xl border border-indigo-100 space-y-1 text-xs">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Zero-Configuration Auto-Binding</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Opening this URL on any laptop, counter terminal, or smartphone instantly sets its terminal ID to <span className="font-mono font-bold text-indigo-700">{activePreset.id}</span> and launches directly into <span className="font-bold">{activePreset.view.toUpperCase()}</span> mode.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href={activeLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        <span>Open in New Window</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* PWA Desktop App Tab */
            <div className="space-y-4">
              {/* Install PWA Hero Card */}
              <div className="p-5 bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 text-white rounded-3xl shadow-md space-y-3.5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/10 rounded-2xl border border-white/20">
                      <Monitor className="h-7 w-7 text-indigo-200" />
                    </div>
                    <div>
                      <h3 className="font-black text-base text-white">Ezee ERP Desktop App (PWA)</h3>
                      <p className="text-xs text-indigo-200">
                        Everything Your Business Needs, in One Place — High-speed cashier experience with offline caching and native performance.
                      </p>
                    </div>
                  </div>

                  {hasPrompt ? (
                    <button
                      type="button"
                      onClick={handleInstallPwa}
                      className="px-5 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer flex items-center gap-2 shrink-0"
                    >
                      <Download className="h-4 w-4 stroke-[3]" />
                      <span>Install App Now</span>
                    </button>
                  ) : isAppInstalled ? (
                    <div className="px-4 py-2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>App Is Installed</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCopy('appUrl', getBaseAppUrl())}
                      className="px-4 py-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy App URL</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs">
                  <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 space-y-0.5">
                    <div className="font-bold text-amber-300">⚡ Instant Load</div>
                    <div className="text-[11px] text-slate-300">Cached locally on disk for zero startup delay.</div>
                  </div>
                  <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 space-y-0.5">
                    <div className="font-bold text-emerald-300">🖥️ Clean POS Window</div>
                    <div className="text-[11px] text-slate-300">Runs without browser tabs or search bar distractions.</div>
                  </div>
                  <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 space-y-0.5">
                    <div className="font-bold text-blue-300">🔌 Full Offline Suite</div>
                    <div className="text-[11px] text-slate-300">Bills continuously even during internet blackouts.</div>
                  </div>
                </div>
              </div>

              {/* Step-by-Step Installation Guides */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  How to Install on Any Device:
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                    <div className="font-black text-slate-900 flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-indigo-600" />
                      <span>Windows & Mac (Chrome / Edge / Brave)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Click the <span className="font-bold text-slate-800">Install icon (⊕)</span> in the top right of your browser's address bar, or click Menu (⋮) ➔ <span className="font-bold text-slate-800">"Install Ezee ERP"</span> / <span className="font-bold text-slate-800">"Create Shortcut"</span>.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                    <div className="font-black text-slate-900 flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-emerald-600" />
                      <span>Mobile Phones (Android & iPhone)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      • <span className="font-bold text-slate-800">iPhone / Safari</span>: Tap the <span className="font-bold">Share</span> button ➔ tap <span className="font-bold text-slate-800">"Add to Home Screen"</span>.<br />
                      • <span className="font-bold text-slate-800">Android / Chrome</span>: Tap (⋮) ➔ tap <span className="font-bold text-slate-800">"Install App"</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            <span>Multi-device retail suite ready for instant deployment.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
