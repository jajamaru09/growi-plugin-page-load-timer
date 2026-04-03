// Navigation API type declarations (not yet in TypeScript's standard lib)
interface NavigationDestination {
  url: string;
}

interface NavigateEvent extends Event {
  navigationType: 'push' | 'replace' | 'reload' | 'traverse';
  destination: NavigationDestination;
}

interface TimingEntry {
  from: string;
  to: string;
  duration: number;
  timestamp: number;
}

const STORAGE_KEY = 'growi-page-load-timer';
const MAX_ENTRIES = 10;
const ELEMENT_ID = 'growi-page-load-timer-display';

const EXCLUDED_PATHS = ['/admin', '/trash', '/me', '/login', '/_search', '/_api/'];

function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_PATHS.some(p => pathname.startsWith(p));
}

// --- Storage ---

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

// --- Display ---

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

  const container = document.querySelector('[class*="page-meta"]');
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

// --- DOM Observation ---

const PAGE_META_SELECTOR = '[class*="page-meta"]';
const DOM_TIMEOUT_MS = 10000;

function waitForPageMeta(): Promise<Element> {
  return new Promise((resolve, reject) => {
    // Already present — resolve immediately
    const existing = document.querySelector(PAGE_META_SELECTOR);
    if (existing) { resolve(existing); return; }

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`page-meta not found within ${DOM_TIMEOUT_MS}ms`));
    }, DOM_TIMEOUT_MS);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(PAGE_META_SELECTOR);
      if (el) {
        clearTimeout(timer);
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// --- Navigation Timing ---

let navigateStart: number | null = null;
let navigateFrom: string | null = null;

function onNavigate(e: Event): void {
  const event = e as NavigateEvent;
  const dest = new URL(event.destination.url);

  console.log('[page-load-timer] navigate event:', event.navigationType, dest.pathname);

  if (event.navigationType !== 'push' && event.navigationType !== 'traverse') return;
  if (isExcludedPath(dest.pathname)) return;
  if (dest.hash === '#edit') return;

  navigateFrom = location.pathname;
  navigateStart = performance.now();
  console.log('[page-load-timer] timing started from', navigateFrom);
}

function onNavigateSuccess(): void {
  if (navigateStart == null || navigateFrom == null) return;

  const startSnapshot = navigateStart;
  const fromSnapshot = navigateFrom;

  // Reset immediately so overlapping navigations don't double-fire
  navigateStart = null;
  navigateFrom = null;

  console.log('[page-load-timer] navigatesuccess, waiting for page-meta DOM...');

  waitForPageMeta()
    .then(() => {
      const duration = performance.now() - startSnapshot;
      const to = location.pathname;

      console.log('[page-load-timer] page-meta appeared:', duration.toFixed(0), 'ms', fromSnapshot, '->', to);

      const entry: TimingEntry = {
        from: fromSnapshot,
        to,
        duration,
        timestamp: Date.now(),
      };
      const entries = saveEntry(entry);
      renderDisplay(entries);
    })
    .catch((err) => {
      console.error('[page-load-timer]', err);
    });
}

// --- Plugin Lifecycle ---

const nav = (): EventTarget | undefined => (window as any).navigation;

export function activate(): void {
  console.log('[page-load-timer] activate() called');
  const n = nav();
  if (!n) {
    console.log('[page-load-timer] Navigation API not available');
    return;
  }

  // Render existing data on activate
  renderDisplay(loadEntries());

  n.addEventListener('navigate', onNavigate);
  n.addEventListener('navigatesuccess', onNavigateSuccess);
  console.log('[page-load-timer] listeners registered');
}

export function deactivate(): void {
  const n = nav();
  if (n) {
    n.removeEventListener('navigate', onNavigate);
    n.removeEventListener('navigatesuccess', onNavigateSuccess);
  }
  document.getElementById(ELEMENT_ID)?.remove();
  navigateStart = null;
  navigateFrom = null;
}
