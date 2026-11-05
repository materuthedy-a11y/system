'use client';

import { useEffect } from 'react';

const LIGHT_THEME_COLOR = '#f3efe6';
const DARK_THEME_COLOR = '#20211f';

/** Keep browser and installed-PWA chrome aligned with the user's app theme. */
export function PwaThemeColor() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;

    const syncThemeColor = () => {
      const isDark = document.documentElement.classList.contains('dark');
      meta.content = isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    };

    syncThemeColor();
    const observer = new MutationObserver(syncThemeColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  return null;
}
