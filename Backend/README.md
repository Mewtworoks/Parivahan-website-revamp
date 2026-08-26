# 🐍 Backend — Parivahan LL/DL Journey, Reimagined

FastAPI service behind the revamped Learner/Driving Licence flow. It fixes the
three failures that actually break the current journey, and it *proves* the
fixes instead of claiming them.

| Real failure | Fix | Proof |
| --- | --- | --- |
| Silent failures, duplicate submits on a flaky network | `POST /apply` is idempotent on a client-supplied key | 50 retries → 1 application |
| "Come in the morning" and wait all day | Fixed slot grid, atomically allocated | 40 racing threads → 1 winner, 39 clean 409s |
| Pile-ups with no information | Live queue token: your number, your inspector, a recomputed ETA | `/queue/{token}` + `/rto/{id}/board` share one truth |
| No proof a pass was recorded honestly | Hash-chained journey ledger | tampering flips `chain_valid` to `false` |

A secondary flow replaces the static text MCQ with an animated **scenario**
test — judgment over memorization — and **Saarthi**, a Hindi-first voice
copilot, drives the same backend through function tools, so it can act, not
just chat.

Saarthi runs **OpenAI's `gpt-oss-20b`**, an open-weight model, served over
NVIDIA NIM's OpenAI-compatible endpoint. Open weights are the point rather than
a compromise: the same agent can run on hardware inside the country, so no
citizen utterance has to leave it, and the marginal cost per district is compute
instead of per-token billing. Moving to a hosted API is two lines of `.env`.

---

## 🚀 Setup & run

```bash
cd Backend
python -m venv venv
# Windows: .\venv\Scripts\activate   |   macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # optional; sane defaults without it
python main.py
```

Server: `http://127.0.0.1:8000` — interactive docs at `/docs`, ReDoc at `/redoc`.

## ✅ Tests

```bash
cd Backend
pytest -q                          # full suite: journey, test engine, agent tools
python tests/test_concurrency.py   # prints the two guarantees, for a live demo
```

---

## 📁 Layout

```text
Backend/
├── main.py                    # dev entry point (uvicorn app.main:app)
├── conftest.py                # makes `app` importable from any cwd
├── app/
│   ├── main.py                # every endpoint
│   ├── booking_models.py      # Application (hash-chained ledger), RTO, Tester, Slot, Booking, QueueToken
│   ├── booking_engine.py      # idempotent apply, atomic booking, live queue + ETA
│   ├── models.py              # scenario schema + attempt/scoring (the legal shell)
│   ├── seed_scenarios.py      # scenario bank (40 scenarios, every competency covered)
│   ├── engine.py              # test build / scoring / proctoring
│   └── agent_tools.py         # Model-agnostic function tools + dispatcher
└── tests/
    ├── test_concurrency.py       # the two concurrency guarantees
    ├── test_journey.py           # end-to-end HTTP journey, test engine, agent tools
    └── test_frontend_contract.py # the shape each React screen depends on
```

The offices in `booking_engine.RTO_CATALOGUE` are the same six the UI offers
(three in Maharashtra, three in Bihar) with the same ids, so `form.rto` from the
application wizard is already a valid `rto_id` here — no mapping layer.

---

## 🛣️ The journey — one API call per step

| Method | Path | What it does |
| --- | --- | --- |
| `POST` | `/apply` | Idempotent apply. Same `idempotency_key` → same application, always. |
| `GET` | `/application/{id}` | Transparency ledger. Always readable, never a blank screen. |
| `GET` | `/application/{id}/receipt` | Tamper-evident proof-of-journey (`chain_valid`). |
| `GET` | `/application/by-number/{no}?dob=` | Tracker lookup. The number alone is never enough — a wrong DOB is a 404, not a partial reveal. |
| `GET` | `/citizen/{ref}/application` | Resume without remembering an application id. |
| `GET` | `/rtos?state=` | The offices the UI offers, nearest first. `load` and `wait` are computed from live queue depth. |
| `GET` | `/slots/days?rto_id=` | The bookable date strip, with a real count left per day. |
| `GET` | `/slots/times?rto_id=&on=` | The time strip for one day, grouped across inspectors. |
| `GET` | `/slots` | Raw free slots (`?rto_id=…&on=YYYY-MM-DD`), earliest first. |
| `POST` | `/book` | Atomic hold. `409` if the slot was just taken, or if you already hold one. |
| `POST` | `/checkin/{app_id}` | Issue a live queue token. Safe to call twice. |
| `GET` | `/queue/{token_id}` | Position, assigned inspector, live ETA. |
| `POST` | `/tester/{id}/call-next` | Inspector clears one; everyone's ETA moves. |
| `GET` | `/rto/{id}/board` | Waiting-hall display: every lane, now serving, depth. |

