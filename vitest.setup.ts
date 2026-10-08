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
//
// Real Storage objects expose every stored key as an enumerable own
// property (so `Object.keys(localStorage)`, `for...in`, and `JSON.stringify`
// see them), which a plain class instance does not provide on its own --
// its only own property would be the private backing field. Wrap it in a
// Proxy so key access and enumeration both go through the same Map.
//
// Node's own (equally broken, see above) `Storage` class has a
// non-configurable `length` on its prototype, so patching methods onto it
// throws "Cannot redefine property: length" -- and since vitest reuses one
// environment across the files in a worker, that throw lands on whichever
// test file happens to run second. Replace the global `Storage` binding
// itself (also just a configurable global, like `localStorage`) with this
// class instead, so `vi.spyOn(Storage.prototype, 'setItem')` in tests that
// assert on calls made through `localStorage`/`sessionStorage` resolves to
// methods we actually control.
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

for (const target of [globalThis, typeof window !== 'undefined' ? window : undefined]) {
  if (!target) continue;
  Object.defineProperty(target, 'Storage', { value: MemoryStorage, writable: true, configurable: true });
}

function createStorage(): Storage {
  const target = new MemoryStorage();
  return new Proxy(target, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && !(prop in target)) return target.getItem(prop) ?? undefined;
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value) {
      if (typeof prop === 'string' && !(prop in target)) {
        target.setItem(prop, value as string);
        return true;
      }
      return Reflect.set(target, prop, value);
    },
    has(target, prop) {
      return (typeof prop === 'string' && target.getItem(prop) !== null) || Reflect.has(target, prop);
    },
    deleteProperty(target, prop) {
      if (typeof prop === 'string' && !(prop in target)) {
        target.removeItem(prop);
        return true;
      }
      return Reflect.deleteProperty(target, prop);
    },
    ownKeys(target) {
      const stored: string[] = [];
      for (let i = 0; i < target.length; i++) stored.push(target.key(i)!);
      return stored;
    },
    getOwnPropertyDescriptor(target, prop) {
      if (typeof prop === 'string' && !(prop in target) && target.getItem(prop) !== null) {
        return { value: target.getItem(prop), writable: true, enumerable: true, configurable: true };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });
}

for (const prop of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, prop, {
    value: createStorage(),
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

// jsdom's own StorageEvent constructor WebIDL-validates `storageArea` against
// its internal Storage class specifically -- a closed-over reference, not a
// lookup of the global `Storage` we just replaced above -- so it rejects our
// localStorage/sessionStorage as "not of type 'Storage'". Replace the
// constructor too so code that dispatches a real `storage` event (cross-tab
// sync tests) can hand it our storage objects.
class MemoryStorageEvent extends Event {
  readonly key: string | null;
  readonly oldValue: string | null;
  readonly newValue: string | null;
  readonly url: string;
  readonly storageArea: Storage | null;

  constructor(type: string, init: StorageEventInit = {}) {
    super(type, init);
    this.key = init.key ?? null;
    this.oldValue = init.oldValue ?? null;
    this.newValue = init.newValue ?? null;
    this.url = init.url ?? '';
    this.storageArea = init.storageArea ?? null;
  }
}

for (const target of [globalThis, typeof window !== 'undefined' ? window : undefined]) {
  if (!target) continue;
  Object.defineProperty(target, 'StorageEvent', { value: MemoryStorageEvent, writable: true, configurable: true });
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

// Node 25+ ships its own localStorage global, which shadows jsdom's under
// vitest; without --localstorage-file it is an empty object with no Storage
// methods. The zustand persist middleware writes through it on every
// setState and several stores read from it directly, so provide a minimal
// in-memory Storage when the real one is missing or unusable.
if (typeof window !== 'undefined' && typeof window.localStorage?.getItem !== 'function') {
  const backing = new Map<string, string>();
  const localStorage: Storage = {
    get length() {
      return backing.size;
    },
    clear: () => backing.clear(),
    getItem: (key: string) => backing.get(key) ?? null,
    key: (index: number) => [...backing.keys()][index] ?? null,
    removeItem: (key: string) => {
      backing.delete(key);
    },
    setItem: (key: string, value: string) => {
      backing.set(key, String(value));
    },
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorage,
    configurable: true,
  });
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
