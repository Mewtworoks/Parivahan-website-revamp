import React, { useEffect, useMemo, useRef, useState } from 'react';

import styles from './ScenarioStage.module.scss';

/**
 * Plays a scenario as a top-down animated diagram.
 *
 * The backend already ships everything a renderer needs — `actors` with
 * keyframed `path` entries of [t, x, y, z], `camera` keyframes, `scene_env`,
 * and `duration_s`. A full 3D renderer consumes exactly this payload; this
 * SVG is the same contract drawn in 2D, so the question is a moving situation
 * you read, not a paragraph you memorise.
 *
 * Axes: x is lateral (right positive), z is distance ahead. The ego vehicle
 * sits at the origin, looking up the screen.
 */

const GLYPH = {
  car: '🚗',
  truck: '🚚',
  bus: '🚌',
  ambulance: '🚑',
  fire_engine: '🚒',
  motorcycle: '🏍️',
  pedestrian: '🚶',
  object: '⚽',
  weather: '🌫️',
  sign: '🚸',
};

const SIGN_GLYPH = {
  STOP: '🛑',
  NO_ENTRY: '⛔',
};

const VIEW_W = 460;
const VIEW_H = 300;
const PAD = 34;

function actorGlyph(actor) {
  if (actor.kind === 'sign') {
    if (actor.meta?.sign && SIGN_GLYPH[actor.meta.sign]) return SIGN_GLYPH[actor.meta.sign];
    if (actor.meta?.limit) return null; // drawn as a speed roundel instead
    return GLYPH.sign;
  }
  if (actor.asset?.includes('child')) return '🧒';
  return GLYPH[actor.kind] || '🔶';
}

/** Position along a keyframed path at time t, or null for a static actor. */
function sampleAt(path, t) {
  if (!path || path.length === 0) return null;
  const keys = [...path].sort((a, b) => a[0] - b[0]);
  if (t <= keys[0][0]) return { x: keys[0][1], z: keys[0][3] };
  const last = keys[keys.length - 1];
  if (t >= last[0]) return { x: last[1], z: last[3] };

  for (let i = 0; i < keys.length - 1; i += 1) {
    const [t0, x0, , z0] = keys[i];
    const [t1, x1, , z1] = keys[i + 1];
    if (t >= t0 && t <= t1) {
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return { x: x0 + (x1 - x0) * f, z: z0 + (z1 - z0) * f };
    }
  }
  return { x: last[1], z: last[3] };
}

/** Fit every point the scene can reach, plus the ego at the origin. */
function useProjection(actors) {
  return useMemo(() => {
    const xs = [-5, 5];
    const zs = [-6, 14];
    actors.forEach((a) =>
      (a.path || []).forEach(([, x, , z]) => {
        xs.push(x);
        zs.push(z);
      }),
    );
    const minX = Math.min(...xs) - 1.5;
    const maxX = Math.max(...xs) + 1.5;
    const minZ = Math.min(...zs) - 1.5;
    const maxZ = Math.max(...zs) + 1.5;

    const sx = (VIEW_W - PAD * 2) / (maxX - minX);
    const sz = (VIEW_H - PAD * 2) / (maxZ - minZ);

    return {
      toX: (x) => PAD + (x - minX) * sx,
      // z grows away from the viewer, so it maps up the screen
      toY: (z) => VIEW_H - PAD - (z - minZ) * sz,
    };
  }, [actors]);
}

