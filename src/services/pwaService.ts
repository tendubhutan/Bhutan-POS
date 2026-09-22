// PWA Service to capture beforeinstallprompt and manage installation state
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((cb) => cb());
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    listeners.forEach((cb) => cb());
  });
}

export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export function canInstallPwa(): boolean {
  return globalDeferredPrompt !== null;
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return globalDeferredPrompt;
}

export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!globalDeferredPrompt) {
    return 'unavailable';
  }
  try {
    const promptEvent = globalDeferredPrompt;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') {
      globalDeferredPrompt = null;
      listeners.forEach((cb) => cb());
      return 'accepted';
    } else {
      return 'dismissed';
    }
  } catch (err) {
    console.warn('[PWA Install Error]:', err);
    return 'unavailable';
  }
}

export function subscribePwaState(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
