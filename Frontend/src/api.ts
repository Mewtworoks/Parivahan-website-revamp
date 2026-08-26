// Every call to the FastAPI backend lives here, so the surface the UI depends
// on is readable in one file. Point it elsewhere with VITE_API_BASE in .env.
//
// The backend holds the journey; this app holds the form being filled in. So
// anything that must survive a reload or be quotable at a counter — the
// application number, the booking, the queue token, the test attempt — comes
// from here rather than from React state.

export const API_BASE = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000').replace(/\/$/, '');

export const DEFAULT_RTO = 'mh01';

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

/** True when the failure is "the server isn't running", which needs different copy. */
export function isOffline(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0;
}

async function request<T>(path: string, init?: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method: init?.method || 'GET',
      signal: init?.signal,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, `Cannot reach the licence service at ${API_BASE}`);
  }
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return { detail: text }; } })() : null;
  if (!res.ok) throw new ApiError(res.status, data?.detail || res.statusText);
  return data as T;
}

// ---------------------------------------------------------------- shapes

export type AppStatusValue = 'submitted' | 'verified' | 'slot_booked' | 'checked_in' | 'completed' | 'rejected';

export interface LedgerEvent {
  seq: number;
  at: string;
  status: AppStatusValue;
  note: string;
  hash: string;
  prev_hash: string;
}

export interface QueueStatus {
  token_id: string;
  token_number: number;
  tester: string;
  status: 'waiting' | 'in_test' | 'done' | 'no_show';
  people_ahead: number;
  /** Place in this inspector's line. The token number is office-wide, so it is
   *  not a position — showing one as the other reads as a contradiction. */
  position_in_lane: number;
  lane_size: number;
  eta_minutes: number;
  someone_in_test: boolean;
}

/** One inspector's lane on the waiting-hall board. */
export interface BoardLane {
  tester_id: string;
  tester: string;
  now_serving: number | null;
  waiting: number;
  next_numbers: number[];
  avg_test_minutes: number;
}

export interface RtoBoard {
  rto_id: string;
  lanes: BoardLane[];
}

// ---- the demo panel: each proof runs the real engine and reports what happened

export interface LedgerRow {
  seq: number;
  status: string;
  note: string;
  hash: string;
  prev_hash: string;
  intact: boolean;
}

export interface IdempotencyProof {
  guarantee: string;
  attempts: { label: string; idempotency_key: string; application_no: string }[];
  retry_was_deduplicated: boolean;
  new_intent_still_created: boolean;
  applications_created: number;
  verdict: string;
}

export interface SlotRaceProof {
  guarantee: string;
  contenders: number;
  results: { applicant: number; outcome: 'won' | 'rejected'; detail: string }[];
  winners: number;
  double_booked: boolean;
  slot_now_held_by_one: boolean;
  verdict: string;
  error?: string;
}

export interface TamperProof {
  guarantee: string;
  application_no: string;
  edited_row: number;
  edited_to: string;
  before: { chain_valid: boolean; events: LedgerRow[] };
  after: { chain_valid: boolean; events: LedgerRow[] };
  restored: boolean;
  verdict: string;
  caveat: string;
}

export interface BookingView {
  booking_id: string;
  date: string;
  label: string;
  time: string;
  tester_id: string;
}

export interface ApplicationView {
  application_id: string;
  application_no: string;
  status: AppStatusValue;
  licence_kind: 'learner' | 'permanent';
  rto_id: string;
  applicant_name: string | null;
  dob: string | null;
  licence_classes: string[];
  created_at: string;
  booking_id: string | null;
  token_id: string | null;
  ledger: LedgerEvent[];
  rto?: { id: string; name: string; area: string; state: string };
  booking?: BookingView;
  queue?: QueueStatus;
}

export interface ReceiptView {
  application_id: string;
  application_no: string;
  licence_kind: string;
  final_status: string;
  chain_valid: boolean;
  chain_head: string;
  events: { seq: number; at: string; status: string; note: string; hash: string }[];
}

/** An office, with load and wait computed from its live queues. */
export interface RtoLive {
  id: string;
  name: string;
  area: string;
  state: string;
  km: number;
  load: 'light' | 'busy';
  wait: string;
  wait_minutes: number;
  waiting_now: number;
  lanes: number;
}

export interface SlotDay { date: string; label: string; left: number }
export interface SlotTime { time: string; start: string; left: number; slot_id: string | null }

