import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@/hooks/use-config', () => ({ useConfig: () => ({ appName: 'Acme Mail' }) }));

import { useDocumentTitle } from '@/hooks/use-document-title';
import { useAccountStore, type AccountEntry } from '@/stores/account-store';

const account = (id: string, email: string) => ({ id, email }) as AccountEntry;

/**
 * What Next does on a client-side navigation: it renders the root layout's
 * metadata <title> again, after the new surface has mounted.
 */
function rerenderMetadataTitle(title = 'Acme Mail'): void {
  document.head.querySelectorAll('title').forEach((el) => el.remove());
  const el = document.createElement('title');
  el.textContent = title;
  document.head.appendChild(el);
}

/** Drains MutationObserver callbacks. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('useDocumentTitle', () => {
  beforeEach(() => {
    document.title = '';
    useAccountStore.setState({
      accounts: [account('a', 'jane@example.com'), account('b', 'joe@example.com')],
      activeAccountId: 'a',
    });
  });

  it('names the active account between the context and the app', () => {
    renderHook(() => useDocumentTitle('Calendar'));
    expect(document.title).toBe('Calendar - jane@example.com - Acme Mail');
  });

  it('follows an account switch', () => {
    renderHook(() => useDocumentTitle('Calendar'));
    act(() => useAccountStore.setState({ activeAccountId: 'b' }));
    expect(document.title).toBe('Calendar - joe@example.com - Acme Mail');
  });

  it('shows the account and the app when the surface adds no context', () => {
    renderHook(() => useDocumentTitle());
    expect(document.title).toBe('jane@example.com - Acme Mail');
  });

  it('shows the context and the app when no account is in view', () => {
    useAccountStore.setState({ accounts: [], activeAccountId: null });
    renderHook(() => useDocumentTitle('Settings'));
    expect(document.title).toBe('Settings - Acme Mail');
  });

  it('puts its title back when the metadata title is rendered again', async () => {
    renderHook(() => useDocumentTitle('Settings'));
    rerenderMetadataTitle();
    await waitFor(() => expect(document.title).toBe('Settings - jane@example.com - Acme Mail'));
  });

  it('leaves the title to the surface that set it last', async () => {
    renderHook(() => useDocumentTitle('Inbox'));
    renderHook(() => useDocumentTitle('Settings'));
    rerenderMetadataTitle();
    await waitFor(() => expect(document.title).toBe('Settings - jane@example.com - Acme Mail'));
    await settle();
    expect(document.title).toBe('Settings - jane@example.com - Acme Mail');
  });

  it('stops re-applying once unmounted', async () => {
    const { unmount } = renderHook(() => useDocumentTitle('Settings'));
    unmount();
    rerenderMetadataTitle('Sign in');
    await settle();
    expect(document.title).toBe('Sign in');
  });
});
