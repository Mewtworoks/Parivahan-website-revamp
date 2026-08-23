import type { AppState, GameLogEntry, PracticeScenario } from '../types';

const CAR_CLASS_IDS = new Set(['LMV-NT', 'LMV-TR', 'E-RICK']);
const BIKE_CLASS_IDS = new Set(['MCWG', 'MCWOG']);

// Tile + sprite art authored for this prototype. 16px tiles, 20x13 grid, scaled with nearest-neighbour.
export const TILE = 16;
export const COLS = 20;
export const ROWS = 13;

export const TILE_COLORS: Record<string, string> = { '.': '#7ba250', '#': '#6d7178', '=': '#6d7178', '-': '#6d7178', z: '#6d7178', k: '#b8b1a2', b: '#8c7f6f', d: '#b9945f', w: '#5f86a8' };

/**
 * 16x16 pixel-art sprites, one row of characters per pixel row.
 * Shared letters: b/s = the dynamic "body" colour passed by the scenario, L = the dynamic "lamp"
 * colour, everything else is a fixed SPRITE_COLORS palette entry (d/w/h/l/p/e).
 */
export const SPRITES: Record<string, string[]> = {
  car: [
    '......dddd......', '.....bbbbbb.....', '....bbbbbbbb....', '...bbbbbbbbbb...',
    '..eebbbbbbbbee..', '..eebbwwwwbbee..', '..eebbwwwwbbee..', '..bbbbbbbbbbbb..',
    '..bbbbbbbbbbbb..', '..eebbwwwwbbee..', '..eebbwwwwbbee..', '..eebbbbbbbbee..',
    '...bbbbbbbbbb...', '....bbbbbbbb....', '.....dddddd.....', '................',
  ],
  van: [
    '.bbbbbbbbbbbbbb.', 'bbbbbbbbbbbbbbbb', 'bbwwwwwwwwwwwwbb', 'bbwwwwwwwwwwwwbb',
    'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'eebbbbbbbbbbbbee', 'eebbbbbbbbbbbbee',
    'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbwwwwwwwwwwwwbb', 'eebbbbbbbbbbbbee',
    'eebbbbbbbbbbbbee', 'bbbbbbbbbbbbbbbb', 'dddddddddddddddd', '................',
  ],
  ped: [
    '......hhhh......', '.....hhhhhh.....', '.....hhhhhh.....', '......hh........',
    '....ssssssss....', '...ssssssssss...', '...ssssssssss...', '...ssssssssss...',
    '...ssssssssss...', '....ssssssss....', '....ss....ss....', '....ll....ll....',
    '....ll....ll....', '....ll....ll....', '....ll....ll....', '................',
  ],
  child: [
    '................', '................', '......hhhh......', '......hhhh......',
    '....ssssssss....', '....ssssssss....', '....ssssssss....', '....ss....ss....',
    '....ll....ll....', '....ll....ll....', '................', '................',
    '................', '................', '................', '................',
  ],
  signal: [
    '.....dddddd.....', '....dLLLLLLd....', '....dLLLLLLd....', '....dLLLLLLd....',
    '....dLLLLLLd....', '....dLLLLLLd....', '....dLLLLLLd....', '.....dddddd.....',
    '......pppp......', '......pppp......', '......pppp......', '......pppp......',
    '......pppp......', '......pppp......', '......pppp......', '................',
  ],
  cow: [
    '................', '....wwwwwwww....', '...wwwwwwwwww...', '..wwwwhhwwwwww..',
    '..wwwwwwwwwwww..', '..wwhhwwwwhhww..', '..wwwwwwwwwwww..', '...wwwwwwwwww...',
    '....wwwwwwww....', '....hh....hh....', '....ll....ll....', '....ll....ll....',
    '....ll....ll....', '....ll....ll....', '................', '................',
  ],
  sign: [
    '.......LL.......', '......LLLL......', '.....LLLLLL.....', '....LLLLLLLL....',
    '...LLLLLLLLLL...', '..LLLLLLLLLLLL..', '.LLLLLLLLLLLLLL.', 'LLLLLLLLLLLLLLLL',
    '......pppp......', '......pppp......', '......pppp......', '......pppp......',
    '......pppp......', '......pppp......', '......pppp......', '................',
  ],
  signc: [
    '......LLLL......', '....LwwwwwwL....', '.LLwwwwwwwwwwLL.', 'LLLLLLLLLLLLLLLL',
    'LLwwwwwwwwwwwwLL', '.LLwwwwwwwwwwLL.', '....LwwwwwwL....', '......LLLL......',
    '......pppp......', '......pppp......', '......pppp......', '......pppp......',
    '......pppp......', '......pppp......', '......pppp......', '................',
  ],
  rect: [
    '..LLLLLLLLLLLL..', '..LLLLLLLLLLLL..', '..LLLLLLLLLLLL..', '..LLLLLLLLLLLL..',
    '..LLLLLLLLLLLL..', '..LLLLLLLLLLLL..', '..LLLLLLLLLLLL..', '..LLLLLLLLLLLL..',
    '..LLLLLLLLLLLL..', '..LLLLLLLLLLLL..', '......pppp......', '......pppp......',
    '......pppp......', '......pppp......', '................', '................',
  ],
  bike: [
    '.......ww.......', '......pppp......', '......pppp......', '.......bb.......',
    '......bbbb......', '.....bbbbbb.....', '.....bbbbbb.....', '......bbbb......',
    '......bbbb......', '......bbbb......', '.......bb.......', '......pppp......',
    '......pppp......', '................', '................', '................',
  ],
};
export const SPRITE_COLORS: Record<string, string> = { d: '#262b31', w: '#cfe4f5', h: '#3a2a1e', l: '#28323d', p: '#4d4f52', e: '#171b1f' };

