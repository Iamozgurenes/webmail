import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Node 22+ ships its own `localStorage`/`sessionStorage` globals that resolve
// to `undefined` unless the process is started with `--localstorage-file`.
// jsdom detects the native globals and skips installing its own Storage
// polyfill, so under jsdom+this Node every `.setItem()`/`.clear()` call
// throws "Cannot read properties of undefined". Replace both with a plain
// in-memory Storage implementation before any test touches them; the
// descriptor Node defines is configurable, so this fully replaces it rather
// than going through Node's own (broken) setter.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

for (const prop of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, prop, {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, prop, {
      value: globalThis[prop],
      writable: true,
      configurable: true,
    });
  }
}

// jsdom does not implement matchMedia; components that read media queries
// (e.g. responsive layout hooks) call it during render. Provide a minimal
// no-match stub so those components can render under test.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useFormatter: () => ({
    dateTime: (d: Date | string) => String(d),
    relativeTime: (d: Date | string) => String(d),
    number: (n: number) => String(n),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useParams: () => ({ locale: 'en' }),
  usePathname: () => '/en',
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en',
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(() => {
  cleanup();
});
