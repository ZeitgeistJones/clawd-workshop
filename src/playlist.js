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
    this.loading = false;
    this.blocked = false;
    this.error = null;
    this.onchange = null;
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
    audio.onplaying = audio.onpause = audio.onerror = null;
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
    // Reuse the unlocked media element across tracks, including on iOS.
    const previousTrack = this.track;
    const audio = this.audio || this.factory(live.track.src);
    audio.onended = audio.onloadedmetadata = audio.onplaying = audio.onpause = audio.onerror = null;
    if (this.audio && (previousTrack !== live.index || audio.error)) {
      audio.pause();
      audio.src = live.track.src;
      audio.load();
    }
    this.track = live.index;
    audio.loop = false;
    audio.volume = this.volume;
    audio.muted = this.muted;
    this.audio = audio;
    const active = () => generation === this.generation && this.audio === audio;
    audio.onplaying = () => {
      if (!active()) return;
      this.playing = true; this.loading = false; this.blocked = false; this.error = null;
      this.onchange?.();
    };
    audio.onpause = () => {
      if (!active() || this.loading) return;
      this.playing = false; this.onchange?.();
    };
    audio.onerror = () => {
      if (!active()) return;
      this.playing = false; this.loading = false; this.blocked = false;
      this.error = new Error('This track could not load.');
      this.clearSync(); this.onchange?.();
    };
    audio.onended = () => {
      if (generation !== this.generation || !this.playing) return;
      this.play().catch(() => {});
    };
    const apply = () => {
      if (generation !== this.generation || this.audio !== audio) return;
      const next = scheduleAt(this.now());
      if (next.index !== live.index) return;
      const duration = Number(audio.duration) || Number(live.track.duration) || 0;
      this.seekLive(audio, next.offset, duration);
    };
    if (typeof audio.readyState === 'number' && audio.readyState >= 1) apply();
    else audio.onloadedmetadata = apply;
    let timeout;
    try { await Promise.race([audio.play(), new Promise((_, reject) => {
      timeout = setTimeout(() => { const error = new Error('The track took too long to load.'); error.name = 'TimeoutError'; reject(error); }, 10000);
      timeout.unref?.();
    })]); } finally { clearTimeout(timeout); }
    if (!active()) return;
    if (scheduleAt(this.now()).index !== live.index) return this.play();
    apply();
    this.playing = true;
    this.loading = false; this.blocked = false; this.error = null; this.onchange?.();
    this.clearSync();
    this.syncTimer = setInterval(() => {
      if (generation !== this.generation || !this.playing || !this.audio) return;
      const next = scheduleAt(this.now());
      if (next.index !== this.track) {
        this.play().catch(() => {});
        return;
      }
      const duration = Number(this.audio.duration) || Number(next.track?.duration) || 0;
      this.seekLive(this.audio, next.offset, duration);
    }, 4000);
    this.syncTimer.unref?.();
  }

  async play() {
    if (!TRACKS.length) throw new Error('No tracks in the playlist.');
    const generation = ++this.generation;
    this.playing = false;
    this.loading = true; this.blocked = false; this.error = null; this.onchange?.();
    this.clearSync();
    try { await this.attachLive(generation); }
    catch (error) {
      if (generation !== this.generation) return;
      this.playing = false; this.loading = false;
      // Chrome often uses NotAllowedError; AbortError can appear when a start is interrupted.
      const autoplayBlocked = error?.name === 'NotAllowedError' || error?.name === 'AbortError';
      this.blocked = autoplayBlocked;
      this.error = autoplayBlocked ? null : error;
      // Keep the element on autoplay blocks so a later click can unmute the same media.
      if (!autoplayBlocked) {
        this.release(this.audio);
        this.audio = null;
      }
      this.clearSync();
      this.onchange?.();
      throw error;
    }
  }

  async stop() {
    ++this.generation;
    this.playing = false;
    this.loading = false;
    this.clearSync();
    const audio = this.audio;
    this.audio = null;
    this.release(audio);
  }
}
