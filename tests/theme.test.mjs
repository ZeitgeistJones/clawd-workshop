import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function loadTheme({ saved = null, prefersDark = false } = {}) {
  const source = await readFile(new URL('../src/theme.js', import.meta.url), 'utf8');
  const storage = new Map();
  if (saved) storage.set('clawd-workshop-theme', saved);
  const button = {
    attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(name, fn) { this.click = fn; },
  };
  const meta = { content: '#eef2ef', setAttribute(key, value) { if (key === 'content') this.content = value; } };
  const html = {
    theme: 'light',
    getAttribute(key) { return key === 'data-theme' ? this.theme : null; },
    setAttribute(key, value) { if (key === 'data-theme') this.theme = value; },
  };
  const context = {
    document: {
      documentElement: html,
      getElementById: id => id === 'theme-toggle' ? button : null,
      querySelector: sel => sel === 'meta[name="theme-color"]' ? meta : null,
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    matchMedia: () => ({ matches: prefersDark }),
  };
  vm.runInNewContext(source.replace(/export /g, ''), context);
  return { html, button, meta, storage, setTheme: context.setTheme, isDark: context.isDark };
}

test('theme follows a saved pick and toggles between light and dark', async () => {
  const h = await loadTheme({ saved: 'dark' });
  assert.equal(h.html.theme, 'dark');
  assert.equal(h.meta.content, '#141a17');
  assert.equal(h.button.attributes['aria-pressed'], 'true');
  h.button.click();
  assert.equal(h.html.theme, 'light');
  assert.equal(h.storage.get('clawd-workshop-theme'), 'light');
  assert.equal(h.meta.content, '#eef2ef');
});

test('with no saved theme, the system preference picks the starting mode', async () => {
  const dark = await loadTheme({ prefersDark: true });
  assert.equal(dark.html.theme, 'dark');
  const light = await loadTheme({ prefersDark: false });
  assert.equal(light.html.theme, 'light');
});
