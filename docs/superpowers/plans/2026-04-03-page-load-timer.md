# Page Load Timer Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Growi上でview → viewのSPAページ遷移時間を計測し、page-meta領域に表示する軽量プラグイン。

**Architecture:** Navigation APIのnavigateイベントでSPA遷移を検知し、intercept()のPromise完了までの時間をperformance.now()で計測。結果はsessionStorageに直近10回分を保持し、.page-metaにprependでDOM挿入する。

**Tech Stack:** TypeScript, Vite, Navigation API, sessionStorage

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | npm パッケージ定義 + growiPlugin メタデータ |
| `tsconfig.json` | TypeScript コンパイラ設定 |
| `vite.config.ts` | Vite ビルド設定（dist/ に出力） |
| `src/client-entry.ts` | プラグインエントリポイント（activate/deactivate + 計測ロジック + DOM挿入） |

すべてのロジックは `src/client-entry.ts` に収める。ファイルを分割するほどの規模ではない。

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "growi-plugin-page-load-timer",
  "version": "1.0.0",
  "description": "Measures and displays view-to-view page navigation time in Growi",
  "main": "dist/client-entry.js",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.4.0"
  },
  "growiPlugin": {
    "schemaVersion": 4,
    "types": ["script"]
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/client-entry.ts',
      name: 'growi-plugin-page-load-timer',
      fileName: 'client-entry',
      formats: ['iife'],
    },
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts
git commit -m "feat: scaffold project with Vite + TypeScript"
```

---

### Task 2: Navigation API Type Definitions

Navigation APIはTypeScriptの標準lib型に含まれていないため、型定義を追加する。

**Files:**
- Modify: `src/client-entry.ts` (this file will be created in this task with type declarations at the top)

- [ ] **Step 1: Create src/client-entry.ts with type declarations**

```typescript
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
```

- [ ] **Step 2: Verify build succeeds**

Run: `npx vite build`
Expected: Build succeeds (may warn about empty export, that's fine at this stage)

- [ ] **Step 3: Commit**

```bash
git add src/client-entry.ts
git commit -m "feat: add Navigation API type declarations"
```

---

### Task 3: Storage Logic

sessionStorageに計測結果を保存・取得するロジックを実装する。

**Files:**
- Modify: `src/client-entry.ts`

- [ ] **Step 1: Add storage constants and functions**

`src/client-entry.ts` の型定義の後に以下を追加:

```typescript
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
```

- [ ] **Step 2: Verify build succeeds**

Run: `npx vite build`
Expected: Build succeeds without errors

- [ ] **Step 3: Commit**

```bash
git add src/client-entry.ts
git commit -m "feat: add sessionStorage read/write for timing entries"
```

---

### Task 4: DOM Display Logic

計測結果をpage-meta領域にDOM挿入する関数を実装する。

**Files:**
- Modify: `src/client-entry.ts`

- [ ] **Step 1: Add display function**

storage関数の後に以下を追加:

```typescript
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
```

- [ ] **Step 2: Verify build succeeds**

Run: `npx vite build`
Expected: Build succeeds without errors

- [ ] **Step 3: Commit**

```bash
git add src/client-entry.ts
git commit -m "feat: add DOM display rendering for timing results"
```

---

### Task 5: Navigation Listener and Plugin Registration

Navigation APIのイベントリスナーと、activate/deactivateによるプラグイン登録を実装する。

**Files:**
- Modify: `src/client-entry.ts`

- [ ] **Step 1: Add navigation listener and plugin registration**

renderDisplay関数の後に以下を追加:

```typescript
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
```

- [ ] **Step 2: Verify build succeeds**

Run: `npx vite build`
Expected: Build succeeds, `dist/client-entry.iife.js` generated

- [ ] **Step 3: Commit**

```bash
git add src/client-entry.ts
git commit -m "feat: add navigation listener and plugin activate/deactivate"
```

---

### Task 6: Build Verification and Cleanup

最終ビルドを確認し、.gitignoreを追加する。

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create .gitignore**

```
node_modules/
dist/
```

- [ ] **Step 2: Run final build**

Run: `npx vite build`
Expected: Clean build, output in `dist/client-entry.iife.js`

- [ ] **Step 3: Verify dist output is reasonable size**

Run: `ls -la dist/`
Expected: `client-entry.iife.js` exists, small file size (< 5KB)

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: add .gitignore for node_modules and dist"
```
