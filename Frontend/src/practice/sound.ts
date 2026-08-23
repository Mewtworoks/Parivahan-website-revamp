// Tiny synthesised feedback sounds for the practice game — no audio files, just short
// oscillator envelopes. Failing silently (no AudioContext, autoplay-blocked, etc.) is fine;
// these are a nice-to-have, never load-bearing for the game itself.

let muted = (() => {
  try { return localStorage.getItem('sfxMuted') === '1'; } catch { return false; }
})();

export function isSfxMuted(): boolean {
  return muted;
}

export function setSfxMuted(value: boolean): void {
  muted = value;
  try { localStorage.setItem('sfxMuted', value ? '1' : '0'); } catch { /* private browsing, etc. */ }
}

let ctx: AudioContext | null = null;
function getContext(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, startOffset: number, duration: number, gain: number, type: OscillatorType) {
  if (muted) return;
  const audio = getContext();
  if (!audio) return;
  const osc = audio.createOscillator();
  const env = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const start = audio.currentTime + startOffset;
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env);
  env.connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** A short rising two-note chime for a correct answer. */
export function playCorrect(): void {
  tone(660, 0, 0.11, 0.05, 'sine');
  tone(880, 0.08, 0.16, 0.05, 'sine');
}

/** A short low buzz for a wrong answer or a timeout. */
export function playWrong(): void {
  tone(160, 0, 0.22, 0.045, 'square');
}

/** A soft, neutral tick for picking an answer, before the reveal. */
export function playTick(): void {
  tone(420, 0, 0.05, 0.03, 'sine');
}
