import { CONFIG } from './config.js';
import { TrackRadio } from './playlist.js';
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
let state = null, demo = null, mode = 'current';
let priceTimer, watchTimer, epoch = 0, priceBusy = null, watchBusy = null, priceFailures = 0, watchFailures = 0, effectTimer;
let samples = [], marketEvents = [], currentPrice = null, effectsEnabled = true, radioBusy = false, awaitingSound = false;

function drawDaySummary(s) {
  const cutoff = (s.data?.end || Date.now()) - 86400000;
  const day = s.allEvents.filter(e => Date.parse(e.created_at) >= cutoff);
  text('day-projects', new Set(day.map(e => e.repo.name)).size);
  text('day-updates', day.length);
  text('day-releases', day.filter(e => e.type === 'ReleaseEvent' && e.payload?.action === 'published').length);
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
  drawDaySummary(state);
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

const VOLUME_KEY = 'clawd-workshop-radio-volume';
let lastAudibleVolume = 55;
function rememberVolume() {
  try { localStorage.setItem(VOLUME_KEY, $('radio-volume').value); } catch { /* Storage is optional. */ }
}
function isAutoplayBlock(error) {
  const name = error?.name || '';
  return name === 'NotAllowedError' || name === 'AbortError';
}
function ensureAudibleVolume() {
  let volume = Number($('radio-volume').value);
  if (!(volume > 0)) {
    volume = lastAudibleVolume || 55;
    $('radio-volume').value = String(volume);
  }
  radio.setVolume(volume / 100);
  return volume;
}
function drawRadio() {
  const volume = Math.round(radio.volume * 100);
  const waiting = awaitingSound || radio.blocked || !radio.playing;
  const audible = radio.playing && !radio.muted && volume > 0 && !radio.blocked && !awaitingSound;
  text('radio-title', radio.current()?.name || 'Workshop radio');
  const label = radio.loading ? 'Joining the room radio…'
    : radio.error ? 'Track unavailable · press Retry.'
    : radio.blocked || awaitingSound ? 'Browser blocked autoplay with sound · press Enable music.'
    : !radio.playing ? 'Press Enable music to join the room.'
    : !audible ? 'Muted · the shared playlist keeps going.'
    : 'Playing · shared room playlist';
  text('radio-status', label);
  $('radio-status').dataset.state = radio.error ? 'error' : radio.blocked || awaitingSound ? 'blocked' : audible ? 'playing' : 'quiet';
  text('radio-play', radio.error ? 'Retry' : waiting && !radio.loading ? 'Enable music' : radio.muted || !volume ? 'Unmute' : 'Mute');
  $('radio-play').classList.toggle('requires-action', Boolean((waiting && !radio.loading) || radio.error));
  $('radio-play').setAttribute('aria-pressed', String(radio.muted || !volume));
  $('radio-play').setAttribute('aria-label', radio.error ? 'Retry workshop music' : waiting ? 'Enable workshop music' : radio.muted || !volume ? 'Unmute music' : 'Mute music');
  $('radio-play').disabled = radioBusy;
  $('radio-volume').setAttribute('aria-valuetext', `${volume}%`);
  text('radio-volume-value', `${volume}%`);
  $('scene').classList.toggle('music-playing', audible);
  document.querySelector('.radio-panel')?.classList.toggle('playing', audible);
  document.querySelector('.radio-panel')?.classList.toggle('needs-sound', Boolean(radio.blocked || awaitingSound));
}
async function startRadio({ withSound = true } = {}) {
  if (withSound) ensureAudibleVolume();
  else radio.setVolume(Number($('radio-volume').value) / 100);
  radio.setMuted(!withSound);
  // Always call play after unmuting: browsers can pause media asynchronously.
  await radio.play();
  if (withSound) {
    awaitingSound = false;
    radio.blocked = false;
  }
}
/** Unmute an already-running element inside the click gesture (Chrome needs this). */
async function unlockSound() {
  ensureAudibleVolume();
  radio.setMuted(false);
  const audio = radio.audio;
  if (audio) {
    audio.muted = false;
    audio.volume = radio.volume;
    // Start play() before any other await so Chrome keeps the user gesture.
    const pending = audio.paused ? audio.play() : Promise.resolve();
    awaitingSound = false;
    radio.blocked = false;
    radio.error = null;
    await pending;
    radio.playing = !audio.paused;
    return;
  }
  await startRadio({ withSound: true });
}
async function bootRadio() {
  if (radioBusy) return;
  radioBusy = true; drawRadio();
  try {
    // Audible playback is the first attempt, never the muted-first path.
    await startRadio({ withSound: true });
  } catch (error) {
    if (isAutoplayBlock(error)) {
      awaitingSound = true;
      try { await startRadio({ withSound: false }); } catch { /* State is set by the player. */ }
      // Muted playback may run, but it is still waiting for permission for sound.
      if (!radio.error) radio.blocked = true;
    }
  } finally { radioBusy = false; drawRadio(); }
}
radio.onchange = drawRadio;
$('radio-play').addEventListener('click', async () => {
  if (radioBusy) return;
  radioBusy = true;
  try {
    if (radio.error || !radio.playing) await startRadio({ withSound: true });
    else if (awaitingSound || radio.blocked || radio.muted || radio.volume === 0) await unlockSound();
    else radio.setMuted(true);
  } catch (error) {
    if (isAutoplayBlock(error)) {
      awaitingSound = true;
      radio.blocked = true;
    }
  } finally { radioBusy = false; drawRadio(); }
});
$('radio-volume').addEventListener('input', async e => {
  const volume = Number(e.target.value);
  radio.setVolume(volume / 100);
  if (volume > 0) lastAudibleVolume = volume;
  radio.setMuted(volume === 0);
  rememberVolume(); drawRadio();
  if (volume > 0 && !radioBusy && (awaitingSound || radio.blocked || !radio.playing)) {
    radioBusy = true;
    try { await unlockSound(); } catch { /* The Enable music control remains available. */ }
    finally { radioBusy = false; drawRadio(); }
  }
});
try {
  const saved = Number(localStorage.getItem(VOLUME_KEY));
  if (saved > 0 && saved <= 100) $('radio-volume').value = String(saved);
} catch { /* Default volume works without storage. */ }
lastAudibleVolume = Number($('radio-volume').value) || 55;
radio.setVolume(lastAudibleVolume / 100);
document.addEventListener('visibilitychange', () => {
  clearTimeout(priceTimer); clearTimeout(watchTimer);
  if (document.hidden) clearEffect();
  else {
    // Keep audio running in the background; resync if the OS paused it.
    if (radio.audio?.paused && !radio.blocked && !radio.error) radio.play().catch(() => {});
    drawRadio();
    if (!demo) { fetchPrice(epoch); watchChain(epoch); }
  }
});
let radioClock;
function runRadioClock() { clearInterval(radioClock); radioClock = setInterval(drawRadio, 4000); }
window.addEventListener('pagehide', () => {
  ++epoch; clearTimeout(priceTimer); clearTimeout(watchTimer); clearEffect();
  clearInterval(radioClock); radio.stop();
});
window.addEventListener('pageshow', e => {
  if (!e.persisted) return;
  runRadioClock(); bootRadio();
  if (!demo && !document.hidden) { fetchPrice(epoch); watchChain(epoch); }
});
runRadioClock(); drawRadio(); bootRadio();
