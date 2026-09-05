import { useEffect, useRef, useState } from 'react';
import './console.css';

/**
 * The payoff section: what the department would actually be looking at.
 *
 * Every section above this one argues that a service could notice its own
 * failures. This is the screen where the argument turns into a thing somebody
 * uses on a Tuesday morning, which is the only form it can really be judged in.
 * "It would notice" is a claim nobody can argue with; a chart with a number on
 * it is a claim somebody can disagree with.
 *
 * Three decisions worth defending, because each had an obvious wrong alternative.
 *
 * **Two series, one axis.** Failures caught runs to four figures; failures that
 * arrived as a complaint never leave single digits. The reflex is a second
 * y-axis so both curves fill the frame — and a second y-axis is the most
 * misleading thing a chart can do, because it lets the author choose where the
 * lines cross. Both series here count the same thing, a failure, so they share
 * one scale. The flat line along the bottom is not a rendering problem. It is
 * the whole point of the page: almost none of this is ever reported.
 *
 * **Emphasis, not category.** One series in the accent, the other in the
 * de-emphasis grey, rather than two equal hues. The story is "this one went
 * up", and a categorical palette would give the baseline the same visual weight
 * as the finding.
 *
 * **Invented, and labelled as such four times over.** The figures are shaped
 * like a service that has been running a few months. They are not measured, and
 * the page says so in the bar, on this card, under the chart, and at the close.
 */

/** Weeks of history the mock holds. The ranges below are windows onto it. */
const WEEKS = 26;

/**
 * The series, generated once from a closed form.
 *
 * Deterministic on purpose. A dashboard whose numbers change on every render
 * invites the reader to watch for a trend that is not there, and a screenshot
 * taken twice would disagree with itself.
 */
function buildSeries() {
  const caught: number[] = [];
  const complaints: number[] = [];
  for (let i = 0; i < WEEKS; i++) {
    // Slightly faster than linear: the thing gets better at finding failures as
    // more of the journey is instrumented, and that acceleration is what this
    // section is about. The wobble is a fixed hash rather than noise, so it is
    // the same wobble on every load.
    const wobble = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 0.12;
    caught.push(Math.round(12 * (i + 1) ** 1.4 * (1 + wobble)));
    complaints.push(3 + (i % 4) + (i > 18 ? 2 : 0));
  }
  return { caught, complaints };
}

const SERIES = buildSeries();

const RANGES: { key: string; weeks: number }[] = [
  { key: '4W', weeks: 4 },
  { key: '12W', weeks: 12 },
  { key: '26W', weeks: 26 },
];

