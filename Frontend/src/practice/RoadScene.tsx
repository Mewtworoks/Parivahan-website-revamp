import { useEffect, useRef } from 'react';
import type { RoadActor, RoadSign, RoadSpec } from '../types';

/**
 * A road situation from a chase camera, behind and above the learner's vehicle.
 *
 * The projection is the pseudo-3D scanline trick arcade racers used before
 * hardware could draw polygons: the road is painted one screen row at a time,
 * each row solving for the distance it represents. The perspective is therefore
 * exact rather than a hand-drawn trapezoid, every marking gets its correct
 * foreshortening for free, and the whole thing stays inside the few-kilobyte,
 * runs-on-a-2015-Android, works-offline budget the practice module is built to.
 *
 * Why this view and not the overhead one it replaces, in two parts:
 *
 * A road sign seen from vertically above is a one-pixel edge. Eleven of the
 * twenty-nine situations ask what a sign or a signal is showing, and the
 * overhead illustration could not contain its own subject — the player read the
 * question and the picture contributed nothing. Face-on, the sign *is* the
 * question.
 *
 * And the camera is behind the car rather than behind the windscreen, which is
 * what lets the hidden-hazard scenarios survive the move. A first-person view
 * cannot host them: draw the two-wheeler in the blind spot and the blind spot is
 * not blind, omit it and there is nothing to learn from. A chase camera is
 * conventionally read as knowing more than the driver does, so the rider sits
 * visibly alongside while the question stays "what do you check before turning".
 */

// Small canvas upscaled with `image-rendering: pixelated`, so this is the same
// pixel art as the rest of the game rather than a smooth 3D panel dropped into
// it. 16:9 at an exact 3x.
const W = 320;
const H = 180;

const HORIZON = Math.round(H * 0.42);
const FOV = 165;
// Eye height above the road: higher than a driver's, because the camera sits
// above and behind the roof. This is what tilts the road open enough to read
// lane position, which several scenarios turn on.
const CAM_H = 2.9;
const ROAD_HALF = 5.2;
const DRAW_Z = 120;

/**
 * The sky, and the colour every distant surface dissolves into.
 *
 * Dust haze rather than the saturated cyan the arcade games use. Two reasons:
 * this build had cobalt deliberately hunted out of it and a bright blue sky put
 * the same hue back as the largest area of colour on the page, and because
 * `haze` mixes everything distant toward this value, one blue constant tinted
 * the entire far half of the scene. Warm and pale also happens to be what the
 * sky over a state highway looks like at the hour anybody sits a test.
 */
const SKY_LOW = '#e2d8c2';
const SKY_TOP = '#a9bfbb';
const NIGHT_LOW = '#2a3340';
const NIGHT_TOP = '#141c28';

/** Blend two `#rrggbb` colours. */
function mix(a: string, b: string, t: number) {
  const k = Math.min(1, Math.max(0, t));
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  const o = pa.map((v, i) => Math.round(v + (pb[i] - v) * k));
  return `rgb(${o[0]},${o[1]},${o[2]})`;
}

/** Stable pseudo-random in 0..1 — for scenery that never boils between frames. */
function noise(i: number) {
  const h = Math.imul(i + 1, 1103515245) ^ 0x9e3779b9;
  return (((h ^ (h >>> 15)) >>> 0) % 1000) / 1000;
}

function project(x: number, z: number) {
  const scale = FOV / Math.max(z, 0.4);
  return { sx: W / 2 + x * scale, sy: HORIZON + CAM_H * scale, scale };
}

/**
 * How far a surface at distance `z` has dissolved into the sky.
 *
 * The single biggest thing separating "a road drawn in perspective" from "a road
 * going somewhere". Without it every colour holds full strength to the horizon
 * and stops dead on one row, and the scene reads as a backdrop with a carpet in
 * front of it.
 */
function haze(z: number) {
  return Math.min(0.82, Math.max(0, (z - 26) / 58));
}

// ---------------------------------------------------------------------------
// Signs. The reason the whole bank is moving to this view, so they are drawn
// properly: real shapes, real border widths, a legible mark inside the face.
// ---------------------------------------------------------------------------

function glyphBendRight(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.strokeStyle = '#1b1d21';
  g.lineWidth = Math.max(1, r * 0.3);
  g.beginPath();
  g.moveTo(cx - r * 0.1, cy + r * 0.62);
  g.lineTo(cx - r * 0.1, cy - r * 0.06);
  g.lineTo(cx + r * 0.58, cy - r * 0.06);
  g.stroke();
}

function glyphNarrows(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.strokeStyle = '#1b1d21';
  g.lineWidth = Math.max(1, r * 0.24);
  g.beginPath();
  g.moveTo(cx - r * 0.55, cy + r * 0.6); g.lineTo(cx - r * 0.16, cy - r * 0.5);
  g.moveTo(cx + r * 0.55, cy + r * 0.6); g.lineTo(cx + r * 0.16, cy - r * 0.5);
  g.stroke();
}

function glyphChildren(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // Two figures, the taller leading the shorter — the standard school-zone mark,
  // reduced to what survives at eight pixels tall.
  g.fillStyle = '#1b1d21';
  g.fillRect(Math.round(cx - r * 0.5), Math.round(cy - r * 0.5), Math.max(1, Math.round(r * 0.26)), Math.round(r * 1.05));
  g.fillRect(Math.round(cx + r * 0.16), Math.round(cy - r * 0.18), Math.max(1, Math.round(r * 0.24)), Math.round(r * 0.72));
  g.beginPath(); g.arc(cx - r * 0.37, cy - r * 0.66, Math.max(1, r * 0.2), 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + r * 0.28, cy - r * 0.34, Math.max(1, r * 0.17), 0, Math.PI * 2); g.fill();
}

/**
 * The St Andrew's cross of an unguarded level crossing. Drawn as the cross alone
 * rather than a train pictograph, because the cross is what is actually bolted
 * to the post at an Indian unmanned crossing and it is what a learner has to
 * recognise from a distance.
 */
