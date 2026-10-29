"use client";

import { useEffect, useState } from "react";

type ActionFeedbackProps = {
  busy: boolean;
  busyMessage: string;
  message?: string;
  error?: string;
  onDismissError?: () => void;
};

export function ActionFeedback({
  busy,
  busyMessage,
  message = "",
  error = "",
  onDismissError,
}: ActionFeedbackProps) {
  const [dismissedMessage, setDismissedMessage] = useState("");

  useEffect(() => {
    if (busy || error || !message) return;

    const timeout = window.setTimeout(() => setDismissedMessage(message), 3500);
    return () => window.clearTimeout(timeout);
  }, [busy, error, message]);

  const visible = Boolean(busy || error || (message && dismissedMessage !== message));
  if (!visible) return null;

  const isError = Boolean(error);
  const title = isError ? "Action could not be completed" : busy ? busyMessage : "Success";
  const detail = isError ? error : busy ? busyMessage : message;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" role="presentation">
      <div
        role={isError ? "alert" : "status"}
        aria-live="polite"
        className={`w-full max-w-md rounded-2xl border bg-zenith-raised p-8 text-center shadow-2xl ${
          isError
            ? "border-zenith-danger/50 text-zenith-danger"
            : busy
              ? "border-zenith-gold/50 text-zenith-ink"
              : "border-zenith-success/50 text-zenith-success"
        }`}
      >
        {busy ? (
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-zenith-gold/30 border-t-zenith-gold" />
        ) : null}
        <p className="text-xl font-bold">{title}</p>
        <p className="mt-3 text-base">{detail}</p>
        {isError && onDismissError ? (
          <button
            type="button"
            className="mt-6 rounded-xl border-2 border-zenith-gold bg-white px-4 py-2 text-sm font-semibold text-zenith-gold"
            onClick={onDismissError}
          >
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}
