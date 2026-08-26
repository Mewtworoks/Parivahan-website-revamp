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
  tool call is caught and nudged once. **The model does not drive the form or
  the booking** — see below.
- [`Backend/app/proofs.py`](Backend/app/proofs.py) — the runnable guarantees
  behind `#/proof`. These run against the real engine; never mock them.
- [`Frontend/src/App.tsx`](Frontend/src/App.tsx) — hash routing (`#/route`) via
  `pushState` + `popstate`/`hashchange`. Adding anything to the top bar wraps the
  wordmark; the desk and proof links live on the home page and in the footer for
  that reason.

## Saarthi — what the model does and does not decide

Two recorded conversations failed the same way. Told a name, Saarthi answered
"which day would you like to book your test slot?" — three answers short of a
filled form. The second went further: "your application is ready" with nothing
filed, then a refusal to say the number it had just invented. Every guard built
before then gated **tool calls**, and in both conversations the model called no
tools at all. It simply talked, and nothing checked whether what it said matched
the state the service knew it was in.

So the service stops asking. **A turn whose answer is already in the database is
answered without an upstream call**, in [`_fast_reply`](Backend/app/voice_agent.py):

| Spoken by the service | Spoken by the model |
| --- | --- |
| the four form questions, and the confirmation sentence | explanations, the law, fees |
| the result after Confirm, disclosure included | corrections and objections it cannot parse |
| the day list and the times on one day | "next Thursday, some time after lunch" |
| application number, status, "is my form filled", "when is my test" | anything off script |
| the opening line, built from the record | |

Consequences worth knowing before changing any of it:

- **The apply journey costs zero model calls** and works with `NVIDIA_API_KEY`
  unset. `tests/test_fast_form.py` asserts this by making `_call_nvidia` raise.
- **`read_answer(field, text, prompted)` returns `None` when unsure**, and the
  turn goes to the model. Never widen it into a guess — a wrong date of birth
  locks somebody out of their own application at the tracker. `prompted` gates
  the name only: any two words look like a name, and "puri prakriya samjhaiye"
  was briefly stored as one.
- **`_guard_reply` discards a model reply that claims an application exists or
  offers to book while the form is unfilled.** It is a last line, not the
  mechanism. Keep it narrow — a version that fired on the word "slot" ate the
  honest answer to "what is the whole process?", and one that fired on "what …
  date …?" discarded the service's own question.
- **Hindi is not an afterthought in the parsers.** Devanagari months, Devanagari
  digits, city names in both scripts. "11 अप्रैल 2008" not parsing meant the
  date fell to the model, was never stored, and got asked for again — a loop, in
  the language most of the users speak.
- **`session.asked_field` and `session.offered`** are what make "Sehaj Gaba",
  "yes" and "the 9:30 one" mean anything. Both are persisted.

State that used to live in dicts and now does not:
[`drafts.py`](Backend/app/drafts.py) (the half-filled form, per citizen),
[`conversations.py`](Backend/app/conversations.py) (the transcript and the
pending action), [`signals.py`](Backend/app/signals.py) (anonymous failures).
A backend restart no longer ends a conversation — `tests/test_resume.py` proves
it by clearing `_SESSIONS` mid-journey.

`signals` is anonymous **by construction**: an HMAC of the citizen reference
with `SECRET_KEY`, and an allowlist per kind so a caller cannot widen what is
stored. A plain digest of a ten-digit phone number is brute-forced in seconds,
which is why it is not one. Never add a foreign key to that table.

`db._add_missing_columns()` runs after `create_all` and adds nullable columns to
tables that already exist. `create_all` alone cannot, which is how adding
`conversations.offered` stopped a running demo from answering any request.

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