export default function ScenarioStage({ scenario, paused = false }) {
  const actors = scenario.actors || [];
  const duration = scenario.duration_s || 6;
  const { toX, toY } = useProjection(actors);

  const [t, setT] = useState(0);
  const raf = useRef();
  const startRef = useRef(null);

  // Loop the clip while the candidate reads the options.
  useEffect(() => {
    startRef.current = null;
    setT(0);
    if (paused) return undefined;

    const frame = (now) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = ((now - startRef.current) / 1000) % duration;
      setT(elapsed);
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [scenario.id, duration, paused]);

  const fog = actors.find((a) => a.kind === 'weather');
  const night = scenario.scene_env?.includes('night') || Boolean(fog);

  return (
    <figure className={styles.stage}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className={`${styles.svg} ${night ? styles.svgNight : ''}`}
        role="img"
        aria-label={scenario.prompt}
      >
        <defs>
          <linearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={night ? '#1e293b' : '#cbd5e1'} />
            <stop offset="100%" stopColor={night ? '#0f172a' : '#94a3b8'} />
          </linearGradient>
        </defs>

        {/* the road surface */}
        <rect
          x={toX(-4.2)}
          y={0}
          width={toX(4.2) - toX(-4.2)}
          height={VIEW_H}
          fill="url(#roadGrad)"
        />

        {/* lane divider — solid where the scenario says overtaking is barred */}
        {(() => {
          const solid = actors.some((a) => a.asset === 'solid_yellow');
          return (
            <line
              x1={toX(0)}
              y1={0}
              x2={toX(0)}
              y2={VIEW_H}
              stroke={solid ? '#facc15' : '#e2e8f0'}
              strokeWidth={solid ? 3 : 2}
              strokeDasharray={solid ? undefined : '12 14'}
              opacity={0.85}
            />
          );
        })()}

        {/* zebra crossing, when the scene has one */}
        {actors.some((a) => a.asset === 'zebra_crossing') && (
          <g opacity="0.9">
            {[-3.6, -2.6, -1.6, -0.6, 0.4, 1.4, 2.4, 3.4].map((x) => (
              <rect
                key={x}
                x={toX(x)}
                y={toY(3.4)}
                width={Math.max(6, toX(x + 0.6) - toX(x))}
                height={Math.abs(toY(2) - toY(3.4))}
                fill="#f8fafc"
              />
            ))}
          </g>
        )}

        {/* fog / weather overlay */}
        {fog && (
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="#e2e8f0" opacity="0.45" />
        )}

        {/* the candidate's own vehicle: always at the origin, facing up */}
        <g transform={`translate(${toX(0)}, ${toY(0)})`}>
          <circle r="17" className={styles.egoHalo} />
          <text className={styles.egoGlyph} textAnchor="middle" dy="7">🚙</text>
          <text className={styles.egoLabel} textAnchor="middle" y="30">you</text>
        </g>

        {/* every other actor */}
        {actors.map((actor, i) => {
          if (actor.kind === 'marking' || actor.kind === 'weather') return null;

          const pos = sampleAt(actor.path, t);
          // Static props get a readable resting place beside the road.
          const fallback = actor.kind === 'sign'
            ? { x: 3.3, z: 6 }
            : { x: -3.1, z: 5 + i * 1.4 };
          const { x, z } = pos || fallback;
          const glyph = actorGlyph(actor);
          const limit = actor.meta?.limit;

          return (
            <g
              key={actor.id}
              transform={`translate(${toX(x)}, ${toY(z)})`}
              className={pos ? styles.moving : undefined}
            >
              {actor.meta?.siren && <circle r="20" className={styles.siren} />}
              {actor.meta?.highbeam && <circle r="18" className={styles.beam} />}
              {limit ? (
                <>
                  <circle r="14" fill="#fff" stroke="#ef4444" strokeWidth="4" />
                  <text className={styles.limitText} textAnchor="middle" dy="5">{limit}</text>
                </>
              ) : (
                <text className={styles.glyph} textAnchor="middle" dy="6">{glyph}</text>
              )}
              <text className={styles.actorLabel} textAnchor="middle" y="26">
                {actor.kind.replace('_', ' ')}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className={styles.caption}>
        <span className={styles.env}>{scenario.scene_env?.replace(/_/g, ' ')}</span>
        <span className={styles.clock}>
          {t.toFixed(1)}s / {duration.toFixed(1)}s
        </span>
      </figcaption>

      <div className={styles.progress}>
        <div className={styles.progressFill} style={{ width: `${(t / duration) * 100}%` }} />
      </div>
    </figure>
  );
}
