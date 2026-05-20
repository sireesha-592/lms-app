import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // default dark
  });

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const theme = isDark ? darkTheme : lightTheme;

  // Apply theme to body + CSS variables (all pages auto-update)
  useEffect(() => {
    document.body.style.background = theme.pageBg;
    document.body.style.color = theme.textPrimary;

    const root = document.documentElement;
    root.style.setProperty('--page-bg',        theme.pageBg);
    root.style.setProperty('--sidebar-bg',     theme.sidebarBg);
    root.style.setProperty('--card-bg',        theme.cardBg);
    root.style.setProperty('--input-bg',       theme.inputBg);
    root.style.setProperty('--hover-bg',       theme.hoverBg);
    root.style.setProperty('--border',         theme.border);
    root.style.setProperty('--border-hover',   theme.borderHover);
    root.style.setProperty('--text-primary',   theme.textPrimary);
    root.style.setProperty('--text-secondary', theme.textSecondary);
    root.style.setProperty('--text-muted',     theme.textMuted);
    root.style.setProperty('--nav-inactive',   theme.navInactiveColor);
    root.style.setProperty('--nav-active-bg',  theme.navActiveBg);
    root.style.setProperty('--nav-active',     theme.navActiveColor);
    root.style.setProperty('--toggle-bg',      theme.toggleBg);
    root.style.setProperty('--toggle-color',   theme.toggleColor);
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ─── Dark Theme ───────────────────────────────────────────
const darkTheme = {
  pageBg:           '#0a0d14',
  sidebarBg:        '#0d1118',
  cardBg:           '#0d1118',
  inputBg:          '#0a0d14',
  hoverBg:          '#1a1f2e',
  border:           '#1e2535',
  borderHover:      '#2a2d3e',
  textPrimary:      '#ffffff',
  textSecondary:    '#94a3b8',
  textMuted:        '#555',
  accent:           '#00d4aa',
  accentPurple:     '#7c6af5',
  accentOrange:     '#f5a623',
  accentRed:        '#f55555',
  navActiveBg:      '#00d4aa15',
  navActiveColor:   '#00d4aa',
  navInactiveColor: '#666',
  toggleBg:         '#1e2535',
  toggleColor:      '#fff',
};

// ─── Light Theme ──────────────────────────────────────────
const lightTheme = {
  pageBg:           '#f0f4f8',
  sidebarBg:        '#ffffff',
  cardBg:           '#ffffff',
  inputBg:          '#f8fafc',
  hoverBg:          '#f0f4f8',
  border:           '#e2e8f0',
  borderHover:      '#cbd5e1',
  textPrimary:      '#1a1a2e',
  textSecondary:    '#64748b',
  textMuted:        '#94a3b8',
  accent:           '#00b896',
  accentPurple:     '#6c5ce7',
  accentOrange:     '#f5a623',
  accentRed:        '#e74c3c',
  navActiveBg:      '#00b89615',
  navActiveColor:   '#00b896',
  navInactiveColor: '#94a3b8',
  toggleBg:         '#e2e8f0',
  toggleColor:      '#1a1a2e',
};