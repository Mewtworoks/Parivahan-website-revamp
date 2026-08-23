# 🚗 Parivahan-website-revamp

A full-stack repository for the Parivahan Website Revamp project, pre-configured for pair development:
- **Frontend**: React + SCSS (Vite)
- **Backend**: Python (FastAPI / Uvicorn)

---

## 📁 Project Architecture

```text
parivahaan-website-revamp/
├── Frontend/                 # React App (Vite + SCSS)
│   ├── src/
│   │   ├── api.js            # Every backend call the UI makes, in one file
│   │   ├── hooks.js          # usePolling (live queue/board), useElapsed
│   │   ├── App.jsx           # Shell: header, API health indicator, tabs
│   │   ├── components/
│   │   │   ├── JourneyFlow.jsx   # Apply → book → check in → queue → receipt
│   │   │   ├── RtoBoard.jsx      # Inspector desk + waiting-hall display
│   │   │   ├── ScenarioTest.jsx  # The 15-scenario theory test
│   │   │   ├── ScenarioStage.jsx # Renders a scenario as an animated diagram
│   │   │   ├── ProofPanel.jsx    # Runs both guarantees as live experiments
│   │   │   ├── AgentConsole.jsx  # Voice-copilot tools, replayed live
│   │   │   └── ui.jsx            # Badge, Panel, Button, Stat, JsonPeek
│   │   ├── styles/           # Global SCSS Design System
│   │   │   ├── _variables.scss # Shared colors, typography, spacing, shadows
│   │   │   ├── _mixins.scss    # Flexbox, responsive mixins, button styles
│   │   │   └── global.scss     # Master global stylesheet
│   │   └── main.jsx          # React DOM entry point
│   ├── index.html            # Vite HTML template with Google Fonts
│   ├── .env.example          # VITE_API_BASE — where the backend lives
│   ├── package.json          # React dependencies & scripts
│   └── vite.config.js        # Vite build & dev server config
├── Backend/                  # Python Backend API (FastAPI)
│   ├── main.py               # Dev entry point (runs app.main:app)
│   ├── conftest.py           # Makes `app` importable from any cwd
│   ├── app/
│   │   ├── main.py           # All endpoints (journey + scenario test + agent)
│   │   ├── booking_models.py # Application (hash-chained ledger), Slot, Booking, QueueToken
│   │   ├── booking_engine.py # Idempotent apply, atomic booking, live queue + ETA
│   │   ├── models.py         # Scenario schema + attempt/scoring (the legal shell)
│   │   ├── seed_scenarios.py # Scenario bank (19 scenarios, all competencies)
│   │   ├── engine.py         # Test build / scoring / proctoring
│   │   └── agent_tools.py    # OpenAI Realtime function tools + dispatcher
│   ├── tests/
│   │   ├── test_concurrency.py # Proof: 50 retries -> 1 app; 40 threads -> 1 slot winner
│   │   └── test_journey.py     # End-to-end HTTP journey, test engine, agent tools
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
   - Primary colors, background neutrals, font sizes, radii, and shadows are defined centrally.
   - Component styles MUST import `@import './styles/variables';` and avoid arbitrary hardcoded colors.

2. **Shared Mixins (`Frontend/src/styles/_mixins.scss`)**:
   - Reusable layouts, flex helpers, glassmorphism, responsive breakpoints (`@include mobile`, `@include tablet`, `@include desktop`) are centralized to maintain visual consistency across all pages.

---

## 🚀 How to Run the Project Locally

**Start the backend first** — the frontend has no mock data, so every panel
reads live from the API and will show an "unreachable" bar without it.

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

Plus an animated **scenario** test replacing the static MCQ, and a voice
copilot (OpenAI Realtime) wired to the same state through function tools.

---

## 🖥️ What the UI shows

Five tabs at `http://localhost:3000`, all reading live from the API — no mock
data anywhere. See [Frontend/README.md](Frontend/README.md) for detail.

| Tab | What to try |
| --- | --- |
| **My journey** | Submit, then hit *Submit again* — same application id. Book a slot, then try booking it twice. Watch the ETA repoll. |
| **RTO desk** | Press *Call next* here, then switch to **My journey** — the ETA moved without a reload. |
| **Theory test** | 15 animated scenarios, Hindi/English toggle, explanations with MV Act references, per-competency result. |
| **Proof** | Fires 50 identical submits and 40 racing applicants at the live backend and counts what came back. |
| **Voice copilot** | The 9 function tools, plus a Hindi conversation replayed against real state. |

Every panel has a collapsible **raw API response**, so every number on screen
is checkable against the JSON the backend actually returned.

---

## 🤝 GitHub Collaboration Setup

1. **Remote Repository URL**: `https://github.com/Mewtworoks/Parivahan-website-revamp.git`
2. **Push Local Changes**:
   ```bash
   git add .
   git commit -m "feat: setup fullstack repository with React frontend and Python backend"
   git push -u origin main
   ```
3. **Invite Collaborator (Friend)**:
   - Go to GitHub Repository -> **Settings** -> **Collaborators**.
   - Click **Add people** and enter your friend's GitHub username to give them access.
