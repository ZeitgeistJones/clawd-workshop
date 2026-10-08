// Public chat: display names, bounded history, and a cursor independent of sends.
import {cleanName, cleanText, muteKey} from './chat-validation.js';
const NAME_KEY = 'clawd-workshop-chat-name';
const FEED_MUTE_KEY = 'clawd-workshop-chat-feed-muted';
const USER_MUTE_KEY = 'clawd-workshop-chat-muted-users';
const POLL_MS = 2500, API = '/api/chat', MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;
const $ = id => document.getElementById(id);
let joinedName = '', cursor = '', timer = 0, session = 0, fetching = null, sending = null;
let feedMuted = false;
/** @type {Set<string>} lowercase cleaned names */
let mutedUsers = new Set();
const requests = new Set();

function isUserMuted(name) {
  const key = muteKey(name);
  return Boolean(key && mutedUsers.has(key));
}

function savedName() { try { return cleanName(localStorage.getItem(NAME_KEY)); } catch { return null; } }
function saveName(name) { try { localStorage.setItem(NAME_KEY, name); } catch {} }
function loadMutes() {
  try { feedMuted = localStorage.getItem(FEED_MUTE_KEY) === '1'; } catch { feedMuted = false; }
  try {
    const raw = JSON.parse(localStorage.getItem(USER_MUTE_KEY) || '[]');
    mutedUsers = new Set(Array.isArray(raw) ? raw.map(muteKey).filter(Boolean) : []);
  } catch { mutedUsers = new Set(); }
}
function saveMutes() {
  try {
    localStorage.setItem(FEED_MUTE_KEY, feedMuted ? '1' : '0');
    localStorage.setItem(USER_MUTE_KEY, JSON.stringify([...mutedUsers]));
  } catch { /* Storage is optional. */ }
}
function nameTone(name) { let hash = 0; for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0; return String(hash % 6); }
function setStatus(message, error = false) { $('chat-status').textContent = message; $('chat-status').dataset.state = error ? 'error' : 'ok'; }
function showRoom(joined) { $('chat-gate').hidden = joined; $('chat-room').hidden = !joined; }
function validMessage(m) { return m && typeof m.id === 'string' && m.id.length <= 100 && cleanName(m.name) && cleanText(m.text) && Number.isFinite(Date.parse(m.at)); }
function atBottom(list) { return list.scrollHeight - list.scrollTop - list.clientHeight < 48; }

function drawMutedUsers() {
  const row = $('chat-muted-users');
  if (!row) return;
  row.replaceChildren();
  if (!mutedUsers.size) { row.hidden = true; return; }
  row.hidden = false;
  const label = document.createElement('span');
  label.textContent = 'Muted';
  row.append(label);
  for (const key of [...mutedUsers].sort()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat-unmute-user';
    button.dataset.muteKey = key;
    button.textContent = `${key} ×`;
    button.setAttribute('aria-label', `Unmute ${key}`);
    row.append(button);
  }
}

function applyMuteUi() {
  const panel = document.querySelector('.chat-panel');
  panel?.classList.toggle('chat-feed-muted', feedMuted);
  const mute = $('chat-mute');
  if (mute) {
    mute.textContent = feedMuted ? 'Show chat' : 'Mute chat';
    mute.setAttribute('aria-pressed', String(feedMuted));
    mute.setAttribute('aria-label', feedMuted ? 'Show live chat messages' : 'Mute live chat messages');
  }
  const banner = $('chat-mute-banner');
  if (banner) banner.hidden = !feedMuted;
  const list = $('chat-messages');
  if (list) list.setAttribute('aria-live', feedMuted ? 'off' : 'polite');
  drawMutedUsers();
}

function setFeedMuted(on) {
  feedMuted = Boolean(on);
  saveMutes();
  if (feedMuted) {
    $('chat-messages')?.replaceChildren();
    if ($('chat-latest')) $('chat-latest').hidden = true;
  } else if (joinedName) refresh({replace: true});
  applyMuteUi();
}