export interface BookResult {
  booking_id: string;
  start: string;
  time: string;
  tester_id: string;
  tester: string | null;
  date: string;
  label: string;
}

export interface ScenarioOption { id: string; label: string; label_hi?: string | null }

export interface ScenarioPublic {
  id: string;
  competency: string;
  difficulty: number;
  duration_s: number;
  prompt: string;
  prompt_hi?: string | null;
  scene_env: string;
  options: ScenarioOption[];
}

export interface NextQuestion {
  done: boolean;
  index: number;
  total?: number;
  scenario?: ScenarioPublic;
}

export interface AnswerResult {
  correct: boolean;
  correct_option_id: string;
  explanation: string;
  mv_act_ref: string | null;
  score_so_far: number;
  answered: number;
  total: number;
  status: string;
}

export interface TestResultView {
  status: 'in_progress' | 'passed' | 'failed' | 'voided';
  score: number;
  total: number;
  pass_threshold: number;
  proctor_flags: string[];
  by_competency: Record<string, { correct: number; wrong: number }>;
}

export interface VoiceToolEvent {
  tool: string;
  // 'deferred' is a tool the agent asked for in the same breath as one that
  // needs confirming — answered so the transcript stays valid, but not run.
  // 'collecting' is a form answer stored with the form still incomplete;
  // 'redirected' is a slot lookup sent back to the form; 'corrected' is a
  // reply the service refused to speak because it contradicted the record.
  status: 'complete' | 'error' | 'awaiting_confirmation' | 'deferred'
        | 'collecting' | 'redirected' | 'corrected';
  result?: Record<string, unknown>;
}

export interface VoiceReply {
  session_id: string;
  reply: string;
  tool_events: VoiceToolEvent[];
  pending_confirmation?: { label: string };
}

// ---------------------------------------------------------------- calls

export const health = (signal?: AbortSignal) =>
  request<{ status: string; service: string }>('/api/health', { signal });

export const listRtos = (state?: string, signal?: AbortSignal) =>
  request<{ rtos: RtoLive[] }>(`/rtos${state ? `?state=${encodeURIComponent(state)}` : ''}`, { signal });

export const slotDays = (rtoId: string, signal?: AbortSignal) =>
  request<{ days: SlotDay[] }>(`/slots/days?rto_id=${encodeURIComponent(rtoId)}`, { signal });

export const slotTimes = (rtoId: string, on: string, signal?: AbortSignal) =>
  request<{ times: SlotTime[] }>(`/slots/times?rto_id=${encodeURIComponent(rtoId)}&on=${on}`, { signal });

export interface ApplyInput {
  citizenRef: string;
  licenceKind?: 'learner' | 'permanent';
  rtoId?: string;
  idempotencyKey: string;
  dob?: string;
  applicantName?: string;
  licenceClasses?: string[];
}

export const apply = (input: ApplyInput) =>
  request<ApplicationView>('/apply', {
    method: 'POST',
    body: {
      citizen_ref: input.citizenRef,
      licence_kind: input.licenceKind || 'learner',
      rto_id: input.rtoId || DEFAULT_RTO,
      idempotency_key: input.idempotencyKey,
      dob: input.dob,
      applicant_name: input.applicantName,
      licence_classes: input.licenceClasses || [],
    },
  });

export const getApplication = (id: string, signal?: AbortSignal) =>
  request<ApplicationView>(`/application/${id}`, { signal });

/**
 * The application filed under a signed-in number, without the number-and-DOB
 * lookup. Throws a 404 ApiError when there is none, which is a normal state and
 * not a failure — most people arriving here have not applied yet.
 *
 * The lookup form stays for everyone else: somebody checking on a relative's
 * application has the slip, not the phone it was filed from.
 */
export const citizenApplication = (citizenRef: string, signal?: AbortSignal) =>
  request<ApplicationView>(
    `/citizen/${encodeURIComponent(citizenRef)}/application`, { signal });

export const findApplication = (no: string, dob: string, signal?: AbortSignal) =>
  request<ApplicationView>(`/application/by-number/${encodeURIComponent(no)}?dob=${encodeURIComponent(dob)}`, { signal });

export const getReceipt = (id: string, signal?: AbortSignal) =>
  request<ReceiptView>(`/application/${id}/receipt`, { signal });

export const bookSlot = (applicationId: string, slotId: string) =>
  request<BookResult>('/book', { method: 'POST', body: { application_id: applicationId, slot_id: slotId } });

