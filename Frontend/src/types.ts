// Shared types for the learner's/driving licence prototype.
// The application form mirrors a real multi-page government form: almost
// every field is optional because it is filled in gradually across steps,
// and unfilled fields fall back to prefilled sample data (see data/applicant.ts).

export type Route =
  | 'home' | 'elig' | 'checklist' | 'status'
  | 'apply' | 'slip' | 'pay' | 'receipt' | 'slot' | 'tutorial'
  | 'learn' | 'lesson' | 'game' | 'report' | 'test' | 'issued'
  // 'dl' is parked. The driving-licence wizard is complete as an interface but
  // has no service behind it — every other journey on this site is wired to the
  // real engine, so leaving it reachable invites someone to find the one screen
  // that only pretends. pages/DrivingLicence.tsx and pages/dl/ are untouched;
  // search "DL journey parked" to put it back.
  // Staff-side and behind-the-scenes views. The desk is what makes the
  // citizen's live queue actually move; the proofs run the guarantees;
  // 'learning' is the only screen here about everybody at once rather than
  // about one applicant, and the only one with no name on it anywhere.
  // 'future' is the only screen here whose numbers are invented, and it says so
  // on itself four times over — see pages/Future.tsx for why that is structural
  // rather than a footnote.
  | 'desk' | 'proof' | 'learning' | 'future'
  // 'home2' is the home page restructured, kept alongside the original so the
  // two can be opened side by side rather than one replacing the other on
  // somebody's word. Reachable at #/home2 and deliberately not linked from the
  // nav: it is a comparison, not a second front door. Whichever wins, the other
  // file and this union member go.
  | 'home2';

export interface EligibilityAnswers {
  dob?: string;
  want?: 'scooter' | 'car' | 'gear';
  has?: 'no' | 'll' | 'dl';
}

export interface ConsentAnswers {
  a?: boolean;
  b?: boolean;
  c?: boolean;
}

/** The in-progress Form 2 application. Filled gradually across steps S0-S8. */
export interface ApplicationForm {
  // S0 — state & RTO
  state?: string;
  rto?: string;
  // S1 — category & authentication route
  cat?: 'none' | 'hold' | 'defence';
  oldNo?: string;
  oldDob?: string;
  route?: 'aadhaar' | 'manual';
  // S2 — identity check
  idType?: 'uid' | 'vid';
  uid?: string;
  phone?: string;
  cons?: ConsentAnswers;
  kyc?: boolean;
  manualOk?: boolean;
  // S2b — confirm e-KYC details
  kycOk?: boolean;
  // S3 — personal details
  first?: string;
  mid?: string;
  last?: string;
  dob?: string;
  gender?: string;
  relType?: string;
  relFirst?: string;
  relLast?: string;
  pob?: string;
  cob?: string;
  blood?: string;
  qual?: string;
  email?: string;
  landline?: string;
  emPhone?: string;
  mark1?: string;
  mark2?: string;
  disab?: 'No' | 'Yes';
  // S4 — address
  line?: string;
  street?: string;
  landmark?: string;
  area?: string;
  district?: string;
  block?: string;
  pin?: string;
  vt?: 'Village' | 'Town';
  city?: string;
  stayY?: string;
  stayM?: string;
  same?: boolean;
  pline?: string;
  plandmark?: string;
  pcity?: string;
  pdistrict?: string;
  ppin?: string;
  addrDoc?: boolean;
  // S5 — vehicle classes
  classes?: string[];
  school?: 'No' | 'Yes';
  schoolNo?: string;
  // S6 — Form 1 declaration
  f1?: Record<string, string>;
  f1sign?: boolean;
  form1a?: boolean;
  organ?: 'Yes' | 'No';
  conv?: 'Yes' | 'No';
  foreign?: 'Yes' | 'No';
  // S7 — documents / photo / signature
  photo?: 'ok' | 'warn';
  sign?: 'ok' | 'warn';
  docsOk?: boolean;
  // S8 — review & submit
  esign?: boolean;
  captchaOk?: boolean;
}

export interface SubmittedApplication {
  /** The application number the backend issued, e.g. SS-2026-004182. */
  no: string;
  name: string;
  phone: string;
  fee: number;
  route?: string;
  clsName: string;
  /** When the server recorded the submission, for the slip and the tracker. */
  submittedAt?: string;
}

/**
 * One actor in a chase-camera road scene.
 *
 * `x` is metres from the centre line (negative is left, the direction oncoming
 * traffic comes from on an Indian road), `z` is metres ahead of the camera.
 * Two numbers instead of the overhead view's tile coordinates, because the
 * perspective renderer needs a real distance to scale by — a tile row cannot be
 * projected, it can only be looked down on.
 */
export type RoadActor = {
  kind: 'car' | 'van' | 'bus' | 'truck' | 'bike' | 'ped' | 'cow' | 'pothole' | 'queue';
  x: number;
  z: number;
  /** Body colour; the defaults per kind are usually right. */
  body?: string;
  /** Coming the other way: drawn front-on, and at night with headlights lit. */
  oncoming?: boolean;
  /** Crossing left-to-right across the scene rather than facing the camera. */
  lateral?: boolean;
  /**
   * Travelling the same way at about the same speed, so it holds its distance
   * while the road scrolls beneath you both. Everything else is stationary
   * relative to the road and therefore closes at whatever speed you are doing.
   */
  withTraffic?: boolean;
  /** Under way with the traffic, but you are catching it — following too close. */
  closes?: boolean;
};

