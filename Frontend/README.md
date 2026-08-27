# Frontend - Parivahan Website Revamp

Frontend client-side code and UI components. React + TypeScript + Vite, wired
to the FastAPI service in `../Backend`.

## Run

```bash
cd Frontend
npm install
npm run dev          # http://localhost:3000
npm run build        # tsc -b must stay clean — this is the real check
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

The backend's `CORS_ORIGINS` has to list whatever port you preview on. A port
that is missing from it fails with a CORS error that looks exactly like the
backend being down.

## What talks to the backend

All API calls go through `src/api.ts`, so the surface the UI depends on is
readable in one file. The form being filled in stays in React state; anything
the citizen must be able to quote later is created by the service and only
referenced here by id (`AppState.applicationId`, `.tokenId`, `.attemptId`).

| Screen | Endpoint | What became real |
| --- | --- | --- |
| Sign in (`ui/SignIn.tsx`) | `POST /identity/request-code`, `/identity/verify` | One `citizen_ref` for the whole site, held in `lib/identity.ts`. The wizard and Saarthi file under the same identity, so the agent can find the form you just filled in. It verifies nothing — the code comes back in the response body, deliberately. |
| Apply · step 1 | `GET /rtos` | Office load and waiting time are read from each office's live queues, not a fixture. Falls back to the static list if the service is down. |
| Apply · submit | `POST /apply` | Issues the real application number. Carries one idempotency key per attempt, so a dropped connection and a second press cannot create two applications. |
| Slip | — | Prints the number and date the service returned. |
| Receipt | `GET /application/{id}/receipt` | Shows the sealed journey record and whether it still verifies. |
| Slot | `GET /slots/days`, `GET /slots/times`, `POST /book` | Real remaining capacity per day and per time. Confirming holds the slot; losing a race says so and reloads what is free. |
| Status | `GET /citizen/{ref}/application`, `GET /application/by-number`, `GET /application/{id}`, `POST /checkin`, `GET /queue` | Signed in, it opens straight on your own application. Otherwise lookup needs number **and** date of birth. Shows the service's own ledger, and on the day a token, a named inspector and a wait that repolls. |
| Test | `POST /test/start`, `GET /test/{id}/next`, `POST /test/{id}/answer`, `GET /test/{id}/result` | Ten questions, six to pass, scored on the server. The correct answer is never sent to the browser, options are permuted per attempt, and a fail names the competencies to practise. |
| Saarthi (`components/VoiceAgent.tsx`) | `POST /agent/voice/*` | Browser speech recognition and playback over a server-side agent. Apply, booking and check-in require an on-screen confirmation. |
| Desk (`#/desk`) | `GET /rto/{id}/board`, `POST /tester/{id}/call-next` | The inspector's side of the counter. Call the next token here and the wait on the citizen's tracker moves — until this existed, nothing could make the queue advance. |
| Proof (`#/proof`) | `POST /proof/*`, `POST /demo/reset` | The three guarantees made to fail on demand, against the real engine, printed on screen. |

Not wired, deliberately: eligibility, checklist, fees, Form 1, e-sign, payment
and the practice game are self-contained in the UI and have no server state to
hold. `Pay.tsx` remains a mock gateway.

## Routing

Hash routes (`#/route`) driven by `pushState` plus `popstate`/`hashchange`, with
the map in `App.tsx`'s `PAGES`. A hash that is not in `PAGES` falls back to home
rather than being cast, because the address bar is user-editable.

Only `apply` demands sign-in. Everything before it — checking whether you
qualify, playing the practice road — is worth doing before you have decided to
apply at all, and demanding a number first turns a two-minute look into a
sign-up. The stages after it are self-gating: they need an application, and
there is no way to have one without passing through the wizard. Saarthi is the
other gated surface, for the same reason and not by route: it fills that form on
the citizen's behalf, so it has to know whose.

Adding anything to the top bar wraps the wordmark, which is why the desk and
proof links live on the home page and in the footer instead.

## Layout

```text
src/
├── api.ts                    # Every backend call, typed
├── types.ts                  # Route union + the shared PageProps shape
├── App.tsx                   # Shell: top bar, active page, footer, sheets
├── parivahan_extracted.css   # The bulk of the component styling
├── lib/
│   ├── useApi.ts             # useApi / usePolling / useAction
│   ├── useOffices.ts         # Live offices, with static fallback
│   ├── identity.ts           # Who is signed in — the citizen_ref
│   ├── journeyStore.ts       # The journey that survives a reload
│   ├── conversation.ts       # Saarthi's transcript, kept across panel opens
│   ├── format.ts             # Date, time and wait formatting
│   ├── language.tsx          # t(en, hi?, mr?) + the language picker
│   ├── validate.ts           # Field validators
│   └── scrollToTop.ts
├── pages/                    # One file per route (see App.tsx PAGES)
│   ├── apply/                # The wizard: Apply, steps, Captcha
│   └── dl/                   # DL journey, parked
├── components/
│   └── VoiceAgent.tsx        # Saarthi's panel: mic, transcript, confirm button
├── practice/                 # The pixel-art practice game (self-contained)
├── data/                     # Static reference data: fees, classes, documents
├── ui/                       # Shared components: Note, Pill, SignIn, Icon, …
├── assets/
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

Containers are `clamp()`-based rather than fixed (`max-width: clamp(1120px, 80vw, 1440px)`),
so a wide monitor gets a wider page instead of a narrow column in a field of
grey. Card rows use `repeat(auto-fit, minmax(340px, 1fr))` for the same reason —
the number of columns follows the width rather than a breakpoint list.

## Language

`t('English', 'हिंदी', 'मराठी')` — Marathi is optional and falls back to
English, so a string can ship with two translations and be completed later.
Strings added for the backend wiring carry English and Hindi.

**Saarthi speaks the language the site is set to.** The picker is the single
source of truth; the panel sends it on every turn, and the service composes its
own replies in that language rather than asking the model to keep track. Guessing
per message from what the citizen said meant a conversation started in English
and answered in Hindi flipped mid-way through.
