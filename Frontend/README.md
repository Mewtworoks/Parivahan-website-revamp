# Frontend - Parivahan Website Revamp

Frontend client-side code and UI components. React + TypeScript + Vite, wired
to the FastAPI service in `../Backend`.

## Run

```bash
cd Frontend
npm install
npm run dev          # http://localhost:3000
```

**Start the backend first** (`cd Backend && python main.py`). Pages read live
state, so without it the office picker falls back to an indicative list and
submitting says so instead of pretending to succeed.

```bash
cp .env.example .env   # only if the API is not on 127.0.0.1:8000
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE` | `http://127.0.0.1:8000` | Where the licence service is listening. |

## What talks to the backend

All API calls go through `src/api.ts`, so the surface the UI depends on is
readable in one file. The form being filled in stays in React state; anything
the citizen must be able to quote later is created by the service and only
referenced here by id (`AppState.applicationId`, `.tokenId`, `.attemptId`).

| Screen | Endpoint | What became real |
| --- | --- | --- |
| Apply · step 1 | `GET /rtos` | Office load and waiting time are read from each office's live queues, not a fixture. Falls back to the static list if the service is down. |
| Apply · submit | `POST /apply` | Issues the real application number. Carries one idempotency key per attempt, so a dropped connection and a second press cannot create two applications. |
| Slip | — | Prints the number and date the service returned. |
| Receipt | `GET /application/{id}/receipt` | Shows the sealed journey record and whether it still verifies. |
| Slot | `GET /slots/days`, `GET /slots/times`, `POST /book` | Real remaining capacity per day and per time. Confirming holds the slot; losing a race says so and reloads what is free. |
| Status | `GET /application/by-number`, `GET /application/{id}`, `POST /checkin`, `GET /queue` | Lookup needs number **and** date of birth. Shows the service's own ledger, and on the day a token, a named inspector and a wait that repolls. |
| Test | `POST /test/start`, `GET /test/{id}/next`, `POST /test/{id}/answer`, `GET /test/{id}/result` | Ten questions, six to pass, scored on the server. The correct answer is never sent to the browser, options are permuted per attempt, and a fail names the competencies to practise. |

Not wired, deliberately: eligibility, checklist, fees, Form 1, e-sign, payment
and the practice game are self-contained in the UI and have no server state to
hold. `Pay.tsx` remains a mock gateway.

## Layout

```text
src/
├── api.ts                    # Every backend call, typed
├── lib/
│   ├── useApi.ts             # useApi / usePolling / useAction
│   ├── useOffices.ts         # Live offices, with static fallback
│   ├── format.ts             # Date, time and wait formatting
│   ├── language.tsx          # t(en, hi?, mr?) + the language picker
│   ├── validate.ts           # Field validators
│   └── scrollToTop.ts
├── pages/                    # One file per route (see App.tsx PAGES)
├── practice/                 # The pixel-art practice game (self-contained)
├── data/                     # Static reference data: fees, classes, documents
├── ui/                       # Shared components: Note, Pill, Tile, Bar, …
└── styles/                   # SCSS design system
```

## SCSS Architecture
- `src/styles/_variables.scss`: Brand colours, spacing scale, radii, shadows.
- `src/styles/_mixins.scss`: Reusable mixins (container, buttons, flex, breakpoints).
- `src/styles/global.scss`: Reset and base styles.
- `src/parivahan_extracted.css`: The bulk of the component styling.

`_variables.scss` must stay in step with `_mixins.scss` and `global.scss` —
those two consume its tokens (`$color-bg-page`, `$sp-6`, `$container-max-width`),
and a missing token fails the build rather than degrading.

## Language

`t('English', 'हिंदी', 'मराठी')` — Marathi is optional and falls back to
English, so a string can ship with two translations and be completed later.
Strings added for the backend wiring carry English and Hindi.
