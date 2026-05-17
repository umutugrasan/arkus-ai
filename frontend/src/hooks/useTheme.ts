import { useEffect, useState } from 'react';

function readIsDark(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/**
 * Tracks the active theme by observing the `dark` class on <html>.
 * Works regardless of how the theme is toggled (curtain-theme-toggle, etc.).
 */
export function useTheme(): { isDark: boolean } {
  const [isDark, setIsDark] = useState<boolean>(readIsDark);

  useEffect(() => {
    const target = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(readIsDark()));
    observer.observe(target, { attributes: true, attributeFilter: ['class'] });
    setIsDark(readIsDark());
    return () => observer.disconnect();
  }, []);

  return { isDark };
}