function muteUser(name) {
  const key = muteKey(name);
  if (!key) return;
  if (muteKey(joinedName) === key) { setStatus('You cannot mute yourself.', true); return; }
  mutedUsers.add(key);
  saveMutes();
  for (const li of [...($('chat-messages')?.children || [])]) {
    if (muteKey(li.dataset.name) === key) li.remove();
  }
  applyMuteUi();
  setStatus(`Muted ${key}. Click their chip to unmute.`);
}

function unmuteUser(key) {
  const normalized = muteKey(key) || String(key || '').toLowerCase();
  if (!normalized) return;
  mutedUsers.delete(normalized);
  saveMutes();
  applyMuteUi();
  if (joinedName && !feedMuted) refresh({replace: true});
  else setStatus(mutedUsers.size ? 'Updated muted list.' : 'No muted users.');
}

function pruneLocalMessages() {
  const list = $('chat-messages');
  if (!list) return;
  const cutoff = Date.now() - MESSAGE_TTL_MS;
  for (const li of [...list.children]) {
    if (Date.parse(li.dataset.at) < cutoff) li.remove();
  }
}
function renderMessages(messages, {replace = false, forceScroll = false} = {}) {
  const list = $('chat-messages'), following = atBottom(list);
  if (replace) list.replaceChildren();
  else pruneLocalMessages();
  if (feedMuted) return;
  let added = 0;
  for (const message of messages.filter(validMessage)) {
    if (Date.parse(message.at) < Date.now() - MESSAGE_TTL_MS) continue;
    if (isUserMuted(message.name)) continue;
    if ([...list.children].some(li => li.dataset.id === message.id)) continue;
    const li = document.createElement('li');
    li.dataset.id = message.id;
    li.dataset.at = message.at;
    li.dataset.name = message.name;
    li.dataset.tone = nameTone(message.name);
    const who = document.createElement('button');
    who.type = 'button';
    who.className = 'chat-name';
    who.textContent = message.name;
    who.title = `Mute ${message.name}`;
    who.setAttribute('aria-label', `Mute ${message.name}`);
    const body = document.createElement('span');
    body.textContent = message.text;
    li.append(who, body);
    const later = [...list.children].find(n => Date.parse(n.dataset.at) > Date.parse(message.at));
    list.insertBefore(li, later || null); added++;
  }
  while (list.children.length > 80) list.firstElementChild.remove();
  if (replace || following || forceScroll) { list.scrollTop = list.scrollHeight; $('chat-latest').hidden = true; }
  else if (added) $('chat-latest').hidden = false;
}
async function api(method, payload) {
  const controller = new AbortController(); requests.add(controller);
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(method === 'GET' && cursor ? `${API}?after=${encodeURIComponent(cursor)}` : API, {
      method, signal: controller.signal, headers: method === 'POST' ? {'Content-Type': 'application/json'} : undefined,
      body: method === 'POST' ? JSON.stringify(payload) : undefined,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `Chat unavailable (${response.status}).`);
    if (!data || method === 'GET' && !Array.isArray(data.messages) || method === 'POST' && !validMessage(data.message)) throw new Error('Chat returned an unreadable response.');
    return data;
  } finally { clearTimeout(timeout); requests.delete(controller); }
}
async function refresh({replace = false} = {}) {
  const generation = session;
  if (fetching === generation || document.hidden || !joinedName) return;
  fetching = generation;
  try {
    if (replace) cursor = '';
    const data = await api('GET');
    if (generation !== session || !joinedName) return;
    const messages = data.messages.filter(validMessage);
    renderMessages(messages, {replace});
    if (messages.length) cursor = messages.at(-1).id;
    if (!feedMuted) setStatus(`Live chat · ${joinedName}`);
    else setStatus(`Chat muted · still joined as ${joinedName}`);
  } catch (error) { if (generation === session && joinedName) setStatus(error.name === 'AbortError' ? 'Chat timed out. Reconnecting…' : error.message, true); }
  finally { if (fetching === generation) fetching = null; }
}
async function send(event) {
  event.preventDefault();
  const generation = session, input = $('chat-input'), draft = input.value, text = cleanText(draft);
  if (!joinedName || sending === generation) return;
  if (feedMuted) { setStatus('Unmute chat to send a message.', true); return; }
  if (!text) { setStatus('Write a message of 1–240 characters.', true); return; }
  sending = generation; $('chat-send').disabled = true;
  try {
    const data = await api('POST', {name: joinedName, text});
    if (generation !== session || !joinedName) return;
    // Sending never advances the GET cursor: other people's pending posts survive.
    renderMessages([data.message], {forceScroll: true});
    if (input.value === draft) input.value = '';
    setStatus(`Live chat · ${joinedName}`);
    if (/@clawd\b/i.test(text) && typeof window.CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('workshop:mention', { detail: { text } }));
    }
  } catch (error) {
    if (generation === session && joinedName) {
      setStatus(error.name === 'AbortError' ? 'Send timed out. Your draft is still here.' : error.message, true);
      // The room may be down, but he can still answer out loud.
      if (/@clawd\b/i.test(text) && typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('workshop:mention', { detail: { text } }));
      }
    }
  }
  finally { if (sending === generation) { sending = null; $('chat-send').disabled = false; if (joinedName) input.focus({preventScroll: true}); } }
}
function resetSession() {
  session++; for (const controller of requests) controller.abort(); requests.clear();
  clearInterval(timer); fetching = sending = null; cursor = ''; $('chat-send').disabled = false;
  $('chat-messages').replaceChildren(); $('chat-latest').hidden = true;
}
function enterRoom(name, focus = true) {
  resetSession(); joinedName = name; saveName(name); showRoom(true); $('chat-you').textContent = name;
  setStatus(`Joining as ${name}…`); applyMuteUi(); refresh({replace: true}); timer = setInterval(() => refresh(), POLL_MS);
  if (focus) $('chat-input').focus({preventScroll: true});
}
function join(event) {
  event.preventDefault(); const name = cleanName($('chat-name').value);
  if (!name) { setStatus('Use 1–20 letters, numbers, spaces, or simple punctuation for your name.', true); return; }
  enterRoom(name);
}
function leave() {
  resetSession(); joinedName = ''; saveName(''); showRoom(false); setStatus('Enter a name to join live chat.');
  applyMuteUi();
  $('chat-name').focus({preventScroll: true});
}
export function initChat() {
  if (!$('chat-gate') || !$('chat-room')) return;
  loadMutes();
  $('chat-gate').addEventListener('submit', join); $('chat-send-form').addEventListener('submit', send); $('chat-leave').addEventListener('click', leave);
  $('chat-mute')?.addEventListener('click', () => setFeedMuted(!feedMuted));
  $('chat-mute-banner')?.addEventListener('click', () => setFeedMuted(false));
  $('chat-muted-users')?.addEventListener('click', e => {
    const button = e.target.closest('.chat-unmute-user');
    if (button?.dataset.muteKey) unmuteUser(button.dataset.muteKey);
  });
  $('chat-messages').addEventListener('click', e => {
    const button = e.target.closest('.chat-name');
    if (button) muteUser(button.textContent);
  });
  $('chat-latest').addEventListener('click', () => { const list = $('chat-messages'); list.scrollTop = list.scrollHeight; $('chat-latest').hidden = true; });
  $('chat-messages').addEventListener('scroll', () => { if (atBottom($('chat-messages'))) $('chat-latest').hidden = true; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && joinedName) refresh(); });
  window.addEventListener('pagehide', () => { clearInterval(timer); for (const controller of requests) controller.abort(); });
  window.addEventListener('pageshow', e => { if (e.persisted && joinedName) { clearInterval(timer); timer = setInterval(() => refresh(), POLL_MS); refresh(); } });
  applyMuteUi();
  const existing = savedName();
  if (existing) { $('chat-name').value = existing; enterRoom(existing, false); }
  else { showRoom(false); setStatus('Enter a name to join live chat.'); }
}
initChat();
