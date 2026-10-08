// Focus view, a touch on Clawd, and @clawd.
import { parseMention } from './ask.js';
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
let asking = false;

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
  if (asking) return;
  const scene = $('scene');
  scene?.classList.add('noticed');
  say(knockLine(lastDetail?.status?.state));
  clearTimeout(glanceTimer);
  glanceTimer = setTimeout(() => {
    scene?.classList.remove('noticed');
    say('');
  }, 2600);
});

async function askClawd(text) {
  const question = parseMention(text);
  if (question === null || asking) return;
  clearTimeout(glanceTimer);
  const scene = $('scene');
  const refuse = line => {
    say(line);
    scene?.classList.remove('noticed');
    clearTimeout(glanceTimer);
    glanceTimer = setTimeout(() => say(''), 4200);
  };
  if (lastDetail?.demo) { refuse('This is a sample workshop. Ask me on the live page.'); return; }
  if (lastDetail?.mode === 'replay') { refuse('This is a replay. Ask me on the live workshop.'); return; }
  const repo = lastDetail?.status?.repo;
  if (!question) { refuse('Ask me something about the repo on the bench.'); return; }
  if (!repo) { refuse('Nothing is on the bench yet.'); return; }
  asking = true;
  scene?.classList.add('noticed');
  say('Looking at the public repo…');
  try {
    const response = await globalThis.fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, repo }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      say(response.status === 429 ? 'Give me a moment.' : response.status === 503 ? 'I cannot answer on this copy of the workshop yet.' : 'I could not read the public repo just now.');
      return;
    }
    say(typeof data?.answer === 'string' && data.answer.trim() ? data.answer : 'I do not know that from the public repo.');
  } catch {
    say('I could not read the public repo just now.');
  } finally {
    asking = false;
    scene?.classList.remove('noticed');
  }
}

window.addEventListener('workshop:mention', event => {
  const text = event.detail?.text;
  if (typeof text === 'string') void askClawd(text);
});

$('visit-note-dismiss')?.addEventListener('click', () => {
  $('visit-note').hidden = true;
});

window.addEventListener('pagehide', () => {
  if (!lastDetail || lastDetail.demo || lastDetail.mode === 'replay') return;
  writeJson(VISIT_KEY, visitSnapshot(lastDetail));
});
