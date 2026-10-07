// Focus view, plus a touch on Clawd that makes him glance over.
import { knockLine, returnNote, visitSnapshot } from './moment.js';

const $ = id => document.getElementById(id);
const VISIT_KEY = 'clawd-workshop-last-look';

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
let glanceTimer = 0;
let visitNoted = false;

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}
function say(text) {
  const bubble = $('speech-bubble');
  if (!bubble) return;
  bubble.textContent = text || '';
  bubble.hidden = !text;
}
function showVisitNote(text) {
  const note = $('visit-note');
  const copy = $('visit-note-text');
  if (!note || !copy || !text) return;
  copy.textContent = text;
  note.hidden = false;
}
function maybeVisitNote(detail) {
  if (visitNoted || detail.demo || detail.mode === 'replay') return;
  if (!detail.data?.checkedAt && !(detail.allEvents || []).length) return;
  visitNoted = true;
  const welcome = returnNote(readJson(VISIT_KEY), visitSnapshot(detail));
  if (welcome) showVisitNote(welcome);
}

window.addEventListener('workshop:render', event => {
  lastDetail = event.detail;
  if (!lastDetail) return;
  maybeVisitNote(lastDetail);
});

$('clawd-tap')?.addEventListener('click', () => {
  const scene = $('scene');
  scene?.classList.add('noticed');
  say(knockLine(lastDetail?.status?.state));
  clearTimeout(glanceTimer);
  glanceTimer = setTimeout(() => {
    scene?.classList.remove('noticed');
    say('');
  }, 2600);
});

$('visit-note-dismiss')?.addEventListener('click', () => {
  $('visit-note').hidden = true;
});

window.addEventListener('pagehide', () => {
  if (!lastDetail || lastDetail.demo || lastDetail.mode === 'replay') return;
  writeJson(VISIT_KEY, visitSnapshot(lastDetail));
});
