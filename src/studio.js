// Focus view, plus the day outside the window, a knock, and a postcard.
import { knockLine, momentLine, paintPostcard, postcardModel, returnNote, selectWindowBirds, visitSnapshot } from './moment.js';

const $ = id => document.getElementById(id);
const VISIT_KEY = 'clawd-workshop-last-look';
const HINT_KEY = 'clawd-workshop-hint-seen';
const HINT = 'The little marks in the window are today\'s public updates. Open the window to read them, or knock.';

const workshop = document.getElementById('workshop');
const button = document.getElementById('focus-button');
const dialog = document.getElementById('focus-dialog');
const home = document.createComment('workshop home');
workshop.before(home);
let scrollPosition = 0;

button.addEventListener('click', () => {
  if (dialog.open) { dialog.close(); return; }
  scrollPosition = window.scrollY;
  dialog.append(workshop);
  document.documentElement.classList.add('workshop-focused');
  dialog.showModal();
  button.setAttribute('aria-pressed', 'true');
  button.setAttribute('aria-label', 'Exit workshop focus view');
  button.title = 'Exit focus view · Escape';
  button.querySelector('span').textContent = 'Exit focus';
  button.focus();
});

dialog.addEventListener('close', () => {
  home.after(workshop);
  document.documentElement.classList.remove('workshop-focused');
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', 'Enlarge the workshop');
  button.title = 'Enlarge the workshop';
  button.querySelector('span').textContent = 'Focus view';
  window.scrollTo({ top: scrollPosition, behavior: 'instant' });
  button.focus({ preventScroll: true });
});

dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});

