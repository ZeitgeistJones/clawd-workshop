export const STATIONS = Object.freeze([
  { name: 'Late-night workbench', bpm: 72, roots: [57, 60, 55, 62] },
  { name: 'Tea by the window', bpm: 66, roots: [53, 58, 55, 60] },
  { name: 'Little ideas', bpm: 78, roots: [60, 57, 62, 55] },
]);
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const frequency = note => 440 * 2 ** ((note - 69) / 12);
export function barScore(index, station = STATIONS[0]) {
  const root = station.roots[index % station.roots.length], beat = 60 / station.bpm;
  const notes = [0, 3, 7, 10, 14].map((interval, i) => ({ kind: 'keys', note: root + interval, at: i * .035, length: beat * 3.8 }));
  [0, 1.5, 2.75].forEach((b, i) => notes.push({ kind: 'bass', note: root - 24 + (i === 2 ? 7 : 0), at: b * beat, length: beat * .65 }));
  [0, 2, 2.75].forEach(b => notes.push({ kind: 'kick', at: b * beat, length: .2 }));
  [1, 3].forEach(b => notes.push({ kind: 'snare', at: b * beat, length: .12 }));
  for (let i = 0; i < 8; i++) notes.push({ kind: 'hat', at: (i * .5 + (i % 2 ? .065 : 0)) * beat, length: .035 });
  if (index % 2) [1.75, 3.5].forEach((b, i) => notes.push({ kind: 'bell', note: root + [19, 14][i], at: b * beat, length: .8 }));
  return { duration: beat * 4, notes };
}

// Original music synthesized locally. No external tracks, autoplay, or network requests.
export class LofiRadio {
  constructor(factory = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)()) { this.factory = factory; this.context = null; this.master = null; this.timer = null; this.volume = .35; this.station = 0; this.playing = false; this.generation = 0; }
  setVolume(value) { this.volume = clamp(value); this.master?.gain.setTargetAtTime(this.volume * .45, this.context.currentTime, .08); }
  async play(station = this.station) {
    if (this.playing) return;
    const generation = ++this.generation;
    const context = this.factory(); this.context = context; this.station = station;
    try {
      await context.resume();
      if (generation !== this.generation) { if (context.state !== 'closed') await context.close(); return; }
      this.master = context.createGain(); this.master.gain.value = this.volume * .45;
      const lowpass = context.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 3000;
      const compressor = context.createDynamicsCompressor(); compressor.threshold.value = -24; compressor.ratio.value = 3;
      this.master.connect(lowpass); lowpass.connect(compressor); compressor.connect(context.destination);
      this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const samples = this.noise.getChannelData(0); for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      const tape = context.createBufferSource(); tape.buffer = this.noise; tape.loop = true;
      const tapeGain = context.createGain(); tapeGain.gain.value = .0025; tape.connect(tapeGain); tapeGain.connect(this.master); tape.start();
      this.playing = true; this.bar = 0; this.nextBar = context.currentTime + .08;
      this.schedule(); this.timer = setInterval(() => this.schedule(), 200);
    } catch (error) { if (context.state !== 'closed') await context.close(); this.context = null; this.playing = false; throw error; }
  }
  schedule() {
    if (!this.playing) return;
    while (this.nextBar < this.context.currentTime + .8) {
      const score = barScore(this.bar++, STATIONS[this.station]);
      score.notes.forEach(note => this.sound(note, this.nextBar + note.at)); this.nextBar += score.duration;
    }
  }
  sound(note, at) {
    const c = this.context, gain = c.createGain(); gain.connect(this.master);
    const peak = { keys: .052, bass: .12, kick: .20, snare: .034, hat: .018, bell: .028 }[note.kind];
    gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(peak, at + .012); gain.gain.exponentialRampToValueAtTime(.0001, at + note.length);
    if (['snare', 'hat'].includes(note.kind)) {
      const noise = c.createBufferSource(), filter = c.createBiquadFilter(); noise.buffer = this.noise;
      filter.type = 'highpass'; filter.frequency.value = note.kind === 'hat' ? 5500 : 1500;
      noise.connect(filter); filter.connect(gain); noise.start(at); noise.stop(at + note.length + .05); noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };
    } else {
      const oscillator = c.createOscillator(); oscillator.type = note.kind === 'bass' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(note.kind === 'kick' ? 110 : frequency(note.note), at);
      if (note.kind === 'kick') oscillator.frequency.exponentialRampToValueAtTime(42, at + .16);
      oscillator.connect(gain); oscillator.start(at); oscillator.stop(at + note.length + .05); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
  }
  async stop() { ++this.generation; clearInterval(this.timer); this.timer = null; this.playing = false; const context = this.context; this.context = null; this.master = null; if (context && context.state !== 'closed') await context.close(); }
}
