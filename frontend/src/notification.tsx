import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import Toast, { type ToastMessage } from "./components/Toast";
import type { Page } from "./roles";

export type NotifyOptions = {
  message: string;
  type?: "success" | "error";
  page?: Page;
  scrollTo?: string;
  onAfterNavigate?: () => void;
};

type NotificationContextValue = {
  notify: (options: NotifyOptions) => void;
  notifySuccess: (message: string, options?: Omit<NotifyOptions, "message" | "type">) => void;
  notifyError: (message: string, options?: Omit<NotifyOptions, "message" | "type">) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function scrollToSection(id: string, delay = 200) {
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, delay);
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return ctx;
}

interface ProviderProps {
  children: ReactNode;
  navigateTo: (page: Page) => void;
}

export function NotificationProvider({ children, navigateTo }: ProviderProps) {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const notify = useCallback(
    (options: NotifyOptions) => {
      const { message, type = "success", page, scrollTo, onAfterNavigate } = options;
      setToast({ id: Date.now(), text: message, type });

      if (page) {
        navigateTo(page);
      }

      if (onAfterNavigate) {
        window.setTimeout(onAfterNavigate, page ? 120 : 0);
      }

      if (scrollTo) {
        scrollToSection(scrollTo, page ? 350 : 150);
      }
    },
    [navigateTo],
  );

  const notifySuccess = useCallback(
    (message: string, options?: Omit<NotifyOptions, "message" | "type">) => {
      notify({ ...options, message, type: "success" });
    },
    [notify],
  );

  const notifyError = useCallback(
    (message: string, options?: Omit<NotifyOptions, "message" | "type">) => {
      notify({ ...options, message, type: "error" });
    },
    [notify],
  );

  return (
    <NotificationContext.Provider value={{ notify, notifySuccess, notifyError }}>
      {children}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </NotificationContext.Provider>
  );
}
