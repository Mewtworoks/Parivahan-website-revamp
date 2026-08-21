import type { GameLogEntry, PracticeScenario } from '../types';

// Tile + sprite art authored for this prototype. 8px tiles, 20x13 grid, scaled with nearest-neighbour.
export const TILE = 8;
export const COLS = 20;
export const ROWS = 13;

export const TILE_COLORS: Record<string, string> = { '.': '#7ba250', '#': '#6d7178', '=': '#6d7178', '-': '#6d7178', z: '#6d7178', k: '#b8b1a2', b: '#8c7f6f', d: '#b9945f', w: '#5f86a8' };

/** 8x8 pixel-art sprites, one row of characters per pixel row. */
export const SPRITES: Record<string, string[]> = {
  car: ['..dddd..', '.bbbbbb.', '.bwwwwb.', '.bbbbbb.', '.bbbbbb.', '.bwwwwb.', '.bbbbbb.', '..dddd..'],
  van: ['bbbbbbbb', 'bwwwwwwb', 'bbbbbbbb', 'bbbbbbbb', 'bbbbbbbb', 'bbbbbbbb', 'bwwwwwwb', 'dddddddd'],
  ped: ['...hh...', '..hhhh..', '...ss...', '..ssss..', '.ssssss.', '..s..s..', '..l..l..', '..l..l..'],
  child: ['........', '...hh...', '..ssss..', '.ssssss.', '..s..s..', '..l..l..', '........', '........'],
  signal: ['..dddd..', '.dLLLLd.', '.dLLLLd.', '.dLLLLd.', '..dddd..', '...pp...', '...pp...', '...pp...'],
  cow: ['........', '.wwwwww.', 'wwbbwwww', 'wwwwwwbw', '.wwwwww.', '..w..w..', '..w..w..', '........'],
  sign: ['...L....', '..LLL...', '.LLLLL..', 'LLLLLLL.', '...p....', '...p....', '...p....', '........'],
  signc: ['..LLLL..', '.LwwwwL.', 'LwwwwwwL', 'LwwwwwwL', '.LwwwwL.', '..LLLL..', '...p....', '...p....'],
  bike: ['...dd...', '..dbbd..', '...bb...', '..dbbd..', '...bb...', '..dbbd..', '...dd...', '........'],
};
export const SPRITE_COLORS: Record<string, string> = { d: '#262b31', w: '#cfe4f5', h: '#3a2a1e', l: '#28323d', p: '#4d4f52' };

const T_JUNC = ['......k#=##k........', '......k#=##k........', '......k#=##k........', '......k#=##k........', 'kkkkkkk#=##kkkkkkkkk', '####################', '--------####--------', '####################', '####################', 'kkkkkkk#=##kkkkkkkkk', '......k#=##k........', '......k#=##k........', '......k#=##k........'];
const T_ZEBRA = ['bb..t.....bb...t....', 'bb........bb........', '....................', 'kkkkkkkkkkkkkzzzkkkkk', '#############zzz####', '-------------zzz----', '#############zzz####', '#############zzz####', 'kkkkkkkkkkkkkzzzkkkkk', '....................', '.....t..........t...', '....................', '....................'];
const T_TEE = ['....................', 'kkkkkkkkkkkkkkkkkkkk', '####################', '--------------------', '####################', 'kkkkkkk#=##kkkkkkkkk', '......k#=##k........', '......k#=##k........', '......k#=##k........', '......k#=##k........', '......k#=##k........', '......k#=##k........', '......k#=##k........'];
const T_ROAD = ['....................', '..b...b.....b...b...', 'kkkkkkkkkkkkkkkkkkkk', '####################', '####################', '--------------------', '####################', '####################', 'kkkkkkkkkkkkkkkkkkkk', '..d...........d.....', '....................', '....................', '....................'];

export const AXIS_LABELS: Record<string, string> = { signals: 'Signals & priority', hazards: 'Hazards', signs: 'Signs & documents' };

