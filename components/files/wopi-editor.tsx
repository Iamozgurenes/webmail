"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, X } from "@/components/icons";
import type { FileResource } from "@/stores/file-store";

interface WopiEditorProps {
  resource: FileResource;
  /** Files account id of the browsing account (multi-account contexts). */
  accountId?: string | null;
  onClose: () => void;
}

interface LaunchData {
  url: string;
  accessToken: string;
  accessTokenTtl: number;
  readOnly: boolean;
}

/**
 * Full-screen WOPI editor overlay (#425). The editor (Collabora Online,
 * OnlyOffice/EuroOffice, ...) is launched the way the WOPI spec prescribes:
 * a form POST of the access token to the editor URL, targeted at an iframe.
 */
export function WopiEditor({ resource, accountId, onClose }: WopiEditorProps) {
  const t = useTranslations("files");
  const [launch, setLaunch] = useState<LaunchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wopi/launch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: resource.id, accountId: accountId || undefined }),
        });
        if (!res.ok) throw new Error(`launch failed (${res.status})`);
        const data = (await res.json()) as LaunchData;
        if (!cancelled) setLaunch(data);
      } catch {
        if (!cancelled) setError(t("office_error"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resource.id, accountId, t]);

  // Submit the launch form exactly once, after it is in the DOM.
  useEffect(() => {
    if (launch && formRef.current && !submittedRef.current) {
      submittedRef.current = true;
      formRef.current.submit();
    }
  }, [launch]);

  // Close on Escape and when the editor posts a close message
  // (Collabora sends {"MessageId":"close"} / UI_Close via postMessage).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onMessage = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      try {
        const msg = JSON.parse(e.data) as { MessageId?: string };
        if (msg.MessageId === "close" || msg.MessageId === "UI_Close") onClose();
      } catch {
        // Not a WOPI post message - ignore.
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("message", onMessage);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-border shrink-0">
        <span className="text-sm font-medium text-foreground truncate">{resource.name}</span>
        <button
          onClick={onClose}
          aria-label={t("office_close")}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {error}
          </div>
        ) : (
          <>
            {!frameLoaded && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("office_loading")}
              </div>
            )}
            <iframe
              name="wopi-editor-frame"
              title={resource.name}
              className="w-full h-full border-0"
              onLoad={() => setFrameLoaded(true)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
              referrerPolicy="no-referrer"
              allow="clipboard-read; clipboard-write"
            />
            {launch && (
              <form
                ref={formRef}
                action={launch.url}
                method="POST"
                target="wopi-editor-frame"
                hidden
              >
                <input name="access_token" value={launch.accessToken} type="hidden" readOnly />
                <input name="access_token_ttl" value={String(launch.accessTokenTtl)} type="hidden" readOnly />
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
