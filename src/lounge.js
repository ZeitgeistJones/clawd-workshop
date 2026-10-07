import { CONFIG } from './config.js';
import { buildBrief } from './builds.js';
import { safeGithubUrl, timeAgo } from './activity.js';
import { TRACKS, TrackRadio } from './playlist.js';
import { MarketClient } from './market.js';

const $ = id => document.getElementById(id);
const text = (id, value) => { $(id).textContent = value; };
const element = (tag, className, value) => { const n = document.createElement(tag); n.className = className || ''; if (value !== undefined) n.textContent = value; return n; };
const link = (url, value) => { const a = element('a', '', value); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
const shortAmount = value => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 }).format(value);
const usd = value => Number.isFinite(Number(value)) && value !== null ? `$${shortAmount(Number(value))}` : '—';
const priceText = value => `$${Number(value).toLocaleString(undefined, { maximumSignificantDigits: 5 })}`;
const marketConfig = { ...CONFIG.market };
let market = new MarketClient(marketConfig);
const radio = new TrackRadio();
function fillTrackSelect() {
  const select = $('radio-station');
  if (!select) return;
  select.replaceChildren(...TRACKS.map((track, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = track.name;
    return option;
  }));
  select.disabled = true;
  select.title = 'Live shared radio — everyone hears the same place in the loop';
  const live = radio.current();
  const index = Math.max(0, TRACKS.findIndex(track => track.id === live?.id));
  select.value = String(index < 0 ? 0 : index);
}
let state = null, demo = null, mode = 'current', detailsCache = new Map(), pendingDetails = new Set();
let priceTimer, watchTimer, epoch = 0, priceBusy = null, watchBusy = null, priceFailures = 0, watchFailures = 0, effectTimer;
let samples = [], marketEvents = [], currentPrice = null, effectsEnabled = true, radioBusy = false;

