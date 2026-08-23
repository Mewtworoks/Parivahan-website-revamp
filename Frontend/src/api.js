// =============================================================================
// Backend client. Every call in the app goes through here, so the whole
// surface the UI depends on is readable in one file.
//
// Point it elsewhere with VITE_API_BASE in Frontend/.env
// =============================================================================

export const API_BASE = (
  import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'
).replace(/\/$/, '');

export const DEFAULT_RTO = 'rto_ggn_01';

export class ApiError extends Error {
  constructor(status, detail, path) {
    super(detail || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.path = path;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    // fetch only rejects on network-level failure — the server is down.
    throw new ApiError(0, `Cannot reach the API at ${API_BASE}`, path);
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, data?.detail || res.statusText, path);
  }
  return data;
}

/**
 * Like request(), but an expected non-2xx (a 409 lost slot race) comes back as
 * data instead of throwing. The proof panel needs to count rejections, not
 * treat them as failures.
 */
export async function tryRequest(path, opts) {
  try {
    return { ok: true, status: 200, data: await request(path, opts) };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, status: err.status, detail: err.detail };
    }
    throw err;
  }
}

// ---------------------------------------------------------------- meta

export const health = (signal) => request('/api/health', { signal });
export const serviceInfo = (signal) => request('/', { signal });

// ------------------------------------------------- journey: apply → queue

export const apply = ({ citizenRef, licenceKind = 'learner', rtoId = DEFAULT_RTO, idempotencyKey }) =>
  request('/apply', {
    method: 'POST',
    body: {
      citizen_ref: citizenRef,
      licence_kind: licenceKind,
      rto_id: rtoId,
      idempotency_key: idempotencyKey,
    },
  });

export const getApplication = (appId) => request(`/application/${appId}`);
export const getReceipt = (appId) => request(`/application/${appId}/receipt`);
export const latestApplication = (citizenRef) =>
  request(`/citizen/${encodeURIComponent(citizenRef)}/application`);

export const listSlots = (rtoId = DEFAULT_RTO, signal) =>
  request(`/slots?rto_id=${encodeURIComponent(rtoId)}`, { signal });

export const bookSlot = (applicationId, slotId) =>
  request('/book', {
    method: 'POST',
    body: { application_id: applicationId, slot_id: slotId },
  });

export const tryBookSlot = (applicationId, slotId) =>
  tryRequest('/book', {
    method: 'POST',
    body: { application_id: applicationId, slot_id: slotId },
  });

export const checkIn = (appId) => request(`/checkin/${appId}`, { method: 'POST' });
export const queueStatus = (tokenId, signal) => request(`/queue/${tokenId}`, { signal });
export const callNext = (testerId) =>
  request(`/tester/${testerId}/call-next`, { method: 'POST' });
export const rtoBoard = (rtoId = DEFAULT_RTO, signal) =>
  request(`/rto/${rtoId}/board`, { signal });

// ---------------------------------------------------------- scenario test

export const startTest = (citizenId) =>
  request('/test/start', { method: 'POST', body: { citizen_id: citizenId } });

export const nextQuestion = (attemptId) => request(`/test/${attemptId}/next`);

export const submitAnswer = (attemptId, { scenarioId, optionId, timeTakenS }) =>
  request(`/test/${attemptId}/answer`, {
    method: 'POST',
    body: {
      scenario_id: scenarioId,
      chosen_option_id: optionId,
      time_taken_s: timeTakenS,
    },
  });

export const testResult = (attemptId) => request(`/test/${attemptId}/result`);

export const reportProctorFlag = (attemptId, flag) =>
  request(`/test/${attemptId}/proctor`, { method: 'POST', body: { flag } });

// ---------------------------------------------------------------- agent

export const agentTools = () => request('/agent/tools');

export const agentDispatch = (tool, args = {}) =>
  request('/agent/dispatch', { method: 'POST', body: { tool, arguments: args } });
