import { useEffect, useRef } from 'react';
import { COLS, ROWS, SPRITE_COLORS, SPRITES, TILE, TILE_COLORS } from './scenarios';
import type { SpriteArt } from '../types';

function drawTile(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number) {
  ctx.fillStyle = TILE_COLORS[ch] || '#7ba250';
  ctx.fillRect(x, y, TILE, TILE);
  if (ch === '.') {
    // grass — a few fixed darker tufts so it isn't one flat colour
    ctx.fillStyle = '#6f9a45';
    ctx.fillRect(x + TILE * 0.19, y + TILE * 0.31, 2, 2);
    ctx.fillRect(x + TILE * 0.63, y + TILE * 0.63, 2, 2);
    ctx.fillRect(x + TILE * 0.44, y + TILE * 0.13, 2, 2);
  }
  if (ch === '#' || ch === '=' || ch === '-' || ch === 'z') {
    // asphalt — a soft top highlight and bottom shade for a little depth
    ctx.fillStyle = '#7d8189'; ctx.fillRect(x, y, TILE, 2);
    ctx.fillStyle = '#5f636a'; ctx.fillRect(x, y + TILE - 2, TILE, 2);
  }
  // Fixed integer offsets, not TILE-scaled fractions — a marking one pixel off from tile to tile
  // (from rounding) reads as a wobble; every '=' and '-' tile has to land on the exact same pixels.
  if (ch === '=') { ctx.fillStyle = '#e3c74a'; ctx.fillRect(x + 7, y + 3, 2, TILE - 6); }
  if (ch === '-') { ctx.fillStyle = '#e3c74a'; ctx.fillRect(x + 2, y + 7, TILE - 4, 2); }
  if (ch === 'z') { ctx.fillStyle = '#ece9e1'; ctx.fillRect(x, y + 3, TILE, 4); ctx.fillRect(x, y + TILE - 7, TILE, 4); }
  if (ch === 'b') {
    // roadside bus-stop shelter marker
    ctx.fillStyle = '#6f6355'; ctx.fillRect(x, y, TILE, 3);
    ctx.fillStyle = '#c9c07f'; ctx.fillRect(x + 4, y + 6, 3, 5); ctx.fillRect(x + TILE - 7, y + 6, 3, 5);
  }
  if (ch === 'k') {
    // kerb — a two-tone paved strip instead of a flat block
    ctx.fillStyle = '#cdc7b8'; ctx.fillRect(x, y, TILE, TILE * 0.4);
    ctx.fillStyle = '#b4ad9c'; ctx.fillRect(x, y + TILE * 0.4, TILE, 2);
  }
  if (ch === 't') {
    // roadside tree, drawn on top of the grass base already filled above
    ctx.fillStyle = '#5c8a3c';
    ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6f9a45';
    ctx.beginPath(); ctx.arc(x + TILE * 0.4, y + TILE * 0.4, TILE * 0.14, 0, Math.PI * 2); ctx.fill();
  }
}

// The art for these three is drawn nose-up, i.e. built for a vehicle travelling vertically —
// correct as-is on a side-street stem, but wrong on every horizontal road unless rotated.
const VEHICLES = new Set(['car', 'van', 'bike']);

function drawSprite(ctx: CanvasRenderingContext2D, name: string, px: number, py: number, body?: string | null, lamp?: string, facing?: 'h' | 'v') {
  const rows = SPRITES[name];
  if (!rows) return;
  const rotate = VEHICLES.has(name) && facing !== 'v';
  ctx.save();
  if (rotate) {
    // Rotate 90° about the sprite's own centre, then draw in the sprite's local 0..TILE frame —
    // the transform (not the coordinates below) is what actually repositions it.
    ctx.translate(px + TILE / 2, py + TILE / 2);
    ctx.rotate(Math.PI / 2);
    ctx.translate(-TILE / 2, -TILE / 2);
    px = 0; py = 0;
  }
  // Outline pass first: every background cell touching the shape gets a dark edge pixel, so the
  // sprite reads as a silhouette against grass/road instead of blending into a flat colour block.
  ctx.fillStyle = 'rgba(8,10,14,0.62)';
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] !== '.') continue;
      const touchesShape = (rows[r - 1]?.[c] ?? '.') !== '.' || (rows[r + 1]?.[c] ?? '.') !== '.'
        || (rows[r][c - 1] ?? '.') !== '.' || (rows[r][c + 1] ?? '.') !== '.';
      if (touchesShape) ctx.fillRect(px + c, py + r, 1, 1);
    }
  }
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = ch === 'b' || ch === 's' ? body || '#3f7ec9' : ch === 'L' ? lamp || '#c8452f' : SPRITE_COLORS[ch] || '#333';
      ctx.fillRect(px + c, py + r, 1, 1);
    }
  }
  ctx.restore();
}

