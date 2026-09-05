/**
 * The hero's right-hand illustration: a small animated road scene — skyline,
 * hills, a driving lane with three vehicles on loop, a pulsing signal — with a
 * floating, gently tilting licence-card mockup at its centre.
 *
 * Every fill here is a theme token rather than a literal colour, so the scene
 * repaints itself for dark mode the way the rest of the site does; only the
 * handful of true one-off accents (headlight glow, tail-light red) stay as
 * fixed colours, the same way the practice game's road art does.
 *
 * All motion is wrapped in `.hero-scene`, which `prefers-reduced-motion:
 * reduce` freezes in one rule in parivahan_extracted.css rather than each
 * animation needing its own reduced-motion override.
 */
export function HeroScene() {
  return (
    <div className="hero-scene">
      <svg className="hero-scene-bg" viewBox="0 0 520 420" preserveAspectRatio="none" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="hsSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--surface)" />
            <stop offset="1" stopColor="var(--bg)" />
          </linearGradient>
        </defs>
        <rect width="520" height="420" fill="url(#hsSky)" />
        {/* Distant skyline */}
        <g fill="var(--brand)" opacity=".1">
          <rect x="26" y="170" width="20" height="90" />
          <polygon points="36,155 26,170 46,170" />
          <rect x="52" y="196" width="16" height="64" />
          <rect x="76" y="212" width="24" height="48" />
          <rect x="270" y="182" width="18" height="78" />
          <rect x="294" y="204" width="26" height="56" />
          <rect x="326" y="164" width="22" height="96" />
          <rect x="404" y="188" width="24" height="72" />
          <rect x="432" y="168" width="20" height="92" />
          <polygon points="442,152 432,168 452,168" />
        </g>
        {/* Rolling hills */}
        <path d="M-10 250 Q 120 210 260 235 T 530 220 L530 420 L-10 420 Z" fill="var(--brand)" opacity=".05" />
        <path d="M-10 275 Q 150 235 330 260 T 530 250 L530 420 L-10 420 Z" fill="var(--brand)" opacity=".07" />
        <path d="M-10 305 Q 130 275 300 295 T 530 280 L530 420 L-10 420 Z" fill="var(--brand)" opacity=".09" />
        {/* Road bed */}
        <path d="M-10 340 C 140 322 300 340 530 326 L530 420 L-10 420 Z" fill="var(--surface2)" />
        <path d="M-10 356 C 150 340 290 358 530 344" stroke="var(--ink)" strokeOpacity=".08" strokeWidth="30" fill="none" />
        <path d="M-10 396 C 150 384 300 402 530 386" stroke="var(--ink)" strokeOpacity=".1" strokeWidth="44" fill="none" />
        <path className="hero-scene-dash hero-scene-dash-a" d="M-10 356 C 150 340 290 358 530 344" stroke="var(--brand)" strokeOpacity=".7" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path className="hero-scene-dash hero-scene-dash-b" d="M-10 396 C 150 384 300 402 530 386" stroke="var(--brand)" strokeOpacity=".8" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* Milestone marker */}
        <g transform="translate(452,306)">
          <rect width="16" height="24" rx="3" fill="var(--surface)" stroke="var(--brand)" strokeWidth="1.4" />
          <rect width="16" height="9" rx="2" fill="var(--brand)" />
          <text x="8" y="7.5" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="var(--surface)" fontFamily="var(--mono)">NH4</text>
          <text x="8" y="20" textAnchor="middle" fontSize="7" fontWeight="700" fill="var(--ink)" fontFamily="var(--mono)">0</text>
        </g>
        {/* Trees */}
        <g className="hero-scene-tree" style={{ transformOrigin: '58px 320px' }}>
          <rect x="55" y="300" width="4" height="20" rx="1.5" fill="var(--muted)" />
          <circle cx="57" cy="288" r="16" fill="var(--brand)" opacity=".18" />
          <circle cx="57" cy="284" r="11" fill="var(--brand)" opacity=".38" />
        </g>
        <g className="hero-scene-tree" style={{ transformOrigin: '480px 312px', animationDelay: '-2s' }}>
          <rect x="478" y="296" width="3.5" height="17" rx="1.5" fill="var(--muted)" />
          <circle cx="480" cy="286" r="13" fill="var(--brand)" opacity=".2" />
          <circle cx="480" cy="282" r="9" fill="var(--brand)" opacity=".4" />
        </g>
        {/* Traffic signal — the scene's clock. Every vehicle's drive loop is
            timed off the same 9s cycle as these three lights, so "stopped at
            the light" and "the light is red" are the same instant rather
            than two animations that happen to look aligned. */}
        <g transform="translate(30,268)">
          <rect x="13" y="24" width="3" height="46" fill="var(--muted)" />
          <rect width="16" height="30" rx="4" x="6" fill="var(--ink)" />
          <circle className="hero-scene-light hero-scene-light-red" cx="14" cy="7" r="2.8" fill="#c24b42" />
          <circle className="hero-scene-light hero-scene-light-yellow" cx="14" cy="15" r="2.8" fill="#d99a2b" />
          <circle className="hero-scene-light hero-scene-light-green" cx="14" cy="23" r="3.1" fill="#37b673" />
        </g>
      </svg>

      <div className="hero-scene-lane hero-scene-lane-van">
        <div className="hero-scene-veh hero-scene-veh-bounce">
          <svg viewBox="0 0 100 42" className="hero-scene-van">
            <ellipse cx="50" cy="37" rx="40" ry="3" fill="var(--ink)" opacity=".16" />
            <path d="M10 13 C10 9 14 7 20 7 L64 7 C70 7 75 9 80 14 L88 21 C91 23 92 26 92 29 L92 32 C92 34 90 35 88 35 L12 35 C10 35 10 33 10 31 Z" fill="var(--brand-hi)" />
            <path d="M10 22 L86 22 L89 25 L10 25 Z" fill="var(--brand)" opacity=".85" />
            <rect x="46" y="11" width="16" height="9" rx="1.5" fill="var(--surface)" opacity=".9" />
            <path d="M66 11 L78 16 C80 17 82 19 83 22 L66 22 Z" fill="var(--surface)" opacity=".9" />
            <rect x="9" y="24" width="2.4" height="6" fill="#c0463f" />
            <g transform="translate(75,34)">
              <circle r="6.4" fill="var(--ink)" /><circle r="4" fill="var(--surface)" />
              <g className="hero-scene-wheel"><line x1="-3" x2="3" strokeWidth="1.1" stroke="var(--brand)" /><line y1="-3" y2="3" strokeWidth="1.1" stroke="var(--brand)" /></g>
            </g>
            <g transform="translate(25,34)">
              <circle r="6.4" fill="var(--ink)" /><circle r="4" fill="var(--surface)" />
              <g className="hero-scene-wheel"><line x1="-3" x2="3" strokeWidth="1.1" stroke="var(--brand)" /><line y1="-3" y2="3" strokeWidth="1.1" stroke="var(--brand)" /></g>
            </g>
          </svg>
        </div>
      </div>

      <div className="hero-scene-lane hero-scene-lane-bike">
        <div className="hero-scene-veh hero-scene-veh-bounce-fast">
          <svg viewBox="0 0 66 40" className="hero-scene-bike">
            <ellipse cx="33" cy="36" rx="24" ry="2.4" fill="var(--ink)" opacity=".18" />
            <g fill="var(--ink)">
              <circle cx="34" cy="10" r="4.6" />
              <path d="M30 15 C30 14 35 14 38 16 L40 24 L29 24 Z" />
            </g>
            <path d="M20 31 L29 23 L42 23 L48 27 L41 32 Z" fill="var(--brand)" />
            <line x1="42" y1="21" x2="45" y2="17" stroke="var(--muted)" strokeWidth="1.6" strokeLinecap="round" />
            <polygon points="48,25 51,26 50,29 47,28" fill="#e0c069" />
            <g transform="translate(50,32)">
              <circle r="5.6" fill="var(--ink)" /><circle r="3.4" fill="var(--surface)" />
              <g className="hero-scene-wheel-fast"><line x1="-2.6" x2="2.6" strokeWidth="1" stroke="var(--brand)" /><line y1="-2.6" y2="2.6" strokeWidth="1" stroke="var(--brand)" /></g>
            </g>
            <g transform="translate(17,32)">
              <circle r="5.6" fill="var(--ink)" /><circle r="3.4" fill="var(--surface)" />
              <g className="hero-scene-wheel-fast"><line x1="-2.6" x2="2.6" strokeWidth="1" stroke="var(--brand)" /><line y1="-2.6" y2="2.6" strokeWidth="1" stroke="var(--brand)" /></g>
            </g>
          </svg>
        </div>
      </div>

      <div className="hero-scene-lane hero-scene-lane-car">
        <div className="hero-scene-veh hero-scene-veh-bounce">
          <svg viewBox="0 0 112 48" className="hero-scene-car" style={{ transform: 'scaleX(-1)' }}>
            <ellipse cx="54" cy="42" rx="44" ry="3.6" fill="var(--ink)" opacity=".18" />
            <path d="M12 33 C12 29 16 27 24 27 L33 27 C39 20 50 15 68 15 L82 15 C90 15 97 20 101 27 L104 28 C108 30 110 33 109 36 C108 39 104 39 99 39 L15 39 C12 39 12 36 12 33 Z" fill="var(--brand)" />
            <path d="M37 26 L43 19 C47 17 54 17 65 17 L79 17 C85 17 91 21 93 26 Z" fill="var(--surface)" opacity=".92" />
            <line x1="65" y1="17" x2="65" y2="26" stroke="var(--brand-hi)" strokeWidth="1" />
            <polygon points="103,29 108,31 105,34 101,32" fill="#e0c069" />
            <rect x="12" y="30" width="3" height="4" rx="1" fill="#c0463f" />
            <g transform="translate(85,38)">
              <circle r="7.4" fill="var(--ink)" /><circle r="4.8" fill="var(--surface)" />
              <g className="hero-scene-wheel"><line x1="-3.8" x2="3.8" strokeWidth="1.2" stroke="var(--brand)" /><line y1="-3.8" y2="3.8" strokeWidth="1.2" stroke="var(--brand)" /></g>
            </g>
            <g transform="translate(28,38)">
              <circle r="7.4" fill="var(--ink)" /><circle r="4.8" fill="var(--surface)" />
              <g className="hero-scene-wheel"><line x1="-3.8" x2="3.8" strokeWidth="1.2" stroke="var(--brand)" /><line y1="-3.8" y2="3.8" strokeWidth="1.2" stroke="var(--brand)" /></g>
            </g>
          </svg>
        </div>
      </div>

      <div className="hero-scene-top">
        <span className="hero-scene-pill"><i className="hero-scene-dot" />Documents auto-verified</span>
        <span className="hero-scene-pill hero-scene-pill-brand">Form validated</span>
      </div>

      <div className="hero-scene-cardwrap">
        <div className="hero-scene-card">
          <div className="hero-scene-shimmer" />
          <div className="hero-scene-ribbon">
            <span>DIGITAL ID</span>
            <b>MOTOR DRIVING LICENCE</b>
            <i className="hero-scene-ribbon-dot" />
          </div>
          <div className="hero-scene-body">
            <div className="hero-scene-body-left">
              <div className="hero-scene-chip-row">
                <span className="hero-scene-chip" />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round"><path d="M8.5 16.5a5 5 0 010-9M12 19a8.5 8.5 0 000-14M15.5 21.5a12 12 0 000-19" /></svg>
              </div>
              <span className="hero-scene-bar" style={{ width: '78%' }} />
              <span className="hero-scene-bar" style={{ width: '92%' }} />
              <span className="hero-scene-bar" style={{ width: '58%' }} />
              <span className="hero-scene-bar hero-scene-bar-brand" style={{ width: '66%' }} />
            </div>
            <div className="hero-scene-photo">
              <span className="hero-scene-photo-head" />
              <span className="hero-scene-photo-body" />
            </div>
          </div>
          <div className="hero-scene-foot">
            <span className="hero-scene-bar" style={{ width: '52%' }} />
            <span className="hero-scene-verified">Verified</span>
          </div>
        </div>
      </div>

      <div className="hero-scene-bottom">
        <div className="hero-scene-stamp">
          <span className="hero-scene-stamp-check">✓</span>
          <span className="col">
            <b>Valid across India</b>
            <small>Instant QR pass</small>
          </span>
        </div>
        <span className="hero-scene-pill hero-scene-pill-stat">
          <i className="hero-scene-dot" />Pass rate <b>92.4%</b>
        </span>
      </div>
    </div>
  );
}
