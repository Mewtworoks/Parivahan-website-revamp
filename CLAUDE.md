# Working notes for Claude

A redesign concept for the Parivahan Sewa learner's-licence journey, built for a
public-service design challenge. React + TypeScript + SCSS on the front, FastAPI
+ Pydantic + SQLite on the back.

## Ground rules

1. **Never commit, stage, push, or create a branch.** The user runs every git
   write themselves. Leave finished work in the tree and say what changed.
2. **Check the branch before starting.** Work belongs on `main`. A checkout of an
   older branch has already made the tree look mysteriously reverted once.
3. **Never commit secrets.** `.env` holds the NIM API key; only `.env.example` is
   tracked. `Backend/state.db` is machine-local demo data and is ignored.
4. **All applicant data is synthetic.** Aadhaar `999999999999` is the reserved
   test value. Nothing here touches a real government system.

## Run and verify

```bash
# Backend — from Backend/
python main.py                 # 127.0.0.1:8000, reload on
python -m pytest -q            # the whole suite, including the subprocess tests
python -m pytest -q -m "not slow"   # skip the ones that spawn interpreters

# Frontend — from Frontend/
npm run dev                    # 5173
npm run build                  # tsc -b must stay clean; this is the real check
```

`CORS_ORIGINS` in `Backend/.env` lists 3000, 3001, 3002 and 5173. Previewing on
any other port fails with a CORS error that looks like the backend is down.

## Storage — read this before touching the engine

The store is **SQLite** (`Backend/state.db`, WAL mode), defined in
[`Backend/app/db.py`](Backend/app/db.py). It replaced an in-memory dict store
guarded by a `threading.Lock`, and the reason matters: that lock was a guarantee
for one process and silently nothing for two. The three claims this build makes
are now constraints in the schema.

| Claim | What enforces it |
| --- | --- |
| A retry never creates a second application | `UNIQUE(idempotency_key)` on `applications` |
| A slot goes to exactly one applicant | `UNIQUE(slot_id)` on `bookings`, plus a conditional `UPDATE … WHERE booked_by IS NULL` checked by row count |
| One application never holds two slots | `UNIQUE(application_id)` on `bookings` |
| A recorded event cannot be quietly replaced | `PRIMARY KEY (application_id, seq)` on `ledger`, insert-only |

Consequences to keep in mind:

- **Every mutation goes through `db.transaction()`**, which opens
  `BEGIN IMMEDIATE`. Reads use `db.read()` and take no lock. Never open a
  transaction inside another one — pass the `conn` down instead.
- **The engine returns snapshots, not live objects.** `be.apply(...)` gives you a
  Pydantic model read out of the database at that moment. Calling
  `be.book_slot(app.id, …)` afterwards does *not* update your local `app`; read
  it back with `be.get_application(app.id)`. This bit `proofs.ledger_tamper` and
  one test during the migration.
- **Nothing uses SQLite-only syntax.** Set `DATABASE_URL` to a MySQL or Postgres
  URL and the same tables and statements run. That is the whole migration.
- **`STATE_FILE=":memory:"` does not mean SQLite's in-memory database.** It means
  a private temp file, deleted at exit. A real in-memory database cannot be
  shared between connections, and sharing one connection across threads would
  put the serialisation back inside the process — which is what
  `tests/test_persistence.py` exists to disprove.

## Load-bearing parts

- [`Backend/app/booking_engine.py`](Backend/app/booking_engine.py) — the three
  guarantees. The most-tested file; change it with the suite running.
- [`Backend/app/db.py`](Backend/app/db.py) — schema and connection handling.
- [`Backend/app/voice_agent.py`](Backend/app/voice_agent.py) — Saarthi. Two-phase
  confirmation on `MUTATING_TOOLS` (`apply_for_licence`, `book_slot`,
  `check_in`): the model must ask before it acts, and a promise to act with no
  tool call is caught and nudged once.
- [`Backend/app/proofs.py`](Backend/app/proofs.py) — the runnable guarantees
  behind `#/proof`. These run against the real engine; never mock them.
- [`Frontend/src/App.tsx`](Frontend/src/App.tsx) — hash routing (`#/route`) via
  `pushState` + `popstate`/`hashchange`. Adding anything to the top bar wraps the
  wordmark; the desk and proof links live on the home page and in the footer for
  that reason.

## Conventions

- Comments explain **why**, in prose, at the point the decision was made. Match
  that density — this codebase is commented like an argument, not like a
  tutorial.
- UI copy is trilingual through `useT(en, hi, mr)`. New user-facing strings need
  at least English and Hindi.
- Scenarios in `seed_scenarios.py` are authored **correct option first**; the
  order is permuted per attempt. Never hand-shuffle a scenario.
- Tests are named as sentences about behaviour
  (`test_a_time_that_has_gone_is_not_offered`), not after the function they call.
- **Changing a test to make a change pass needs saying out loud.** Say what the
  test used to assert and why that assertion was wrong.