const T_JUNC = ['......k#=##k........', '......k#=##k........', '......k#=##k........', '......k#=##k........', 'kkkkkkk#=##kkkkkkkkk', '####################', '--------####--------', '####################', '####################', 'kkkkkkk#=##kkkkkkkkk', '......k#=##k........', '......k#=##k........', '......k#=##k........'];
const T_ZEBRA = ['bb..t.....bb...t....', 'bb........bb........', '....................', 'kkkkkkkkkkkkkzzzkkkkk', '#############zzz####', '-------------zzz----', '#############zzz####', '#############zzz####', 'kkkkkkkkkkkkkzzzkkkkk', '....................', '.....t..........t...', '....................', '....................'];
const T_TEE = ['....................', 'kkkkkkkkkkkkkkkkkkkk', '####################', '--------------------', '####################', 'kkkkkkk#=##kkkkkkkkk', '......k#=##k........', '......k#=##k........', '......k#=##k........', '......k#=##k........', '......k#=##k........', '......k#=##k........', '......k#=##k........'];
const T_ROAD = ['....................', '..b...b.....b...b...', 'kkkkkkkkkkkkkkkkkkkk', '####################', '####################', '--------------------', '####################', '####################', 'kkkkkkkkkkkkkkkkkkkk', '..d...........d.....', '....................', '....................', '....................'];

export const AXIS_LABELS: Record<string, string> = { signals: 'Signals & priority', hazards: 'Hazards', signs: 'Signs & documents' };

const SMALL_NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const TENS_WORDS: Record<number, string> = { 20: 'twenty', 30: 'thirty', 40: 'forty' };
/** Spells out a small count for copy like "Twenty-four real road situations", instead of hardcoding a number that goes stale whenever the scenario bank changes size. */
export function spelledOut(n: number): string {
  if (n < SMALL_NUMBER_WORDS.length) return SMALL_NUMBER_WORDS[n];
  const tens = Math.floor(n / 10) * 10;
  const ones = n % 10;
  if (TENS_WORDS[tens]) return ones ? `${TENS_WORDS[tens]}-${SMALL_NUMBER_WORDS[ones]}` : TENS_WORDS[tens];
  return String(n);
}

