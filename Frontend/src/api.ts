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
  eta_minutes: number;
  someone_in_test: boolean;
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
