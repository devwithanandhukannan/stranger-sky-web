// lib/pwa.ts - Untold PWA Installation Manager

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __untoldPwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function initPwaListener() {
  if (typeof window === 'undefined') return;

  // Register service worker if available
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Listen for beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__untoldPwaPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent('untold-pwa-available'));
  });

  window.addEventListener('appinstalled', () => {
    window.__untoldPwaPrompt = null;
    window.dispatchEvent(new CustomEvent('untold-pwa-installed'));
  });
}

export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export async function promptPwaInstall(): Promise<{ outcome: 'accepted' | 'dismissed' | 'manual' }> {
  if (typeof window === 'undefined') return { outcome: 'dismissed' };

  const prompt = window.__untoldPwaPrompt;
  if (prompt) {
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        window.__untoldPwaPrompt = null;
      }
      return { outcome: choice.outcome };
    } catch {
      return { outcome: 'dismissed' };
    }
  }

  // If no beforeinstallprompt (e.g. iOS Safari or desktop browser without direct prompt), return manual
  return { outcome: 'manual' };
}

