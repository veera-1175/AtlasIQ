import { useEffect } from "react";

export interface ToastMessage {
  id: number;
  text: string;
  type: "success" | "error";
}

interface Props {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export default function Toast({ toast, onDismiss }: Props) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isSuccess = toast.type === "success";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`toast-banner animate-fade-in-up ${isSuccess ? "toast-banner-success" : "toast-banner-error"}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg leading-none" aria-hidden>
          {isSuccess ? "✓" : "!"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="mono-label">{isSuccess ? "Completed" : "Failed"}</p>
          <p className="mt-1 text-sm text-white">{toast.text}</p>
        </div>
        <button type="button" onClick={onDismiss} className="mono-label shrink-0 hover:text-white">
          Dismiss
        </button>
      </div>
    </div>
  );
}
