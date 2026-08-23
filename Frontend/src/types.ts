// Shared types for the learner's/driving licence prototype.
// The application form mirrors a real multi-page government form: almost
// every field is optional because it is filled in gradually across steps,
// and unfilled fields fall back to prefilled sample data (see data/applicant.ts).

export type Route =
  | 'home' | 'elig' | 'checklist' | 'status'
  | 'apply' | 'slip' | 'pay' | 'receipt' | 'slot' | 'tutorial'
  | 'learn' | 'lesson' | 'game' | 'report' | 'test' | 'issued' | 'dl';

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
  no: string;
  name: string;
  phone: string;
  fee: number;
  route?: string;
  clsName: string;
}

export interface GameLogEntry {
  id: string;
  axes: string[];
  ok: boolean;
  ms: number;
  fast: boolean;
  to: boolean;
}

export type ApplicationStage = 'submitted' | 'esign' | 'paid' | 'booked' | 'issued';

/** The whole app's in-memory state, held by the shell and passed down to every page. */
export interface AppState {
  module?: 'll' | 'dl';
  elig?: EligibilityAnswers;
  form?: ApplicationForm;
  app?: SubmittedApplication;
  stage?: ApplicationStage;
  paym?: 'upi' | 'card' | 'net';
  slot?: { day: string; time: string; rto: string };
  gameLog?: GameLogEntry[] | null;
  focus?: string | null;
  score?: number;
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
  wait: string;
  load: 'light' | 'busy';
}

export interface VehicleClass {
  id: string;
  code: string;
  name: string;
  note: string;
  min: number;
  fee: number;
  medical?: boolean;
}

export interface FeeLine {
  k: string;
  v: number;
  per?: 'once' | 'class';
  rule: string;
  state?: boolean;
}

export interface DocumentRequirement {
  id: string;
  name: string;
  need: string;
  via: string;
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
