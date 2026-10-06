import { CONFIG } from './config.js';
import { GithubClient } from './github.js';
import { deriveStatus, describeEvent, normalizeEvents, pulse, pulseSeries, repoUrl, timeAgo } from './activity.js';
import { demoSnapshot } from './demo.js';

const $ = id => document.getElementById(id);
const client = new GithubClient();
let snapshot = null, unavailable = false, demo = new URLSearchParams(location.search).get('demo') === '1';
let demoState = 'building', busy = false, timer, lastAttempt = 0, demoData = null;
const captions = { building: 'A little elbow grease. A lot of ambition.', planning: 'Big ideas start with tiny blueprints.', testing: 'Safety goggles on. Fingers crossed.', shipping: 'Boxed up. Sent out. Tea earned.', idle: 'Even little builders need a tea break.', unknown: 'The kettle is on. Waiting for news.' };
const safeStore = {
  get() { try { const s = JSON.parse(localStorage.getItem(CONFIG.cacheKey)); return s?.username === CONFIG.username && s?.data ? s.data : null; } catch { return null; } },
  set(data) { try { localStorage.setItem(CONFIG.cacheKey, JSON.stringify({ username: CONFIG.username, data })); } catch { /* Storage may be disabled. The dashboard still works. */ } }
};
function node(tag, className, text) { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; }
function externalLink(url, className, text) { const a = node('a', className, text); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
function notice(message) { $('notice').textContent = message; $('notice').hidden = !message; }
function render() {
  const data = demo ? demoData : snapshot;
  const now = Date.now(), events = data?.events || [];
  // A cached workflow must never look like a newly observed running job.
  const old = !data || now - Date.parse(data.checkedAt) > Math.max(CONFIG.refreshMs * 2, client.pollMs * 2);
  const status = deriveStatus(events, data?.runs || [], now, !demo && (unavailable || old));
  $('scene').dataset.state = status.state;
  $('state-tag').dataset.state = status.state;
  $('state-tag').textContent = { building: 'BUILDING SIGNALS', planning: 'PLANNING SIGNALS', testing: 'CHECKS RUNNING', shipping: 'JUST RELEASED', idle: 'QUIET SIGNALS', unknown: 'AWAITING SIGNALS' }[status.state];
  $('status-title').textContent = status.label.replace('Clawd', CONFIG.displayName);
  $('status-reason').textContent = status.reason;
  $('scene-caption').textContent = captions[status.state];
  $('scene-title').textContent = `${CONFIG.displayName}'s workshop: ${status.label}`;
  $('last-activity').textContent = `Last event: ${timeAgo(status.lastActivity, now)}`;
  $('active-repo').textContent = status.repo ? `${status.repo.split('/').slice(1).join('/')} ↗` : 'No active repo detected';
  $('active-repo').href = status.repo ? repoUrl(status.repo) : `https://github.com/${CONFIG.username}`;
  $('evidence-link').hidden = !status.evidenceUrl;
  if (status.evidenceUrl) $('evidence-link').href = status.evidenceUrl;
  $('last-checked').textContent = demo ? 'Sample activity · not real data' : data ? `${unavailable || old ? 'Saved' : 'Checked'} ${timeAgo(data.checkedAt, now).toLowerCase()}` : 'Not checked yet';
  $('source-badge').classList.toggle('demo', demo);
  $('source-badge').replaceChildren(node('span', 'dot'), document.createTextNode(demo ? 'DEMO · SAMPLE ACTIVITY' : unavailable || old ? 'GitHub · awaiting fresh data' : 'Public GitHub signals'));
  const score = pulse(events, now);
  $('pulse-value').textContent = data ? score : '—';
  $('pulse-copy').textContent = !data ? 'Waiting for public activity.' : demo ? 'A sample of the build heartbeat.' : unavailable || old ? 'From the saved activity snapshot.' : score > 65 ? 'The workbench is buzzing.' : score > 20 ? 'A little momentum in the workshop.' : 'A quiet moment at the workbench.';
  const points = pulseSeries(events, now).map((p, i) => [i * 320 / 60, 78 - p * .7]);
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  $('pulse-line').setAttribute('d', data ? line : '');
  $('pulse-fill').setAttribute('d', data ? `${line} L320,80 L0,80 Z` : '');
  $('pulse-chart').setAttribute('aria-label', `${demo ? 'Demo' : 'Fetched public activity'} pulse over the last hour, currently ${data ? score : 'unknown'} out of 100.`);
  $('timeline').replaceChildren();
  events.slice(0, 6).forEach(e => {
    const d = describeEvent(e), li = node('li'), copy = node('div', 'event-copy');
    copy.append(externalLink(d.url, 'event-title', d.title), node('div', 'event-detail', `${d.repo.split('/').slice(1).join('/')} ${d.detail ? `· ${d.detail}` : ''}`));
    const time = node('time', 'event-time', timeAgo(d.time, now)); time.dateTime = d.time; time.title = new Date(d.time).toLocaleString();
    li.append(node('span', 'event-icon', d.icon), copy, time); $('timeline').append(li);
  });
  if (!events.length) $('timeline').append(node('li', 'empty', unavailable ? 'Activity could not be loaded. Try refreshing later, or take a look at demo mode.' : 'No public building activity in the fetched window. The tea is still warm.'));
  $('projects').replaceChildren();
  (data?.repos || []).slice(0, 3).forEach((r, i) => {
    const a = externalLink(repoUrl(r.full_name), 'project-link'), info = node('span', 'project-info');
    info.append(node('span', 'project-name', r.name), node('span', 'project-meta', `${r.language || 'A work in progress'} · ${r.stargazers_count || 0} stars`));
    a.append(node('span', 'project-icon', ['⌘', '⚙', '◇'][i]), info, node('span', 'project-arrow', '↗')); $('projects').append(a);
  });
  if (!data?.repos?.length) $('projects').append(node('p', 'empty', 'No repository shelf available yet.'));
  const releases = events.filter(e => e.type === 'ReleaseEvent' && e.payload?.action === 'published');
  $('release-summary').replaceChildren();
  if (releases.length) { const last = describeEvent(releases[0]); $('release-summary').append(document.createTextNode(`${releases.length} release${releases.length === 1 ? '' : 's'} in fetched activity · `), externalLink(last.url, '', last.detail || 'latest release')); }
  else $('release-summary').textContent = 'Recently pushed repos. Finished releases appear here when detected.';
  $('workflow-note').textContent = demo ? 'Demo events and projects are fictional.' : [data?.workflowWarning || 'Checks cover only the last active repo and this builder’s workflow runs.', data?.repoWarning].filter(Boolean).join(' ');
  $('demo-toggle').textContent = demo ? 'Back to GitHub' : 'Try demo'; $('demo-toggle').setAttribute('aria-pressed', String(demo)); $('demo-state').hidden = !demo;
  $('refresh-button').disabled = busy || (!demo && Date.now() < client.blockedUntil);
}
function schedule() { clearTimeout(timer); if (!demo) timer = setTimeout(() => { if (!document.hidden) refresh(); else schedule(); }, Math.max(client.pollMs, client.blockedUntil - Date.now())); }
async function refresh() {
  if (demo) { demoData = demoSnapshot(demoState); notice('Demo mode: all activity, projects, and workflow signals here are sample data.'); render(); return; }
  if (busy) return;
  if (Date.now() < client.blockedUntil) { notice(`GitHub is rate limited. We'll try again after ${new Date(client.blockedUntil).toLocaleTimeString()}.`); render(); schedule(); return; }
  busy = true; lastAttempt = Date.now(); $('refresh-button').disabled = true; $('refresh-button').textContent = 'Checking…';
  try {
    const next = await client.snapshot();
    snapshot = next; unavailable = false; safeStore.set(snapshot);
    if (!demo) notice(next.workflowWarning || next.repoWarning || '');
  } catch (error) {
    unavailable = true;
    if (!demo) notice(`${error.message || 'Could not reach GitHub.'} ${snapshot ? 'Showing a saved snapshot until the next successful check.' : 'Try demo mode to preview the workshop.'}`);
  } finally { busy = false; $('refresh-button').textContent = '↻ Refresh'; render(); schedule(); }
}
$('profile-link').href = `https://github.com/${CONFIG.username}`;
$('builder-name').textContent = CONFIG.displayName;
document.title = `Is ${CONFIG.displayName} building? — The little workshop`;
$('refresh-button').addEventListener('click', () => { if (!demo && Date.now() - lastAttempt < 15000) { notice('Checked just now. Give GitHub a few seconds before refreshing again.'); return; } refresh(); });
$('demo-toggle').addEventListener('click', () => { demo = !demo; clearTimeout(timer); if (demo) refresh(); else { notice(''); render(); refresh(); } });
$('demo-state').addEventListener('change', e => { demoState = e.target.value; refresh(); });
$('motion-button').addEventListener('click', () => { const paused = $('scene').classList.toggle('paused'); $('motion-button').textContent = paused ? '▶' : 'Ⅱ'; $('motion-button').setAttribute('aria-pressed', String(paused)); $('motion-button').setAttribute('aria-label', paused ? 'Resume animation' : 'Pause animation'); });
$('about-button').addEventListener('click', () => $('about-dialog').showModal());
$('close-dialog').addEventListener('click', () => $('about-dialog').close());
$('about-dialog').addEventListener('click', e => { if (e.target === $('about-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !demo && Date.now() - lastAttempt >= client.pollMs) refresh(); });
window.addEventListener('online', () => { if (!demo && unavailable) refresh(); });
snapshot = safeStore.get();
if (snapshot) { try { snapshot.events = normalizeEvents(snapshot.events); } catch { snapshot = null; } }
unavailable = !!snapshot;
if (demo) demoData = demoSnapshot();
render(); refresh();
setInterval(() => { if (!document.hidden) render(); }, 15000);
