# 🚗 Parivahan-website-revamp

A redesign of the Learner/Driving Licence journey on Parivahan Sewa.
- **Frontend**: React + TypeScript + SCSS (Vite)
- **Backend**: Python (FastAPI / Uvicorn / SQLAlchemy Core / SQLite)

The two halves are wired together: the UI holds the form you are filling in,
the service holds the journey. Nothing on a screen is a fixture pretending to
be live.

---

## 📁 Project Architecture

```text
parivahaan-website-revamp/
├── Frontend/                 # React + TypeScript App (Vite + SCSS)
│   ├── src/
│   │   ├── api.ts            # Every backend call the UI makes, typed
│   │   ├── types.ts          # Route union + the shared PageProps shape
│   │   ├── lib/
│   │   │   ├── useApi.ts     # useApi / usePolling / useAction
│   │   │   ├── useOffices.ts # Live offices, with static fallback
│   │   │   ├── identity.ts   # Who is signed in — one citizen_ref for the site
│   │   │   ├── journeyStore.ts # The journey that survives a reload
│   │   │   ├── conversation.ts # Saarthi's transcript, kept across panel opens
│   │   │   ├── format.ts     # Date, time and wait formatting
│   │   │   ├── language.tsx  # t(en, hi?, mr?) + language picker
│   │   │   └── validate.ts   # Field validators
│   │   ├── pages/            # One file per route (see App.tsx PAGES)
│   │   │   ├── apply/        # The wizard: Apply, steps, Captcha
│   │   │   └── dl/           # DL journey, parked
│   │   ├── components/
│   │   │   └── VoiceAgent.tsx # Saarthi's panel: mic, transcript, confirm button
│   │   ├── practice/         # Pixel-art practice game (self-contained)
│   │   ├── data/             # Static reference data: fees, classes, documents
│   │   ├── ui/               # Shared components: Note, Pill, SignIn, Icon, …
│   │   ├── styles/           # Global SCSS Design System
│   │   │   ├── _variables.scss # Brand colors, spacing scale, radii, shadows
│   │   │   ├── _mixins.scss    # container, buttons, flex, breakpoints
│   │   │   └── global.scss     # Reset and base styles
│   │   ├── parivahan_extracted.css # The bulk of the component styling
│   │   ├── App.tsx           # Shell: top bar, active page, footer, sheets
│   │   └── main.tsx          # React DOM entry point
│   ├── index.html            # Vite HTML template with Google Fonts
│   ├── .env.example          # VITE_API_BASE — where the backend lives
│   ├── package.json          # React dependencies & scripts
│   ├── tsconfig.json         # TypeScript config
│   └── vite.config.ts        # Vite build & dev server config
├── Backend/                  # Python Backend API (FastAPI)
│   ├── main.py               # Dev entry point (runs app.main:app)
│   ├── conftest.py           # Makes `app` importable from any cwd
│   ├── pytest.ini            # Markers, including `slow` for the subprocess tests
│   ├── app/
│   │   ├── main.py           # All endpoints (journey + test + agent + proof)
│   │   ├── db.py             # Schema, connections, transactions — the store
│   │   ├── booking_models.py # Application (hash-chained ledger), Slot, Booking, QueueToken
│   │   ├── booking_engine.py # Idempotent apply, atomic booking, live queue + ETA
│   │   ├── models.py         # Scenario schema + attempt/scoring (the legal shell)
│   │   ├── seed_scenarios.py # Scenario bank (40 scenarios, all competencies)
│   │   ├── engine.py         # Test build / scoring / proctoring / option shuffle
│   │   ├── identity.py       # Stand-in sign-in: one citizen_ref for the whole site
│   │   ├── agent_tools.py    # Function tools, dispatcher, and the answer parsers
│   │   ├── voice_agent.py    # Saarthi: the form spine, confirm gate, rate limits
│   │   ├── drafts.py         # The half-filled form, per citizen
│   │   ├── conversations.py  # Transcripts + the action awaiting confirmation
│   │   ├── signals.py        # Anonymous failure log (HMAC, allowlisted)
│   │   └── proofs.py         # The three guarantees, made to fail on demand
│   ├── tests/
│   │   ├── test_concurrency.py       # 50 retries -> 1 app; 40 threads -> 1 winner
│   │   ├── test_persistence.py       # Six real interpreters race one slot
│   │   ├── test_journey.py           # End-to-end HTTP journey, test engine, tools
│   │   ├── test_frontend_contract.py # The shape each React screen depends on
│   │   ├── test_voice_agent.py       # Saarthi's guards, replayed from real failures
│   │   ├── test_fast_form.py         # The apply journey with the model unplugged
│   │   ├── test_resume.py            # A backend restart does not end a conversation
│   │   ├── test_identity.py          # Sign-in codes
│   │   ├── test_signals.py           # The allowlist actually drops what it must
│   │   └── test_proofs.py            # The proofs run against the real engine
│   ├── requirements.txt      # Python dependencies (fastapi, uvicorn, etc.)
│   ├── .env.example          # Environment variables template
│   └── README.md             # Backend setup guide + full API reference
├── .gitignore                # Optimized Git ignore for Node & Python
├── .gitattributes            # Line ending normalization across OS
└── README.md                 # Main documentation
```

