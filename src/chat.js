// Public workshop chat — display name only, no accounts.
const NAME_KEY = 'clawd-workshop-chat-name';
const POLL_MS = 4000;
const $ = id => document.getElementById(id);

let joinedName = '';
let lastAt = '';
let timer = 0;
let busy = false;

function savedName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}
function saveName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* Storage may be disabled. */ }
}

function setStatus(message, isError = false) {
  const el = $('chat-status');
  if (!el) return;
  el.textContent = message;
  el.dataset.state = isError ? 'error' : 'ok';
}

function showRoom(inRoom) {
  const gate = $('chat-gate');
  const room = $('chat-room');
  if (gate) gate.hidden = inRoom;
  if (room) room.hidden = !inRoom;
}

function renderMessages(messages, { replace = false } = {}) {
  const list = $('chat-messages');
  if (!list) return;
  if (replace) list.replaceChildren();
  for (const message of messages) {
    if ([...list.children].some(li => li.dataset.id === message.id)) continue;
    const li = document.createElement('li');
    li.dataset.id = message.id;
    const who = document.createElement('strong');
    who.textContent = message.name;
    const body = document.createElement('span');
    body.textContent = message.text;
    const when = document.createElement('time');
    when.dateTime = message.at;
    when.textContent = new Date(message.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    li.append(who, body, when);
    list.append(li);
    lastAt = message.at || lastAt;
  }
  if (messages.length) list.scrollTop = list.scrollHeight;
}

async function api(method, payload) {
  const url = method === 'GET'
    ? `./api/chat${lastAt ? `?since=${encodeURIComponent(lastAt)}` : ''}`
    : './api/chat';
  const response = await fetch(url, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: method === 'POST' ? JSON.stringify(payload) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Chat error ${response.status}`);
  return data;
}

async function refresh({ replace = false } = {}) {
  if (busy || document.hidden || !joinedName) return;
  busy = true;
  try {
    if (replace) lastAt = '';
    const data = await api('GET');
    renderMessages(data.messages || [], { replace });
    setStatus(`In the room as ${joinedName}`);
  } catch (error) {
    setStatus(error.message || 'Chat is unavailable right now.', true);
  } finally {
    busy = false;
  }
}

async function send(event) {
  event.preventDefault();
  const input = $('chat-input');
  const text = input?.value || '';
  if (!joinedName || !text.trim()) return;
  const button = $('chat-send');
  if (button) button.disabled = true;
  try {
    const data = await api('POST', { name: joinedName, text });
    if (data.message) renderMessages([data.message]);
    if (input) input.value = '';
    setStatus(`In the room as ${joinedName}`);
  } catch (error) {
    setStatus(error.message || 'Could not send that.', true);
  } finally {
    if (button) button.disabled = false;
    input?.focus();
  }
}

function join(event) {
  event.preventDefault();
  const name = ($('chat-name')?.value || '').trim();
  if (!name) {
    setStatus('Pick a display name first.', true);
    return;
  }
  joinedName = name.slice(0, 20);
  saveName(joinedName);
  showRoom(true);
  const you = $('chat-you');
  if (you) you.textContent = joinedName;
  setStatus(`Joining as ${joinedName}…`);
  refresh({ replace: true });
  clearInterval(timer);
  timer = setInterval(() => refresh(), POLL_MS);
}

function leave() {
  joinedName = '';
  lastAt = '';
  clearInterval(timer);
  showRoom(false);
  setStatus('Pick a name to join the public workshop chat.');
}

export function initChat() {
  const gate = $('chat-gate');
  const room = $('chat-room');
  if (!gate || !room) return;

  const existing = savedName();
  if (existing) {
    const input = $('chat-name');
    if (input) input.value = existing;
  }

  $('chat-join-form')?.addEventListener('submit', join);
  $('chat-send-form')?.addEventListener('submit', send);
  $('chat-leave')?.addEventListener('click', leave);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && joinedName) refresh();
  });
  showRoom(false);
  setStatus('Pick a name to join the public workshop chat.');
}

initChat();
