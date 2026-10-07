/* Light / dark chrome. Remembers your pick; otherwise follows the system. */
const KEY = 'clawd-workshop-theme';
const LIGHT_COLOR = '#eef2ef';
const DARK_COLOR = '#141a17';

const $ = id => document.getElementById(id);

function prefersDark() {
  try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
}

function savedTheme() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

export function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

export function setTheme(mode) {
  const dark = mode === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch { /* Storage may be disabled. */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? DARK_COLOR : LIGHT_COLOR);
  const button = $('theme-toggle');
  if (!button) return;
  button.setAttribute('aria-pressed', String(dark));
  button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  button.title = dark ? 'Light mode' : 'Dark mode';
}

export function initTheme() {
  setTheme(savedTheme() || (prefersDark() ? 'dark' : 'light'));
  $('theme-toggle')?.addEventListener('click', () => setTheme(isDark() ? 'light' : 'dark'));
}

initTheme();