export function Console() {
  const [range, setRange] = useState('12W');
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [feed, setFeed] = useState(0);
  const plot = useRef<SVGSVGElement>(null);

  const weeks = RANGES.find(r => r.key === range)?.weeks ?? 12;
  const from = WEEKS - weeks;
  const caught = SERIES.caught.slice(from);
  const complaints = SERIES.complaints.slice(from);

  /** Feed rows. Anonymous by construction: a step and a field, never a person. */
  const rows: string[][] = [
    ['stage 4', 'address proof', 'back-pressed', '×3'],
    ['stage 2', 'date of birth', 'changed answer', '×1'],
    ['stage 4', 'address proof', 'abandoned', '×2'],
    ['slot', 'time of day', 'waited 4m', '×1'],
    ['stage 3', 'vehicle class', 'back-pressed', '×1'],
    ['payment', 'bank redirect', 'timed out', '×1'],
  ];

  /**
   * The feed advances on a timer — the one thing on this page that claims to be
   * live. Stopped outright for reduced motion: a list that rewrites itself every
   * two seconds is unreadable to somebody who needs longer than that to read it,
   * and every row is present either way.
   */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tick = setInterval(() => setFeed(n => n + 1), 2400);
    return () => clearInterval(tick);
  }, []);

  // Geometry in viewBox units, so a 2px line stays 2px however wide the card is.
  const W = 720;
  const H = 250;
  const PAD = { l: 48, r: 62, t: 16, b: 28 };
  const top = Math.max(...caught) * 1.14;
  const x = (i: number) => PAD.l + (i / Math.max(1, caught.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);

  const path = (data: number[]) =>
    data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${path(caught)} L${x(caught.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  /** Gridlines at round numbers, not at even fractions of the maximum. */
  const step = 10 ** Math.floor(Math.log10(top)) / 2;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = plot.current;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const local = ((event.clientX - box.left) / box.width) * W;
    const span = (W - PAD.l - PAD.r) / Math.max(1, caught.length - 1);
    const index = Math.round((local - PAD.l) / span);
    setHover(index >= 0 && index < caught.length ? index : null);
  };

  const weekLabel = (i: number) => `week ${from + i + 1}`;
  const last = caught.length - 1;
  const total = SERIES.caught.slice(-12).reduce((a, b) => a + b, 0);

  return (
    <section className="gb-sec gb-console">
      <span className="gb-label">What it would look like</span>
      <div>
        <p className="gb-claim">
          Not a report at the end of a quarter. <em>A screen open on a Tuesday.</em>
        </p>
        <p className="gb-body">
          This is the part that does not exist yet. It is here because "the service
          would notice" is a claim nobody can argue with, and a screen with numbers on
          it is a claim somebody can disagree with. Every figure below is invented.
        </p>

        <div className="gb-card">
        <div className="gb-card-top">
          <b>{'Learner licence · Maharashtra'}</b>
          <span className="gb-live"><i />{'Receiving'}</span>
          <span className="gb-tag-mock">{'Mock data'}</span>
        </div>

        {/* The four tiles below say how much. Not one of them says what anybody
            should do, which is the only thing an early-warning screen is for —
            a number nobody acts on is a report, and the section above has just
            finished promising this is not a report. So the alert goes first and
            the counts support it. The test for this card is whether a reader who
            knows nothing about the build can look at it and say what somebody
            does on Monday morning. */}
        <div className="gb-alert">
          <div className="gb-alert-top">
            <span className="gb-alert-tag">{'Friction alert'}</span>
            <span className="gb-alert-when">{'noticed 38 minutes ago'}</span>
          </div>
          <b className="gb-alert-what">{'Stage 4 — Address proof'}</b>
          <p className="gb-alert-say">
            {'Two in five people who reach this box now leave without finishing it. Last week it was one in ten.'}
          </p>
          <p className="gb-alert-do">
            <span>{'What to do'}</span>
            {'The hint asks for a “recent” utility bill without saying how recent. Most of the uploads being rejected are older than three months — say so in the hint.'}
          </p>
        </div>

        {/* Four numbers. A fifth is always the one that makes somebody stop
            reading the first four. */}
        <div className="gb-kpis">
          <div className="gb-kpi is-hero">
            <span className="gb-kpi-k">{'Failures caught, 12 weeks'}</span>
            <b>{total.toLocaleString('en-IN')}</b>
            <span className="gb-kpi-d is-up">{'+38% on the 12 before'}</span>
          </div>
          <div className="gb-kpi">
            <span className="gb-kpi-k">{'Fixes shipped'}</span>
            <b>14</b>
            <span className="gb-kpi-d">{'nine of them to one field'}</span>
          </div>
          <div className="gb-kpi">
            <span className="gb-kpi-k">{'Median time to notice'}</span>
            <b>38<small>min</small></b>
            <span className="gb-kpi-d">{'was: next quarter'}</span>
          </div>
          <div className="gb-kpi">
            <span className="gb-kpi-k">{'Complaints needed'}</span>
            <b>0</b>
            <span className="gb-kpi-d">{'none of it was reported'}</span>
          </div>
        </div>

        <div className="gb-chart-head">
          <div>
            <b>{'Failures caught, by week'}</b>
            {/* A legend, always: two series must never be told apart by colour
                alone. Both are direct-labelled at their last point as well. */}
            <div className="gb-legend">
              <span><i className="is-caught" />{'Caught by the service'}</span>
              <span><i className="is-said" />{'Arrived as a complaint'}</span>
            </div>
          </div>
          <div className="gb-ranges">
            {RANGES.map(r => (
              <button
                key={r.key}
                className={r.key === range ? 'is-on' : ''}
                onClick={() => { setRange(r.key); setHover(null); }}
              >
                {r.key}
              </button>
            ))}
            <button className={showTable ? 'is-on' : ''} onClick={() => setShowTable(v => !v)}>
              {'Table'}
            </button>
          </div>
        </div>

        {showTable ? (
          <div className="gb-table-wrap">
            <table className="gb-table">
              <caption>{'Failures caught and failures reported, by week. Mock data.'}</caption>
              <thead>
                <tr>
                  <th scope="col">{'Week'}</th>
                  <th scope="col">{'Caught'}</th>
                  <th scope="col">{'Complained'}</th>
                </tr>
              </thead>
              <tbody>
                {caught.map((v, i) => (
                  <tr key={from + i}>
                    <td>{from + i + 1}</td>
                    <td>{v.toLocaleString('en-IN')}</td>
                    <td>{complaints[i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="gb-plot-wrap">
            <svg
              ref={plot}
              className="gb-plot"
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={`Failures caught rose from ${caught[0]} to ${caught[last]} a week across ${weeks} weeks, while failures that arrived as a complaint stayed between ${Math.min(...complaints)} and ${Math.max(...complaints)}.`}
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            >
              {ticks.map(v => (
                <g key={v}>
                  <line className="gb-grid-line" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
                  <text className="gb-axis" x={PAD.l - 10} y={y(v) + 3.5} textAnchor="end">
                    {v.toLocaleString('en-IN')}
                  </text>
                </g>
              ))}

              <path className="gb-area" d={area} />
              <path className="gb-line is-caught" d={path(caught)} />
              <path className="gb-line is-said" d={path(complaints)} />

              {/* Direct labels on the last point only. A number over every mark
                  is noise; these two are where the argument lands. */}
              <circle className="gb-dot is-caught" cx={x(last)} cy={y(caught[last])} r={4} />
              <text className="gb-endlabel is-caught" x={x(last) + 10} y={y(caught[last]) + 4}>
                {caught[last].toLocaleString('en-IN')}
              </text>
              <circle className="gb-dot is-said" cx={x(last)} cy={y(complaints[last])} r={4} />
              <text className="gb-endlabel is-said" x={x(last) + 10} y={y(complaints[last]) + 4}>
                {complaints[last]}
              </text>

              {hover !== null && (
                <g>
                  <line className="gb-cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} />
                  <circle className="gb-dot is-caught" cx={x(hover)} cy={y(caught[hover])} r={5} />
                  <circle className="gb-dot is-said" cx={x(hover)} cy={y(complaints[hover])} r={5} />
                </g>
              )}

              <text className="gb-axis" x={PAD.l} y={H - 8}>{weekLabel(0)}</text>
              <text className="gb-axis" x={W - PAD.r} y={H - 8} textAnchor="end">{weekLabel(last)}</text>
            </svg>

            {/* The tooltip is HTML, not SVG, so it can wrap, use the page's own
                type, and never be clipped by the plot's viewBox. */}
            {hover !== null && (
              <div className="gb-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
                <b>{weekLabel(hover)}</b>
                <span><i className="is-caught" />{caught[hover].toLocaleString('en-IN')} {'caught'}</span>
                <span><i className="is-said" />{complaints[hover]} {'complained'}</span>
              </div>
            )}
          </div>
        )}

        <div className="gb-feed">
          <div className="gb-feed-head">
            <span>{'Signals arriving'}</span>
            <span>{'No names, no numbers, nothing anybody typed'}</span>
          </div>
          <ul>
            {Array.from({ length: 5 }, (_, k) => rows[(feed + k) % rows.length]).map((row, k) => (
              <li key={`${feed}-${k}`} style={{ opacity: 1 - k * 0.17 }}>
                <span className="gb-feed-t">
                  {String(9 + k).padStart(2, '0')}:{String((41 + feed * 7 + k * 13) % 60).padStart(2, '0')}
                </span>
                <span>{row[0]}</span>
                <span>{row[1]}</span>
                <span>{row[2]}</span>
                <span className="gb-feed-n">{row[3]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

        <span className="gb-note">
          Mock data throughout. Nothing in this console was measured.
        </span>
      </div>
    </section>
  );
}
