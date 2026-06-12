import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppNotification,
  fetchNotificationSummary,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api";
import { Page } from "../roles";
import { IconBell } from "./Icons";

interface Props {
  onNavigate: (page: Page) => void;
}

export default function NotificationBell({ onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [summary, list] = await Promise.all([fetchNotificationSummary(), fetchNotifications()]);
      setUnread(summary.unread_count);
      setItems(list);
    } catch {
      /* ignore polling errors */
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 30_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, refresh]);

  async function handleOpenItem(item: AppNotification) {
    if (!item.is_read) {
      await markNotificationRead(item.id);
      setUnread((n) => Math.max(0, n - 1));
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_read: true } : i)));
    }
    if (item.link_page) {
      onNavigate(item.link_page as Page);
    }
    setOpen(false);
  }

  async function handleMarkAll() {
    await markAllNotificationsRead();
    setUnread(0);
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost relative px-3 py-2 text-white hover:text-white"
        aria-label="Notifications"
      >
        <IconBell />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center bg-white px-1 text-[9px] font-bold text-black">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 border border-ink-700 bg-ink-950 shadow-xl">
          <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
            <p className="mono-label">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={handleMarkAll} className="btn-ghost px-2 py-1 text-[10px]">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-500">No notifications yet.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenItem(item)}
                  className={`block w-full border-b border-ink-900 px-4 py-3 text-left hover:bg-ink-900 ${
                    item.is_read ? "opacity-70" : "bg-white/[0.03]"
                  }`}
                >
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-ink-400">{item.message}</p>
                  <p className="mono-label mt-2 text-[9px] text-ink-600">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