// 12 scenarios. axes: signal, priority, sign, hazard, consistency
export const SCENARIOS: PracticeScenario[] = [
  { id: 'S1', lvl: 'signals', map: T_JUNC, art: [['signal', 12, 4, null, '#d9a12b'], ['car', 9, 8, '#3f7ec9'], ['ped', 15, 6, '#c8452f']],
    q: 'You are 20 metres from the junction and the signal turns amber. There is a pedestrian already on the far crossing.',
    a: ['Speed up and clear the junction before red', 'Stop before the line', 'Sound the horn and continue'], c: 1, axes: ['signal', 'hazard'],
    ex: 'Amber means stop unless you are so close that stopping is unsafe. At 20 metres you can stop, and a pedestrian is already committed to the crossing.',
    cite: 'MV Act s.119 · road signal compliance' },
  { id: 'S2', lvl: 'signals', map: T_JUNC, art: [['car', 9, 8, '#3f7ec9'], ['car', 13, 6, '#d8d2c4']],
    q: 'Unmarked crossroad, no signal. A car arrives from your right at the same moment.',
    a: ['You have right of way, proceed', 'Give way to the car on your right', 'Whoever indicates first goes'], c: 1, axes: ['priority'],
    ex: 'At an uncontrolled junction, traffic from the right has priority. This single rule causes a large share of junction collisions.',
    cite: 'Rules of the Road Regulations 1989, r.9' },
  { id: 'S3', lvl: 'signals', map: T_JUNC, art: [['signal', 12, 4, null, '#d9a12b'], ['car', 9, 7, '#3f7ec9']],
    q: 'The signal is flashing amber, not steady.',
    a: ['Treat it as a red light and wait', 'Slow down, check the junction, proceed with care', 'Ignore it, the signal is broken'], c: 1, axes: ['signal'],
    ex: 'A flashing amber is a caution signal, not a stop signal. You may proceed once you have checked the junction is clear.',
    cite: 'State RTO question bank · signals, item 14' },
  { id: 'S4', lvl: 'signals', map: T_ZEBRA, art: [['car', 6, 4, '#3f7ec9'], ['ped', 13, 5, '#2f6b4f']],
    q: 'A pedestrian steps onto the zebra crossing ahead of you. The light is green for you.',
    a: ['Green is mine, continue at speed', 'Stop and let the pedestrian cross', 'Swerve into the next lane'], c: 1, axes: ['priority', 'hazard'],
    ex: 'A pedestrian on a zebra crossing has right of way regardless of your signal. Green permits movement, it does not remove the duty of care.',
    cite: 'MV Act s.138 · pedestrian right of way' },
  { id: 'H1', lvl: 'hazards', map: T_ROAD, art: [['van', 7, 3, '#8c8f96'], ['car', 3, 6, '#3f7ec9'], ['child', 8, 5, '#c8452f']],
    q: 'A van is parked on your left. You cannot see the footpath behind it. You are doing 45 km/h.',
    a: ['Maintain speed, you have a clear lane', 'Slow to a walking pace and cover the brake', 'Hold the horn down and pass'], c: 1, axes: ['hazard'],
    ex: 'A stationary vehicle blocking your view of a footpath is the classic hidden hazard. The correct response is speed reduction before you can see the danger, not after.',
    cite: 'Defensive driving · developing hazard, DVSA model' },
  { id: 'H2', lvl: 'hazards', map: T_ROAD, art: [['cow', 11, 4], ['car', 4, 6, '#3f7ec9']],
    q: 'Cattle are standing in your lane on a two-lane road with oncoming traffic.',
    a: ['Overtake using the oncoming lane', 'Stop or crawl until it is safe to pass wide', 'Drive close and use the horn to move them'], c: 1, axes: ['hazard', 'priority'],
    ex: 'Animals move unpredictably and towards noise. Crossing into oncoming traffic to avoid them trades one hazard for a worse one.',
    cite: 'State RTO question bank · hazards, item 31' },
  { id: 'H3', lvl: 'hazards', map: T_ROAD, art: [['van', 13, 3, '#c5b46a'], ['car', 5, 6, '#3f7ec9'], ['ped', 12, 5, '#2f6b4f']],
    q: 'A bus has stopped ahead at a stop. Passengers are getting off on the road side.',
    a: ['Pass on the right without slowing', 'Slow, expect people to step out from in front of the bus', 'Pass on the left, between bus and kerb'], c: 1, axes: ['hazard'],
    ex: 'People crossing in front of a stopped bus cannot see you and you cannot see them. Passing on the left is where they will be walking.',
    cite: 'Defensive driving · obscured pedestrian' },
  { id: 'H4', lvl: 'hazards', map: T_ZEBRA, art: [['car', 4, 4, '#3f7ec9'], ['bike', 11, 6, '#c8452f']],
    q: 'A two-wheeler is riding in your blind spot as you approach a left turn.',
    a: ['Turn, you signalled first', 'Check the mirror and shoulder, let the rider clear, then turn', 'Brake hard so the rider passes'], c: 1, axes: ['hazard', 'consistency'],
    ex: 'Signalling announces intent, it does not create space. A left turn across a two-wheeler in the blind spot is one of the most common urban collisions.',
    cite: 'Rules of the Road Regulations 1989, r.12' },
  { id: 'G1', lvl: 'signs', map: T_TEE, art: [['sign', 5, 7, null, '#c8452f'], ['car', 9, 10, '#3f7ec9']],
    q: 'A triangular sign with a red border showing a bend to the right.',
    a: ['Right hand curve ahead — cautionary', 'Right turn prohibited — mandatory', 'One way to the right — informatory'], c: 0, axes: ['sign'],
    ex: 'Triangular red-bordered signs are cautionary: they warn about the road ahead. Circular signs with a red border are mandatory: they order or prohibit.',
    cite: 'IRC:67 sign classification · cautionary' },
  { id: 'G2', lvl: 'signs', map: T_TEE, art: [['signc', 14, 3, null, '#c8452f'], ['car', 9, 9, '#3f7ec9']],
    q: 'A circular sign, red border, blank white centre with a horizontal red bar.',
    a: ['No parking', 'No entry', 'No overtaking'], c: 1, axes: ['sign'],
    ex: 'A red circle with a single horizontal white bar is No Entry. Entering is a mandatory-sign violation, not a caution ignored.',
    cite: 'IRC:67 · mandatory signs' },
  { id: 'G3', lvl: 'signs', map: T_ROAD, art: [['car', 8, 6, '#3f7ec9']],
    q: "You are riding on a learner's licence. What must be with you?",
    a: ["The learner's licence only", 'The licence, an L plate, and a licensed driver for that class', 'Nothing, the licence is on your phone'], c: 1, axes: ['sign', 'consistency'],
    ex: 'A learner may only ride or drive with an L plate displayed and, for most classes, an instructor or licensed holder of that class beside them.',
    cite: 'CMV Rules 1989, r.3 · learner conditions' },
  { id: 'G4', lvl: 'signs', map: T_ROAD, art: [['car', 6, 6, '#3f7ec9'], ['car', 12, 4, '#d8d2c4']],
    q: 'The road is marked with a solid single white centre line.',
    a: ['Overtake if the road ahead is clear', 'Do not cross or straddle the line', 'Cross only to turn right'], c: 1, axes: ['sign', 'priority'],
    ex: 'A solid centre line must not be crossed. A broken line permits overtaking when clear. Most learners get this the wrong way round.',
    cite: 'IRC:35 road markings' },
];