function glyphLevelCrossing(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.strokeStyle = '#1b1d21';
  g.lineWidth = Math.max(1, r * 0.26);
  g.beginPath();
  g.moveTo(cx - r * 0.6, cy - r * 0.55); g.lineTo(cx + r * 0.6, cy + r * 0.55);
  g.moveTo(cx + r * 0.6, cy - r * 0.55); g.lineTo(cx - r * 0.6, cy + r * 0.55);
  g.stroke();
}

function glyphArrow(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, dir: 'up' | 'left', color: string) {
  g.fillStyle = color;
  const t = Math.max(1, r * 0.28);
  if (dir === 'up') {
    g.fillRect(Math.round(cx - t / 2), Math.round(cy - r * 0.15), Math.round(t), Math.round(r * 0.85));
    g.beginPath();
    g.moveTo(cx, cy - r * 0.85); g.lineTo(cx + r * 0.5, cy - r * 0.1); g.lineTo(cx - r * 0.5, cy - r * 0.1);
    g.closePath(); g.fill();
  } else {
    g.fillRect(Math.round(cx - r * 0.15), Math.round(cy - t / 2), Math.round(r * 0.85), Math.round(t));
    g.beginPath();
    g.moveTo(cx - r * 0.85, cy); g.lineTo(cx - r * 0.1, cy - r * 0.5); g.lineTo(cx - r * 0.1, cy + r * 0.5);
    g.closePath(); g.fill();
  }
}

function drawSign(ctx: CanvasRenderingContext2D, s: RoadSign, night: boolean) {
  const { sx, sy, scale } = project(s.x, s.z);
  if (scale < 3) return;
  const size = Math.max(7, scale * 0.66);
  const postH = Math.max(9, scale * 1.2);
  const f = haze(s.z) * 0.8;
  const sky = night ? NIGHT_LOW : SKY_LOW;

  ctx.fillStyle = mix('#8a8f96', sky, f);
  ctx.fillRect(Math.round(sx - Math.max(1, size * 0.055)), Math.round(sy - postH), Math.max(1, Math.round(size * 0.11)), Math.round(postH));

  const cx = Math.round(sx);
  const cy = Math.round(sy - postH - size * 0.34);
  const face = mix(night ? '#cfc9b8' : '#f6f3ea', sky, f);
  const red = mix('#c8452f', sky, f);
  const blue = mix('#1f4f86', sky, f);
  const ink = mix('#1b1d21', sky, f * 0.7);

  if (s.shape === 'tri') {
    const r = size * 0.66;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.94, cy + r * 0.74); ctx.lineTo(cx - r * 0.94, cy + r * 0.74);
    ctx.closePath();
    ctx.fillStyle = face; ctx.fill();
    // The border width carries the classification — triangle-with-red-border is
    // cautionary, and that distinction is literally the answer to two of these
    // questions — so it is stroked properly rather than hinted at one pixel.
    ctx.lineWidth = Math.max(1.5, r * 0.26); ctx.strokeStyle = red; ctx.stroke();
    const gc = cy + r * 0.14;
    if (s.glyph === 'bend-right') glyphBendRight(ctx, cx, gc, r * 0.5);
    else if (s.glyph === 'narrows') glyphNarrows(ctx, cx, gc, r * 0.5);
    else if (s.glyph === 'children') glyphChildren(ctx, cx, gc, r * 0.5);
    else if (s.glyph === 'level-crossing') glyphLevelCrossing(ctx, cx, gc, r * 0.55);
  } else if (s.shape === 'circle-red') {
    const r = size * 0.56;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = face; ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.28); ctx.strokeStyle = red; ctx.stroke();
    if (s.glyph === 'no-entry') {
      // The single horizontal bar. This is No Entry, and the question that asks
      // about it offers No Parking and No Overtaking as the wrong answers — so
      // the bar has to be unmistakably one horizontal bar and nothing else.
      ctx.fillStyle = face;
      ctx.fillRect(Math.round(cx - r * 0.62), Math.round(cy - r * 0.17), Math.round(r * 1.24), Math.max(1, Math.round(r * 0.34)));
    }
  } else if (s.shape === 'circle-blue') {
    const r = size * 0.56;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = blue; ctx.fill();
    glyphArrow(ctx, cx, cy, r * 0.62, s.glyph === 'arrow-up' ? 'up' : 'left', face);
  } else {
    // Informatory rectangle. The words are unreadable at this size and drawing
    // them as text would produce grey mush, so they are bars of the right
    // length in the right places — the shape and colour are what the question
    // is about, and a legible fake is worse than an honest silhouette.
    const rw = size * 1.5;
    const rh = size * (s.glyph === 'arrow-up' ? 0.95 : 0.72);
    ctx.fillStyle = blue;
    ctx.fillRect(Math.round(cx - rw / 2), Math.round(cy - rh / 2), Math.round(rw), Math.round(rh));
    ctx.fillStyle = face;
    ctx.strokeStyle = face; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(cx - rw / 2) + 0.5, Math.round(cy - rh / 2) + 0.5, Math.round(rw) - 1, Math.round(rh) - 1);
    if (s.glyph === 'arrow-up') glyphArrow(ctx, cx, cy, rh * 0.42, 'up', face);
    else {
      for (let i = 0; i < 2; i++) {
        const bw = rw * (i === 0 ? 0.5 : 0.32);
        ctx.fillRect(Math.round(cx - rw * 0.34), Math.round(cy - rh * 0.2 + i * rh * 0.34), Math.round(bw), Math.max(1, Math.round(rh * 0.14)));
      }
    }
    void ink;
  }
}

/**
 * A signal head on a post, plus optionally the cross-street's own head and the
 * arrow board that makes a free left legal. Which lamp is lit is the question in
 * eight scenarios, so the lit one glows and the dark two stay genuinely dark
 * rather than dimly coloured — a "dim red" and a "lit red" are the difference
 * between two different answers.
 */
