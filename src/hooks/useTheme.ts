import { useLayoutEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('geometry-preview-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem('geometry-preview-theme', theme);
    } catch {
      // Theme switching still works when persistence is unavailable.
    }
  }, [theme]);

  return { theme, toggleTheme: () => setTheme((current) => (current === 'light' ? 'dark' : 'light')) };
}