// axes: signal, priority, sign, hazard, consistency
export const SCENARIOS: PracticeScenario[] = [
  { id: 'S1', lvl: 'signals', vehicle: 'any', map: T_JUNC, art: [['signal', 12, 4, null, '#d9a12b'], ['car', 9, 7.5, '#3f7ec9'], ['ped', 15, 6, '#c8452f', undefined, undefined, 'cross']],
    q: 'You are 20 metres from the junction and the signal turns amber. There is a pedestrian already on the far crossing.',
    a: ['Speed up and clear the junction before red', 'Stop before the line', 'Sound the horn and continue'], c: 1, axes: ['signal', 'hazard'],
    ex: 'Amber means stop unless you are so close that stopping is unsafe. At 20 metres you can stop, and a pedestrian is already committed to the crossing.',
    cite: 'MV Act s.119 · road signal compliance' },
  { id: 'S2', lvl: 'signals', vehicle: 'any', map: T_JUNC, art: [['car', 9, 7.5, '#3f7ec9'], ['car', 13, 5, '#d8d2c4', undefined, 'h', 'fwd']],
    q: 'Unmarked crossroad, no signal. A car arrives from your right at the same moment.',
    a: ['You have right of way, proceed', 'Give way to the car on your right', 'Whoever indicates first goes'], c: 1, axes: ['priority'],
    ex: 'At an uncontrolled junction, traffic from the right has priority. This single rule causes a large share of junction collisions.',
    cite: 'Rules of the Road Regulations 1989, r.9' },
  { id: 'S3', lvl: 'signals', vehicle: 'any', map: T_JUNC, art: [['signal', 12, 4, null, '#d9a12b'], ['car', 9, 7.5, '#3f7ec9']],
    q: 'The signal is flashing amber, not steady.',
    a: ['Treat it as a red light and wait', 'Slow down, check the junction, proceed with care', 'Ignore it, the signal is broken'], c: 1, axes: ['signal'],
    ex: 'A flashing amber is a caution signal, not a stop signal. You may proceed once you have checked the junction is clear.',
    cite: 'State RTO question bank · signals, item 14' },
  { id: 'S4', lvl: 'signals', vehicle: 'any', map: T_ZEBRA, art: [['car', 6, 4, '#3f7ec9'], ['ped', 13, 5, '#2f6b4f', undefined, undefined, 'cross']],
    q: 'A pedestrian steps onto the zebra crossing ahead of you. The light is green for you.',
    a: ['Green is mine, continue at speed', 'Stop and let the pedestrian cross', 'Swerve into the next lane'], c: 1, axes: ['priority', 'hazard'],
    ex: 'A pedestrian on a zebra crossing has right of way regardless of your signal. Green permits movement, it does not remove the duty of care.',
    cite: 'MV Act s.138 · pedestrian right of way' },
  { id: 'H1', lvl: 'hazards', vehicle: 'car', map: T_ROAD, art: [['van', 7, 2.6, '#c9cdd3'], ['car', 3, 6.5, '#3f7ec9'], ['child', 8, 5, '#c8452f', undefined, undefined, 'cross']],
    q: 'A van is parked on your left. You cannot see the footpath behind it. You are doing 45 km/h.',
    a: ['Maintain speed, you have a clear lane', 'Slow to a walking pace and cover the brake', 'Hold the horn down and pass'], c: 1, axes: ['hazard'],
    ex: 'A stationary vehicle blocking your view of a footpath is the classic hidden hazard. The correct response is speed reduction before you can see the danger, not after.',
    cite: 'Defensive driving · developing hazard, DVSA model' },
  { id: 'H2', lvl: 'hazards', vehicle: 'car', map: T_ROAD, art: [['cow', 11, 3.5], ['car', 4, 6.5, '#3f7ec9']],
    q: 'Cattle are standing in your lane on a two-lane road with oncoming traffic.',
    a: ['Overtake using the oncoming lane', 'Stop or crawl until it is safe to pass wide', 'Drive close and use the horn to move them'], c: 1, axes: ['hazard', 'priority'],
    ex: 'Animals move unpredictably and towards noise. Crossing into oncoming traffic to avoid them trades one hazard for a worse one.',
    cite: 'State RTO question bank · hazards, item 31' },
  { id: 'H3', lvl: 'hazards', vehicle: 'car', map: T_ROAD, art: [['van', 13, 2.6, '#c5b46a'], ['car', 5, 6.5, '#3f7ec9'], ['ped', 12, 5, '#2f6b4f', undefined, undefined, 'cross']],
    q: 'A bus has stopped ahead at a stop. Passengers are getting off on the road side.',
    a: ['Pass on the right without slowing', 'Slow, expect people to step out from in front of the bus', 'Pass on the left, between bus and kerb'], c: 1, axes: ['hazard'],
    ex: 'People crossing in front of a stopped bus cannot see you and you cannot see them. Passing on the left is where they will be walking.',
    cite: 'Defensive driving · obscured pedestrian' },
  { id: 'H4', lvl: 'hazards', vehicle: 'car', map: T_ZEBRA, art: [['car', 4, 4, '#3f7ec9'], ['bike', 11, 6.5, '#c8452f', undefined, 'h', 'fwd']],
    q: 'A two-wheeler is riding in your blind spot as you approach a left turn.',
    a: ['Turn, you signalled first', 'Check the mirror and shoulder, let the rider clear, then turn', 'Brake hard so the rider passes'], c: 1, axes: ['hazard', 'consistency'],
    ex: 'Signalling announces intent, it does not create space. A left turn across a two-wheeler in the blind spot is one of the most common urban collisions.',
    cite: 'Rules of the Road Regulations 1989, r.12' },
  { id: 'G1', lvl: 'signs', vehicle: 'any', map: T_TEE, art: [['sign', 5, 7, null, '#c8452f'], ['car', 9.5, 10, '#3f7ec9', undefined, 'v']],
    q: 'A triangular sign with a red border showing a bend to the right.',
    a: ['Right hand curve ahead — cautionary', 'Right turn prohibited — mandatory', 'One way to the right — informatory'], c: 0, axes: ['sign'],
    ex: 'Triangular red-bordered signs are cautionary: they warn about the road ahead. Circular signs with a red border are mandatory: they order or prohibit.',
    cite: 'IRC:67 sign classification · cautionary' },
  { id: 'G2', lvl: 'signs', vehicle: 'any', map: T_TEE, art: [['signc', 14, 1, null, '#c8452f'], ['car', 9.5, 9, '#3f7ec9', undefined, 'v']],
    q: 'A circular sign, red border, blank white centre with a horizontal red bar.',
    a: ['No parking', 'No entry', 'No overtaking'], c: 1, axes: ['sign'],
    ex: 'A red circle with a single horizontal white bar is No Entry. Entering is a mandatory-sign violation, not a caution ignored.',
    cite: 'IRC:67 · mandatory signs' },
  { id: 'G3', lvl: 'signs', vehicle: 'bike', map: T_ROAD, art: [['bike', 8, 6.5, '#3f7ec9']],
    q: "You are riding on a learner's licence. What must be with you?",
    a: ["The learner's licence only", 'The licence, an L plate, and a licensed driver for that class', 'Nothing, the licence is on your phone'], c: 1, axes: ['sign', 'consistency'],
    ex: 'A learner may only ride or drive with an L plate displayed and, for most classes, an instructor or licensed holder of that class beside them.',
    cite: 'CMV Rules 1989, r.3 · learner conditions' },
  { id: 'G4', lvl: 'signs', vehicle: 'any', map: T_ROAD, art: [['car', 6, 6.5, '#3f7ec9'], ['car', 12, 3.5, '#d8d2c4']],
    q: 'The road is marked with a solid single white centre line.',
    a: ['Overtake if the road ahead is clear', 'Do not cross or straddle the line', 'Cross only to turn right'], c: 1, axes: ['sign', 'priority'],
    ex: 'A solid centre line must not be crossed. A broken line permits overtaking when clear. Most learners get this the wrong way round.',
    cite: 'IRC:35 road markings' },
  { id: 'S5', lvl: 'signals', vehicle: 'any', map: T_JUNC, art: [['signal', 12, 4, null, '#c8452f'], ['car', 9, 7.5, '#3f7ec9']],
    q: 'The signal ahead is red. The stop line is a few metres before the zebra crossing.',
    a: ['Stop with the front of the car on the crossing, closer to the light', 'Stop behind the stop line, before the crossing', "Stop wherever is convenient, as long as you're behind other traffic"], c: 1, axes: ['signal'],
    ex: 'You must stop behind the stop line, not on the pedestrian crossing — blocking it forces pedestrians into moving traffic.',
    cite: 'CMV Rules 1989, r.15 · stop line discipline' },
  { id: 'S6', lvl: 'signals', vehicle: 'any', map: T_JUNC, art: [['signal', 12, 4, null, '#5c9a5c'], ['van', 8, 7.5, '#c5b46a', undefined, 'h', 'fwd'], ['car', 9.5, 10, '#3f7ec9', undefined, 'v']],
    q: 'The signal turns green for you, but a truck from the previous phase is still completing its turn across your path.',
    a: ['Accelerate immediately, you have the green', 'Wait until the junction is clear before moving off', 'Sound the horn continuously until it moves'], c: 1, axes: ['signal', 'priority'],
    ex: 'A green light permits movement, it does not guarantee a clear path. Traffic still clearing from the previous phase always has priority over a fresh green.',
    cite: 'Defensive driving · green-light clearance' },
  { id: 'H5', lvl: 'hazards', vehicle: 'car', map: T_ROAD, art: [['car', 5, 6.5, '#3f7ec9'], ['child', 12, 3.5, '#c8452f'], ['sign', 15, 8, null, '#2f6fb0']],
    q: 'You are passing a school-zone sign. No children are visible right now.',
    a: ['Drive at the normal road speed, since no one is around', 'Slow down regardless — children can appear suddenly near a school', 'Only slow down during the morning entry time'], c: 1, axes: ['hazard', 'sign'],
    ex: 'A school-zone sign is a standing instruction, not a suggestion for when children happen to be visible. A sudden appearance near a school is exactly the hazard it warns about.',
    cite: 'IRC:67 · school zone caution' },
  { id: 'H6', lvl: 'hazards', vehicle: 'car', map: T_ROAD, art: [['car', 4, 6.5, '#3f7ec9'], ['car', 10, 6.5, '#d8d2c4', undefined, 'h', 'fwd']],
    q: 'The road is wet after rain and you are following another car closely at 50 km/h.',
    a: ["Keep the same gap — wet roads don't change stopping distance much", 'Increase your following distance — wet roads roughly double it', 'Brake-check occasionally to test your grip'], c: 1, axes: ['hazard', 'consistency'],
    ex: 'Wet roads significantly increase stopping distance. The usual two-second following gap should become at least four seconds in the wet.',
    cite: 'Defensive driving · wet-weather following distance' },
  { id: 'G5', lvl: 'signs', vehicle: 'any', map: T_TEE, art: [['rect', 6, 7, null, '#2f6fb0'], ['car', 9.5, 10, '#3f7ec9', undefined, 'v']],
    q: 'You see a rectangular blue sign giving the distance to the next town.',
    a: ['It is a warning — slow down ahead', 'It is a prohibition — a manoeuvre is banned here', "It is informatory — it's telling you something, not ordering you"], c: 2, axes: ['sign'],
    ex: 'Rectangular signs are informatory: distances, place names, facilities. They inform, they don\'t warn or prohibit — that is what triangles and circles are for.',
    cite: 'IRC:67 · informatory signs' },
  { id: 'G6', lvl: 'signs', vehicle: 'any', map: T_TEE, art: [['signc', 14, 1, null, '#2f6fb0'], ['car', 9.5, 9, '#3f7ec9', undefined, 'v']],
    q: 'A circular sign with a blue background and a white arrow.',
    a: ['A warning to slow down', 'A mandatory direction — you must go that way', 'Just a decoration, no legal meaning'], c: 1, axes: ['sign'],
    ex: 'Blue circular signs are mandatory — they instruct you to do something, like a compulsory direction. Red circular signs prohibit; blue ones order.',
    cite: 'IRC:67 · mandatory signs' },
  { id: 'S7', lvl: 'signals', vehicle: 'any', map: T_JUNC, art: [['signal', 12, 4, null, '#5c9a5c'], ['car', 9, 7.5, '#3f7ec9']],
    q: "The main signal is red, but a green arrow board beside it reads 'Free Left'.",
    a: ['Wait for the main signal to turn green', 'You may turn left with care, watching for pedestrians and other traffic', 'The arrow board is decorative and has no meaning'], c: 1, axes: ['signal', 'priority'],
    ex: "A green 'Free Left' arrow permits a left turn even on red, but you must still give way to pedestrians and to traffic already in the junction.",
    cite: 'Traffic signal supplementary boards · free-left turn' },
  { id: 'S8', lvl: 'signals', vehicle: 'any', map: T_JUNC, art: [['signal', 12, 4, null, '#c8452f'], ['car', 9, 7.5, '#3f7ec9', undefined, 'h', false], ['car', 9.5, 10, '#d8d2c4', undefined, 'v']],
    q: 'You are first at a red light. You notice the signal for the cross-street traffic turn amber, then red.',
    a: ['Start moving as soon as the cross-street light turns red', 'Wait for your own signal to turn green before moving', 'Move if no cars are visible on the cross street'], c: 1, axes: ['signal', 'consistency'],
    ex: 'Only your own signal governs when you may move. Junctions usually run an all-red safety gap between phases — moving early risks a vehicle still clearing the far side.',
    cite: 'Signal phase discipline · all-red clearance gap' },
  { id: 'H7', lvl: 'hazards', vehicle: 'car', map: T_ROAD, art: [['car', 8, 6.5, '#3f7ec9'], ['bike', 5, 6.5, '#c8452f', undefined, 'h', 'fwd']],
    q: 'You see a pothole ahead in your lane. A two-wheeler is close behind you.',
    a: ['Swerve suddenly to avoid it', 'Check your mirror, signal, and change line smoothly if it is safe', 'Brake hard right before the pothole'], c: 1, axes: ['hazard', 'consistency'],
    ex: 'A sudden swerve or hard brake with a vehicle close behind risks a rear-end collision. Signal early and move smoothly only if it is safe to do so.',
    cite: 'Defensive driving · avoiding a hazard without sudden inputs' },
  { id: 'H8', lvl: 'hazards', vehicle: 'car', map: T_ROAD, art: [['car', 4, 6.5, '#3f7ec9'], ['car', 13, 6.5, '#e8e3d8', undefined, 'h', 'back']],
    q: 'Driving at night, an oncoming vehicle has its headlights on full beam, dazzling you.',
    a: ['Flash your own full beam back at them', 'Look slightly toward the left road edge and slow down', 'Close your eyes briefly until it passes'], c: 1, axes: ['hazard'],
    ex: 'Looking toward the road edge rather than at the glare preserves your night vision and lane position. Retaliating with full beam blinds both drivers.',
    cite: 'Defensive driving · night glare' },
  { id: 'G7', lvl: 'signs', vehicle: 'any', map: T_TEE, art: [['rect', 6, 7, null, '#2f6fb0'], ['car', 9.5, 10, '#3f7ec9', undefined, 'v']],
    q: 'A rectangular sign with a single upward arrow, on a blue background.',
    a: ["It's a warning of a one-way street ahead", 'It is mandatory — this is a one-way street, travel only in the direction shown', "It's purely decorative"], c: 1, axes: ['sign'],
    ex: 'A blue rectangular arrow sign for a one-way street is mandatory — travel is only permitted in the direction the arrow shows.',
    cite: 'IRC:67 · one-way mandatory sign' },
  { id: 'G8', lvl: 'signs', vehicle: 'any', map: T_TEE, art: [['sign', 5, 7, null, '#c8452f'], ['car', 9.5, 10, '#3f7ec9', undefined, 'v']],
    q: 'A triangular sign, red border, showing two arrows squeezing together.',
    a: ['Road narrows ahead — cautionary, ease off and watch for oncoming traffic', 'Road closed ahead — turn back', 'Two-way traffic starts here — mandatory'], c: 0, axes: ['sign', 'hazard'],
    ex: 'Triangular signs are cautionary. A narrowing-road pictograph warns the carriageway ahead is tighter than usual, often at a bridge — reduce speed and give way if needed.',
    cite: 'IRC:67 · road-narrows caution' },
  { id: 'G9', lvl: 'signs', vehicle: 'bike', map: T_ROAD, art: [['bike', 9, 6.5, '#3f7ec9']],
    q: "You're about to ride off with a friend riding pillion. Your friend has no helmet.",
    a: ['Ride anyway — only the rider needs a helmet', 'Both rider and pillion must wear a helmet — get your friend one first', 'Helmets are optional under 40 km/h'], c: 1, axes: ['sign'],
    ex: 'Section 129 of the MV Act requires both the rider and the pillion passenger to wear a protective helmet, not just the rider.',
    cite: 'MV Act s.129 · helmet requirement' },
  { id: 'G10', lvl: 'signs', vehicle: 'bike', map: T_ROAD, art: [['bike', 9, 6.5, '#3f7ec9']],
    q: 'Three friends want to ride pillion with you, all at once, on your two-wheeler.',
    a: ["That's fine as long as everyone holds on", 'Only one pillion passenger is allowed at a time', 'Up to two are allowed if they are children'], c: 1, axes: ['sign'],
    ex: 'A two-wheeler may carry only one pillion passenger. Extra riders overload the vehicle and are a common reason for on-the-spot fines.',
    cite: 'CMV Rules 1989, r.123 · pillion limit' },
  { id: 'G11', lvl: 'signs', vehicle: 'bike', map: T_ROAD, art: [['bike', 9, 6.5, '#3f7ec9']],
    q: "You are 16 and want to ride your brother's geared motorcycle (MCWG class).",
    a: ['Fine — geared bikes are allowed from 16', 'You need to wait until 18 — MCWG requires the rider to be 18', 'Only allowed with a parent riding pillion'], c: 1, axes: ['sign'],
    ex: 'A gearless scooter or moped up to 50cc (MCWOG) can be ridden from 16. A geared motorcycle (MCWG) requires the rider to be at least 18.',
    cite: "MV Act s.4 · minimum age by vehicle class" },
  { id: 'H9', lvl: 'hazards', vehicle: 'bike', map: T_ROAD, art: [['bike', 9, 6.5, '#3f7ec9', undefined, 'h', false], ['car', 4, 6.5, '#d8d2c4'], ['van', 13, 3.5, '#c9cdd3']],
    q: "Traffic is stopped bumper-to-bumper at a red light. There's a narrow gap between two lanes of stationary cars.",
    a: ['Squeeze through the gap to jump ahead of the queue', "Wait in your lane like other traffic — a gap isn't a lane", 'Ride on the footpath around the queue'], c: 1, axes: ['hazard', 'consistency'],
    ex: 'Weaving between stationary lanes of traffic is not a right of way — a car door can open or a car can shift lane without warning. Queue like any other vehicle.',
    cite: 'Defensive riding · lane discipline in queued traffic' },
  { id: 'H10', lvl: 'hazards', vehicle: 'bike', map: T_JUNC, art: [['bike', 9, 7.5, '#3f7ec9'], ['car', 9.5, 10, '#d8d2c4', undefined, 'v']],
    q: 'You want to turn right at the junction ahead. You signal immediately and start turning.',
    a: ['That is enough — signalling is the only requirement', 'Check your mirror and blind spot before turning, not just signal', "Turning without signalling is fine if the road looks empty"], c: 1, axes: ['hazard', 'consistency'],
    ex: "A signal alone doesn't check for a vehicle already overtaking you. Mirror-check every time before actually committing to the turn, signal or not.",
    cite: 'Defensive riding · mirror check before committing' },
];