/** A road sign, drawn face-on — which is the entire reason this view exists. */
export type RoadSign = {
  z: number;
  x: number;
  shape: 'tri' | 'circle-red' | 'circle-blue' | 'rect-blue';
  /** Which mark goes inside the face. */
  glyph?: 'bend-right' | 'narrows' | 'children' | 'no-entry' | 'arrow-left' | 'arrow-up' | 'text' | 'level-crossing';
  /** For the informatory rectangles, which carry words rather than a symbol. */
  text?: string;
};

/**
 * Everything the chase-camera renderer needs to draw one situation.
 *
 * Authored per scenario beside the overhead `map`/`art` rather than replacing
 * them, so the two views can be compared on the same question and the overhead
 * one stays available for anything this view turns out to render worse.
 */
export interface RoadSpec {
  /** What the learner is driving. Decides the vehicle at the bottom of frame. */
  player?: 'car' | 'bike';
  /** A passenger on the player's two-wheeler, for the pillion questions. */
  pillion?: boolean | 'nohelmet' | 'three';
  /** Metres the player sits off the centre line. */
  lane?: number;
  /**
   * How fast the learner is travelling, in metres per second. `0` means stopped.
   *
   * This exists because the first version had no notion of it: the road scrolled
   * on a wall clock while every actor sat at a fixed distance, so the markings
   * rushed past a cow that never got any closer, and the car was still driving
   * in the scenarios that begin "you are first at a red light" and "traffic is
   * stopped bumper-to-bumper". One number, read by the road, the verge, the
   * roadside furniture and every actor, is what keeps those things agreeing.
   */
  speed?: number;
  night?: boolean;
  wet?: boolean;
  /** Centre-line treatment, which is itself the question in one scenario. */
  centre?: 'dash' | 'solid' | 'none';
  /** Distance to a crossing side road, drawn as asphalt across the verges. */
  junction?: number;
  /** Distance to a zebra crossing. */
  zebra?: number;
  /** Distance to a painted stop line. */
  stopline?: number;
  /**
   * Distance to an unmarked speed breaker.
   *
   * Its own feature rather than an actor, because a hump is part of the road
   * surface — and unmarked is the point of the scenario it exists for, so it is
   * drawn as a shallow rise in the tarmac with no paint on it whatsoever.
   */
  hump?: number;
  signal?: {
    z: number;
    state: 'red' | 'amber' | 'green' | 'flash-amber';
    /** The separate arrow board some junctions carry beside the main head. */
    freeLeft?: boolean;
    /** The cross-street's own head, visible from the stop line. */
    cross?: 'red' | 'amber' | 'green';
  };
  signs?: RoadSign[];
  actors?: RoadActor[];
  /**
   * What is behind, shown in a rear-view mirror inset.
   *
   * A forward camera cannot show a vehicle following you, and two questions turn
   * on one. The mirror is also the pedagogically exact place to put it: the
   * answer to "a two-wheeler is close behind" is that you knew because you
   * looked. And its absence carries meaning too — in the blind-spot question the
   * rider is drawn alongside and deliberately *not* in the mirror, because not
   * being in the mirror is what a blind spot is.
   */
  mirror?: ('car' | 'bike' | 'truck' | 'ambulance')[];
}

export interface GameLogEntry {
  id: string;
  axes: string[];
  ok: boolean;
  ms: number;
  fast: boolean;
  to: boolean;
  /**
   * Which option was chosen, or null on a timeout.
   *
   * The log recorded only whether the answer was right, which was enough to
   * score a round and not enough to review one — "you got four wrong" without
   * being able to say *what you answered instead* is the part of a report card
   * nobody can act on. Revising needs the wrong answer you actually believed,
   * next to the right one.
   */
  pick: number | null;
}

export type ApplicationStage = 'submitted' | 'esign' | 'paid' | 'booked' | 'issued';

/**
 * The whole app's in-memory state, held by the shell and passed down to every
 * page. The form being filled in lives here; anything the citizen must be able
 * to quote later — the application number, the booking, the queue token, the
 * test attempt — is created by the backend and only referenced here by id.
 */
