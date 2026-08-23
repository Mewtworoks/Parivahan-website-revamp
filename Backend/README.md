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
test — judgment over memorization — and a voice copilot (OpenAI Realtime)
drives the same backend through function tools, so it can act, not just chat.

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
│   ├── seed_scenarios.py      # scenario bank (19 scenarios, every competency covered)
│   ├── engine.py              # test build / scoring / proctoring
│   └── agent_tools.py         # OpenAI Realtime function tools + dispatcher
└── tests/
    ├── test_concurrency.py    # the two concurrency guarantees
    └── test_journey.py        # end-to-end HTTP journey, test engine, agent tools
```

---

## 🛣️ The journey — one API call per step

| Method | Path | What it does |
| --- | --- | --- |
| `POST` | `/apply` | Idempotent apply. Same `idempotency_key` → same application, always. |
| `GET` | `/application/{id}` | Transparency ledger. Always readable, never a blank screen. |
| `GET` | `/application/{id}/receipt` | Tamper-evident proof-of-journey (`chain_valid`). |
| `GET` | `/citizen/{ref}/application` | Resume without remembering an application id. |
| `GET` | `/slots` | Free fixed time-slots (`?rto_id=…&on=YYYY-MM-DD`), earliest first. |
| `POST` | `/book` | Atomic hold. `409` if the slot was just taken, or if you already hold one. |
| `POST` | `/checkin/{app_id}` | Issue a live queue token. Safe to call twice. |
| `GET` | `/queue/{token_id}` | Position, assigned inspector, live ETA. |
| `POST` | `/tester/{id}/call-next` | Inspector clears one; everyone's ETA moves. |
| `GET` | `/rto/{id}/board` | Waiting-hall display: every lane, now serving, depth. |

### Scenario test

| Method | Path | What it does |
| --- | --- | --- |
| `POST` | `/test/start` | Begin a 15-scenario test, balanced across competencies. |
| `GET` | `/test/{id}/next` | Next scenario, **answer stripped**. |
| `POST` | `/test/{id}/answer` | Score it, and return the explanation + MV Act reference. |
| `GET` | `/test/{id}/result` | Pass/fail, plus a per-competency breakdown of what to practise. |
| `POST` | `/test/{id}/proctor` | Proctoring subsystem posts events; disqualifying flags void the attempt. |

### Voice agent

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/agent/tools` | Function-tool schema to register on `session.update`. |
| `POST` | `/agent/dispatch` | Execute a tool call the Realtime model emitted. |

Wiring: `GET /agent/tools` → add to the Realtime session's `tools` → on a
`function_call`, `POST /agent/dispatch {tool, arguments}` and hand the result
back to the model. The backend never holds the socket; the client owns the key.

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
- **State is in-memory** (`_APPS`, `_SLOTS`, `_TOKENS`, `_ATTEMPTS`). Restarting
  clears it. The shapes are already Pydantic models, so persistence is a thin
  layer, not a rewrite.
- **Mock/synthetic data only.** No real Aadhaar, PAN, OTP, or payment anywhere.

## ⚙️ Configuration (`.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` / `PORT` | `127.0.0.1` / `8000` | Bind address. |
| `CORS_ORIGINS` | `*` | Comma-separated origins. Named origins enable credentialed requests; `*` disables them. |
| `OPENAI_API_KEY` | — | Used by the client that opens the Realtime session. |