export type VehicleFocus = 'car' | 'bike' | 'both';

/**
 * Which vehicle the applicant is actually applying for, so the practice bank can match it —
 * read from the specific classes picked in the Apply wizard once they're that far along,
 * falling back to the broader answer given on the Eligibility page, defaulting to showing
 * everything when neither is known yet (e.g. playing straight from the home page).
 */
export function vehicleFocusFrom(state: AppState): VehicleFocus {
  const classIds = state.form?.classes;
  if (classIds && classIds.length) {
    const hasCar = classIds.some(id => CAR_CLASS_IDS.has(id));
    const hasBike = classIds.some(id => BIKE_CLASS_IDS.has(id));
    if (hasCar && hasBike) return 'both';
    if (hasCar) return 'car';
    if (hasBike) return 'bike';
  }
  const want = state.elig?.want;
  if (want === 'car') return 'car';
  if (want === 'scooter') return 'bike';
  if (want === 'gear') return 'both'; // "a geared motorcycle, or both bike and car" — see Eligibility.tsx
  return 'both';
}

/** The scenario bank filtered to what's relevant for the given vehicle focus ('any'-tagged rules always included). */
export function scenariosFor(focus: VehicleFocus): PracticeScenario[] {
  if (focus === 'both') return SCENARIOS;
  return SCENARIOS.filter(s => s.vehicle === 'any' || s.vehicle === focus);
}

export const SKILL_AXES: [key: string, label: string][] = [
  ['signal', 'Signal compliance'], ['priority', 'Right of way'], ['sign', 'Sign recognition'], ['hazard', 'Hazard anticipation'], ['consistency', 'Decision consistency'],
];

/** Decision window per question (ms), and the threshold under which an answer counts as "fast". */
export const DECISION_LIMIT_MS = 12000;
export const FAST_ANSWER_MS = 6000;

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