export interface AppState {
  module?: 'll' | 'dl';
  elig?: EligibilityAnswers;
  form?: ApplicationForm;
  /**
   * Which stage of the wizard the citizen was last on.
   *
   * Kept beside the answers rather than in the component, because the two are
   * only useful together. The form's own copy promises "saved after every step"
   * and the answers were indeed saved — but the place was not, so a reload
   * returned somebody to stage one to go looking for work they could not see,
   * which reads as having lost all of it.
   */
  formStep?: number;
  app?: SubmittedApplication;
  stage?: ApplicationStage;
  paym?: 'upi' | 'card' | 'net';
  slot?: { day: string; time: string; rto: string; bookingId?: string; tester?: string };
  gameLog?: GameLogEntry[] | null;
  focus?: string | null;
  score?: number;
  /** How many questions that score was out of — the service decides, not the UI. */
  scoreTotal?: number;
  /** Server-side application id (uuid). Everything after submission needs it. */
  applicationId?: string;
  /** Live queue token, once the applicant has checked in at the office. */
  tokenId?: string;
  /** Current theory-test attempt on the server. */
  attemptId?: string;
  /**
   * Demo autopilot: each page checks this and, if it matches, fills and
   * advances itself the way a person clicking through that page would — see
   * lib/autoDemo.ts. Reached only through the header's cheat code, not a
   * visible button. Cleared once its journey ends.
   */
  autoDemo?: 'll' | 'game' | 'gov';
}

/** Props every top-level page receives from the shell. */
export interface PageProps {
  go: (route: Route) => void;
  state: AppState;
  update: (patch: Partial<AppState>) => void;
}

export interface RtoOffice {
  id: string;
  name: string;
  area: string;
  km: number;
  /** The service's own English sentence. Kept as a fallback only. */
  wait: string;
  /**
   * The same wait as a number, which is what screens should render. The English
   * sentence above is composed server-side and cannot be translated in the
   * browser; the minutes can be, so a Hindi reader gets Hindi either way.
   */
  waitMinutes?: number;
  load: 'light' | 'busy';
}

export interface VehicleClass {
  id: string;
  code: string;
  name: string;
  nameHi?: string;
  nameMr?: string;
  note: string;
  noteHi?: string;
  noteMr?: string;
  min: number;
  fee: number;
  medical?: boolean;
}

export interface FeeLine {
  k: string;
  kHi?: string;
  kMr?: string;
  v: number;
  per?: 'once' | 'class';
  rule: string;
  ruleHi?: string;
  ruleMr?: string;
  state?: boolean;
}

export interface DocumentRequirement {
  id: string;
  name: string;
  nameHi?: string;
  nameMr?: string;
  need: string;
  needHi?: string;
  needMr?: string;
  via: string;
  viaHi?: string;
  viaMr?: string;
  auto: boolean;
}

export interface ApplicationStep {
  t: string;
  tHi: string;
  tMr: string;
  ref: string;
}

export interface StageDefinition {
  n: string;
  nHi: string;
  nMr: string;
  k: string;
}

export interface StageRow extends StageDefinition {
  status: 'Completed' | 'Exempted' | 'To be done by you';
}

export interface Category {
  id: string;
  t: string;
  tHi: string;
  tMr: string;
  d: string;
  dHi: string;
  dMr: string;
}

export interface TheoryQuestion {
  q: string;
  a: string[];
  c: number;
  ex: string;
}

export interface CaptchaQuestion {
  q: string;
  a: string[];
}

/**
 * [spriteName, tileX, tileY, bodyColor?, lampColor?, facing?, move?]
 * - facing: only matters for car/van/bike — the art is drawn nose-up for vertical travel, so 'h'
 *   (the default when omitted) rotates it 90° to face along a horizontal road; pass 'v' for the
 *   minority of scenes where the vehicle is actually travelling up/down a side street.
 * - move: how this sprite creeps across the scene as the 4-second decision window elapses, so the
 *   scenario visibly plays out rather than sitting frozen. 'fwd'/'back' creep along the sprite's
 *   own facing axis (back = closing from the opposite direction, e.g. oncoming traffic); 'cross'
 *   is a pedestrian/animal-style crossing of the road, perpendicular to it; `false` pins the sprite
 *   still even if it would otherwise default to moving (used for the driver's own vehicle in the
 *   couple of scenarios where you're already stopped, not approaching). Every displacement is
 *   capped small enough that nothing ever visually reaches, let alone overlaps, anything else —
 *   the animation always freezes (at whatever point the countdown was at) before a decision is
 *   made, never a moment after.
 */
export type SpriteArt = [string, number, number, (string | null)?, string?, ('h' | 'v')?, ('fwd' | 'back' | 'cross' | false)?];

/** Which applicant this scenario is relevant to — 'any' means the rule applies regardless of vehicle class. */
export type ScenarioVehicle = 'any' | 'car' | 'bike';

export interface PracticeScenario {
  id: string;
  lvl: 'signals' | 'hazards' | 'signs';
  vehicle: ScenarioVehicle;
  map: string[];
  art: SpriteArt[];
  q: string;
  a: string[];
  c: number;
  axes: string[];
  ex: string;
  cite: string;
}

export interface PrefilledApplicant {
  first: string;
  mid: string;
  last: string;
  dob: string;
  gender: string;
  blood: string;
  relType: string;
  relFirst: string;
  relLast: string;
  cob: string;
  qual: string;
  mark1: string;
  mark2: string;
  emPhone: string;
  email: string;
  stayY: string;
  stayM: string;
  state: string;
  pob: string;
  line: string;
  street: string;
  landmark: string;
  area: string;
  city: string;
  district: string;
  block: string;
  pin: string;
  vt: 'Village' | 'Town';
}
