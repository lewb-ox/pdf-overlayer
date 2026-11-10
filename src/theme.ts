import { useLayoutEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'pdf-overlayer.theme';

function parsePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

function readPreference(): ThemePreference {
  try { return parsePreference(localStorage.getItem(STORAGE_KEY)); }
  catch { return 'system'; }
}

function applyTheme(preference: ThemePreference, systemDark: boolean) {
  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#171e1b' : '#f6f5f1');
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);

  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme(preference, media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [preference]);

  useLayoutEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setPreference(readPreference());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const changePreference = (next: ThemePreference) => {
    setPreference(next);
    // Some browsers block storage. Theme switching still works for this session.
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep the in-memory choice. */ }
  };

  return { preference, changePreference };
}
