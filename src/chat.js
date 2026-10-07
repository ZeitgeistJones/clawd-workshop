// Public chat: display names, bounded history, and a cursor independent of sends.
import {cleanName, cleanText} from './chat-validation.js';
const NAME_KEY = 'clawd-workshop-chat-name', POLL_MS = 2500, API = '/api/chat';
const $ = id => document.getElementById(id);
let joinedName = '', cursor = '', timer = 0, session = 0, fetching = null, sending = null;
const requests = new Set();
function savedName() { try { return cleanName(localStorage.getItem(NAME_KEY)); } catch { return null; } }
function saveName(name) { try { localStorage.setItem(NAME_KEY, name); } catch {} }
function nameTone(name) { let hash = 0; for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0; return String(hash % 6); }
function setStatus(message, error = false) { $('chat-status').textContent = message; $('chat-status').dataset.state = error ? 'error' : 'ok'; }
function showRoom(joined) { $('chat-gate').hidden = joined; $('chat-room').hidden = !joined; }
function validMessage(m) { return m && typeof m.id === 'string' && m.id.length <= 100 && cleanName(m.name) && cleanText(m.text) && Number.isFinite(Date.parse(m.at)); }
function atBottom(list) { return list.scrollHeight - list.scrollTop - list.clientHeight < 48; }
function renderMessages(messages, {replace = false, forceScroll = false} = {}) {
  const list = $('chat-messages'), following = atBottom(list);
  if (replace) list.replaceChildren();
  let added = 0;
  for (const message of messages.filter(validMessage)) {
    if ([...list.children].some(li => li.dataset.id === message.id)) continue;
    const li = document.createElement('li'); li.dataset.id = message.id; li.dataset.at = message.at; li.dataset.tone = nameTone(message.name);
    const who = document.createElement('strong'), body = document.createElement('span');
    who.textContent = message.name; body.textContent = message.text; li.append(who, body);
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
    setStatus(`Live chat · ${joinedName}`);
  } catch (error) { if (generation === session && joinedName) setStatus(error.name === 'AbortError' ? 'Chat timed out. Reconnecting…' : error.message, true); }
  finally { if (fetching === generation) fetching = null; }
}
async function send(event) {
  event.preventDefault();
  const generation = session, input = $('chat-input'), draft = input.value, text = cleanText(draft);
  if (!joinedName || sending === generation) return;
  if (!text) { setStatus('Write a message of 1–240 characters.', true); return; }
  sending = generation; $('chat-send').disabled = true;
  try {
    const data = await api('POST', {name: joinedName, text});
    if (generation !== session || !joinedName) return;
    // Sending never advances the GET cursor: other people's pending posts survive.
    renderMessages([data.message], {forceScroll: true});
    if (input.value === draft) input.value = '';
    setStatus(`Live chat · ${joinedName}`);
  } catch (error) { if (generation === session && joinedName) setStatus(error.name === 'AbortError' ? 'Send timed out. Your draft is still here.' : error.message, true); }
  finally { if (sending === generation) { sending = null; $('chat-send').disabled = false; if (joinedName) input.focus({preventScroll: true}); } }
}
function resetSession() {
  session++; for (const controller of requests) controller.abort(); requests.clear();
  clearInterval(timer); fetching = sending = null; cursor = ''; $('chat-send').disabled = false;
  $('chat-messages').replaceChildren(); $('chat-latest').hidden = true;
}
function enterRoom(name, focus = true) {
  resetSession(); joinedName = name; saveName(name); showRoom(true); $('chat-you').textContent = name;
  setStatus(`Joining as ${name}…`); refresh({replace: true}); timer = setInterval(() => refresh(), POLL_MS);
  if (focus) $('chat-input').focus({preventScroll: true});
}
function join(event) {
  event.preventDefault(); const name = cleanName($('chat-name').value);
  if (!name) { setStatus('Use 1–20 letters, numbers, spaces, or simple punctuation for your name.', true); return; }
  enterRoom(name);
}
function leave() {
  resetSession(); joinedName = ''; saveName(''); showRoom(false); setStatus('Enter a name to join live chat.');
  $('chat-name').focus({preventScroll: true});
}
export function initChat() {
  if (!$('chat-gate') || !$('chat-room')) return;
  $('chat-gate').addEventListener('submit', join); $('chat-send-form').addEventListener('submit', send); $('chat-leave').addEventListener('click', leave);
  $('chat-latest').addEventListener('click', () => { const list = $('chat-messages'); list.scrollTop = list.scrollHeight; $('chat-latest').hidden = true; });
  $('chat-messages').addEventListener('scroll', () => { if (atBottom($('chat-messages'))) $('chat-latest').hidden = true; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && joinedName) refresh(); });
  window.addEventListener('pagehide', () => { clearInterval(timer); for (const controller of requests) controller.abort(); });
  window.addEventListener('pageshow', e => { if (e.persisted && joinedName) { clearInterval(timer); timer = setInterval(() => refresh(), POLL_MS); refresh(); } });
  const existing = savedName();
  if (existing) { $('chat-name').value = existing; enterRoom(existing, false); }
  else { showRoom(false); setStatus('Enter a name to join live chat.'); }
}
initChat();
