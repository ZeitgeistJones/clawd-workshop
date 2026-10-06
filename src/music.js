// Workshop radio: original Web Audio lo-fi. Stations are moods; each Play starts a fresh live set.
export const STATIONS = Object.freeze([
  { name: 'Late-night workbench', bpm: [68, 76], density: .55, sparkle: .35 },
  { name: 'Tea by the window', bpm: [60, 70], density: .4, sparkle: .55 },
  { name: 'Little ideas', bpm: [74, 84], density: .7, sparkle: .45 },
]);

const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const frequency = note => 440 * 2 ** ((note - 69) / 12);
const SCALE = [0, 2, 3, 5, 7, 8, 10]; // natural minor colors
const CHORDS = [[0, 3, 7, 10], [0, 3, 7, 12], [2, 5, 9, 12], [3, 7, 10, 14], [5, 8, 12, 15], [7, 10, 14, 17]];

/** Tiny deterministic RNG so tests can freeze a set, while Play uses Math.random. */
export function makeRng(seed = Math.random() * 1e9) {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];
const chance = (rng, p) => rng() < p;
const between = (rng, min, max) => min + rng() * (max - min);

/** One listen: random key + tempo inside the station’s mood. */
export function createSession(station = STATIONS[0], rng = makeRng()) {
  const mood = typeof station === 'number' ? STATIONS[station] : station;
  return {
    name: mood.name,
    bpm: Math.round(between(rng, mood.bpm[0], mood.bpm[1])),
    key: 48 + Math.floor(rng() * 12), // C3–B3
    density: mood.density,
    sparkle: mood.sparkle,
    progression: Array.from({ length: 4 }, () => pick(rng, CHORDS)),
  };
}

/** Generate one bar. Pass the same rng to keep a set coherent; omit for one-off tests. */
export function barScore(index, sessionOrStation = STATIONS[0], rng = makeRng(index + 1)) {
  const session = sessionOrStation?.key != null ? sessionOrStation : createSession(sessionOrStation, rng);
  const beat = 60 / session.bpm;
  const chord = session.progression[index % session.progression.length];
  const root = session.key + chord[0];
  const notes = [];

  // Soft pad chord — sometimes thinner for air.
  const voices = chance(rng, session.density) ? chord : chord.slice(0, 3);
  voices.forEach((interval, i) => {
    notes.push({ kind: 'keys', note: session.key + interval + (chance(rng, .2) ? 12 : 0), at: i * .04, length: beat * between(rng, 3.2, 3.9) });
  });

  // Walking-ish bass hits on a few beats.
  const bassBeats = chance(rng, .5) ? [0, 2] : [0, 1.5, 2.75];
  bassBeats.forEach((b, i) => {
    const step = SCALE[Math.floor(rng() * SCALE.length)];
    notes.push({ kind: 'bass', note: root - 24 + (i ? step : 0), at: b * beat, length: beat * between(rng, .45, .75) });
  });

  // Kick / snare skeleton with light variation.
  const kicks = chance(rng, .65) ? [0, 2] : [0, 2, 2.75];
  kicks.forEach(b => notes.push({ kind: 'kick', at: b * beat + (chance(rng, .25) ? beat * .04 : 0), length: .2 }));
  const snares = chance(rng, session.density) ? [1, 3] : [1];
  snares.forEach(b => notes.push({ kind: 'snare', at: b * beat, length: .12 }));

  // Hats: denser on busier moods, with swing.
  const hatCount = chance(rng, session.density) ? 8 : 4;
  for (let i = 0; i < hatCount; i++) {
    if (chance(rng, .12)) continue;
    const swing = i % 2 ? between(rng, .04, .09) : 0;
    notes.push({ kind: 'hat', at: (i * (4 / hatCount) + swing) * beat, length: .035 });
  }

  // Occasional sparkle bells — different every few bars.
  if (chance(rng, session.sparkle)) {
    const sparkle = [14, 17, 19, 22];
    const when = pick(rng, [1.25, 1.75, 2.5]);
    notes.push({ kind: 'bell', note: root + pick(rng, sparkle), at: when * beat, length: between(rng, .55, 1.1) });
    if (chance(rng, .4) && when + .75 < 3.9) notes.push({ kind: 'bell', note: root + pick(rng, sparkle), at: (when + .75) * beat, length: .7 });
  }

  const duration = beat * 4;
  return { duration, notes: notes.filter(n => n.at >= 0 && n.at < duration && n.length > 0), session };
}

