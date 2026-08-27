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
python -m pytest -q                 # full suite — 160 tests
python -m pytest -q -m "not slow"   # skip the ones that spawn real interpreters
python tests/test_concurrency.py    # prints the two guarantees, for a live demo
```

---

## 📁 Layout

```text
Backend/
├── main.py                    # dev entry point (uvicorn app.main:app)
├── conftest.py                # makes `app` importable from any cwd
├── pytest.ini                 # markers, including `slow`
├── app/
│   ├── main.py                # every endpoint
│   ├── db.py                  # schema, connections, transactions — the store
│   ├── booking_models.py      # Application (hash-chained ledger), RTO, Tester, Slot, Booking, QueueToken
│   ├── booking_engine.py      # idempotent apply, atomic booking, live queue + ETA
│   ├── models.py              # scenario schema + attempt/scoring (the legal shell)
│   ├── seed_scenarios.py      # scenario bank (40 scenarios, every competency covered)
│   ├── engine.py              # test build / scoring / proctoring
│   ├── identity.py            # stand-in sign-in — one citizen_ref for the site
│   ├── agent_tools.py         # function tools, dispatcher, and the answer parsers
│   ├── voice_agent.py         # Saarthi: the form spine, confirm gate, rate limits
│   ├── drafts.py              # the half-filled form, per citizen
│   ├── conversations.py       # transcripts + the action awaiting confirmation
│   ├── signals.py             # anonymous failure log (HMAC, allowlisted)
│   └── proofs.py              # the three guarantees, made to fail on demand
└── tests/
    ├── test_concurrency.py       # the two concurrency guarantees, in threads
    ├── test_persistence.py       # six real interpreters race one slot  [slow]
    ├── test_journey.py           # end-to-end HTTP journey, test engine, agent tools
    ├── test_frontend_contract.py # the shape each React screen depends on
    ├── test_voice_agent.py       # Saarthi's guards, replayed from real failures
    ├── test_fast_form.py         # the apply journey with the model unplugged
    ├── test_resume.py            # a backend restart does not end a conversation
    ├── test_identity.py          # sign-in codes
    ├── test_signals.py           # the allowlist drops what it must
    └── test_proofs.py            # the proofs run against the real engine
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

### Sign-in

| Method | Path | What it does |
| --- | --- | --- |
| `POST` | `/identity/request-code` | Issue a sign-in code — **and return it in the body**, because nothing here sends an SMS. |
| `POST` | `/identity/verify` | Exchange the code for the `citizen_ref` everything downstream is keyed on. |

`request-code` answers `delivered: false` with a note saying why, so a client
cannot present this as a real one-time password without ignoring the field that
tells it not to. See the design note below for what this is actually for.

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
| `POST` | `/agent/voice/start` | Open a Saarthi conversation, **resuming one already in progress**. Returns the opening line and whether it resumed. |
| `POST` | `/agent/voice/turn` | One turn. Answered from the record where possible, from the model where not. |
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

### Proofs and demo control

| Method | Path | What it does |
| --- | --- | --- |
| `POST` | `/proof/idempotent-apply` | Submit the same application twice, as a dropped connection does. |
| `POST` | `/proof/slot-race?contenders=8` | Genuine simultaneous bookings at one slot. Exactly one may win. |
| `POST` | `/proof/ledger-tamper` | Edit a recorded event and show the receipt reporting it. |
| `POST` | `/demo/reset` | Back to a clean slate: no applications, no bookings, an empty queue. |
| `GET` | `/` · `/api/health` | Liveness, scenario-bank size, the office ids currently seeded. |

Every proof runs against the real engine — same code path as a live request, no
mocks. Each uses a throwaway citizen reference and books into a far-future date,
so a demonstration never consumes a slot or an application number the
walkthrough is about to need. `#/proof` in the UI is these four buttons.

---

## 🗣️ Saarthi — the model does not drive the form

Saarthi runs **OpenAI's `gpt-oss-20b`**, an open-weight model, served over
NVIDIA NIM's OpenAI-compatible endpoint. Open weights are the point rather than
a compromise: the same agent can run on hardware inside the country, so no
citizen utterance has to leave it, and the marginal cost per district is compute
instead of per-token billing. Moving to a hosted API is two lines of `.env`.

**What the model is not allowed to decide is the more important half.** Two
recorded conversations failed the same way: told a name and nothing else,
Saarthi answered *"which day would you like to book your test slot?"* — three
answers short of a filled form. The next run said *"your application is ready"*
with nothing filed, then refused to say the number it had just invented. Every
guard built before then gated **tool calls**, and in both conversations the
model called no tools at all. It simply talked.

So a turn whose answer is already in the database is answered without an
upstream call, in `_fast_reply`:

| Spoken by the service | Spoken by the model |
| --- | --- |
| the four form questions, and the confirmation sentence | explanations, the law, fees |
| the result after Confirm, disclosure included | corrections and objections it cannot parse |
| the day list, and the times on one day | *"next Thursday, some time after lunch"* |
| application number, status, *"is my form filled"*, *"when is my test"* | anything off script |
| the opening line, rebuilt from the record | |

Consequences worth knowing before changing any of it:

- **The apply journey costs zero model calls** and works with `NVIDIA_API_KEY`
  unset. `tests/test_fast_form.py` asserts it by making the upstream call raise.
  It replaced six or seven round-trips at 8–55 s each.
