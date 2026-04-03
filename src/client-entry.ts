// Navigation API type declarations (not yet in TypeScript's standard lib)
interface NavigateEvent extends Event {
  navigationType: 'push' | 'replace' | 'reload' | 'traverse';
  destination: { url: string };
  canIntercept: boolean;
  intercept(options?: { handler?: () => Promise<void> }): void;
}

interface Navigation extends EventTarget {
  addEventListener(
    type: 'navigate',
    listener: (event: NavigateEvent) => void,
  ): void;
  removeEventListener(
    type: 'navigate',
    listener: (event: NavigateEvent) => void,
  ): void;
}

declare global {
  interface Window {
    navigation: Navigation;
    pluginActivators: Record<
      string,
      { activate: () => void; deactivate: () => void }
    >;
  }
}

interface TimingEntry {
  from: string;
  to: string;
  duration: number;
  timestamp: number;
}

const STORAGE_KEY = 'growi-page-load-timer';
const MAX_ENTRIES = 10;

function loadEntries(): TimingEntry[] {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw == null) return [];
  try {
    return JSON.parse(raw) as TimingEntry[];
  } catch {
    return [];
  }
}

function saveEntry(entry: TimingEntry): TimingEntry[] {
  const entries = loadEntries();
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  return entries;
}

const ELEMENT_ID = 'growi-page-load-timer-display';

function getColor(seconds: number): string {
  if (seconds < 1) return '#28a745';
  if (seconds < 3) return '#ffc107';
  return '#dc3545';
}

function renderDisplay(entries: TimingEntry[]): void {
  if (entries.length === 0) return;

  const last = entries[entries.length - 1];
  const lastSec = last.duration / 1000;
  const avgSec =
    entries.reduce((sum, e) => sum + e.duration, 0) / entries.length / 1000;

  const container = document.querySelector('.page-meta');
  if (container == null) return;

  // Remove existing display if present
  document.getElementById(ELEMENT_ID)?.remove();

  const el = document.createElement('div');
  el.id = ELEMENT_ID;
  el.className = 'text-secondary mb-2';
  el.style.fontSize = '0.85em';

  const lastColor = getColor(lastSec);
  const avgColor = getColor(avgSec);

  el.innerHTML =
    `⏱ 前回: <span style="color:${lastColor};font-weight:bold">${lastSec.toFixed(1)}s</span>` +
    ` / 平均: <span style="color:${avgColor};font-weight:bold">${avgSec.toFixed(1)}s</span>` +
    ` (${entries.length})`;

  container.prepend(el);
}

function shouldMeasure(event: NavigateEvent): boolean {
  if (event.navigationType !== 'push' && event.navigationType !== 'traverse') {
    return false;
  }
  if (!event.canIntercept) return false;

  const url = new URL(event.destination.url);
  // Skip API calls
  if (url.pathname.startsWith('/_api/')) return false;
  // Skip edit mode
  if (url.hash === '#edit') return false;

  return true;
}

let navigationHandler: ((event: NavigateEvent) => void) | null = null;

const activate = (): void => {
  if (typeof window.navigation === 'undefined') return;

  // Render existing data on activate
  renderDisplay(loadEntries());

  navigationHandler = (event: NavigateEvent) => {
    if (!shouldMeasure(event)) return;

    const from = location.pathname;
    const start = performance.now();

    event.intercept({
      handler: async () => {
        const duration = performance.now() - start;
        const entry: TimingEntry = {
          from,
          to: new URL(event.destination.url).pathname,
          duration,
          timestamp: Date.now(),
        };
        const entries = saveEntry(entry);
        renderDisplay(entries);
      },
    });
  };

  window.navigation.addEventListener('navigate', navigationHandler);
};

const deactivate = (): void => {
  if (navigationHandler != null && typeof window.navigation !== 'undefined') {
    window.navigation.removeEventListener('navigate', navigationHandler);
    navigationHandler = null;
  }
  document.getElementById(ELEMENT_ID)?.remove();
};

// Register plugin
if (window.pluginActivators == null) {
  window.pluginActivators = {} as typeof window.pluginActivators;
}
window.pluginActivators['growi-plugin-page-load-timer'] = {
  activate,
  deactivate,
};