let lastDetail = null;
let knockTimer = 0;
let knockActive = false;
let visitNoted = false;

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}
function say(text) {
  const bubble = $('speech-bubble');
  if (bubble && bubble.textContent !== text) bubble.textContent = text;
}
function setWindowOpen(open) {
  const panel = $('window-day');
  if (!panel) return;
  panel.hidden = !open;
  for (const id of ['window-button', 'window-open']) {
    const control = $(id);
    if (!control) continue;
    control.setAttribute('aria-expanded', String(open));
  }
  if (open) $('window-day-close')?.focus();
}
function paintFlock(birds) {
  const flock = $('window-flock');
  if (!flock) return;
  const existing = new Map([...flock.children].map(node => [node.dataset.id, node]));
  const next = new Set();
  for (const bird of birds) {
    next.add(bird.id);
    let node = existing.get(bird.id);
    if (!node) {
      node = document.createElement('i');
      node.className = 'window-bird';
      node.dataset.id = bird.id;
      flock.append(node);
    }
    node.style.left = `${bird.x}%`;
    node.style.top = `${bird.y}%`;
  }
  for (const [id, node] of existing) if (!next.has(id)) node.remove();
}
function paintDay(birds, demo) {
  const list = $('window-day-list');
  const empty = $('window-day-empty');
  const note = $('window-day-note');
  if (!list || !empty) return;
  list.replaceChildren();
  empty.hidden = birds.length > 0;
  list.hidden = birds.length === 0;
  if (note) note.textContent = demo
    ? 'Sample birds from the demo day. They are not Clawd\'s real activity.'
    : 'The latest public updates in the fetched day. Private work stays invisible.';
  for (const bird of birds) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = bird.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const title = document.createElement('strong');
    title.textContent = bird.title;
    const meta = document.createElement('span');
    meta.textContent = [bird.repo, bird.detail, bird.when].filter(Boolean).join(' · ');
    link.append(title, meta);
    if (demo) {
      const tag = document.createElement('em');
      tag.textContent = 'Sample';
      link.append(tag);
    }
    li.append(link);
    list.append(li);
  }
  const count = birds.length;
  const label = count
    ? `Open the window. ${count} public update${count === 1 ? '' : 's'} outside.`
    : 'Open the window. No public updates in this view yet.';
  $('window-button')?.setAttribute('aria-label', label);
}
function showVisitNote(text) {
  const note = $('visit-note');
  const copy = $('visit-note-text');
  if (!note || !copy || !text) return;
  copy.textContent = text;
  note.hidden = false;
}
function maybeVisitNote(detail) {
  if (visitNoted || detail.mode === 'replay') return;
  if (!detail.data?.checkedAt && !(detail.allEvents || []).length) return;
  visitNoted = true;
  if (!detail.demo) {
    const welcome = returnNote(readJson(VISIT_KEY), visitSnapshot(detail));
    if (welcome) { showVisitNote(welcome); writeJson(HINT_KEY, true); return; }
  }
  if (!readJson(HINT_KEY)) { showVisitNote(HINT); writeJson(HINT_KEY, true); }
}
function shareHref() {
  return `${location.origin}${location.pathname}`;
}
function fillPostcard() {
  const model = postcardModel(lastDetail || { status: { state: 'unknown' } }, shareHref());
  $('postcard-line').textContent = model.line;
  $('postcard-project').textContent = model.project;
  $('postcard-stamp').textContent = model.stamp;
  $('postcard-foot').textContent = [model.when, model.href].filter(Boolean).join(' · ');
  $('postcard-status').textContent = '';
  return model;
}
async function copyMoment(model) {
  const status = $('postcard-status');
  try {
    await navigator.clipboard.writeText(model.caption);
    status.textContent = 'Copied. Paste it anywhere.';
  } catch {
    status.textContent = 'Copy was blocked. Select the card text instead.';
  }
}
async function savePostcard(model) {
  const status = $('postcard-status');
  try {
    if (document.fonts?.load) {
      await document.fonts.load('16px "DM Sans"');
      await document.fonts.load('52px Georgia');
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    paintPostcard(ctx, model);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('empty image');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clawd-workshop-moment.png';
    link.click();
    URL.revokeObjectURL(url);
    status.textContent = 'Saved a picture of this moment.';
  } catch {
    status.textContent = 'Couldn\'t save the image. Copy the moment instead.';
  }
}

window.addEventListener('workshop:render', event => {
  lastDetail = event.detail;
  const detail = lastDetail;
  if (!detail) return;
  const demo = !!detail.demo;
  const replay = detail.mode === 'replay';
  const birds = selectWindowBirds(detail.allEvents || []);
  paintFlock(birds);
  paintDay(birds, demo);
  if (!knockActive) say(momentLine(detail.status, { demo, replay }));
  maybeVisitNote(detail);
});

$('knock-button')?.addEventListener('click', () => {
  const scene = $('scene');
  scene?.classList.add('noticed', 'knocking');
  knockActive = true;
  say(knockLine(lastDetail?.status?.state));
  clearTimeout(knockTimer);
  knockTimer = setTimeout(() => {
    scene?.classList.remove('noticed', 'knocking');
    knockActive = false;
    if (lastDetail) say(momentLine(lastDetail.status, { demo: !!lastDetail.demo, replay: lastDetail.mode === 'replay' }));
  }, 2600);
  setTimeout(() => scene?.classList.remove('knocking'), 700);
});

function openWindow() {
  setWindowOpen($('window-day')?.hidden !== false);
}
$('window-button')?.addEventListener('click', openWindow);
$('window-open')?.addEventListener('click', openWindow);
$('window-day-close')?.addEventListener('click', () => {
  setWindowOpen(false);
  $('window-open')?.focus();
});
$('visit-note-dismiss')?.addEventListener('click', () => {
  $('visit-note').hidden = true;
  writeJson(HINT_KEY, true);
});

const postcard = $('postcard-dialog');
$('postcard-button')?.addEventListener('click', () => {
  fillPostcard();
  postcard?.showModal();
});
$('postcard-close')?.addEventListener('click', () => postcard?.close());
postcard?.addEventListener('click', event => {
  if (event.target !== postcard) return;
  const rect = postcard.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) postcard.close();
});
$('postcard-copy')?.addEventListener('click', () => copyMoment(fillPostcard()));
$('postcard-save')?.addEventListener('click', () => savePostcard(fillPostcard()));
$('postcard-share')?.addEventListener('click', async () => {
  const model = fillPostcard();
  if (typeof navigator.share !== 'function') { await copyMoment(model); return; }
  try { await navigator.share({ title: 'Clawd workshop', text: model.caption, url: model.href }); }
  catch (error) { if (error?.name !== 'AbortError') await copyMoment(model); }
});
if (typeof navigator.share !== 'function' && $('postcard-share')) $('postcard-share').hidden = true;

window.addEventListener('pagehide', () => {
  if (!lastDetail || lastDetail.demo || lastDetail.mode === 'replay') return;
  writeJson(VISIT_KEY, visitSnapshot(lastDetail));
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || $('window-day')?.hidden) return;
  if (dialog.open || postcard?.open || $('about-dialog')?.open) return;
  setWindowOpen(false);
});