---

## 🎨 SCSS Design System Rules

1. **Centralized Variables (`Frontend/src/styles/_variables.scss`)**:
   - Brand colors, spacing scale, radii and shadows are defined centrally.
   - Component styles pull them in with `@use '…/variables' as *;` and avoid arbitrary hardcoded colors.

2. **Shared Mixins (`Frontend/src/styles/_mixins.scss`)**:
   - Reusable layouts, `container`, button styles and responsive breakpoints (`@include mobile`, `@include tablet`) are centralized to maintain visual consistency across all pages.

3. **Keep the three files in step.** `_mixins.scss` and `global.scss` consume
   tokens from `_variables.scss` (`$color-bg-page`, `$sp-6`, `$container-max-width`).
   A token that goes missing fails the build rather than degrading quietly.

---

## 🚀 How to Run the Project Locally

**Start the backend first.** The UI reads live state, so without it the office
picker falls back to an indicative list and submitting tells you so rather than
pretending to succeed.

### 1️⃣ Run Backend (Python)
```bash
cd Backend
python -m venv venv
# Activate virtual environment (Windows: .\venv\Scripts\activate | Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
python main.py
```
*Backend API will run at `http://127.0.0.1:8000` with interactive docs at `http://127.0.0.1:8000/docs`.*

### 2️⃣ Run Frontend (React)
```bash
cd Frontend
npm install
npm run dev
```
*Frontend dev server will launch at `http://localhost:3000`.*
Override the API location with `VITE_API_BASE` in `Frontend/.env` if the backend is elsewhere.

`CORS_ORIGINS` in `Backend/.env` lists the ports the dev server actually uses.
Previewing on a port that is not in that list fails with a CORS error that
looks exactly like the backend being down.

### 3️⃣ Verify the backend guarantees
```bash
cd Backend
python -m pytest -q                 # full suite — 160 tests
python -m pytest -q -m "not slow"   # skip the ones that spawn real interpreters
python tests/test_concurrency.py    # prints the concurrency proof, for a live demo
```

Or open **`#/proof`** in the running site and press the buttons: the same three
guarantees, run against the live engine, printed on screen.

---

## 🧭 What the backend does

Three failures of the current Parivahan LL/DL journey, three fixes — each one
demonstrated by a test, not just claimed. See [Backend/README.md](Backend/README.md)
for the full API reference.

| Real failure | Fix | Proof |
| --- | --- | --- |
| Silent failures, duplicate submits on a flaky network | `POST /apply` idempotent on a client key | 50 retries → 1 application |
| "Come in the morning" and wait all day | Fixed slot grid, atomically allocated | 40 racing threads → 1 winner |
| Pile-ups with no information | Live queue token: number, inspector, recomputed ETA | `/queue/{token}` + `/rto/{id}/board` |
| No proof a pass was recorded honestly | Hash-chained journey ledger | tampering flips `chain_valid` false |

**Those guarantees are schema constraints, not conventions.** State lives in
SQLite (`Backend/state.db`, WAL mode), and each claim is a `UNIQUE` or a
composite primary key, so no code path — and no second process — can route
around one. This used to be a `threading.Lock`, which held for one worker and
was silently nothing for two; `tests/test_persistence.py` now races six real
interpreters at a single slot and expects exactly one winner. Nothing uses
SQLite-only syntax: point `DATABASE_URL` at MySQL or Postgres and the same
tables and statements run.

