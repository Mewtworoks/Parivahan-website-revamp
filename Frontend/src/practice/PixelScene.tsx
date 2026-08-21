import { useEffect, useRef } from 'react';
import { COLS, ROWS, SPRITE_COLORS, SPRITES, TILE, TILE_COLORS } from './scenarios';
import type { SpriteArt } from '../types';

function drawTile(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number) {
  ctx.fillStyle = TILE_COLORS[ch] || '#7ba250';
  ctx.fillRect(x, y, TILE, TILE);
  if (ch === '#' || ch === '=' || ch === '-' || ch === 'z') { ctx.fillStyle = '#767a81'; ctx.fillRect(x, y, TILE, 1); }
  if (ch === '=') { ctx.fillStyle = '#e3c74a'; ctx.fillRect(x + 7, y + 1, 1, 4); }
  if (ch === '-') { ctx.fillStyle = '#e3c74a'; ctx.fillRect(x + 1, y + 7, 4, 1); }
  if (ch === 'z') { ctx.fillStyle = '#ece9e1'; ctx.fillRect(x, y + 1, TILE, 3); ctx.fillRect(x, y + 6, TILE, 2); }
  if (ch === 'b') { ctx.fillStyle = '#6f6355'; ctx.fillRect(x, y, TILE, 1); ctx.fillStyle = '#c9c07f'; ctx.fillRect(x + 2, y + 3, 2, 2); ctx.fillRect(x + 5, y + 3, 2, 2); }
  if (ch === 'k') { ctx.fillStyle = '#cdc7b8'; ctx.fillRect(x, y, TILE, 2); }
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

/** Renders a road situation as an 8px top-down pixel-art scene on a canvas. */
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
