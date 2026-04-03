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