Plus a scenario-based theory test replacing the static MCQ, and **Saarthi**, a
Hindi-first voice copilot wired to the same state through function tools — so it
acts on the real journey rather than describing it.

---

## 🗣️ Saarthi — what the model decides, and what it does not

Saarthi runs **OpenAI's `gpt-oss-20b`**, an open-weight model, served over
NVIDIA NIM's OpenAI-compatible endpoint. Open weights are the point for a
government deployment: the same agent can run on hardware inside the country, no
citizen utterance has to leave it, and the cost per district is compute rather
than per-token billing.

**The model does not drive the form.** That is a design decision taken after
watching it fail, twice. Told a name and nothing else, it answered *"which day
would you like to book your test slot?"* — three answers short of a filled form.
A second run went further and said *"your application is ready"* with nothing
filed. Every guard built before then gated **tool calls**, and in both
conversations the model called no tools at all. It simply talked, and nothing
checked whether what it said matched the state the service knew it was in.

So the service stops asking and starts speaking. **A turn whose answer is
already in the database is answered without any upstream call:**

| Spoken by the service | Spoken by the model |
| --- | --- |
| the four form questions, and the confirmation sentence | explanations, the law, fees |
| the result after Confirm, disclosure included | corrections and objections it cannot parse |
| the day list, and the times on one day | *"next Thursday, some time after lunch"* |
| application number, status, *"is my form filled"*, *"when is my test"* | anything off script |
| the opening line, rebuilt from the record | |

Three things follow from that, and they are the interesting ones:

- **The apply journey costs zero model calls.** It went from six or seven
  round-trips at 8–55 s each to sub-second, and it works with `NVIDIA_API_KEY`
  unset — `tests/test_fast_form.py` asserts exactly that, by making the upstream
  call raise.
- **A backend restart no longer ends a conversation.** The half-filled form and
  the transcript are rows, not dict entries, so closing the tab and coming back
  is greeted with *"we got as far as your date of birth — shall we carry on?"*
- **A parser that is unsure hands the turn to the model** rather than storing a
  guess. A wrong date of birth locks somebody out of their own application at
  the tracker, so `read_answer` returning `None` is the correct outcome, not a
  gap to close.

`apply`, `book_slot` and `check_in` are held behind a visible confirmation
button, so a model retry cannot silently file an application or book an
appointment. The key never reaches the browser.

---

## 🔗 Where the two halves meet

| Screen | What became real |
| --- | --- |
| **Sign in** | One `citizen_ref` for the whole site. The wizard and Saarthi file under the same identity, so the agent can find the form you just filled in. |
| **Apply · office picker** | "Light day / Busy" and the waiting time are read from each office's live queues. |
| **Apply · submit** | Issues the real application number. One idempotency key per attempt, so a dropped connection and a second press cannot create two applications. |
| **Slip / Receipt** | The number, date and sealed journey record the service returned — including whether that record still verifies. |
| **Slot** | Real remaining capacity per day and per time. Confirming holds the slot; losing a race says so and reloads what is free. |
| **Status** | Signed in, it opens on your own application. Otherwise lookup needs the number **and** the date of birth. Shows the service's own ledger, and on the day a token, a named inspector and a wait that repolls. |
| **Theory test** | Ten questions, six to pass, scored server-side. The answer never reaches the browser, and options are permuted per attempt. |
| **Saarthi** | Fills the form, files it and books the slot against the live journey — not a chat about one. |
| **Inspector desk** (`#/desk`) | The other side of the counter. Call the next token here and the wait on the citizen's tracker moves. |
| **Proof** (`#/proof`) | The three guarantees made to fail on demand, against the real engine. No mocks, no narration written ahead of time. |

Deliberately left as UI-only, because they hold no server state: eligibility,
checklist, fees, Form 1, e-sign, payment, and the practice game.

The six RTO offices — three in Maharashtra, three in Bihar — are defined once,
in `Backend/app/booking_engine.py`, with the same ids the application wizard
uses. So `form.rto` is already a valid `rto_id` and there is no mapping layer to
drift.

---

## 🔒 Mock data only

No real Aadhaar, PAN, OTP or payment anywhere in this repository. Aadhaar
`999999999999` is the reserved test value. Nothing here touches a live
government system, and sign-in verifies nothing — it returns the code in the
response body, which is deliberate and is why it is called a stand-in.
