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
  if (ch === '=') { ctx.fillStyle = '#e3c74a'; ctx.fillRect(x + TILE * 0.44, y + 3, 2, TILE - 6); }
  if (ch === '-') { ctx.fillStyle = '#e3c74a'; ctx.fillRect(x + 2, y + TILE * 0.44, TILE - 4, 2); }
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

function drawSprite(ctx: CanvasRenderingContext2D, name: string, px: number, py: number, body?: string | null, lamp?: string) {
  const rows = SPRITES[name];
  if (!rows) return;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = ch === 'b' || ch === 's' ? body || '#3f7ec9' : ch === 'L' ? lamp || '#c8452f' : SPRITE_COLORS[ch] || '#333';
      ctx.fillRect(px + c, py + r, 1, 1);
    }
  }
}

/** Renders a road situation as a top-down pixel-art scene on a canvas. */
export function PixelScene({ map, art, shake }: { map: string[]; art: SpriteArt[]; shake?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) drawTile(ctx, (map[r] || '')[c] || '.', c * TILE, r * TILE);
    (art || []).forEach(([name, x, y, body, lamp]) => drawSprite(ctx, name, x * TILE, y * TILE, body, lamp));
  }, [map, art]);

  return (
    <div className="pixwrap" data-shake={shake ? '1' : null}>
      <canvas ref={canvasRef} width={COLS * TILE} height={ROWS * TILE} className="pixcanvas" role="img" aria-label="Top-down pixel illustration of the road situation described below" />
    </div>
  );
}
