// Workshop radio playlist — add new songs here (files live in public/music/).
// Drop the mp3 in public/music/, then append one entry below.

/** @typedef {{ id: string, name: string, src: string }} Track */

/** @type {Track[]} */
export const TRACKS = [
  { id: 'fwahh', name: 'fwahh', src: './public/music/fwahh.mp3' },
  { id: 'slop-lessons', name: 'Slop Lessons', src: './public/music/slop-lessons.mp3' },
];

/** HTMLAudio playlist player. Loops the selected track. Starts only after play(). */
export class TrackRadio {
  /**
   * @param {(src: string) => HTMLAudioElement} [factory]
   */
  constructor(factory = src => {
    const audio = new Audio(src);
    audio.preload = 'metadata';
    audio.loop = true;
    return audio;
  }) {
    this.factory = factory;
    this.audio = null;
    this.track = 0;
    this.volume = 0.55;
    this.playing = false;
    this.generation = 0;
  }

  current() {
    return TRACKS[this.track] || TRACKS[0] || null;
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.audio) this.audio.volume = this.volume;
  }

  release(audio) {
    if (!audio) return;
    audio.pause();
    try {
      audio.removeAttribute('src');
      audio.load();
    } catch { /* Some harnesses stub Audio without full DOM methods. */ }
  }

  async play(track = this.track) {
    const index = Math.max(0, Math.min(TRACKS.length - 1, Number(track) || 0));
    const item = TRACKS[index];
    if (!item) throw new Error('No tracks in the playlist.');
    const generation = ++this.generation;
    const previous = this.audio;
    this.audio = null;
    this.playing = false;
    this.release(previous);
    this.track = index;
    const audio = this.factory(item.src);
    audio.loop = true;
    audio.volume = this.volume;
    this.audio = audio;
    try {
      await audio.play();
      if (generation !== this.generation) {
        this.release(audio);
        if (this.audio === audio) this.audio = null;
        return;
      }
      this.playing = true;
    } catch (error) {
      if (this.audio === audio) this.audio = null;
      this.playing = false;
      throw error;
    }
  }

  async stop() {
    ++this.generation;
    this.playing = false;
    const audio = this.audio;
    this.audio = null;
    this.release(audio);
  }
}