function drawBrief(s) {
  const { status, metadata, events } = s, saved = s.mode === 'current' ? detailsCache.get(status.repo) : null;
  const info = saved?.metadata || metadata, brief = buildBrief(status.repo, info, events, s.mode === 'replay');
  text('brief-name', brief.name); text('brief-description', brief.description); $('brief-source').href = brief.source;
  $('brief-tags').replaceChildren(...[brief.language, brief.license, ...brief.topics].filter(Boolean).map(t => element('span', '', t)));
  const updateTime = brief.update ? s.mode === 'replay' ? `Recorded ${new Date(brief.update.time).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : timeAgo(brief.update.time) : '';
  text('brief-update', brief.update ? `${brief.update.title}${brief.update.detail ? ` · ${brief.update.detail}` : ''}. ${updateTime}.` : 'No fetched public changes for this project.');
  $('brief-website').hidden = !brief.website; if (brief.website) $('brief-website').href = brief.website;
  $('brief-commits').replaceChildren();
  if (s.mode !== 'replay') for (const c of saved?.commits || []) {
    const title = c.commit?.message?.split('\n')[0]; if (!title) continue;
    const li = element('li'); li.append(link(safeGithubUrl(c.html_url, brief.source), title), element('small', '', timeAgo(c.commit?.committer?.date))); $('brief-commits').append(li);
  }
  text('brief-note', [brief.context, saved?.warning, s.demo ? 'Sample projects and changes.' : ''].filter(Boolean).join(' '));
  const cutoff = (s.data?.end || Date.now()) - 86400000;
  const day = s.allEvents.filter(e => Date.parse(e.created_at) >= cutoff);
  text('day-projects', new Set(day.map(e => e.repo.name)).size); text('day-updates', day.length);
  text('day-releases', day.filter(e => e.type === 'ReleaseEvent' && e.payload?.action === 'published').length);
  if (!s.demo && s.mode === 'current' && status.repo && (!saved || Date.now() - saved.at > 600000) && !pendingDetails.has(status.repo)) {
    const repo = status.repo; pendingDetails.add(repo);
    s.client.details(repo).then(details => {
      detailsCache.set(repo, { ...details, at: Date.now() });
      if (state?.status.repo === repo && state.mode === 'current' && !state.demo) drawBrief(state);
    }).catch(() => { detailsCache.set(repo, { at: Date.now(), commits: [], warning: 'Extra repository details are unavailable.' }); }).finally(() => pendingDetails.delete(repo));
  }
}
function drawPrice(quote, sample = false) {
  currentPrice = quote; text('market-price', priceText(quote.price));
  const change = quote.priceChange?.h24;
  text('market-change', change == null ? '24h unavailable' : `${Number(change) >= 0 ? '+' : ''}${Number(change).toFixed(1)}% · 24h`);
  $('market-change').classList.toggle('negative', Number(change) < 0);
  text('market-volume', usd(quote.volume?.h24)); text('market-liquidity', usd(quote.liquidity?.usd));
  if (!sample) $('market-link').href = `https://dexscreener.com/${marketConfig.chainId}/${encodeURIComponent(quote.pairAddress)}`;
  text('market-status', sample ? 'DEMO · sample price and market figures' : `DEX Screener · checked ${new Date(quote.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · refreshes every 30s`);
  samples.push(quote.price); samples = samples.slice(-60); $('market-chart').hidden = samples.length < 2 || sample;
  if (samples.length > 1) {
    const lo = Math.min(...samples), hi = Math.max(...samples), span = hi - lo;
    $('market-line').setAttribute('d', samples.map((p, i) => `${i ? 'L' : 'M'}${(i * 320 / (samples.length - 1)).toFixed(1)},${(span ? 54 - (p - lo) / span * 48 : 30).toFixed(1)}`).join(' '));
  }
}
function drawEvents() {
  $('market-events').replaceChildren();
  for (const event of marketEvents.slice(0, 4)) {
    const li = element('li'), title = `${event.kind === 'buy' ? '✦' : '♨'} ${event.label} · ${shortAmount(event.amount)} CLAWD`;
    li.append(event.sample ? element('span', '', title) : link(`https://basescan.org/tx/${event.tx}`, title));
    li.append(element('small', '', event.sample ? 'DEMO · sample event' : event.kind === 'buy' ? `≈ ${usd(event.usd)} at fetched price · block ${event.block}` : `Observed token transfer · block ${event.block}`)); $('market-events').append(li);
  }
}
function burnLevel(amount) {
  const n = Math.max(0, Number(amount) || 0);
  if (n >= 25_000_000) return 3;
  if (n >= 5_000_000) return 2;
  return 1;
}
function clearEffect() {
  clearTimeout(effectTimer);
  delete $('scene').dataset.marketEffect;
  delete $('scene').dataset.burnLevel;
  $('scene-event').hidden = true;
}
function showEvent(event) {
  marketEvents.unshift(event); marketEvents = marketEvents.slice(0, 12); drawEvents();
  if (!effectsEnabled || mode === 'replay' || document.hidden || $('scene').classList.contains('paused')) return;
  clearEffect();
  $('scene').dataset.marketEffect = event.kind;
  $('scene-event').hidden = false;
  let holdMs = 5500;
  if (event.kind === 'burn') {
    const level = burnLevel(event.amount);
    $('scene').dataset.burnLevel = String(level);
    holdMs = level === 3 ? 8200 : level === 2 ? 6500 : 4800;
  }
  text('scene-event-icon', event.kind === 'buy' ? '✦' : '♨');
  text('scene-event-title', `${event.sample ? 'DEMO · ' : ''}${event.label}`);
  text('scene-event-detail', `${shortAmount(event.amount)} CLAWD${event.kind === 'buy' ? ` · ≈ ${usd(event.usd)}` : ' · a little extra warmth in the workshop'}`);
  effectTimer = setTimeout(clearEffect, holdMs);
}
async function fetchPrice(generation) {
  if (demo || document.hidden || priceBusy === generation || generation !== epoch) return;
  priceBusy = generation;
  const client = market;
  try {
    const quote = await client.quote(); if (generation !== epoch || demo) return; priceFailures = 0; drawPrice(quote);
    // Don't leave the chain watcher waiting a full watch interval after the first quote lands.
    if (watchBusy !== generation) { clearTimeout(watchTimer); watchChain(generation); }
  }
  catch (error) { if (generation === epoch) { priceFailures++; text('market-status', `${currentPrice ? 'Saved quote · ' : 'Price unavailable · '}${error.message} Retrying.`); } }
  finally { if (priceBusy === generation) priceBusy = null; if (generation === epoch && !demo && !document.hidden) priceTimer = setTimeout(() => fetchPrice(generation), Math.min(120000, marketConfig.refreshMs * 2 ** priceFailures)); }
}
async function watchChain(generation) {
  if (demo || document.hidden || watchBusy === generation || generation !== epoch) return;
  if (!market.price) { text('chain-status', 'Waiting for a verified pair from the price feed.'); watchTimer = setTimeout(() => watchChain(generation), marketConfig.watchMs); return; }
  watchBusy = generation;
  const client = market;
  try {
    const result = await client.watch(); if (generation !== epoch || demo) return; watchFailures = 0;
    text('chain-status', `${mode === 'replay' ? 'Current market · scene reactions paused during replay. ' : ''}${result.note}`);
    for (const event of result.events) showEvent(event);
  } catch (error) { if (generation === epoch) { watchFailures++; text('chain-status', `Transaction feed unavailable · ${error.message} No simulated events are substituted.`); } }
  finally { if (watchBusy === generation) watchBusy = null; if (generation === epoch && !demo && !document.hidden) watchTimer = setTimeout(() => watchChain(generation), Math.min(120000, marketConfig.watchMs * 2 ** watchFailures)); }
}
function setMarketMode(sample) {
  ++epoch; clearTimeout(priceTimer); clearTimeout(watchTimer); clearEffect(); market.dispose(); market = new MarketClient(marketConfig);
  marketEvents = []; samples = []; currentPrice = null; priceFailures = watchFailures = 0; drawEvents();
  $('market-demo').hidden = !sample; $('market-chart').hidden = true;
  if (sample) { drawPrice({ price: .000042, priceChange: { h24: 3.8 }, volume: { h24: 85000 }, liquidity: { usd: 340000 }, at: Date.now() }, true); text('chain-status', 'DEMO · preview reactions with the buttons below.'); }
  else { text('market-price', '—'); text('market-change', '—'); text('market-volume', '—'); text('market-liquidity', '—'); text('market-status', 'Connecting to the price feed…'); text('chain-status', 'Opening the transaction feed…'); fetchPrice(epoch); watchChain(epoch); }
}
window.addEventListener('workshop:render', e => {
  state = e.detail; const previousMode = mode; mode = state.mode;
  drawBrief(state);
  if (demo !== state.demo) { demo = state.demo; setMarketMode(demo); }
  if (mode === 'replay') { clearEffect(); if (!demo) text('chain-status', 'Current market · scene reactions paused during historical replay.'); }
  else if (previousMode === 'replay' && !demo) text('chain-status', 'Current market · watching new transaction logs.');
});
for (const [id, key] of [['buy-threshold', 'bigBuyUsd'], ['burn-threshold', 'bigBurnTokens']]) $(id).addEventListener('change', e => {
  const value = Number(e.target.value); if (!Number.isFinite(value) || value < 1) { e.target.value = String(marketConfig[key]); return; } marketConfig[key] = value;
});
$('market-effects').addEventListener('change', e => { effectsEnabled = e.target.checked; if (!effectsEnabled) clearEffect(); });
$('demo-buy').addEventListener('click', () => { if (demo) showEvent({ kind: 'buy', label: 'Buy-side swap', amount: 48000000, usd: 2016, sample: true }); });
$('demo-burn').addEventListener('click', () => {
  if (!demo) return;
  const amount = Math.max(1, Number($('burn-threshold').value) || 1_000_000);
  showEvent({ kind: 'burn', label: 'Token burn', amount, sample: true });
});

