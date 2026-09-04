/**
 * The wordmark's icon: a road in perspective, converging to a vanishing point.
 *
 * It replaces a PNG of a scooter. Two reasons, and the second is why it is drawn
 * in code rather than redrawn as an asset.
 *
 * A scooter is the wrong subject. It names one of the two vehicle classes this
 * service issues licences for, so half the applicants are looking at a picture
 * of somebody else's journey — and a vehicle silhouette is the single most
 * common mark in transport, which makes it the least identifying thing available.
 * A road is what every applicant here has in common.
 *
 * And the PNG had the old cobalt baked into its pixels, so when the palette went
 * green the tile underneath it turned and the image did not. That was being held
 * together by `filter: hue-rotate(-78deg)` — a correction that guesses at a hue
 * and breaks the moment the brand colour moves again. Inline SVG reads the
 * tokens directly, is sharp at any size, and costs no request.
 *
 * The geometry is the same perspective the practice module renders: two edges
 * rising toward a horizon with the centre line dashing between them. Drawn as
 * strokes rather than a filled carriageway because at the 30px this sits at in
 * the top bar, a filled trapezoid reads as a solid wedge and the dashes inside
 * it disappear.
 */
export function Mark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-hidden="true"
      style={{ flex: 'none', display: 'block' }}
    >
      <rect width="32" height="32" rx="7" fill="var(--brand)" />
      {/* The two carriageway edges. They stop short of the top so the mark has a
          horizon rather than running off the tile — the gap is what makes it
          read as distance instead of as a triangle. */}
      <g stroke="#fff" strokeWidth="2.4" strokeLinecap="square" fill="none">
        <path d="M5 27 L12.4 9" />
        <path d="M27 27 L19.6 9" />
      </g>
      {/* Centre line, dashing away. Each dash is shorter and narrower than the
          one before it, which is the whole of the perspective in three marks. */}
      <g fill="#fff">
        <rect x="14.7" y="21.5" width="2.6" height="5" rx="0.6" />
        <rect x="15.1" y="15.5" width="1.8" height="3.4" rx="0.5" />
        <rect x="15.4" y="11.4" width="1.2" height="2.1" rx="0.4" />
      </g>
    </svg>
  );
}