export const checkIn = (applicationId: string) =>
  request<{ token_id: string; token_number: number; tester_id: string }>(`/checkin/${applicationId}`, { method: 'POST' });

export const queueStatus = (tokenId: string, signal?: AbortSignal) =>
  request<QueueStatus>(`/queue/${tokenId}`, { signal });

export const callNext = (testerId: string) =>
  request<{ now_serving: number | null }>(`/tester/${testerId}/call-next`, { method: 'POST' });

export const startTest = (citizenId: string) =>
  request<{ attempt_id: string; total_questions: number; pass_threshold: number }>('/test/start', {
    method: 'POST', body: { citizen_id: citizenId },
  });

export const nextQuestion = (attemptId: string, signal?: AbortSignal) =>
  request<NextQuestion>(`/test/${attemptId}/next`, { signal });

export const submitAnswer = (attemptId: string, scenarioId: string, optionId: string, timeTakenS: number) =>
  request<AnswerResult>(`/test/${attemptId}/answer`, {
    method: 'POST',
    body: { scenario_id: scenarioId, chosen_option_id: optionId, time_taken_s: timeTakenS },
  });

export const testResult = (attemptId: string, signal?: AbortSignal) =>
  request<TestResultView>(`/test/${attemptId}/result`, { signal });

// ------------------------------------------------------ inspector desk / board

// callNext already lives with the queue calls above — this view only needed the
// board, which nothing had reached for yet.
export const rtoBoard = (rtoId: string, signal?: AbortSignal) =>
  request<RtoBoard>(`/rto/${encodeURIComponent(rtoId)}/board`, { signal });

// ----------------------------------------------------------------- demo proofs

export const proveIdempotentApply = () =>
  request<IdempotencyProof>('/proof/idempotent-apply', { method: 'POST' });

export const proveSlotRace = (contenders = 8) =>
  request<SlotRaceProof>(`/proof/slot-race?contenders=${contenders}`, { method: 'POST' });

export const proveLedgerTamper = () =>
  request<TamperProof>('/proof/ledger-tamper', { method: 'POST' });

export const resetDemo = () =>
  request<{ reset: boolean; offices: number }>('/demo/reset', { method: 'POST' });

// ------------------------------------------------------------------ identity
// A stand-in for the portal's sign-in, not authentication — the service returns
// the code because nothing sends an SMS, and says so in `delivered` and `note`.

export interface SignInCode {
  phone: string;
  code: string;
  delivered: boolean;
  expires_in_minutes: number;
  note: string;
}

export const requestSignInCode = (phone: string) =>
  request<SignInCode>('/identity/request-code', { method: 'POST', body: { phone } });

export const verifySignInCode = (phone: string, code: string) =>
  request<{ citizen_ref: string; phone: string }>('/identity/verify', {
    method: 'POST', body: { phone, code },
  });

// ---------------------------------------------------------------- voice agent

export interface VoiceStart {
  session_id: string;
  expires_in_minutes: number;
  /**
   * The opening line, composed by the service from what the record already
   * says about this citizen — an appointment, a filed application, a form left
   * half-answered. It costs no model call, which is why the panel now asks for
   * it instead of greeting from a hardcoded string: the first turn used to be
   * the slowest in the conversation and it was spent saying hello.
   */
  greeting: string;
  /** Whether this picked something up rather than starting from nothing. */
  resumed: boolean;
}

export const startVoice = (citizenRef: string, language = 'en') =>
  request<VoiceStart>('/agent/voice/start', {
    method: 'POST', body: { citizen_ref: citizenRef, language },
  });

/**
 * The picker travels with every turn, not just with the session.
 *
 * The service used to read each message and decide the language from it, which
 * flipped a Hindi conversation to English on the word "9:30". The site language
 * is the answer and always was — someone who wants to switch does it with the
 * picker, where they can see what they chose.
 */
export const voiceTurn = (sessionId: string, transcript: string, language = 'en') =>
  request<VoiceReply>('/agent/voice/turn', {
    method: 'POST', body: { session_id: sessionId, transcript, language },
  });

export const confirmVoiceAction = (sessionId: string, language = 'en') =>
  request<VoiceReply>('/agent/voice/confirm', {
    method: 'POST', body: { session_id: sessionId, language },
  });

export const cancelVoiceAction = (sessionId: string) =>
  request<{ session_id: string; cancelled: boolean }>('/agent/voice/cancel', { method: 'POST', body: { session_id: sessionId } });

export const endVoice = (sessionId: string) =>
  request<void>(`/agent/voice/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