### Scenario test

| Method | Path | What it does |
| --- | --- | --- |
| `POST` | `/test/start` | Begin a 10-question test, balanced across competencies. Six correct to pass. |
| `GET` | `/test/{id}/next` | Next scenario, **answer stripped** and **options permuted** for this attempt. |
| `POST` | `/test/{id}/answer` | Score it, and return the explanation + MV Act reference. |
| `GET` | `/test/{id}/result` | Pass/fail, plus a per-competency breakdown of what to practise. |
| `POST` | `/test/{id}/proctor` | Proctoring subsystem posts events; disqualifying flags void the attempt. |

### Voice agent

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/agent/tools` | Function-tool schema, for a client driving its own model socket. |
| `POST` | `/agent/dispatch` | Execute a tool call that model emitted. |
| `POST` | `/agent/voice/start` | Start a 30-minute server-side Saarthi conversation. |
| `POST` | `/agent/voice/turn` | Send browser-recognised speech to NVIDIA and receive a reply. |
| `POST` | `/agent/voice/confirm` | Execute a pending apply, booking, or check-in only after the citizen confirms. |
| `POST` | `/agent/voice/cancel` | Discard the pending state-changing request. |
| `DELETE` | `/agent/voice/{session_id}` | End the voice conversation. |

The frontend uses `/agent/voice/*`: the key stays in FastAPI, the browser only
does microphone transcription and speech playback, and `apply`, `book_slot` and
`check_in` are held until the citizen presses a visible confirmation button — so
a model retry cannot silently file an application or book an appointment.

`/agent/tools` + `/agent/dispatch` are the alternative for a client that owns
its own model socket: register the schema on the session, then post each
function call here and hand the result back. The schema is model-agnostic, so a
speech-to-speech Realtime session takes it with at most a reshuffle.

---

## 🔒 Design notes

- **Why it is safe at scale.** The idempotency key absorbs the retry-storms
  that overload the current portal. Slot allocation is a single critical
  section — `UNIQUE(slot_id)` + `INSERT … ON CONFLICT` (or `SELECT … FOR
  UPDATE`) in Postgres, a `threading.Lock` in this demo. Both give the same
  guarantee: one winner per slot.
- **Append-only ledger.** Every state transition is a hash-chained row.
  Altering, inserting, or dropping any event breaks every hash after it, so
  `chain_valid` goes false — no clerk can quietly rewrite a journey.
- **State is in-memory** (`_APPS`, `_SLOTS`, `_TOKENS`, `_ATTEMPTS`), with every
  mutating entry point snapshotting to `state.json` on the way out and
  `be.restore()` reloading it at startup — so a restart mid-demo no longer wipes
  the journey. Test attempts are the exception and are not snapshotted. The
  shapes are Pydantic models, so real persistence is a thin layer, not a
  rewrite. `POST /demo/reset` returns to a clean slate.
- **Two identifiers, two levels of protection.** `application_id` is a v4 uuid —
  122 bits, not enumerable — so `GET /application/{id}` treats holding one as
  evidence you were given it. The display number is sequential
  (`SS-2026-004182`, then `…183`), so `GET /application/by-number` demands the
  date of birth as well and a wrong one is a 404, never a partial reveal. A uuid
  as a bearer capability is right for a prototype and is not authentication: in
  production both sit behind the portal's Aadhaar/mobile session.
- **Option order carries no information.** Every scenario in the bank is
  authored with its correct option first, so the served order is permuted per
  attempt (seeded on attempt + scenario, so a refresh does not rearrange the
  answers). Without this, always tapping the top answer passes the test —
  `tests/test_frontend_contract.py` asserts it no longer does.
- **Mock/synthetic data only.** No real Aadhaar, PAN, OTP, or payment anywhere.

## ⚙️ Configuration (`.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` / `PORT` | `127.0.0.1` / `8000` | Bind address. |
| `CORS_ORIGINS` | `*` | Comma-separated origins. Named origins enable credentialed requests; `*` disables them. |
| `NVIDIA_API_KEY` | - | Server-only key for Saarthi. Never expose it to the browser or commit it. |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` | NVIDIA OpenAI-compatible API base URL. |
| `NVIDIA_MODEL` | `openai/gpt-oss-20b` | Model used for Saarthi conversations and tool selection. |