export const SKILL_AXES: [key: string, label: string][] = [
  ['signal', 'Signal compliance'], ['priority', 'Right of way'], ['sign', 'Sign recognition'], ['hazard', 'Hazard anticipation'], ['consistency', 'Decision consistency'],
];

/** Decision window per question (ms), and the threshold under which an answer counts as "fast". */
export const DECISION_LIMIT_MS = 4000;
export const FAST_ANSWER_MS = 2200;

/** Scores each of the five skill axes from a played round's answer log, 0-1 (or null if the axis wasn't tested). */
export function scoreOf(log: GameLogEntry[]): Record<string, number | null> {
  const valueOf = (entry: GameLogEntry) => (entry.ok ? (entry.fast ? 1 : 0.55) : 0);
  const scores: Record<string, number | null> = {};
  SKILL_AXES.forEach(([axis]) => {
    const relevant = log.filter(e => e.axes.includes(axis));
    scores[axis] = relevant.length ? relevant.reduce((sum, e) => sum + valueOf(e), 0) / relevant.length : null;
  });
  if (log.length > 1) {
    const meanMs = log.reduce((sum, e) => sum + e.ms, 0) / log.length;
    const variance = log.reduce((sum, e) => sum + (e.ms - meanMs) ** 2, 0) / log.length;
    const stdDev = Math.sqrt(variance);
    const penalty = Math.min(0.35, stdDev / 2600);
    scores.consistency = (scores.consistency ?? 0.6) * (1 - penalty);
  }
  return scores;
}