function drawSignal(ctx: CanvasRenderingContext2D, spec: NonNullable<RoadSpec['signal']>, time: number, night: boolean) {
  const { sx, sy, scale } = project(-ROAD_HALF - 1.1, spec.z);
  if (scale < 3) return;
  const f = haze(spec.z) * 0.7;
  const sky = night ? NIGHT_LOW : SKY_LOW;
  const postH = Math.max(14, scale * 2.3);
  const bw = Math.max(4, scale * 0.42);
  const lamp = bw * 0.66;

  ctx.fillStyle = mix('#5d6167', sky, f);
  ctx.fillRect(Math.round(sx - Math.max(1, bw * 0.09)), Math.round(sy - postH), Math.max(1, Math.round(bw * 0.18)), Math.round(postH));

  const bx = Math.round(sx - bw / 2);
  const by = Math.round(sy - postH - lamp * 3.3);
  ctx.fillStyle = mix('#25282d', sky, f * 0.5);
  ctx.fillRect(bx, by, Math.round(bw), Math.round(lamp * 3.3));

  // Flashing amber is a real state with its own answer, so it is animated
  // rather than drawn as a steady amber with a note next to it.
  const flashOn = Math.sin(time * 6.5) > -0.1;
  const on = spec.state === 'flash-amber' ? (flashOn ? 'amber' : null) : spec.state;
  const lamps: [string, string][] = [['red', '#e04a2f'], ['amber', '#f0b429'], ['green', '#35b76a']];
  lamps.forEach(([name, colour], i) => {
    const lit = on === name;
    const cx = Math.round(sx);
    const cy = Math.round(by + lamp * (0.75 + i * 1.15));
    const r = Math.max(1.2, lamp * 0.36);
    if (lit) {
      // A soft halo, so a lit lamp reads as emitting rather than as a coloured
      // dot. Radius kept small; a big glow at night swallows the head.
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3.2);
      glow.addColorStop(0, colour + 'cc');
      glow.addColorStop(1, colour + '00');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, r * 3.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = lit ? colour : mix('#14171b', sky, f * 0.4);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  });

  if (spec.freeLeft) {
    // The board beside the head. Green arrow on a dark plate, to the left of the
    // main lamps where junctions actually mount it.
    const px = Math.round(sx + bw * 0.75);
    const py = Math.round(by + lamp * 2.2);
    const s = Math.max(4, lamp * 1.5);
    ctx.fillStyle = mix('#25282d', sky, f * 0.5);
    ctx.fillRect(px, py, Math.round(s), Math.round(s));
    glyphArrow(ctx, px + s / 2, py + s / 2, s * 0.34, 'left', '#35b76a');
  }

  if (spec.cross) {
    // The cross-street's head, facing across, small and further off. It exists
    // for one question — whether another phase going red is your cue to move —
    // and the answer depends on being able to see that it is not your signal.
    const c = project(ROAD_HALF + 2.2, spec.z + 2.5);
    const ch = Math.max(9, c.scale * 1.7);
    const cbw = Math.max(3, c.scale * 0.3);
    ctx.fillStyle = mix('#5d6167', sky, f);
    ctx.fillRect(Math.round(c.sx), Math.round(c.sy - ch), Math.max(1, Math.round(cbw * 0.2)), Math.round(ch));
    ctx.fillStyle = mix('#25282d', sky, f * 0.5);
    ctx.fillRect(Math.round(c.sx - cbw / 2), Math.round(c.sy - ch - cbw * 2), Math.round(cbw), Math.round(cbw * 2));
    const colour = spec.cross === 'red' ? '#e04a2f' : spec.cross === 'amber' ? '#f0b429' : '#35b76a';
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(Math.round(c.sx), Math.round(c.sy - ch - cbw * (spec.cross === 'green' ? 0.5 : spec.cross === 'amber' ? 1 : 1.5)), Math.max(1, cbw * 0.28), 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

const BODY: Record<string, string> = {
  car: '#d8cf7a', van: '#c9c2ae', bus: '#e0a338', truck: '#8d9aa6', bike: '#3d6f52',
};

/** Nothing is ever allowed nearer than this, so the situation never resolves. */
const MIN_GAP = 5.5;

/**
 * Where an actor is now, given how far the learner has travelled.
 *
 * The rule the first version was missing: anything not moving with the traffic
 * closes at the speed you are doing, because you are the thing that is moving.
 * A cow, a pothole, a parked van, a stopped bus and a sign all approach at the
 * same rate as the trees on the verge — the moment one of them holds its
 * distance while the verge streams past, the scene stops being a road.
 *
 * A vehicle travelling the same way at the same speed is the exception: it
 * genuinely holds its distance, and the road still scrolls beneath both of you.
 * `closes` marks the one scenario where it does not — following too closely on a
 * wet road — and `oncoming` closes at roughly double, which is what a closing
 * speed is.
 */
function actorZ(a: RoadActor, travelled: number) {
  // Stated per actor rather than guessed from its kind, because the same kind
  // goes both ways: the van in one scenario is parked at the kerb and closing on
  // you, and a van under way would hold its distance. Guessing from `kind` got
  // that wrong in the only place it mattered.
  const rate = a.oncoming ? 2 : a.withTraffic ? 0 : 1;
  return Math.max(MIN_GAP, a.z - travelled * rate);
}

/**
 * How far a crossing vehicle has come along the side road.
 *
 * "A car arrives from your right at the same moment" is the question, and the
 * first version drew it parked out on the verge and left it there: nothing in
 * the scene arrived, so the one word the whole priority rule turns on was
 * carried by the text alone. It now closes on the junction and stops at the near
 * edge of your carriageway, which is where a car actually claiming priority
 * would be.
 */
function lateralX(a: RoadActor, travelled: number) {
  if (!a.lateral) return a.x;
  const stopAt = 3.6;
  const room = Math.max(0, Math.abs(a.x) - stopAt);
  return a.x - Math.sign(a.x) * Math.min(room, travelled * 0.44);
}

function drawActor(ctx: CanvasRenderingContext2D, a: RoadActor, travelled: number, night: boolean, time: number) {
  const z = actorZ(a, travelled);
  const { sx, sy, scale } = project(lateralX(a, travelled), z);
  if (scale < 2.2 || z > DRAW_Z) return;
  const f = haze(z);
  const sky = night ? NIGHT_LOW : SKY_LOW;
  const body = mix(a.body || BODY[a.kind] || '#c0c0c0', sky, f);

  const shadow = (w: number) => {
    ctx.fillStyle = `rgba(16,18,14,${0.26 * (1 - f)})`;
    ctx.fillRect(Math.round(sx - w / 2) - 1, Math.round(sy) - 1, Math.round(w) + 2, 2);
  };

  if (a.kind === 'pothole') {
    // Flat on the road, so it is an ellipse in projection rather than a circle.
    const w = Math.max(2, scale * 0.9);
    ctx.fillStyle = mix('#22252a', sky, f * 0.8);
    ctx.beginPath(); ctx.ellipse(sx, sy, w, Math.max(1, w * 0.34), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = mix('#4a4e55', sky, f * 0.8);
    ctx.beginPath(); ctx.ellipse(sx, sy - Math.max(0.5, w * 0.12), w * 0.82, Math.max(1, w * 0.24), 0, 0, Math.PI * 2); ctx.fill();
    return;
  }

  if (a.kind === 'ped') {
    const h = Math.max(4, scale * 1.05);
    const w = Math.max(2, h * 0.34);
    // A slow sway, so a person waiting is alive and a person crossing is walking.
    const sway = Math.sin(time * 2.6 + a.x) * (h * 0.04);
    shadow(w * 1.2);
    ctx.fillStyle = mix('#3a4c7a', sky, f);
    ctx.fillRect(Math.round(sx - w / 2 + sway), Math.round(sy - h * 0.62), Math.round(w), Math.round(h * 0.62));
    ctx.fillStyle = mix('#c8996b', sky, f);
    ctx.beginPath(); ctx.arc(Math.round(sx + sway), Math.round(sy - h * 0.78), Math.max(1, h * 0.17), 0, Math.PI * 2); ctx.fill();
    return;
  }

  if (a.kind === 'cow') {
    const h = Math.max(4, scale * 0.95);
    const w = Math.max(4, h * 1.7);
    shadow(w);
    ctx.fillStyle = mix('#cfc6b4', sky, f);
    ctx.fillRect(Math.round(sx - w / 2), Math.round(sy - h * 0.78), Math.round(w), Math.round(h * 0.56));
    // Head low and to one side, which is how a standing cow reads in silhouette.
    ctx.fillRect(Math.round(sx + w * 0.34), Math.round(sy - h * 0.95), Math.round(w * 0.3), Math.round(h * 0.36));
    ctx.fillStyle = mix('#8b8272', sky, f);
    for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(sx - w * 0.4 + i * w * 0.26), Math.round(sy - h * 0.24), Math.max(1, Math.round(w * 0.09)), Math.round(h * 0.24));
    return;
  }

  if (a.kind === 'queue') {
    // Bumper-to-bumper stationary traffic, two lanes of it, for the lane-
    // splitting question. Drawn as a receding column so the gap between the two
    // lanes — which is the thing the question is about — is visible.
    for (let i = 0; i < 6; i++) {
      const qz = z + i * 4.6;
      for (const lane of [-2.4, 2.4]) {
        drawActor(ctx, { kind: 'car', x: lane, z: qz, body: i % 2 ? '#b9b2a0' : '#9aa6b2' }, 0, night, time);
      }
    }
    return;
  }

  // Vehicles. Boxes with the right proportions, a window, and lamps — at twenty
  // pixels wide that is everything that reads, and anything more is noise.
  const dims: Record<string, [number, number]> = {
    car: [1.7, 1.15], van: [1.9, 1.7], bus: [2.4, 2.5], truck: [2.5, 2.1], bike: [0.7, 1.1],
  };
  const [dw, dh] = dims[a.kind] || [1.7, 1.15];

  if (a.lateral) {
    // Side profile. Everything below this point draws the back of a vehicle —
    // window in the middle, tail lamps at the corners — and that code was
    // skipped entirely for a crossing vehicle, which is why the car from the
    // right came out as a plain beige rectangle. A vehicle seen side-on is a
    // different object: long, low, with wheels under it and a cabin set back.
    const lw = Math.max(6, scale * dw * 2.1);
    const lh = Math.max(3, scale * dh * 0.72);
    const lx = Math.round(sx - lw / 2);
    const ly = Math.round(sy - lh);
    // Facing: something from the right is travelling leftward, so its nose is on
    // the left. The direction it is pointing is the whole of what makes it read
    // as crossing rather than parked.
    const nose = a.x > 0 ? -1 : 1;

    shadow(lw);
    ctx.fillStyle = mix('#1c1c1f', sky, f);
    const wr = Math.max(1, lh * 0.3);
    ctx.fillRect(Math.round(lx + lw * 0.16), Math.round(sy - wr), Math.round(wr * 1.6), Math.round(wr));
    ctx.fillRect(Math.round(lx + lw * 0.68), Math.round(sy - wr), Math.round(wr * 1.6), Math.round(wr));

    ctx.fillStyle = body;
    ctx.fillRect(lx, ly + Math.round(lh * 0.34), Math.round(lw), Math.round(lh * 0.62));
    // Cabin, set back from the nose so the silhouette has a direction.
    const cabX = nose < 0 ? lx + lw * 0.3 : lx + lw * 0.16;
    ctx.fillRect(Math.round(cabX), ly, Math.round(lw * 0.52), Math.round(lh * 0.4));
    ctx.fillStyle = `rgba(255,255,255,${0.16 * (1 - f)})`;
    ctx.fillRect(lx, ly + Math.round(lh * 0.34), Math.round(lw), 1);
    // Glass along the cabin.
    ctx.fillStyle = `rgba(30,40,48,${0.5 * (1 - f)})`;
    ctx.fillRect(Math.round(cabX + lw * 0.05), ly + Math.round(lh * 0.08), Math.round(lw * 0.42), Math.round(lh * 0.24));
    // One lamp at the leading end, so which way it is going is unambiguous.
    ctx.fillStyle = mix('#e8e3cf', sky, f);
    const lampX = nose < 0 ? lx + 1 : lx + lw - Math.max(1, lw * 0.06) - 1;
    ctx.fillRect(Math.round(lampX), ly + Math.round(lh * 0.5), Math.max(1, Math.round(lw * 0.06)), Math.max(1, Math.round(lh * 0.18)));
    return;
  }

  const w = Math.max(3, scale * dw);
  const h = Math.max(3, scale * dh);
  const left = Math.round(sx - w / 2);
  const top = Math.round(sy - h);

  shadow(w);
  ctx.fillStyle = body;
  ctx.fillRect(left, top, Math.round(w), Math.round(h));

  // A lit top row: one line of sky landing on a horizontal surface, which is
  // most of what stops a flat rectangle reading as a sticker.
  ctx.fillStyle = `rgba(255,255,255,${0.16 * (1 - f)})`;
  ctx.fillRect(left, top, Math.round(w), 1);

  {
    ctx.fillStyle = `rgba(30,40,48,${0.55 * (1 - f)})`;
    ctx.fillRect(left + Math.round(w * 0.15), top + Math.round(h * 0.12), Math.round(w * 0.7), Math.round(h * 0.3));
    if (a.oncoming) {
      // Headlights, and at night a glare that actually dazzles — which is the
      // entire content of the full-beam question.
      const hw = Math.max(1, Math.round(w * 0.18));
      ctx.fillStyle = night ? '#fffbe8' : mix('#e8e3cf', sky, f);
      ctx.fillRect(left + Math.round(w * 0.08), top + Math.round(h * 0.55), hw, Math.max(1, Math.round(h * 0.2)));
      ctx.fillRect(left + Math.round(w * 0.74), top + Math.round(h * 0.55), hw, Math.max(1, Math.round(h * 0.2)));
      if (night) {
        const g = ctx.createRadialGradient(sx, sy - h * 0.45, 0, sx, sy - h * 0.45, Math.max(8, w * 2.6));
        g.addColorStop(0, 'rgba(255,250,225,0.55)');
        g.addColorStop(0.5, 'rgba(255,250,225,0.16)');
        g.addColorStop(1, 'rgba(255,250,225,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy - h * 0.45, Math.max(8, w * 2.6), 0, Math.PI * 2); ctx.fill();
      }
    } else {
      const lw = Math.max(1, Math.round(w * 0.15));
      ctx.fillStyle = mix('#d24a32', sky, f);
      ctx.fillRect(left + Math.round(w * 0.07), top + Math.round(h * 0.62), lw, Math.max(1, Math.round(h * 0.18)));
      ctx.fillRect(left + Math.round(w * 0.78), top + Math.round(h * 0.62), lw, Math.max(1, Math.round(h * 0.18)));
    }
  }
}

/**
 * The learner's own vehicle. Not projected — it is what the camera is locked to,
 * so it holds a fixed size while the world moves around it.
 */
function drawPlayer(ctx: CanvasRenderingContext2D, spec: RoadSpec, bob: number) {
  const lane = spec.lane || 0;
  const bike = spec.player === 'bike';
  const cw = bike ? 26 : 56;
  const ch = bike ? 34 : 30;
  const cx = Math.round(W / 2 + lane * 26);
  const top = Math.round(H - ch - 16 + bob);
  const left = Math.round(cx - cw / 2);

  // Contact shadow in rows of falling alpha. A hard-edged shadow is a black
  // stripe painted on the road; one that thins as it spreads reads as contact.
  ctx.fillStyle = 'rgba(14,18,20,0.30)';
  ctx.fillRect(left + 3, top + ch - 2, cw - 6, 3);
  ctx.fillStyle = 'rgba(14,18,20,0.18)';
  ctx.fillRect(left + 1, top + ch + 1, cw - 2, 2);
  ctx.fillStyle = 'rgba(14,18,20,0.09)';
  ctx.fillRect(left - 2, top + ch + 3, cw + 4, 2);

  if (bike) {
    // Rider from behind: wheel, body, shoulders, helmet. Pillions stack above,
    // because three of the questions are about who is on the back and whether
    // their head is covered — so the helmet has to be a visibly separate thing
    // that can be missing.
    ctx.fillStyle = '#1c1c1f';
    ctx.fillRect(cx - 3, top + ch - 12, 6, 12);
    ctx.fillStyle = '#3d6f52';
    ctx.fillRect(left + 6, top + 16, cw - 12, 10);
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(left + 3, top + 10, cw - 6, 8);

    const riders = spec.pillion === 'three' ? 4 : spec.pillion ? 2 : 1;
    for (let i = 0; i < riders; i++) {
      const ry = top + 8 - i * 6;
      const rw = 14 - i;
      ctx.fillStyle = i === 0 ? '#c8382a' : '#5f6b7a';
      ctx.fillRect(Math.round(cx - rw / 2), ry, rw, 9);
      // A helmet on the rider always; on the pillion only when the scenario says
      // so. The bare head is the answer to one question.
      const helmeted = i === 0 || spec.pillion !== 'nohelmet';
      ctx.fillStyle = helmeted ? '#2b2f36' : '#c8996b';
      ctx.beginPath(); ctx.arc(cx, ry - 2, 4.2, 0, Math.PI * 2); ctx.fill();
      if (helmeted) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(cx - 4, ry - 3, 8, 1);
      }
    }
    return;
  }

  const body = '#c8382a';
  ctx.fillStyle = '#1c1c1f';
  ctx.fillRect(left - 2, top + ch - 9, 8, 9);
  ctx.fillRect(left + cw - 6, top + ch - 9, 8, 9);

  // Each block inset a pixel at its top and bottom row — that is how pixel art
  // rounds a corner, so the silhouette stops being a rectangle without a single
  // blurred edge.
  ctx.fillStyle = body;
  ctx.fillRect(left + 2, top + 10, cw - 4, 1);
  ctx.fillRect(left, top + 11, cw, ch - 14);
  ctx.fillRect(left + 2, top + ch - 3, cw - 4, 1);
  ctx.fillStyle = '#dd4c37';
  ctx.fillRect(left + 3, top + 11, cw - 6, 1);
  ctx.fillStyle = '#8f2418';
  ctx.fillRect(left + 1, top + ch - 4, cw - 2, 1);
  ctx.fillStyle = body;
  ctx.fillRect(left + 9, top + 2, cw - 18, 1);
  ctx.fillRect(left + 7, top + 3, cw - 14, 9);

  ctx.fillStyle = '#233038';
  ctx.fillRect(left + 10, top + 4, cw - 20, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(left + 10, top + 4, cw - 20, 2);

  ctx.fillStyle = '#f0533a';
  ctx.fillRect(left + 3, top + 15, 10, 6);
  ctx.fillRect(left + cw - 13, top + 15, 10, 6);
  ctx.fillStyle = '#e9e4d6';
  ctx.fillRect(left + cw / 2 - 8, top + 16, 16, 6);
  ctx.fillStyle = '#2a2a2e';
  ctx.fillRect(left + cw / 2 - 6, top + 18, 12, 2);
}

export function RoadScene({ spec, progress = 0, revealed = false }: { spec: RoadSpec; progress?: number; revealed?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);
  const revealedRef = useRef(revealed);
  const specRef = useRef(spec);
  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { revealedRef.current = revealed; }, [revealed]);
  useEffect(() => { specRef.current = spec; }, [spec]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let frame = 0;
    let frozenAt: number | null = null;

    const render = (t: number) => {
      if (revealedRef.current) { if (frozenAt === null) frozenAt = t; } else { frozenAt = null; }
      const time = (frozenAt ?? t) / 1000;
      const s = specRef.current;
      const night = !!s.night;
      const skyLow = night ? NIGHT_LOW : SKY_LOW;
      const skyTop = night ? NIGHT_TOP : SKY_TOP;
      // Cubic rather than quadratic ease-out. Over a thirty-second window the
      // distances involved are small — a hazard twenty metres off leaves about
      // twelve metres to cover — and spreading twelve metres evenly across half
      // a minute is motion too slow to register as motion. Cubic puts most of it
      // in the opening seconds, where it reads as approach, and lets the last
      // couple of metres take the rest of the window as the car settles to a
      // stop at the decision point.
      const eased = 1 - (1 - Math.min(1, Math.max(0, progressRef.current))) ** 3;

      // How far the learner may travel across the whole decision window.
      //
      // Not a distance picked by hand: it is solved so that the nearest thing
      // closing on the camera arrives at MIN_GAP exactly as the countdown
      // expires. The situation therefore develops across the entire window and
      // comes to rest at the final moment, waiting for the answer — rather than
      // resolving in the first two seconds and leaving a still picture on screen
      // for the remaining twenty-eight, which is what a fixed distance produced
      // once the window went to thirty seconds.
      //
      // Everything ground-fixed is a candidate, not just actors: a junction or a
      // stop line arriving under the car would be as wrong as driving into a cow.
      let reach = Infinity;
      const consider = (z0: number, rate: number) => { if (rate > 0) reach = Math.min(reach, (z0 - MIN_GAP) / rate); };
      (s.actors || []).forEach(a => consider(a.z, a.oncoming ? 2 : a.withTraffic ? 0 : 1));
      (s.signs || []).forEach(g => consider(g.z, 1));
      if (s.signal) consider(s.signal.z, 1);
      [s.junction, s.zebra, s.stopline, s.hump].forEach(z => { if (z !== undefined) consider(z, 1); });
      // An empty stretch of road has nothing to arrive at, so it just moves.
      if (!isFinite(reach)) reach = 30;

      // One clock for the whole scene.
      //
      // The road used to scroll on `time * 26` while actors moved on the
      // countdown, which is two motion systems disagreeing in the same frame:
      // markings streaming past at speed, and the hazard they are streaming
      // toward sitting perfectly still. Everything now derives from a single
      // distance travelled, so if the verge moves the cow moves, and if the
      // scenario says you are stopped at a red light then nothing moves at all.
      //
      // Distance is a function of the countdown, not of the wall clock: the
      // situation advances as the decision window burns down and freezes the
      // moment the answer lands.
      //
      // The easing is doing real work here. `1-(1-p)²` decelerates, so the scene
      // closes quickly at first and slows as it arrives — which on a road reads
      // as braking, and puts the car at a standstill at the same instant the
      // time runs out. `speed: 0` scenarios never move at all: you are already
      // stopped at the light, and the light is the question.
      const speed = s.speed ?? 11;
      const travelled = speed === 0 ? 0 : eased * reach;
      const scroll = travelled;

      // Painted markings and roadside structures are as fixed to the ground as a
      // cow is, so they advance too. Missing this is subtler than the cow and
      // just as wrong: the dashes would stream toward a junction that never
      // arrived, and a stop line would hold station under a car that was
      // supposedly driving at it.
      const adv = (z0: number | undefined) => (z0 === undefined ? undefined : Math.max(MIN_GAP, z0 - travelled));
      const jz = adv(s.junction);
      const zz = adv(s.zebra);
      const sz = adv(s.stopline);
      const hz = adv(s.hump);

      // Two flat sky bands. A 180px canvas upscaled 3x steps a smooth gradient
      // anyway, so it is better to choose where the step falls.
      const seam = Math.round(HORIZON * 0.58);
      ctx.fillStyle = skyTop; ctx.fillRect(0, 0, W, seam);
      ctx.fillStyle = skyLow; ctx.fillRect(0, seam, W, HORIZON - seam);
      // Ordered dither through the seam: two bands meeting on one row is a hard
      // line drawn across the sky, and six rows of checkerboard read as a
      // graduation at this scale without introducing a gradient to band.
      for (let i = 0; i < 6; i++) {
        const y = seam - 3 + i;
        if (y < 0 || y >= HORIZON) continue;
        ctx.fillStyle = skyLow;
        for (let x = i % 2; x < W; x += 2) if (noise(x * 13 + i * 71) < (i + 1) / 7) ctx.fillRect(x, y, 1, 1);
      }

      // Skyline, in two planes of aerial perspective: hills furthest and palest,
      // the tree line nearer and less faded. Drawing both at full strength puts
      // the most distant things in the frame at the saturation of the foreground,
      // and no amount of haze on the road recovers that depth.
      ctx.fillStyle = mix('#5f8f6b', skyLow, night ? 0.72 : 0.6);
      for (let i = 0; i < 26; i++) {
        const n = noise(i * 3);
        ctx.beginPath(); ctx.arc((i / 25) * (W + 40) - 20, HORIZON + 2, 12 + n * 26, Math.PI, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = mix('#3f6b45', skyLow, night ? 0.5 : 0.34);
      for (let i = 0; i < 34; i++) {
        const n = noise(i * 7 + 5);
        const cx = Math.round((i / 33) * (W + 30) - 15 + n * 6);
        const h = 6 + n * 11;
        const w = 4 + n * 5;
        ctx.fillRect(Math.round(cx - w / 2), Math.round(HORIZON - h), Math.round(w), Math.round(h));
        ctx.fillRect(cx - 1, HORIZON - 2, 2, 3);
      }

      const wet = !!s.wet;

      // The road, one screen row at a time. Road features — the junction, the
      // zebra, the stop line — are drawn here rather than as sprites, because
      // they lie flat on the tarmac and this loop is the only place that knows
      // the exact distance of each row.
      for (let y = HORIZON; y < H; y++) {
        const z = (CAM_H * FOV) / Math.max(y - HORIZON, 0.5);
        if (z > DRAW_Z * 3) continue;
        const halfW = (ROAD_HALF * FOV) / z;
        const cx = W / 2;
        const f = haze(z);
        const band = Math.floor((z + scroll) / 7) % 2 === 0;

        const verge = night ? (band ? '#1e3b28' : '#1a3324') : (band ? '#2f9e46' : '#28903d');
        ctx.fillStyle = mix(verge, skyLow, f);
        ctx.fillRect(0, y, W, 1);

        // Wet tarmac is darker and less banded — water fills the texture in,
        // which is exactly why it also stops gripping.
        const dry = band ? '#43474d' : '#3e424a';
        const surf = wet ? (band ? '#2b3138' : '#292f36') : dry;
        ctx.fillStyle = mix(night ? (band ? '#23272e' : '#20242a') : surf, skyLow, f);
        ctx.fillRect(Math.round(cx - halfW), y, Math.round(halfW * 2), 1);

        // A crossing side road: asphalt taken right across the verges for the
        // depth of the junction, which is what makes it a crossroad rather than
        // a gap in the hedge.
        if (jz !== undefined && Math.abs(z - jz) < 3.4) {
          ctx.fillStyle = mix(night ? '#20242a' : dry, skyLow, f);
          ctx.fillRect(0, y, W, 1);
        }

        const edgeInJunction = jz !== undefined && Math.abs(z - jz) < 3.4;
        if (!edgeInJunction) {
          const ew = Math.max(1, (0.28 * FOV) / z);
          ctx.fillStyle = mix('#eceadf', skyLow, f * 0.9);
          ctx.fillRect(Math.round(cx - halfW + ew * 0.4), y, Math.round(ew), 1);
          ctx.fillRect(Math.round(cx + halfW - ew * 1.4), y, Math.round(ew), 1);
        }

        // Centre line. 'solid' is not decoration here — one question is entirely
        // about what a solid single centre line permits, so the two treatments
        // have to be visibly different things.
        const centre = s.centre || 'dash';
        if (centre !== 'none' && !edgeInJunction) {
          const drawIt = centre === 'solid' || (z + scroll) % 8 < 4.2;
          if (drawIt) {
            const mw = Math.max(1, (0.22 * FOV) / z);
            // White when solid, yellow when broken. Not a style choice: the
            // question about this asks what a "solid single white centre line"
            // permits, and answering it over a yellow line would be showing the
            // player a different marking from the one being examined.
            ctx.fillStyle = mix(centre === 'solid' ? '#efece1' : '#f2d64e', skyLow, f * 0.9);
            ctx.fillRect(Math.round(cx - mw / 2), y, Math.round(mw), 1);
          }
        }

        // Zebra: bars across the carriageway, spaced in metres so they
        // foreshorten with everything else.
        if (zz !== undefined && Math.abs(z - zz) < 1.9) {
          const stripe = Math.floor((z * 2.2)) % 2 === 0;
          if (stripe) {
            ctx.fillStyle = mix('#efece1', skyLow, f * 0.85);
            ctx.fillRect(Math.round(cx - halfW), y, Math.round(halfW * 2), 1);
          }
        }

        // An unmarked speed breaker: a shallow rise in the tarmac and nothing
        // else. Lightened on the near face and darkened just past the crown,
        // which is the whole of how a hump reads from a car — and deliberately
        // without a stripe of paint on it, because "no warning and no paint" is
        // the situation being tested.
        if (hz !== undefined && Math.abs(z - hz) < 1.5) {
          const t = (z - hz) / 1.5;
          ctx.fillStyle = mix(t < 0 ? '#6d727a' : '#2f343b', skyLow, f * 0.8);
          ctx.fillRect(Math.round(cx - halfW), y, Math.round(halfW * 2), 1);
        }

        // Stop line: solid, and thicker than a lane marking.
        if (sz !== undefined && Math.abs(z - sz) < 0.55) {
          ctx.fillStyle = mix('#efece1', skyLow, f * 0.85);
          ctx.fillRect(Math.round(cx - halfW), y, Math.round(halfW * 2), 1);
        }
      }

      // Roadside objects streaming past — the strongest speed cue in the scene by
      // a distance. The road surface alone reads as a static gradient; it is the
      // things beside it going by that say the vehicle is moving.
      const SPACING = 11;
      for (let i = 0; i < 14; i++) {
        const z = ((i * SPACING - scroll) % (SPACING * 14) + SPACING * 14) % (SPACING * 14) + 2;
        if (z > DRAW_Z || z < 2.5) continue;
        // Nothing on the verge where the side road crosses it.
        if (jz !== undefined && Math.abs(z - jz) < 5) continue;
        for (const side of [-1, 1]) {
          const { sx, sy, scale } = project(side * (ROAD_HALF + 2.4), z);
          const h = Math.max(3, scale * 2.5);
          const w = Math.max(1, scale * 0.18);
          const f = haze(z);
          if ((i + (side > 0 ? 1 : 0)) % 3 === 0) {
            ctx.fillStyle = mix('#e8e4d8', skyLow, f);
            ctx.fillRect(Math.round(sx - w / 2), Math.round(sy - h * 0.42), Math.max(1, Math.round(w)), Math.round(h * 0.42));
            ctx.fillStyle = mix('#c8452f', skyLow, f);
            ctx.fillRect(Math.round(sx - w / 2), Math.round(sy - h * 0.42), Math.max(1, Math.round(w)), Math.max(1, Math.round(h * 0.1)));
          } else {
            ctx.fillStyle = mix('#6b5540', skyLow, f);
            ctx.fillRect(Math.round(sx - w / 2), Math.round(sy - h * 0.5), Math.max(1, Math.round(w)), Math.round(h * 0.5));
            const cr = Math.max(2, scale * 0.62);
            ctx.fillStyle = mix('#3f7a42', skyLow, f);
            ctx.beginPath(); ctx.arc(Math.round(sx), Math.round(sy - h * 0.55), cr, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = mix('#4e9150', skyLow, f);
            ctx.beginPath(); ctx.arc(Math.round(sx - cr * 0.3), Math.round(sy - h * 0.6), cr * 0.45, 0, Math.PI * 2); ctx.fill();
          }
        }
      }

      // Furthest first, so a nearer actor overlaps a further one.
      const actors = [...(s.actors || [])].sort((a, b) => b.z - a.z);
      actors.forEach(a => drawActor(ctx, a, travelled, night, time));
      (s.signs || []).forEach(sign => drawSign(ctx, { ...sign, z: Math.max(MIN_GAP, sign.z - travelled) }, night));
      if (s.signal) drawSignal(ctx, { ...s.signal, z: Math.max(MIN_GAP, s.signal.z - travelled) }, time, night);

      drawPlayer(ctx, s, Math.sin(time * 2.4) * 0.6);

      // Rear-view mirror. Top centre, small, with a bezel — the only element in
      // the scene that is not part of the world, so it has to look like a piece
      // of the car rather than a floating panel.
      if (s.mirror && s.mirror.length) {
        const mw = 74;
        const mh = 20;
        const mx = Math.round(W / 2 - mw / 2);
        const my = 5;
        ctx.fillStyle = '#1e2126';
        ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
        // The mirror's own view: the road behind, which is the same road going
        // the other way, so it is a strip of tarmac between two verges.
        ctx.fillStyle = night ? '#20242a' : '#43474d';
        ctx.fillRect(mx, my, mw, mh);
        ctx.fillStyle = mix(night ? '#1e3b28' : '#2f9e46', skyLow, 0.2);
        ctx.fillRect(mx, my, 9, mh);
        ctx.fillRect(mx + mw - 9, my, 9, mh);
        s.mirror.forEach((kind, i) => {
          const bw = kind === 'bike' ? 7 : kind === 'truck' ? 22 : kind === 'ambulance' ? 19 : 16;
          const bh = kind === 'bike' ? 11 : kind === 'truck' ? 15 : kind === 'ambulance' ? 14 : 10;
          const bx = Math.round(mx + mw / 2 - bw / 2 + (i - (s.mirror!.length - 1) / 2) * (bw + 6));
          const by = my + mh - bh - 1;
          ctx.fillStyle = kind === 'bike' ? '#3d6f52' : kind === 'ambulance' ? '#eceadf' : '#b9b2a0';
          ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = 'rgba(30,40,48,0.55)';
          ctx.fillRect(bx + 1, by + 1, bw - 2, Math.max(1, Math.round(bh * 0.4)));
          if (kind === 'ambulance') {
            // A red stripe and a beacon that actually flashes. A still ambulance
            // in a mirror is just a white van, and the question is about the one
            // behind you with its siren on.
            ctx.fillStyle = '#c8382a';
            ctx.fillRect(bx, by + Math.round(bh * 0.55), bw, 2);
            ctx.fillStyle = Math.sin(time * 9) > 0 ? '#e8483a' : '#3a5f8a';
            ctx.fillRect(bx + Math.round(bw * 0.3), by - 2, Math.round(bw * 0.4), 2);
          }
          if (kind === 'bike') {
            // A rider's head, so a two-wheeler in the mirror is a person.
            ctx.fillStyle = '#2b2f36';
            ctx.beginPath(); ctx.arc(bx + bw / 2, by - 1, 2.2, 0, Math.PI * 2); ctx.fill();
          }
        });
        // A highlight along the top of the glass.
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(mx, my, mw, 1);
      }

      // Night is a wash rather than a repaint: every colour above already mixes
      // toward the night sky, and this adds the last of the blue-black over the
      // whole frame so the headlights have something to be bright against.
      if (night) {
        ctx.fillStyle = 'rgba(12,18,32,0.34)';
        ctx.fillRect(0, 0, W, H);
      }

      // Vignette last. It settles the eye on the middle of the frame where the
      // situation is, and stops the scene ending on four right-angles of
      // full-strength colour. Weak on purpose: a vignette you can see is a
      // filter, one you cannot is composition.
      const vig = ctx.createRadialGradient(W / 2, H * 0.52, H * 0.34, W / 2, H * 0.52, H * 0.92);
      vig.addColorStop(0, 'rgba(26,22,16,0)');
      vig.addColorStop(0.72, 'rgba(26,22,16,0.05)');
      vig.addColorStop(1, 'rgba(26,22,16,0.20)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="pixwrap">
      <canvas ref={canvasRef} width={W} height={H} className="pixcanvas roadcanvas"
        role="img" aria-label="Chase-camera view of the road situation described below" />
    </div>
  );
}
