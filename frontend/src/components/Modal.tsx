import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ModalSize = "md" | "lg" | "xl" | "2xl" | "3xl";

const SIZE_CLASS: Record<ModalSize, string> = {
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
  "3xl": "max-w-6xl",
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: ModalSize;
  titleId?: string;
}

export default function Modal({ open, onClose, children, size = "lg", titleId }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`modal-panel ${SIZE_CLASS[size]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ModalHeader({
  label,
  title,
  subtitle,
  titleId,
  onClose,
}: {
  label?: string;
  title: string;
  subtitle?: string;
  titleId?: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-panel-header flex shrink-0 items-start justify-between gap-4 border-b border-ink-800 px-8 py-5">
      <div className="min-w-0">
        {label && <p className="mono-label">{label}</p>}
        <h3 id={titleId} className={`font-bold text-white ${label ? "mt-2 text-2xl" : "text-2xl"}`}>
          {title}
        </h3>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      <button type="button" onClick={onClose} className="btn-ghost shrink-0 px-3 py-2 text-lg leading-none" aria-label="Close">
        ×
      </button>
    </div>
  );
}

export function ModalBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`modal-panel-body px-8 py-5 ${className}`}>{children}</div>;
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="modal-panel-footer flex shrink-0 gap-3 border-t border-ink-800 px-8 py-5">
      {children}
    </div>
  );
}
