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
    `⏱ 前回: <span style="color:${lastColor};">${lastSec.toFixed(1)}s</span>` +
    ` / 平均: <span style="color:${avgColor};">${avgSec.toFixed(1)}s</span>` +
    ` (${entries.length})`;

  container.prepend(el);
}

// --- DOM Observation ---

const WIKI_SELECTOR = '.wiki';
const DOM_TIMEOUT_MS = 10000;

let pendingObserver: MutationObserver | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function cancelPendingWait(): void {
  if (pendingObserver) {
    pendingObserver.disconnect();
    pendingObserver = null;
  }
  if (pendingTimer != null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

function waitForContentChange(
  previousContent: string,
  onDone: () => void,
): void {
  // Cancel any leftover observer from a previous navigation
  cancelPendingWait();

  // Check if already changed
  const wiki = document.querySelector(WIKI_SELECTOR);
  if (wiki && wiki.innerHTML !== previousContent) {
    onDone();
    return;
  }

  pendingTimer = setTimeout(() => {
    cancelPendingWait();
  }, DOM_TIMEOUT_MS);

  pendingObserver = new MutationObserver(() => {
    const el = document.querySelector(WIKI_SELECTOR);
    if (el && el.innerHTML !== previousContent) {
      cancelPendingWait();
      onDone();
    }
  });
  pendingObserver.observe(document.body, { childList: true, subtree: true });
}

// --- Navigation Timing ---

let navigateStart: number | null = null;
let navigateFrom: string | null = null;
let wikiSnapshot: string | null = null;

function onNavigate(e: Event): void {
  const event = e as NavigateEvent;
  const dest = new URL(event.destination.url);


  if (event.navigationType !== 'push' && event.navigationType !== 'traverse') return;
  if (isExcludedPath(dest.pathname)) return;
  if (dest.hash === '#edit') return;

  // Cancel any pending wait from a previous navigation
  cancelPendingWait();

  navigateFrom = location.pathname;
  navigateStart = performance.now();
  wikiSnapshot = document.querySelector(WIKI_SELECTOR)?.innerHTML ?? '';
}

function onNavigateSuccess(): void {
  if (navigateStart == null || navigateFrom == null) return;

  const startSnapshot = navigateStart;
  const fromSnapshot = navigateFrom;
  const contentSnapshot = wikiSnapshot ?? '';

  // Reset immediately so overlapping navigations don't double-fire
  navigateStart = null;
  navigateFrom = null;
  wikiSnapshot = null;

  waitForContentChange(contentSnapshot, () => {
    const duration = performance.now() - startSnapshot;
    const to = location.pathname;

    const entry: TimingEntry = {
      from: fromSnapshot,
      to,
      duration,
      timestamp: Date.now(),
    };
    const entries = saveEntry(entry);
    renderDisplay(entries);
  });
}

// --- Plugin Lifecycle ---

const nav = (): EventTarget | undefined => (window as any).navigation;

export function activate(): void {
  const n = nav();
  if (!n) return;

  // Render existing data on activate
  renderDisplay(loadEntries());

  n.addEventListener('navigate', onNavigate);
  n.addEventListener('navigatesuccess', onNavigateSuccess);
}

export function deactivate(): void {
  cancelPendingWait();
  const n = nav();
  if (n) {
    n.removeEventListener('navigate', onNavigate);
    n.removeEventListener('navigatesuccess', onNavigateSuccess);
  }
  document.getElementById(ELEMENT_ID)?.remove();
  navigateStart = null;
  navigateFrom = null;
}
