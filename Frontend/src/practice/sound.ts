// Feedback sounds for the practice game. Failing silently (autoplay-blocked, missing file, etc.)
// is fine — these are a nice-to-have, never load-bearing for the game itself.
import correctSrc from '../assets/correct_quiz.mp3';
import wrongSrc from '../assets/wrong_quiz.mp3';
import gameOverSrc from '../assets/game-over_quiz.mp3';

// On by default — a first-time player hears sound unless they explicitly mute it.
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

function playFile(src: string): void {
  if (muted) return;
  try {
    const audio = new Audio(src);
    void audio.play().catch(() => { /* autoplay-blocked, etc. — fine to skip */ });
  } catch {
    // Audio unsupported in this environment — fine to skip.
  }
}

/** Plays on a correct answer. */
export function playCorrect(): void {
  playFile(correctSrc);
}

/** Plays on a wrong answer or a timeout. */
export function playWrong(): void {
  playFile(wrongSrc);
}

/** Plays once all three hearts are gone and the round ends. */
export function playGameOver(): void {
  playFile(gameOverSrc);
}
