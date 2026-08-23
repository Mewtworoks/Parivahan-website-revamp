# ⚛️ Frontend — Parivahan LL/DL Journey

React + Vite client for the reimagined Learner/Driving Licence journey. Every
screen here is wired to the FastAPI backend — there is no mock data and no
hardcoded happy path. If the API is down, the header says so.

## 🚀 Run

```bash
cd Frontend
npm install
npm run dev
```

Dev server: `http://localhost:3000`. **Start the backend first** —
`cd Backend && python main.py` — or every panel will show the unreachable bar.

```bash
cp .env.example .env      # only needed if the API is not on 127.0.0.1:8000
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE` | `http://127.0.0.1:8000` | Where the FastAPI backend is listening. |

## 🗂️ Layout

```text
Frontend/src/
├── api.js                    # Every backend call in the app, in one file
├── hooks.js                  # usePolling (the "live" in live queue), useElapsed
├── App.jsx                   # Shell: header, health indicator, tabs
├── components/
│   ├── JourneyFlow.jsx       # Apply → book → check in → queue → receipt
│   ├── RtoBoard.jsx          # Inspector desk + waiting-hall display
│   ├── ScenarioTest.jsx      # The 15-scenario theory test
│   ├── ScenarioStage.jsx     # Renders a scenario as an animated diagram
│   ├── ProofPanel.jsx        # Runs the two guarantees as live experiments
│   ├── AgentConsole.jsx      # The voice copilot's function tools, replayed
│   └── ui.jsx                # Badge, Panel, Button, Stat, JsonPeek, StepRail
└── styles/                   # Shared SCSS design system
```

## 🧭 The five tabs

- **My journey** — the citizen path. Submitting twice proves the retry is safe;
  booking the same slot twice gets refused; the queue ETA repolls every 2.5s;
  the receipt shows the hash chain and its `chain_valid` verdict.
- **RTO desk** — the inspector's *Call next* button and the hall screen. Press
  it here and the ETA in **My journey** moves, live, in the other tab.
- **Theory test** — 15 animated scenarios in Hindi or English. Wrong answers
  explain themselves with the MV Act reference; the result breaks the score
  down per competency so you know what to practise.
- **Proof** — fires 50 identical submits and 40 racing applicants at the live
  backend, then counts what came back.
- **Voice copilot** — the 9 function tools the OpenAI Realtime model drives,
  plus a replay of a Hindi conversation that actually changes backend state.

Every panel has a collapsible **raw API response** — the numbers on screen are
always checkable against the JSON the backend returned.

## 🎨 SCSS rules

- **Variables** (`src/styles/_variables.scss`) — colours, type scale, spacing,
  radii, shadows. Component styles import them; no arbitrary hex values.
- **Mixins** (`src/styles/_mixins.scss`) — `flex-center`, `flex-between`,
  `card-surface`, `glassmorphism`, `btn-primary`, and the `mobile` / `tablet` /
  `desktop` breakpoints.
- Component styles are CSS Modules (`*.module.scss`) importing
  `'../styles/variables'` and `'../styles/mixins'`.

Sass prints `@import` deprecation warnings — the scaffold's existing pattern.
They are warnings, not errors; migrating the whole design system to `@use` is a
separate change.