- **`read_answer(field, text, prompted)` returns `None` when unsure**, and the
  turn goes to the model. Never widen it into a guess — a wrong date of birth
  locks somebody out of their own application at the tracker. `prompted` gates
  the name only: any two words look like a name, and *"puri prakriya
  samjhaiye"* was briefly stored as one.
- **`_guard_reply` discards a model reply that claims an application exists, or
  offers to book, while the form is unfilled.** It is a last line, not the
  mechanism. Keep it narrow — a version that fired on the word "slot" ate the
  honest answer to *"what is the whole process?"*, and one that fired on
  *"what … date …?"* discarded the service's own question.
- **Hindi is not an afterthought in the parsers.** Devanagari months and digits,
  city names in both scripts. *"11 अप्रैल 2008"* failing to parse meant the date
  fell to the model, was never stored, and got asked for again — a loop, in the
  language most of the users speak.
- **A restart does not end a conversation.** The draft, the transcript and the
  pending action are rows, not dict entries. `tests/test_resume.py` proves it by
  clearing `_SESSIONS` mid-journey. Rate-limit buckets stay in memory, because
  they are correctly ephemeral.

---

## 🔒 Design notes

- **The guarantees are constraints, not conventions.** Each one is enforced by
  the schema, so no code path — and no second process — can route around it:
  `UNIQUE(idempotency_key)` on applications, `UNIQUE(slot_id)` and
  `UNIQUE(application_id)` on bookings, and a composite primary key on the
  insert-only ledger. Booking claims its slot with a conditional
  `UPDATE … WHERE booked_by IS NULL` and checks the row count, so the winner is
  decided by what actually changed rather than by a check that has since gone
  stale. This used to be a `threading.Lock`, which held for one worker and was
  silently false for two; `tests/test_persistence.py` now races six real
  interpreters at one slot and expects exactly one winner.
- **Append-only ledger.** Every state transition is a hash-chained row.
  Altering, inserting, or dropping any event breaks every hash after it, so
  `chain_valid` goes false — no clerk can quietly rewrite a journey. The engine
  only ever inserts, and the primary key refuses a second event at a position
  that already exists.
- **State is SQLite** (`Backend/state.db`, WAL mode), opened on first use and
  written inside a `BEGIN IMMEDIATE` transaction per mutation — so a restart
  mid-demo resumes rather than wiping the journey, and two workers see one set
  of facts. Test attempts are the exception and stay in memory. Nothing uses
  SQLite-only syntax: set `DATABASE_URL` to a MySQL or Postgres URL and the same
  tables and statements run unchanged. `POST /demo/reset` returns to a clean
  slate.
- **Adding a column is handled; `create_all` alone is not.** `create_all` will
  create a missing table but will not alter an existing one, so a new column
  shipped to a running database gave `no such column` on every request.
  `db._add_missing_columns()` runs after it and adds nullable columns
  one at a time; a non-nullable addition is logged as needing a real migration
  rather than half-applied.
- **Two identifiers, two levels of protection.** `application_id` is a v4 uuid —
  122 bits, not enumerable — so `GET /application/{id}` treats holding one as
  evidence you were given it. The display number is sequential
  (`SS-2026-004182`, then `…183`), so `GET /application/by-number` demands the
  date of birth as well and a wrong one is a 404, never a partial reveal. A uuid
  as a bearer capability is right for a prototype and is not authentication: in
  production both sit behind the portal's Aadhaar/mobile session.
- **`identity.py` is a label, not a login.** It returns the code in the response
  body; anyone who can ask for one can use it. It exists because the journey
  needs *one* identity — the wizard used to file under the phone number typed at
  stage two while Saarthi invented `saarthi-demo-<random>` each time its panel
  opened, so the agent could not find the application you had just filled in.
  Everything downstream keys off `citizen_ref`, so swapping in the real
  Aadhaar/mobile session touches this file and nothing else.
- **`signals` is anonymous by construction.** The reference stored is an HMAC of
  `citizen_ref` under `SECRET_KEY`, not a digest: a plain `sha256` of a
  ten-digit phone number is brute-forced in seconds by anyone holding the table,
  which is not anonymisation. An allowlist per kind means a caller cannot widen
  what gets stored, and a test asserts the drop. There is deliberately no
  foreign key from that table to anything.
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
| `CORS_ORIGINS` | `*` | Comma-separated origins. Named origins enable credentialed requests; `*` disables them. A dev server on a port that is not listed fails with a CORS error that looks like the backend being down. |
| `DATABASE_URL` | – | Full SQLAlchemy URL. Set it and it wins outright — this is the MySQL/Postgres switch. |
| `STATE_FILE` | `state.db` beside the app | Where the SQLite file lives, when `DATABASE_URL` is unset. `":memory:"` means a private temp file deleted at exit, **not** SQLite's in-memory database — a real one cannot be shared between connections, and sharing one connection across threads would put the serialisation back inside the process. |
| `SECRET_KEY` | – | HMAC key for the anonymous `signals` reference. Without it the reference is not unguessable. |
| `NVIDIA_API_KEY` | – | Server-only key for Saarthi. Never expose it to the browser or commit it. The apply journey works without it. |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` | NVIDIA OpenAI-compatible API base URL. |
| `NVIDIA_MODEL` | `openai/gpt-oss-20b` | Model used for Saarthi conversations and tool selection. |