// Original music synthesized locally. No external tracks, autoplay, or network requests.
export class LofiRadio {
  constructor(factory = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)()) {
    this.factory = factory; this.context = null; this.master = null; this.timer = null;
    this.volume = .55; this.station = 0; this.playing = false; this.generation = 0;
    this.session = null; this.rng = null;
  }
  setVolume(value) {
    this.volume = clamp(value);
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume * .9, this.context.currentTime, .08);
  }
  async play(station = this.station) {
    if (this.playing) return;
    const generation = ++this.generation;
    const context = this.factory(); this.context = context; this.station = station;
    this.rng = makeRng(); this.session = createSession(STATIONS[this.station] || STATIONS[0], this.rng);
    try {
      await context.resume();
      if (generation !== this.generation) { if (context.state !== 'closed') await context.close(); return; }
      this.master = context.createGain(); this.master.gain.value = this.volume * .9;
      const lowpass = context.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 3200;
      const compressor = context.createDynamicsCompressor(); compressor.threshold.value = -22; compressor.ratio.value = 2.8;
      this.master.connect(lowpass); lowpass.connect(compressor); compressor.connect(context.destination);
      this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const samples = this.noise.getChannelData(0); for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      const tape = context.createBufferSource(); tape.buffer = this.noise; tape.loop = true;
      const tapeGain = context.createGain(); tapeGain.gain.value = .003; tape.connect(tapeGain); tapeGain.connect(this.master); tape.start();
      this.playing = true; this.bar = 0; this.nextBar = context.currentTime + .08;
      this.schedule(); this.timer = setInterval(() => this.schedule(), 200);
    } catch (error) {
      if (context.state !== 'closed') await context.close();
      this.context = null; this.playing = false; this.session = null; throw error;
    }
  }
  schedule() {
    if (!this.playing || !this.session) return;
    while (this.nextBar < this.context.currentTime + .8) {
      const score = barScore(this.bar++, this.session, this.rng);
      score.notes.forEach(note => this.sound(note, this.nextBar + note.at));
      this.nextBar += score.duration;
    }
  }
  sound(note, at) {
    const c = this.context, gain = c.createGain(); gain.connect(this.master);
    const peak = { keys: .07, bass: .16, kick: .26, snare: .045, hat: .024, bell: .04 }[note.kind];
    gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(peak, at + .012); gain.gain.exponentialRampToValueAtTime(.0001, at + note.length);
    if (['snare', 'hat'].includes(note.kind)) {
      const noise = c.createBufferSource(), filter = c.createBiquadFilter(); noise.buffer = this.noise;
      filter.type = 'highpass'; filter.frequency.value = note.kind === 'hat' ? 5500 : 1500;
      noise.connect(filter); filter.connect(gain); noise.start(at); noise.stop(at + note.length + .05);
      noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };
    } else {
      const oscillator = c.createOscillator(); oscillator.type = note.kind === 'bass' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(note.kind === 'kick' ? 110 : frequency(note.note), at);
      if (note.kind === 'kick') oscillator.frequency.exponentialRampToValueAtTime(42, at + .16);
      oscillator.connect(gain); oscillator.start(at); oscillator.stop(at + note.length + .05);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
  }
  async stop() {
    ++this.generation; clearInterval(this.timer); this.timer = null; this.playing = false;
    const context = this.context; this.context = null; this.master = null; this.session = null; this.rng = null;
    if (context && context.state !== 'closed') await context.close();
  }
}