function drawRadio(message) {
  fillTrackSelect();
  const track = radio.current();
  text('radio-title', track?.name || 'Workshop radio');
  const live = !radio.playing
    ? 'Starting the shared loop…'
    : radio.muted
      ? 'Muted · still live for the room'
      : 'Live room · synced for everyone';
  text('radio-status', message || live);
  text('radio-play', radio.muted ? '🔇' : '🔊');
  $('radio-play').setAttribute('aria-pressed', String(radio.muted));
  $('radio-play').setAttribute('aria-label', radio.muted ? 'Unmute music' : 'Mute music');
  $('scene').classList.toggle('music-playing', radio.playing && !radio.muted);
  document.querySelector('.radio-panel')?.classList.toggle('playing', radio.playing && !radio.muted);
}
async function startRadio({ allowMutedFallback = true } = {}) {
  radio.setVolume(Number($('radio-volume').value) / 100);
  try {
    if (!radio.playing) await radio.play();
    else if (radio.audio?.paused) await radio.audio.play();
    return true;
  } catch {
    if (!allowMutedFallback) return false;
    radio.setMuted(true);
    try {
      if (!radio.playing) await radio.play();
      else if (radio.audio?.paused) await radio.audio.play();
      return true;
    } catch {
      return false;
    }
  }
}
$('radio-play').addEventListener('click', async () => {
  if (radioBusy) return; radioBusy = true; $('radio-play').disabled = true;
  try {
    if (!radio.playing) {
      radio.setMuted(false);
      const ok = await startRadio({ allowMutedFallback: false });
      if (!ok) drawRadio('Audio is unavailable in this browser.');
      else drawRadio();
      return;
    }
    radio.setMuted(!radio.muted);
    if (!radio.muted && radio.audio?.paused) await radio.audio.play();
    drawRadio();
  } catch { drawRadio('Audio is unavailable in this browser.'); }
  finally { radioBusy = false; $('radio-play').disabled = false; }
});
$('radio-volume').addEventListener('input', e => {
  radio.setVolume(Number(e.target.value) / 100);
  if (radio.muted && Number(e.target.value) > 0) {
    radio.setMuted(false);
    drawRadio();
  }
});
radio.setVolume(Number($('radio-volume').value) / 100);
document.addEventListener('visibilitychange', () => {
  clearTimeout(priceTimer); clearTimeout(watchTimer);
  if (document.hidden) clearEffect();
  else {
    if (radio.playing) {
      if (radio.audio?.paused) radio.audio.play().catch(() => {});
      drawRadio();
    }
    if (!demo) { fetchPrice(epoch); watchChain(epoch); }
  }
});
window.addEventListener('pagehide', () => { ++epoch; clearTimeout(priceTimer); clearTimeout(watchTimer); clearEffect(); radio.stop(); });
let radioClock = setInterval(() => { if (radio.playing) drawRadio(); }, 4000);
window.addEventListener('pagehide', () => clearInterval(radioClock));
drawRadio();
startRadio().then(ok => {
  drawRadio(ok ? undefined : 'Tap the speaker to start music.');
  if (ok && radio.muted) {
    const unmute = () => {
      radio.setMuted(false);
      if (radio.audio?.paused) radio.audio.play().catch(() => {});
      drawRadio();
      document.removeEventListener('pointerdown', unmute);
      document.removeEventListener('keydown', unmute);
    };
    document.addEventListener('pointerdown', unmute, { once: true });
    document.addEventListener('keydown', unmute, { once: true });
  }
});
