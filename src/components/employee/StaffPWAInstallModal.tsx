import React, { useState, useEffect } from 'react';
import { 
  Download, Smartphone, CheckCircle2, Share2, PlusSquare, 
  Bell, Clock, CheckSquare, ShieldCheck, X, ChevronRight,
  Sparkles, ExternalLink, ArrowDown, Zap
} from 'lucide-react';

interface StaffPWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  installPrompt: any;
  onInstallAccepted?: () => void;
}

export const StaffPWAInstallModal: React.FC<StaffPWAInstallModalProps> = ({
  isOpen,
  onClose,
  installPrompt,
  onInstallAccepted
}) => {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string>('default');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isIOSDevice);

    // Detect standalone mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Check notification status
    if ('Notification' in window) {
      setNotificationStatus(Notification.permission);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    if (!installPrompt) {
      // If native prompt not captured yet (or on unsupported browser), request notification as fallback
      handleRequestNotification();
      return;
    }

    try {
      setIsInstalling(true);
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        setInstallSuccess(true);
        if (onInstallAccepted) onInstallAccepted();
        // Request notifications alongside install
        handleRequestNotification();
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err) {
      console.warn('[PWA Install Error]:', err);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleRequestNotification = async () => {
    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationStatus(perm);
        if (perm === 'granted' && 'vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
      } catch (err) {
        console.warn('[Notification Perm Error]:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-2xl text-white space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-base text-white">Staff Mobile App</h3>
                <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-500/30">
                  PWA
                </span>
              </div>
              <p className="text-xs text-slate-400">Install to your phone's Home Screen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status Badge if already installed */}
        {isStandalone ? (
          <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold">App is Installed & Running Standalone</p>
              <p className="text-[11px] text-emerald-400/80">You are using the dedicated mobile portal experience.</p>
            </div>
          </div>
        ) : installSuccess ? (
          <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold">Installation Initiated!</p>
              <p className="text-[11px] text-emerald-400/80">The Staff Portal icon will now appear on your phone's home screen.</p>
            </div>
          </div>
        ) : null}

        {/* Benefits Grid */}
        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Why Install the Staff App:</p>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-slate-200">1-Tap Fast Clock In / Out</p>
                <p className="text-[11px] text-slate-400">Log shifts instantly right from your phone home screen without opening a browser.</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <CheckSquare className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-slate-200">Live Task Assignments & Replies</p>
                <p className="text-[11px] text-slate-400">View tasks from managers, post fast status updates, and chat in task threads.</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-slate-200">Instant Assignment Alerts</p>
                <p className="text-[11px] text-slate-400">Get push notifications and haptic feedback as soon as tasks are assigned.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Install Flow Instructions based on device */}
        {!isStandalone && (
          <div className="pt-2">
            {isIOS ? (
              <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-xs space-y-3">
                <div className="flex items-center gap-2 text-blue-300 font-bold">
                  <Share2 className="h-4 w-4 text-blue-400" />
                  <span>How to Install on iPhone / iPad (Safari):</span>
                </div>
                <ol className="space-y-2 text-slate-300 text-[11px] list-decimal list-inside leading-relaxed pl-1">
                  <li>
                    Tap the <strong className="text-white">Share</strong> icon (<span className="inline-block px-1 py-0.5 rounded bg-slate-800 text-[10px] text-blue-400 border border-slate-700">⎋ or Share</span>) in Safari's bottom toolbar.
                  </li>
                  <li>
                    Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong> (<span className="inline-block px-1 py-0.5 rounded bg-slate-800 text-[10px] text-blue-400 border border-slate-700">＋</span>).
                  </li>
                  <li>
                    Tap <strong className="text-white">"Add"</strong> at the top right to complete installation.
                  </li>
                </ol>
              </div>
            ) : installPrompt ? (
              <button
                type="button"
                disabled={isInstalling}
                onClick={handleNativeInstall}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 transition transform active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                <span>{isInstalling ? 'Installing App...' : 'Install Staff App on Mobile'}</span>
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleRequestNotification}
                  className="w-full py-2.5 px-4 rounded-2xl bg-blue-600/30 border border-blue-500/50 hover:bg-blue-600/50 text-blue-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Bell className="h-4 w-4" />
                  <span>{notificationStatus === 'granted' ? 'Notifications Enabled ✓' : 'Enable Assignment Alerts'}</span>
                </button>
                <p className="text-[11px] text-slate-400 text-center">
                  To install, open browser menu (⋮) and tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Notifications Permission Request Row */}
        {notificationStatus !== 'granted' && (
          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-slate-300 text-[11px]">Allow task assignment notifications</span>
            </div>
            <button
              onClick={handleRequestNotification}
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] cursor-pointer"
            >
              Allow
            </button>
          </div>
        )}

        {/* Bottom Close / Dismiss */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
          >
            {isStandalone || installSuccess ? 'Done' : 'Maybe Later'}
          </button>
        </div>
      </div>
    </div>
  );
};
