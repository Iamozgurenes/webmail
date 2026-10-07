// Browser-tab titles read "<context> - <account> - <app>", the order Gmail and
// Outlook Web use. Browsers cut a long title from the end, so the part that
// changes (folder, unread count, subject) goes first and the app name last.
// The account sits in between, so two mailboxes open side by side stay apart
// in the tab strip and in session restore. Empty parts are left out. (#1159)
export function formatTabTitle(
  context: string | null | undefined,
  account: string | null | undefined,
  appName: string,
): string {
  return [context, account, appName].filter(Boolean).join(' - ');
}

/** What the mail view is showing, already localized. */
export interface MailTitleView {
  /** Composer label while the composer is open ("New message", "Reply", ...). */
  composer?: string | null;
  /** Subject of the open message. */
  subject?: string | null;
  /** Selected mailbox, with its unread count when there is one. */
  mailbox?: string | null;
}

/** The context part of the mail view's tab title: composer, then message, then mailbox. */
export function mailTitleContext(view: MailTitleView): string | null {
  return view.composer || view.subject || view.mailbox || null;
}
