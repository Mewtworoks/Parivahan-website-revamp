# 🚗 Parivahan-website-revamp

A redesign of the Learner/Driving Licence journey on Parivahan Sewa.
- **Frontend**: React + TypeScript + SCSS (Vite)
- **Backend**: Python (FastAPI / Uvicorn)

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
│   │   ├── lib/
│   │   │   ├── useApi.ts     # useApi / usePolling / useAction
│   │   │   ├── useOffices.ts # Live offices, with static fallback
│   │   │   ├── format.ts     # Date, time and wait formatting
│   │   │   ├── language.tsx  # t(en, hi?, mr?) + language picker
│   │   │   └── validate.ts   # Field validators
│   │   ├── pages/            # One file per route (see App.tsx PAGES)
│   │   ├── practice/         # Pixel-art practice game (self-contained)
│   │   ├── data/             # Static reference data: fees, classes, documents
│   │   ├── ui/               # Shared components: Note, Pill, Tile, Bar, …
│   │   ├── styles/           # Global SCSS Design System
│   │   │   ├── _variables.scss # Brand colors, spacing scale, radii, shadows
│   │   │   ├── _mixins.scss    # container, buttons, flex, breakpoints
│   │   │   └── global.scss     # Reset and base styles
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
│   ├── app/
│   │   ├── main.py           # All endpoints (journey + scenario test + agent)
│   │   ├── booking_models.py # Application (hash-chained ledger), Slot, Booking, QueueToken
│   │   ├── booking_engine.py # Idempotent apply, atomic booking, live queue + ETA
│   │   ├── models.py         # Scenario schema + attempt/scoring (the legal shell)
│   │   ├── seed_scenarios.py # Scenario bank (40 scenarios, all competencies)
│   │   ├── engine.py         # Test build / scoring / proctoring / option shuffle
│   │   ├── agent_tools.py    # Model-agnostic function tools + dispatcher
│   │   └── voice_agent.py    # Saarthi: server-side turns, confirm gate, rate limits
│   ├── tests/
│   │   ├── test_concurrency.py       # Proof: 50 retries -> 1 app; 40 threads -> 1 winner
│   │   ├── test_journey.py           # End-to-end HTTP journey, test engine, agent tools
│   │   └── test_frontend_contract.py # The shape each React screen depends on
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

### 3️⃣ Verify the backend guarantees
```bash
cd Backend
pytest -q                          # full suite
python tests/test_concurrency.py   # prints the concurrency proof, for a live demo
```

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

Plus a scenario-based theory test replacing the static MCQ, and **Saarthi**, a
Hindi-first voice copilot wired to the same state through function tools — so it
acts on the real journey rather than describing it.

Saarthi runs **OpenAI's `gpt-oss-20b`**, an open-weight model, served over
NVIDIA NIM's OpenAI-compatible endpoint. Open weights are the point for a
government deployment: the same agent can run on hardware inside the country, no
citizen utterance has to leave it, and the cost per district is compute rather
than per-token billing. The key never reaches the browser, and `apply`,
`book_slot` and `check_in` are held behind a visible confirmation button, so a
model retry cannot silently file an application or book an appointment.

---

## 🔗 Where the two halves meet

| Screen | What became real |
| --- | --- |
| **Apply · office picker** | "Light day / Busy" and the waiting time are read from each office's live queues. |
| **Apply · submit** | Issues the real application number. One idempotency key per attempt, so a dropped connection and a second press cannot create two applications. |
| **Slip / Receipt** | The number, date and sealed journey record the service returned — including whether that record still verifies. |
| **Slot** | Real remaining capacity per day and per time. Confirming holds the slot; losing a race says so and reloads what is free. |
| **Status** | Lookup needs the number **and** the date of birth. Shows the service's own ledger, and on the day a token, a named inspector and a wait that repolls. |
| **Theory test** | Ten questions, six to pass, scored server-side. The answer never reaches the browser, and options are permuted per attempt. |

Deliberately left as UI-only, because they hold no server state: eligibility,
checklist, fees, Form 1, e-sign, payment, and the practice game.

The six RTO offices are defined once, in `Backend/app/booking_engine.py`, with
the same ids the application wizard uses — so `form.rto` is already a valids
`rto_id` and there is no mapping layer to drift.

---


