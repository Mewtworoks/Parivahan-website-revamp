import { useEffect, useState } from 'react';

/**
 * The hero picture: a form losing people, and something counting it.
 *
 * This replaced a rotating heat-mapped brain, and the reason is worth writing
 * down because it was a real mistake. The brain was a picture of the *metaphor*
 * — a mind, a scan, a sore spot glowing. It was pleasant to look at and it told
 * a reader nothing about what had been built, so the page opened with thirty
 * seconds of atmosphere and the first concrete sentence arrived far too late.
 * Asked what the page was proposing, somebody who had read it could not say.
 *
 * So the hero now shows the mechanism instead of the mood: the four steps of a
 * real form, one of them losing somebody, and a counter going up. That is the
 * entire product in one frame, and it needs no caption — which is the test a
 * hero visual should have to pass.
 *
 * It is HTML and CSS, not canvas. Everything here is a rectangle, a rule and a
 * number, and text in a canvas is text a screen reader cannot reach.
 */

/** The steps of the real apply flow, in order. */
const STEPS = [
  'Your details',
  'Address proof',
  'Vehicle class',
  'Photo and signature',
];

/**
 * What happens, and at which step. Fixed, and weighted the way the page argues:
 * address proof is where the journey actually dies, so it comes up most.
 */
const EVENTS: { step: number; label: string }[] = [
  { step: 1, label: 'pressed back' },
  { step: 3, label: 'waited 4m' },
  { step: 1, label: 'left the form' },
  { step: 0, label: 'changed an answer' },
  { step: 1, label: 'pressed back' },
  { step: 2, label: 'pressed back' },
];

export function Journey() {
  const [tick, setTick] = useState(0);
  const still = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (still) return;
    const timer = setInterval(() => setTick(n => n + 1), 2200);
    return () => clearInterval(timer);
  }, [still]);

  const event = EVENTS[tick % EVENTS.length];

  // Starts at a number that looks like a service which has been running, and
  // climbs while somebody watches. The step is uneven so it reads as arrivals
  // rather than as a stopwatch.
  const counted = 1284 + tick * 3 + (tick % 3);

  return (
    <div className="gb-journey">
      <div className="gb-journey-head">
        <span>Learner licence · apply</span>
        <span className="gb-journey-live">
          <i />
          {still ? 'recording' : 'recording'}
        </span>
      </div>

      <ol className="gb-journey-steps">
        {STEPS.map((step, index) => {
          const hit = index === event.step;
          return (
            <li key={step} className={hit ? 'is-hit' : ''}>
              <span className="gb-journey-n">{String(index + 1).padStart(2, '0')}</span>
              <span className="gb-journey-name">{step}</span>
              {/* The tag is keyed on the tick so React remounts it and the
                  entrance animation replays. Without the key it slides in once
                  and then silently swaps its text, which reads as a typo
                  correcting itself rather than as a new event arriving. */}
              {hit && <span className="gb-journey-tag" key={tick}>{event.label}</span>}
            </li>
          );
        })}
      </ol>

      <div className="gb-journey-foot">
        <div>
          <span className="gb-journey-k">Failures noticed today</span>
          <b>{counted.toLocaleString('en-IN')}</b>
        </div>
        <div>
          <span className="gb-journey-k">Complaints filed</span>
          <b>0</b>
        </div>
      </div>

      <span className="gb-journey-note">Illustration. Nothing here is measured.</span>
    </div>
  );
}
