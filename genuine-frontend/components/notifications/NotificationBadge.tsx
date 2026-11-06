'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { notificationsAPI } from '@/lib/api/notifications';
import { notify } from '@/components/ui/AppToaster';

export function NotificationBadge() {
  const user = useAuthStore((state) => state.user);
  const [unread, setUnread] = useState(0);
  const initialized = useRef(false);
  const seen = useRef(new Set<string>());
  useEffect(() => {
    if (!user?.id || !user.businessId) { setUnread(0); initialized.current = false; seen.current.clear(); return; }
    let active = true;
    const refresh = async () => {
      try {
        const page = await notificationsAPI.inbox({ page: 1, limit: 8 });
        if (!active) return;
        setUnread(page.unreadCount);
        const newest = page.data.filter((entry) => !entry.isRead);
        if (initialized.current) {
          const arrivals = newest.filter((entry) => !seen.current.has(entry.id));
          if (arrivals.length) notify.info(arrivals.length === 1 ? arrivals[0].subject : `${arrivals.length} new notifications`);
        }
        newest.forEach((entry) => seen.current.add(entry.id));
        initialized.current = true;
      } catch { /* Inbox access can fail temporarily; the notifications page has a retry action. */ }
    };
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60_000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [user?.id, user?.businessId]);
  return <Link href="/dashboard/notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative rounded-xl bg-[#f0f7c9] p-2 text-[#596b05] transition hover:bg-[#e7f49d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:bg-[#28301c] dark:text-[#d8f04b] dark:hover:bg-[#343d22]">
    <Bell size={18}/>{unread > 0 ? <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full border border-white bg-rose-600 px-1 text-[9px] font-bold leading-none text-white dark:border-[#20211f]">{unread > 99 ? '99+' : unread}</span> : null}
  </Link>;
}
