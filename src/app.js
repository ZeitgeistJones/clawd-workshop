import { CONFIG } from './config.js';
import './lounge.js';
import './studio.js';
import { GithubClient } from './github.js';
import { deriveStatus, describeEvent, normalizeEvents, pulse, pulseSeries, repoUrl, timeAgo } from './activity.js';
import { demoSnapshot, demoHistory } from './demo.js';
import { projectObject } from './objects.js';
import { makeReplay, replayFrame, formatDuration, mergeEvents, DAY_MS } from './replay.js';
import { SCORE_BUILDS, REPORT_URL, scoreBuild, scoreBuildForRepo } from './showcase.js';
import './chat.js';

const $ = id => document.getElementById(id);
const client = new GithubClient();
const params = new URLSearchParams(location.search);
let snapshot = null, unavailable = false, demo = params.get('demo') === '1';
let admin = params.get('admin') === '1';
let demoState = 'building', busy = false, timer, lastAttempt = 0, demoData = null;
let mode = 'current', history = null, historyBusy = false, loadGeneration = 0;
const replay = { plan: null, elapsed: 0, playing: false, lastTick: 0, lastPaint: 0, paintedChapter: -1 };
const captions = { building: 'A little elbow grease. A lot of ambition.', planning: 'Big ideas start with tiny blueprints.', testing: 'Safety goggles on. Fingers crossed.', shipping: 'Boxed up. Sent out. Tea earned.', idle: 'Even little builders need a tea break.', unknown: 'The kettle is on. Waiting for news.' };
const stateLabels = { building: 'BUILDING SIGNALS', planning: 'PLANNING SIGNALS', testing: 'CHECKS RUNNING', shipping: 'JUST RELEASED', idle: 'QUIET SIGNALS', unknown: 'AWAITING SIGNALS' };
const safeStore = {
  get() { try { const s = JSON.parse(localStorage.getItem(CONFIG.cacheKey)); return s?.username === CONFIG.username && s?.data ? s.data : null; } catch { return null; } },
  set(data) { try { localStorage.setItem(CONFIG.cacheKey, JSON.stringify({ username: CONFIG.username, data })); } catch { /* Storage may be disabled. */ } }
};
const BENCH_PROP_KEY = 'clawd-workshop-bench-prop';
let benchPropVisible = (() => { try { return localStorage.getItem(BENCH_PROP_KEY) !== '0'; } catch { return true; } })();
function setBenchPropVisible(show) {
  benchPropVisible = show;
  try { localStorage.setItem(BENCH_PROP_KEY, show ? '1' : '0'); } catch { /* Storage may be disabled. */ }
  $('scene').classList.toggle('bench-prop-hidden', !show);
  const hasRepo = Boolean($('object-repo-link') && !$('object-repo-link').hidden);
  $('project-object-link')?.setAttribute('visibility', hasRepo && show ? 'visible' : 'hidden');
  for (const id of ['bench-prop-toggle', 'bench-prop-toggle-side']) {
    const button = $(id); if (!button) continue;
    button.setAttribute('aria-pressed', String(show));
    button.textContent = show ? 'Hide' : 'Show';
    button.setAttribute('aria-label', show ? 'Hide the project on the bench' : 'Show the project on the bench');
  }
}
let benchCardTimer = null, benchCardRepo = null;
function fillBenchPropCard(repo) {
  const card = $('bench-prop-card'); if (!card) return;
  const short = repo ? repo.split('/').slice(1).join('/') : '';
  const href = repo ? repoUrl(repo) : `https://github.com/${CONFIG.username}`;
  const score = scoreBuildForRepo(repo);
  $('bench-prop-card-name').textContent = short || 'No project';
  $('bench-prop-card-github').href = href;
  $('bench-prop-card-github').textContent = 'GitHub ↗';
  $('bench-prop-card-report').href = REPORT_URL;
  $('bench-prop-card-report').textContent = 'Build Report ↗';
  const grades = $('bench-prop-card-grades'), note = $('bench-prop-card-note');
  if (score) {
    grades.hidden = false; note.hidden = true;
    $('bench-prop-card-econ-label').textContent = score.econLabel;
    $('bench-prop-card-econ').textContent = score.econ;
    $('bench-prop-card-builder').textContent = score.builder;
  } else {
    grades.hidden = true; note.hidden = false;
  }
}
function showBenchPropCard(show) {
  const card = $('bench-prop-card'); if (!card) return;
  clearTimeout(benchCardTimer);
  if (!show) { benchCardTimer = setTimeout(() => { card.hidden = true; }, 160); return; }
  if (!benchCardRepo || $('scene').classList.contains('bench-prop-hidden')) { card.hidden = true; return; }
  fillBenchPropCard(benchCardRepo);
  card.hidden = false;
}
function bindBenchProp(repo) {
  const href = repo ? repoUrl(repo) : `https://github.com/${CONFIG.username}`;
  benchCardRepo = repo || null;
  const link = $('project-object-link');
  if (link) {
    link.setAttribute('href', href);
    link.setAttribute('aria-label', repo ? `Open ${repo.split('/').slice(1).join('/')} on GitHub` : 'Open GitHub profile');
    link.classList.toggle('is-inactive', !repo);
  }
  const title = $('project-object-title');
  if (title) title.textContent = repo ? `Open ${repo.split('/').slice(1).join('/')} on GitHub` : 'No project on the bench';
  const side = $('object-repo-link');
  if (side) { side.href = href; side.hidden = !repo; side.textContent = repo ? 'Open on GitHub ↗' : ''; }
  for (const id of ['bench-prop-toggle', 'bench-prop-toggle-side']) {
    const button = $(id); if (button) button.hidden = !repo;
  }
  if (!repo) showBenchPropCard(false);
  else fillBenchPropCard(repo);
}
function node(tag, className, text) { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; }
function externalLink(url, className, text) { const a = node('a', className, text); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
function objectIcon(kind) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 120 90'); svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `./public/objects.svg#${kind}`); use.setAttribute('width', '120'); use.setAttribute('height', '90'); svg.append(use); return svg;
}
function notice(message) { $('notice').textContent = message; $('notice').hidden = !message; }
function clock(value) { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function dayClock(value) { return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function chapterClock(c) { return c.start === c.end ? clock(c.start) : `${clock(c.start)}–${clock(c.end)}`; }
function frameStatus(frame) {
  if (!frame) return { state: 'unknown', label: historyBusy ? 'Opening the day…' : 'No replay chapters yet', reason: historyBusy ? 'Loading the available public activity.' : 'No building signals were found in this 24-hour window.', repo: null };
  const c = frame.chapter, last = c.events.at(-1);
  return { state: c.state, label: c.quiet ? c.title : c.state === 'shipping' ? 'A release, ready to go.' : `Working on ${c.title}`, reason: c.quiet ? 'This is a gap in the fetched public signals, not a recording of Clawd’s actual presence.' : `${c.summary}. ${chapterClock(c)}.`, repo: c.repo, lastActivity: last?.created_at, evidenceUrl: last ? describeEvent(last).url : null };
}
function render() {
  const isReplay = mode === 'replay', frame = isReplay ? replayFrame(replay.plan, replay.elapsed) : null;
  const data = isReplay ? history : demo ? demoData : snapshot;
  const now = frame?.at ?? Date.now();
  const events = (data?.events || []).filter(e => !isReplay || Date.parse(e.created_at) <= now);
  const old = !data || Date.now() - Date.parse(data.checkedAt) > Math.max(CONFIG.refreshMs * 2, client.pollMs * 2);
  const status = isReplay ? frameStatus(frame) : deriveStatus(events, data?.runs || [], now, !demo && (unavailable || old));
  const metadata = (data?.repos || []).find(r => r.full_name === status.repo) || {};
  const object = projectObject(status.repo, metadata);
  $('scene').dataset.state = status.state; $('scene').dataset.projectKind = object.kind;
  $('state-tag').dataset.state = status.state;
  $('state-tag').textContent = isReplay ? `REPLAY · ${stateLabels[status.state]}` : stateLabels[status.state];
  $('signal-heading').textContent = isReplay && frame ? `CHAPTER ${frame.index + 1} / ${replay.plan.chapters.length}` : isReplay ? '24-HOUR REPLAY' : 'THE LATEST SIGNAL';
  $('status-title').textContent = status.label.replace('Clawd', CONFIG.displayName);
  $('status-reason').textContent = status.reason;
  $('scene-caption').textContent = isReplay && frame && !frame.chapter.quiet ? `${object.label} · ${frame.chapter.events.length} public update${frame.chapter.events.length === 1 ? '' : 's'}` : captions[status.state];
  $('scene-title').textContent = `${CONFIG.displayName}'s workshop: ${status.label}. ${status.repo ? object.label : 'No project on the bench'}.`;
  $('project-visual').setAttribute('href', `./public/objects.svg#${object.kind}`);
  $('project-object-link')?.setAttribute('visibility', status.repo && benchPropVisible ? 'visible' : 'hidden');
  $('object-name').textContent = status.repo ? object.label : 'No project on the bench';
  $('object-basis').textContent = status.repo ? object.basis : 'Waiting for the next project';
  bindBenchProp(status.repo);
  setBenchPropVisible(benchPropVisible);
  $('last-activity').textContent = isReplay && frame ? `Recorded: ${chapterClock(frame.chapter)}` : `Last event: ${timeAgo(status.lastActivity, now)}`;
  $('active-repo').textContent = status.repo ? `${status.repo.split('/').slice(1).join('/')} ↗` : 'No project detected';
  $('active-repo').href = status.repo ? repoUrl(status.repo) : `https://github.com/${CONFIG.username}`;
  $('evidence-link').hidden = !status.evidenceUrl;
  if (status.evidenceUrl) $('evidence-link').href = status.evidenceUrl;
  $('last-checked').textContent = isReplay ? `${demo ? 'Sample' : 'Recorded'} day · ${frame ? clock(frame.at) : 'loading'}` : demo ? 'Sample activity · not real data' : data ? `${unavailable || old ? 'Saved' : 'Checked'} ${timeAgo(data.checkedAt).toLowerCase()}` : 'Not checked yet';
  $('source-badge').classList.toggle('demo', demo);
  $('source-badge').replaceChildren(node('span', 'dot'), document.createTextNode(demo ? isReplay ? 'DEMO · DAY REPLAY' : 'DEMO · SAMPLE ACTIVITY' : isReplay ? 'REPLAY · PUBLIC HISTORY' : unavailable || old ? 'GitHub · awaiting fresh data' : 'Public GitHub signals'));
  const score = pulse(events, now);
  $('pulse-value').textContent = data ? score : '—';
  $('pulse-copy').textContent = isReplay ? 'Public activity at this point in the day.' : !data ? 'Waiting for public activity.' : demo ? 'A sample of the build heartbeat.' : unavailable || old ? 'From the saved activity snapshot.' : score > 65 ? 'The workbench is buzzing.' : score > 20 ? 'A little momentum in the workshop.' : 'A quiet moment at the workbench.';
  const points = pulseSeries(events, now).map((p, i) => [i * 320 / 60, 78 - p * .7]);
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  $('pulse-line').setAttribute('d', data ? line : '');
  $('pulse-fill').setAttribute('d', data ? `${line} L320,80 L0,80 Z` : '');
  $('pulse-chart').setAttribute('aria-label', `${demo ? 'Demo' : 'Fetched public activity'} pulse${isReplay ? ' during replay' : ''}, currently ${data ? score : 'unknown'} out of 100.`);
  $('timeline-title').textContent = isReplay ? 'Evidence for this chapter' : 'Fresh from the workbench';
  $('timeline').replaceChildren();
  const shown = isReplay ? [...(frame?.chapter.events || [])].reverse() : events.slice(0, 6);
  shown.forEach(e => {
    const d = describeEvent(e), li = node('li'), copy = node('div', 'event-copy');
    copy.append(externalLink(d.url, 'event-title', d.title), node('div', 'event-detail', `${d.repo.split('/').slice(1).join('/')} ${d.detail ? `· ${d.detail}` : ''}`));
    const time = node('time', 'event-time', isReplay ? clock(Date.parse(d.time)) : timeAgo(d.time, now)); time.dateTime = d.time; time.title = new Date(d.time).toLocaleString();
    li.append(node('span', 'event-icon', d.icon), copy, time); $('timeline').append(li);
  });
  if (!shown.length) $('timeline').append(node('li', 'empty', isReplay ? 'No fetched events in this chapter. Skip to the next project with ›.' : unavailable ? 'Activity could not be loaded. Try refreshing later, or take a look at demo mode.' : 'No public building activity in the fetched window. The tea is still warm.'));
  $('shelf-title').textContent = isReplay ? 'Worked on so far' : 'A few recent projects';
  $('projects').replaceChildren();
  const shelf = isReplay ? [...new Set(events.map(e => e.repo.name))].slice(0, 6).map(full_name => (data.repos || []).find(r => r.full_name === full_name) || { full_name, name: full_name.split('/').slice(1).join('/') }) : (data?.repos || []).slice(0, 6);
  shelf.forEach(r => {
    const illustration = projectObject(r.full_name, r), a = externalLink(repoUrl(r.full_name), 'project-link'), info = node('span', 'project-info');
    info.append(node('span', 'project-name', r.name), node('span', 'project-meta', isReplay ? illustration.label : `${r.language || 'A work in progress'} · ${r.stargazers_count || 0} stars`));
    if (r.description) info.append(node('span', 'project-description', r.description));
    const icon = node('span', 'project-icon'); icon.append(objectIcon(illustration.kind));
    a.append(icon, info, node('span', 'project-arrow', '↗')); $('projects').append(a);
  });
  if (!shelf.length) $('projects').append(node('p', 'empty', isReplay ? 'Projects arrive on the shelf as the day unfolds.' : 'No repository shelf available yet.'));
  const releases = events.filter(e => e.type === 'ReleaseEvent' && e.payload?.action === 'published');
  $('release-summary').replaceChildren();
  if (releases.length) { const last = describeEvent(releases[0]); $('release-summary').append(document.createTextNode(`${releases.length} release${releases.length === 1 ? '' : 's'} ${isReplay ? 'seen so far' : 'in fetched activity'} · `), externalLink(last.url, '', last.detail || 'latest release')); }
  else $('release-summary').textContent = isReplay ? 'Project illustrations are visual metaphors, not screenshots of the actual apps.' : 'Recently pushed repos. Finished releases appear here when detected.';
  $('workflow-note').textContent = isReplay ? 'Replay uses timestamped public events. Current workflow runs are never projected into the past. Nearby updates to one project are grouped; all chapter evidence is listed.' : demo ? 'Demo events and projects are fictional.' : [data?.workflowWarning || 'Checks cover only the last active repo and this builder’s workflow runs.', data?.repoWarning].filter(Boolean).join(' ');
  $('demo-toggle').textContent = demo ? 'Back to GitHub' : 'Try demo'; $('demo-toggle').setAttribute('aria-pressed', String(demo)); $('demo-state').hidden = !demo || isReplay;
  $('refresh-button').hidden = isReplay;
  $('refresh-button').disabled = busy || (!demo && Date.now() < client.blockedUntil);
  $('admin-shell').hidden = !admin;
  $('admin-nav').hidden = !admin;
  $('admin-nav').setAttribute('aria-pressed', String(admin && isReplay));
  $('current-mode').classList.toggle('active', !isReplay); $('current-mode').setAttribute('aria-pressed', String(!isReplay));
  $('replay-mode').classList.toggle('active', isReplay); $('replay-mode').setAttribute('aria-pressed', String(isReplay)); $('replay-mode').disabled = !admin || busy || historyBusy;
  $('replay-panel').hidden = !admin || !isReplay;
  updateReplayControls();
  if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('workshop:render', { detail: { demo, mode, status, metadata, events: shown, allEvents: events, repos: shelf, data, client } }));
}
function updateReplayControls() {
  if (mode !== 'replay') return;
  const plan = replay.plan, frame = replayFrame(plan, replay.elapsed), ready = !!frame;
  $('replay-play').disabled = !ready; $('replay-previous').disabled = !ready || frame.index === 0; $('replay-next').disabled = !ready || frame.index === plan.chapters.length - 1;
  $('replay-progress').disabled = !ready; $('replay-length').disabled = historyBusy;
  $('replay-play').textContent = replay.playing ? 'Ⅱ Pause' : frame?.ended ? '↺ Play again' : '▶ Play';
  $('replay-play').setAttribute('aria-pressed', String(replay.playing));
  $('replay-progress').max = String(plan?.durationMs || CONFIG.replayDurationMs); $('replay-progress').value = String(replay.elapsed);
  $('replay-progress').setAttribute('aria-valuetext', frame ? `Chapter ${frame.index + 1} of ${plan.chapters.length}: ${frame.chapter.title}, ${formatDuration(replay.elapsed)} elapsed` : 'No replay loaded');
  $('replay-elapsed').textContent = `${formatDuration(replay.elapsed)} / ${formatDuration(plan?.durationMs || CONFIG.replayDurationMs)}`;
  $('replay-clock').textContent = frame ? `${dayClock(frame.at)} · ${frame.chapter.title}` : historyBusy ? 'Loading the day…' : 'No available chapters';
  if (plan) { $('replay-start').textContent = dayClock(plan.start); $('replay-end').textContent = dayClock(plan.end); }
  for (const button of $('replay-chapters').querySelectorAll('button')) button.setAttribute('aria-current', String(Number(button.dataset.chapter) === frame?.index));
}
function drawChapters() {
  $('replay-chapters').replaceChildren();
  replay.plan?.chapters.forEach((c, i) => {
    const li = node('li'), button = node('button', 'chapter-button'); button.dataset.chapter = String(i);
    const kind = projectObject(c.repo, history?.repos.find(r => r.full_name === c.repo) || {}).kind;
    const thumbnail = node('span', 'chapter-icon'); if (!c.quiet) thumbnail.append(objectIcon(kind)); else thumbnail.textContent = c.state === 'unknown' ? '?' : '☾';
    const copy = node('span', 'chapter-copy'); copy.append(node('strong', '', c.title), node('small', '', `${chapterClock(c)} · ${c.quiet ? 'gap' : `${c.events.length} updates`}`));
    button.append(thumbnail, copy); button.addEventListener('click', () => { replay.elapsed = c.offsetMs; replay.playing = false; render(); }); li.append(button); $('replay-chapters').append(li);
  });
}
function setPlan(keepPosition = false) {
  const old = replayFrame(replay.plan, replay.elapsed), fraction = old?.progress || 0;
  replay.plan = makeReplay(history?.events || [], { end: history?.end || Date.now(), durationMs: Number($('replay-length').value) || CONFIG.replayDurationMs, partial: history?.partial, coverageStart: history?.coverageStart });
  const chapter = keepPosition && old ? replay.plan.chapters[old.index] : null;
  replay.elapsed = chapter ? chapter.offsetMs + chapter.durationMs * fraction : 0; replay.lastTick = 0; replay.paintedChapter = -1;
  const plan = replay.plan;
  $('replay-coverage').textContent = historyBusy ? 'Loading the day…' : !plan.chapters.length ? 'No public building activity is available in this window.' : `${demo ? 'Sample day' : 'Available public history'} · ${plan.events.length} events · ${plan.projectCount} projects · ${plan.chapters.length} chapters. ${history?.partial ? 'Partial day: earlier activity may be missing. ' : ''}${history?.warning || ''}${plan.durationMs > plan.requestedDurationMs + 1 ? ` Extended to ${formatDuration(plan.durationMs)} to keep every chapter readable.` : plan.durationMs < plan.requestedDurationMs - 1 ? ` Shortened to ${formatDuration(plan.durationMs)} so a quiet day does not drag.` : ''}`;
  drawChapters();
}
async function openReplay() {
  if (!admin || historyBusy || busy) return;
  const generation = ++loadGeneration; mode = 'replay'; replay.playing = false; clearTimeout(timer);
  notice(demo ? 'Demo replay: this is a fictional sample day, not Clawd’s real activity.' : '');
  if (history && Date.now() - Date.parse(history.checkedAt) < CONFIG.refreshMs) { setPlan(); replay.playing = !!replay.plan.chapters.length; render(); return; }
  historyBusy = true; history = null; replay.plan = null; $('replay-coverage').textContent = 'Loading the available 24-hour history…'; render();
  try {
    const next = demo ? demoHistory() : await client.history(snapshot || {});
    if (generation !== loadGeneration) return;
    history = next;
    if (!demo && snapshot) { snapshot.historyEvents = mergeEvents(next.events, snapshot.historyEvents || []).filter(e => Date.now() - Date.parse(e.created_at) <= DAY_MS); safeStore.set(snapshot); }
    historyBusy = false; setPlan(); replay.playing = !!replay.plan.chapters.length;
  } catch (error) {
    if (generation !== loadGeneration) return;
    historyBusy = false; notice(`Replay could not be loaded: ${error.message}. You can preview a sample day with Try demo.`); setPlan();
  } finally { if (generation === loadGeneration) { historyBusy = false; render(); } }
}
function currentMode() { loadGeneration++; historyBusy = false; mode = 'current'; replay.playing = false; replay.lastTick = 0; render(); schedule(); if (!demo && (unavailable || !snapshot || Date.now() - Date.parse(snapshot.checkedAt) >= client.pollMs)) refresh(); }
function schedule() { clearTimeout(timer); if (!demo && mode === 'current') timer = setTimeout(() => { if (!document.hidden) refresh(); else schedule(); }, Math.max(client.pollMs, client.blockedUntil - Date.now())); }
async function refresh() {
  if (mode === 'replay') return;
  if (demo) { demoData = demoSnapshot(demoState); notice('Demo mode: all activity, projects, and workflow signals here are sample data.'); render(); return; }
  if (busy) return;
  if (Date.now() < client.blockedUntil) { notice(`GitHub is rate limited. We'll try again after ${new Date(client.blockedUntil).toLocaleTimeString()}.`); render(); schedule(); return; }
  busy = true; lastAttempt = Date.now(); $('refresh-button').disabled = true; $('refresh-button').textContent = 'Checking…';
  try {
    const next = await client.snapshot();
    next.historyEvents = mergeEvents(snapshot?.historyEvents || snapshot?.events || [], next.events).filter(e => Date.now() - Date.parse(e.created_at) <= DAY_MS);
    snapshot = next; unavailable = false; safeStore.set(snapshot);
    if (!demo && mode === 'current') notice(next.workflowWarning || next.repoWarning || '');
  } catch (error) {
    unavailable = true;
    if (!demo && mode === 'current') notice(`${error.message || 'Could not reach GitHub.'} ${snapshot ? 'Showing a saved snapshot until the next successful check.' : 'Try demo mode to preview the workshop.'}`);
  } finally { busy = false; $('refresh-button').textContent = '↻ Refresh'; render(); schedule(); }
}
function tick(t) {
  if (mode === 'replay' && replay.playing && !document.hidden) {
    const dt = replay.lastTick ? Math.max(0, Math.min(1000, t - replay.lastTick)) : 0;
    replay.elapsed = Math.min(replay.plan.durationMs, replay.elapsed + dt);
    const frame = replayFrame(replay.plan, replay.elapsed);
    if (frame.ended) replay.playing = false;
    if (t - replay.lastPaint >= 150 || frame.ended) {
      replay.lastPaint = t;
      if (frame.index !== replay.paintedChapter || frame.chapter.quiet) { replay.paintedChapter = frame.index; render(); }
      else updateReplayControls();
    }
    replay.lastTick = t;
  } else replay.lastTick = 0;
  requestAnimationFrame(tick);
}
$('profile-link').href = `https://github.com/${CONFIG.username}`; $('builder-name').textContent = CONFIG.displayName;
document.title = `What is ${CONFIG.displayName} Building? — The little workshop`;
$('refresh-button').addEventListener('click', () => { if (!demo && Date.now() - lastAttempt < 15000) { notice('Checked just now. Give GitHub a few seconds before refreshing again.'); return; } refresh(); });
$('demo-toggle').addEventListener('click', () => { const wasReplay = mode === 'replay'; loadGeneration++; historyBusy = false; mode = 'current'; history = null; replay.playing = false; demo = !demo; clearTimeout(timer); notice(''); if (demo) demoData = demoSnapshot(demoState); render(); if (wasReplay) openReplay(); else refresh(); });
$('demo-state').addEventListener('change', e => { demoState = e.target.value; refresh(); });
$('motion-button').addEventListener('click', () => { const paused = $('scene').classList.toggle('paused'); $('motion-button').textContent = paused ? '▶' : 'Ⅱ'; $('motion-button').setAttribute('aria-pressed', String(paused)); $('motion-button').setAttribute('aria-label', paused ? 'Resume animation' : 'Pause animation'); });
$('current-mode').addEventListener('click', currentMode); $('replay-mode').addEventListener('click', openReplay);
$('admin-nav').addEventListener('click', () => { if (!admin) return; if (mode === 'replay') currentMode(); else openReplay(); });
$('replay-play').addEventListener('click', () => { if (!replay.plan?.chapters.length) return; if (replay.elapsed >= replay.plan.durationMs) replay.elapsed = 0; replay.playing = !replay.playing; replay.lastTick = 0; render(); });
$('replay-progress').addEventListener('input', e => { replay.elapsed = Number(e.target.value); replay.playing = false; render(); });
$('replay-length').addEventListener('change', () => { setPlan(true); render(); });
function skip(direction) { const frame = replayFrame(replay.plan, replay.elapsed); if (frame) { const i = Math.max(0, Math.min(replay.plan.chapters.length - 1, frame.index + direction)); replay.elapsed = replay.plan.chapters[i].offsetMs; replay.playing = false; render(); } }
$('replay-previous').addEventListener('click', () => skip(-1)); $('replay-next').addEventListener('click', () => skip(1));
$('about-button').addEventListener('click', () => $('about-dialog').showModal()); $('close-dialog').addEventListener('click', () => $('about-dialog').close());
$('about-dialog').addEventListener('click', e => { if (e.target === $('about-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
for (const id of ['bench-prop-toggle', 'bench-prop-toggle-side']) $(id)?.addEventListener('click', () => { setBenchPropVisible(!benchPropVisible); if (!benchPropVisible) showBenchPropCard(false); });
const propLink = $('project-object-link'), propCard = $('bench-prop-card');
if (propLink) {
  propLink.addEventListener('mouseenter', () => showBenchPropCard(true));
  propLink.addEventListener('mouseleave', () => showBenchPropCard(false));
  propLink.addEventListener('focus', () => showBenchPropCard(true));
  propLink.addEventListener('blur', () => showBenchPropCard(false));
}
if (propCard) {
  propCard.addEventListener('mouseenter', () => showBenchPropCard(true));
  propCard.addEventListener('mouseleave', () => showBenchPropCard(false));
}
function openScoreCard(id) {
  const build = scoreBuild(id);
  if (!build) return;
  $('score-card-name').textContent = build.name;
  $('score-card-tag').textContent = build.tag;
  $('score-card-econ-label').textContent = build.econLabel;
  $('score-card-econ').textContent = build.econ;
  $('score-card-builder').textContent = build.builder;
  $('score-card-blurb').textContent = build.blurb;
  $('score-card-github').href = build.github;
  $('score-card-report').href = REPORT_URL;
  $('score-dialog').showModal();
}
function scoreChip(build) {
  const button = node('button', 'score-chip', '');
  button.type = 'button';
  button.dataset.scoreId = build.id;
  button.setAttribute('aria-label', `Open ${build.name} score card`);
  button.append(node('span', 'score-chip-name', build.name), node('span', 'score-chip-meta', `${build.tag} · ${build.econ}`));
  button.addEventListener('click', () => openScoreCard(build.id));
  return button;
}
function renderScoreShowcase() {
  const holder = $('score-holder'), shipping = $('score-shipping');
  if (!holder || !shipping) return;
  holder.replaceChildren(...SCORE_BUILDS.filter(b => b.section === 'holder').map(scoreChip));
  shipping.replaceChildren(...SCORE_BUILDS.filter(b => b.section === 'shipping').map(scoreChip));
}
$('close-score-dialog').addEventListener('click', () => $('score-dialog').close());
$('score-dialog').addEventListener('click', e => { if (e.target === $('score-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
renderScoreShowcase();
document.addEventListener('visibilitychange', () => { replay.lastTick = 0; if (document.hidden && mode === 'replay' && replay.playing) { replay.playing = false; render(); } else if (!document.hidden && !demo && mode === 'current' && Date.now() - lastAttempt >= client.pollMs) refresh(); });
window.addEventListener('online', () => { if (!demo && unavailable && mode === 'current') refresh(); });
snapshot = safeStore.get();
if (snapshot) { try { snapshot.events = normalizeEvents(snapshot.events); snapshot.historyEvents = normalizeEvents(snapshot.historyEvents || []); } catch { snapshot = null; } }
unavailable = !!snapshot; if (demo) demoData = demoSnapshot();
render(); refresh(); requestAnimationFrame(tick);
setInterval(() => { if (!document.hidden && mode === 'current') render(); }, 15000);