// Sprites that represent something alive or moving get a small idle bob instead of sitting frozen.
const BOBS = new Set(['ped', 'child', 'bike', 'cow']);

// The colour every scenario uses for "you" — auto-detecting it means individual scenarios don't
// need to separately flag which vehicle is the player's own.
const PLAYER_BODY = '#3f7ec9';

// How far a directed creep is allowed to travel, in tiles, at full progress. Kept comfortably
// smaller than the smallest gap between any two actors across the scenario bank, so nothing ever
// visually reaches — let alone overlaps — anything else, at any point in the countdown.
const CREEP_TILES = 1.4;
const CROSS_TILES = 1.1;

/** Renders a road situation as a top-down pixel-art scene on a canvas, with actors that creep through the scenario as `progress` (0 to 1, matching the decision countdown) advances. Everything — the directed creep and the idle sway/pulse alike — freezes solid the instant `revealed` turns true. */
export function PixelScene({ map, art, shake, progress = 0, revealed = false }: { map: string[]; art: SpriteArt[]; shake?: boolean; progress?: number; revealed?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);
  const revealedRef = useRef(revealed);
  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { revealedRef.current = revealed; }, [revealed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let frame = 0;
    // The instant of the freeze — captured once, on the first frame `revealed` is true, then held.
    let frozenAt: number | null = null;

    const render = (t: number) => {
      if (revealedRef.current) { if (frozenAt === null) frozenAt = t; } else { frozenAt = null; }
      const effectiveT = frozenAt ?? t;
      const eased = 1 - (1 - Math.min(1, Math.max(0, progressRef.current))) ** 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) drawTile(ctx, (map[r] || '')[c] || '.', c * TILE, r * TILE);
      (art || []).forEach(([name, x, y, body, lamp, facing, move]) => {
        const isVehicle = VEHICLES.has(name);
        const isPlayer = isVehicle && body === PLAYER_BODY;
        // The player's own vehicle creeps toward the situation by default — pass `false` explicitly
        // for the few scenarios where you're already stopped rather than approaching.
        const effectiveMove = move !== undefined ? move : (isPlayer ? 'fwd' : false);

        // A little idle sway/rock, phase-shifted per sprite so a scene with several actors doesn't move in lockstep.
        const bob = BOBS.has(name) ? Math.sin(effectiveT / 260 + x * 1.7 + y) * 1.3 : 0;
        const rotated = isVehicle && facing !== 'v';
        const drift = isVehicle ? Math.sin(effectiveT / 520 + x * 1.3 + y * 1.7) * 2.2 : 0;
        // A real traffic signal pulses rather than sitting lit at one flat brightness.
        const effectiveLamp = name === 'signal' && lamp ? (Math.sin(effectiveT / 420) > 0.1 ? lamp : 'rgba(140,116,48,0.4)') : lamp;

        let moveDx = 0, moveDy = 0;
        if (effectiveMove === 'cross') {
          moveDy = eased * TILE * CROSS_TILES;
        } else if (effectiveMove === 'fwd' || effectiveMove === 'back') {
          const sign = effectiveMove === 'back' ? -1 : 1;
          // Horizontal road: forward is rightward. Vertical side-street: forward is toward the
          // main road, i.e. upward — every stem placement in this scenario bank is south of it.
          if (rotated) moveDx = eased * TILE * CREEP_TILES * sign;
          else moveDy = -eased * TILE * CREEP_TILES * sign;
        }

        const px = x * TILE + (rotated ? drift : 0) + moveDx;
        const py = y * TILE + bob + (rotated ? 0 : drift) + moveDy;
        drawSprite(ctx, name, px, py, body, effectiveLamp, facing);
      });
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [map, art]);

  return (
    <div className="pixwrap" data-shake={shake ? '1' : null}>
      <canvas ref={canvasRef} width={COLS * TILE} height={ROWS * TILE} className="pixcanvas" role="img" aria-label="Top-down pixel illustration of the road situation described below" />
    </div>
  );
}
