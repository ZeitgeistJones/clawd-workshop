// Workshop radio playlist — add new songs here (files live in public/music/).
// Drop the mp3 in public/music/, then append one entry with its duration in seconds.
// Everyone shares one live loop: position = wall-clock time through the playlist.

/** @typedef {{ id: string, name: string, src: string, duration: number }} Track */

/** @type {Track[]} */
export const TRACKS = [
  { id: 'fwahh', name: 'fwahh', src: './public/music/fwahh.mp3', duration: 153.624 },
  { id: 'slop-lessons', name: 'Slop Lessons', src: './public/music/slop-lessons.mp3', duration: 202.752 },
  { id: 'clawd-calendar', name: 'clawd calendar', src: './public/music/clawd-calendar.mp3', duration: 168.024 },
  { id: 'clawd-talk-to-your-wallet', name: 'talk to your wallet', src: './public/music/clawd-talk-to-your-wallet.mp3', duration: 158.64 },
];

/** @param {Track[]} [tracks] */
export function playlistLength(tracks = TRACKS) {
  return tracks.reduce((sum, track) => sum + Math.max(0, Number(track.duration) || 0), 0);
}

/**
 * Shared live position for everyone with a working clock.
 * @param {number} [nowMs]
 * @param {Track[]} [tracks]
 */
export function scheduleAt(nowMs = Date.now(), tracks = TRACKS) {
  const total = playlistLength(tracks);
  if (!tracks.length || !(total > 0)) return { index: 0, offset: 0, track: tracks[0] || null, total: 0 };
  let cursor = ((nowMs / 1000) % total + total) % total;
  for (let index = 0; index < tracks.length; index++) {
    const duration = Math.max(0, Number(tracks[index].duration) || 0);
    if (cursor < duration) {
      return { index, offset: cursor, track: tracks[index], total };
    }
    cursor -= duration;
  }
  return { index: 0, offset: 0, track: tracks[0], total };
}

/** HTMLAudio player that joins the shared looping schedule. Starts only after play(). */
export class TrackRadio {
  /**
   * @param {(src: string) => HTMLAudioElement} [factory]
   * @param {() => number} [now]
   */
  constructor(factory = src => {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.loop = false;
    return audio;
  }, now = () => Date.now()) {
    this.factory = factory;
    this.now = now;
    this.audio = null;
    this.track = 0;
    this.volume = 0.55;
    this.muted = false;
    this.playing = false;
    this.generation = 0;
    this.syncTimer = 0;
  }

  current() {
    return scheduleAt(this.now()).track || TRACKS[this.track] || TRACKS[0] || null;
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.audio) this.audio.volume = this.volume;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.audio) this.audio.muted = this.muted;
  }

  release(audio) {
    if (!audio) return;
    audio.onended = null;
    audio.onloadedmetadata = null;
    audio.pause();
    try {
      audio.removeAttribute('src');
      audio.load();
    } catch { /* Some harnesses stub Audio without full DOM methods. */ }
  }

  clearSync() {
    clearInterval(this.syncTimer);
    this.syncTimer = 0;
  }

  seekLive(audio, offset, duration) {
    if (!audio || !(duration > 0)) return;
    const target = Math.min(Math.max(0, offset), Math.max(0, duration - 0.05));
    const current = Number(audio.currentTime) || 0;
    if (Math.abs(current - target) > 0.35) {
      try { audio.currentTime = target; } catch { /* Ignore seek races while loading. */ }
    }
  }

  async attachLive(generation) {
    const live = scheduleAt(this.now());
    if (!live.track) throw new Error('No tracks in the playlist.');
    const previous = this.audio;
    this.audio = null;
    this.release(previous);
    this.track = live.index;
    const audio = this.factory(live.track.src);
    audio.loop = false;
    audio.volume = this.volume;
    audio.muted = this.muted;
    this.audio = audio;
    audio.onended = () => {
      if (generation !== this.generation || !this.playing) return;
      this.attachLive(generation).catch(() => {});
    };
    const apply = () => {
      if (generation !== this.generation || this.audio !== audio) return;
      const duration = Number(live.track.duration) || Number(audio.duration) || 0;
      this.seekLive(audio, scheduleAt(this.now()).offset, duration);
    };
    if (typeof audio.readyState === 'number' && audio.readyState >= 1) apply();
    else audio.onloadedmetadata = apply;
    await audio.play();
    if (generation !== this.generation) {
      this.release(audio);
      if (this.audio === audio) this.audio = null;
      return;
    }
    apply();
    this.playing = true;
    this.clearSync();
    this.syncTimer = setInterval(() => {
      if (generation !== this.generation || !this.playing || !this.audio) return;
      const next = scheduleAt(this.now());
      if (next.index !== this.track) {
        this.attachLive(generation).catch(() => {});
        return;
      }
      const duration = Number(next.track?.duration) || Number(this.audio.duration) || 0;
      this.seekLive(this.audio, next.offset, duration);
    }, 4000);
  }

  async play() {
    if (!TRACKS.length) throw new Error('No tracks in the playlist.');
    const generation = ++this.generation;
    this.playing = false;
    this.clearSync();
    await this.attachLive(generation);
  }

  async stop() {
    ++this.generation;
    this.playing = false;
    this.clearSync();
    const audio = this.audio;
    this.audio = null;
    this.release(audio);
  }
}
