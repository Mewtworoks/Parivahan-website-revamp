"""
SQLite storage for the booking engine.

Why this replaced the JSON snapshot it grew out of: the three guarantees this
service makes were enforced by a ``threading.Lock`` held inside one Python
process. That is honest for a single-worker demo and false the moment the server
runs ``--workers 2`` — two processes, two locks, one slot sold twice, and the
proof page still reporting a clean race because both contenders happened to land
on the same worker. A guarantee that depends on how the server was started is
not a guarantee.

So the guarantees live in the schema now, where a second process cannot route
around them:

  * ``UNIQUE(idempotency_key)`` on ``applications`` — a retry cannot create a
    second application, whichever worker handles it.
  * ``UNIQUE(slot_id)`` on ``bookings`` — a slot cannot be sold twice, however
    many processes press at the same moment. ``UNIQUE(application_id)`` on the
    same table refuses the mirror image: one application quietly holding two.
  * ``PRIMARY KEY (application_id, seq)`` on ``ledger``, inserted and never
    updated — an event cannot be slipped into the middle of a chain or
    renumbered on top of an existing one.

SQLite rather than MySQL or Postgres because the constraint work is identical
and the operational cost is not: one file on disk, no server to start, and
``python main.py`` still runs the whole backend. Nothing below uses SQLite-only
syntax, so the same tables and the same statements run on MySQL or Postgres by
changing ``DATABASE_URL`` and nothing else.
"""

from __future__ import annotations

import atexit
import logging
import os
import shutil
import tempfile
from contextlib import contextmanager
from datetime import date, datetime, time
from pathlib import Path
from typing import Iterator

from sqlalchemy import (
    Column,
    Connection,
    Float,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
    create_engine,
    delete,
    event,
    inspect,
    text,
)
from sqlalchemy.engine import Engine

log = logging.getLogger("db")

METADATA = MetaData()

# Dates, times and timestamps are stored as ISO text. Sorting and range
# comparison are then plain lexicographic string operations that mean the same
# thing on every engine, which is what lets the "has this time gone?" filter be
# a WHERE clause rather than a full scan followed by a Python loop.
_DATE = String(10)      # 2026-08-27
_TIME = String(5)       # 09:30
_STAMP = String(40)     # 2026-08-27T09:30:00+00:00
_ID = String(40)

rtos = Table(
    "rtos", METADATA,
    Column("id", _ID, primary_key=True),
    Column("name", Text, nullable=False),
    Column("city", Text, nullable=False),
    Column("state", Text, nullable=False),
    Column("area", Text, nullable=False),
    Column("km", Float, nullable=False),
    Column("open_time", _TIME, nullable=False),
    Column("close_time", _TIME, nullable=False),
    Column("slot_minutes", Integer, nullable=False),
    Column("lunch_from", _TIME, nullable=False),
    Column("lunch_to", _TIME, nullable=False),
)

testers = Table(
    "testers", METADATA,
    Column("id", _ID, primary_key=True),
    Column("name", Text, nullable=False),
    Column("rto_id", _ID, nullable=False),
    Column("avg_test_minutes", Integer, nullable=False),
    Index("ix_testers_rto", "rto_id"),
)

slots = Table(
    "slots", METADATA,
    Column("id", _ID, primary_key=True),
    Column("rto_id", _ID, nullable=False),
    Column("tester_id", _ID, nullable=False),
    Column("slot_date", _DATE, nullable=False),
    Column("start", _TIME, nullable=False),
    # NULL means free. The booking table's UNIQUE(slot_id) is what actually
    # enforces single allocation; this column is the denormalised read path the
    # pickers use, written in the same transaction.
    Column("booked_by_application", _ID, nullable=True),
    Index("ix_slots_day", "rto_id", "slot_date", "start"),
)

# Which (office, day) grids have been built. A set in the old engine; a table
# here for the same reason — it is the thing that makes grid building idempotent
# under two processes starting at once.
slot_days = Table(
    "slot_days", METADATA,
    Column("rto_id", _ID, primary_key=True),
    Column("day", _DATE, primary_key=True),
)

applications = Table(
    "applications", METADATA,
    Column("id", _ID, primary_key=True),
    # Creation order, so "the citizen's latest application" is an ORDER BY and
    # not a dependence on dict insertion order.
    Column("seq", Integer, nullable=False),
    Column("display_no", String(20), nullable=False, unique=True),
    Column("citizen_ref", Text, nullable=False),
    Column("licence_kind", String(20), nullable=False),
    Column("rto_id", _ID, nullable=False),
    Column("status", String(20), nullable=False),
    # Guarantee 1. The retry storm ends here, in the database, rather than in a
    # dict lookup that only one process can see.
    Column("idempotency_key", Text, nullable=False, unique=True),
    Column("created_at", _STAMP, nullable=False),
    Column("dob", Text, nullable=True),
    Column("applicant_name", Text, nullable=True),
    Column("licence_classes", Text, nullable=False),   # JSON array
    Column("booking_id", _ID, nullable=True),
    Column("token_id", _ID, nullable=True),
    Index("ix_apps_citizen", "citizen_ref", "seq"),
)

# Guarantee 3. Rows are inserted and never updated: the composite primary key
# refuses a second event at an existing position, so a chain cannot be quietly
# rewritten in place — a forger has to delete and reinsert the whole tail, which
# changes the chain head the citizen already holds a copy of.
ledger = Table(
    "ledger", METADATA,
    Column("application_id", _ID, primary_key=True),
    Column("seq", Integer, primary_key=True),
    Column("at", _STAMP, nullable=False),
    Column("status", String(20), nullable=False),
    Column("note", Text, nullable=False),
    Column("prev_hash", String(64), nullable=False),
    Column("hash", String(64), nullable=False),
)

# Guarantee 2, both directions.
bookings = Table(
    "bookings", METADATA,
    Column("id", _ID, primary_key=True),
    Column("application_id", _ID, nullable=False, unique=True),
    Column("slot_id", _ID, nullable=False, unique=True),
    Column("rto_id", _ID, nullable=False),
    Column("tester_id", _ID, nullable=False),
    Column("slot_date", _DATE, nullable=False),
    Column("start", _TIME, nullable=False),
    Column("created_at", _STAMP, nullable=False),
)

tokens = Table(
    "tokens", METADATA,
    Column("id", _ID, primary_key=True),
    # Checking in twice must return the same token rather than burn a second
    # number, and the constraint says so instead of the code promising to.
    Column("application_id", _ID, nullable=False, unique=True),
    Column("rto_id", _ID, nullable=False),
    Column("tester_id", _ID, nullable=False),
    Column("number", Integer, nullable=False),
    Column("status", String(20), nullable=False),
    Column("checked_in_at", _STAMP, nullable=False),
    Column("started_at", _STAMP, nullable=True),
    Column("finished_at", _STAMP, nullable=True),
    UniqueConstraint("rto_id", "number", name="ux_tokens_rto_number"),
    Index("ix_tokens_lane", "tester_id", "status"),
)

# A form somebody started answering and did not finish.
#
# Deliberately not a row in ``applications``. An unfinished form is not an
# application: put one there and it appears in the tracker, gets a display
# number, gets a ledger chain, and is what ``latest_application_for`` hands the
# next session — a citizen who answered one question would be told they had
# already applied. This table holds nothing but the answers given so far, so the
# worst it can cause is a resumed question.
drafts = Table(
    "drafts", METADATA,
    # String, not Text: a TEXT primary key needs a prefix length on MySQL, and
    # the whole point of this file is that the schema moves engines unchanged.
    Column("citizen_ref", String(120), primary_key=True),
    Column("answers", Text, nullable=False),     # JSON object
    # What was being asked when they walked away, so the next conversation can
    # open with "we got as far as your date of birth" rather than starting over.
    Column("current_field", String(40), nullable=True),
    Column("updated_at", _STAMP, nullable=False),
)

# A Saarthi conversation, which used to be a dict with a thirty-minute timer.
#
# It held the citizen's half-answered form, so closing the tab, waiting, or
# restarting the server threw away answers they had already given — and the next
# session asked for all of them again. Nothing about a conversation was ever
# ephemeral except where it was stored.
conversations = Table(
    "conversations", METADATA,
    Column("id", _ID, primary_key=True),
    Column("citizen_ref", String(120), nullable=False),
    Column("messages", Text, nullable=False),      # JSON: the model's message list
    Column("language", Text, nullable=True),
    Column("application_id", _ID, nullable=True),
    Column("rto_id", _ID, nullable=True),
    Column("token_id", _ID, nullable=True),
    # The action waiting on the confirmation button. Kept because a reload in
    # front of that button used to strand the citizen on something they could
    # neither confirm nor cancel — the one state the gate must never produce.
    Column("pending", Text, nullable=True),        # JSON or NULL
    # What Saarthi last put on the table — "the days", "the times on Thursday".
    # Kept because "yes" and "the second one" only mean anything against it.
    Column("offered", String(60), nullable=True),
    Column("created_at", _STAMP, nullable=False),
    Column("last_seen", _STAMP, nullable=False),
    Index("ix_conversations_citizen", "citizen_ref", "last_seen"),
)

# What went wrong, with no way back to who it happened to.
#
# The point is the aggregate: which competency the most people fail, which form
# field they abandon at, which office loses the most slot races. That is a
# curriculum signal and a service-design signal, and neither needs a name
# attached. ``citizen_hash`` is an HMAC rather than a hash because a phone
# number is a ten-digit space — a plain digest is brute-forced in seconds by
# anyone holding this table, which would make the anonymity a claim rather than
# a property. See app/signals.py for the allowlist that keeps `detail` clean.
signals = Table(
    "signals", METADATA,
    Column("id", _ID, primary_key=True),
    Column("at", _STAMP, nullable=False),
    Column("citizen_hash", String(32), nullable=False),
    Column("kind", String(40), nullable=False),
    Column("detail", Text, nullable=False),        # JSON, allowlisted keys only
    Index("ix_signals_kind_at", "kind", "at"),
)

# Sequences. SQLite has no SEQUENCE and AUTOINCREMENT would not survive the
# "start at 4181 so the first number matches the copy" requirement, so the
# counters are rows bumped inside the same transaction as the insert they feed.
counters = Table(
    "counters", METADATA,
    Column("name", String(60), primary_key=True),
    Column("value", Integer, nullable=False),
)


# --------------------------------------------------------------------------
# Engine
# --------------------------------------------------------------------------

_engine: Engine | None = None
_url: str | None = None


def _default_path() -> Path:
    return Path(__file__).resolve().parents[1] / "state.db"


def _resolve_url() -> str:
    """
    Where the database lives.

    ``DATABASE_URL`` wins outright and is the whole of the MySQL/Postgres story
    — nothing below this line is SQLite-specific except the PRAGMAs, which are
    skipped for other drivers.

    ``STATE_FILE=":memory:"`` is kept for the test suite, but it does not mean
    SQLite's ``:memory:``. A real in-memory database cannot be shared between
    connections, and sharing one connection across threads would put the
    serialisation back inside the process — which is the exact thing the
    concurrency test exists to disprove. So it means a private temporary file,
    deleted when the process ends: real connections, real locking, real proof,
    and still nothing left on disk and nothing inherited from the running demo.
    """
    explicit = os.getenv("DATABASE_URL", "").strip()
    if explicit:
        return explicit

    configured = os.getenv("STATE_FILE", "").strip()
    if configured == ":memory:":
        tmp = tempfile.mkdtemp(prefix="parivahan-test-")
        atexit.register(shutil.rmtree, tmp, True)
        return f"sqlite:///{Path(tmp) / 'state.db'}"

    path = Path(configured) if configured else _default_path()
    # A leftover state.json from the snapshot era is not readable as a database
    # and not worth migrating — the demo reseeds in under a second.
    if path.suffix == ".json":
        path = path.with_suffix(".db")
    path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{path}"


def _make_engine(url: str) -> Engine:
    eng = create_engine(
        url,
        # SQLAlchemy emits no BEGIN of its own, so `transaction()` below can open
        # the one it wants: BEGIN IMMEDIATE, which takes the write lock up front.
        # Left to a deferred BEGIN, two writers that both read first would each
        # hold a read lock and neither could upgrade — SQLITE_BUSY that no amount
        # of waiting resolves.
        isolation_level="AUTOCOMMIT",
        future=True,
        # Pool connections move between request threads.
        connect_args={"check_same_thread": False, "timeout": 30}
        if url.startswith("sqlite") else {},
        pool_pre_ping=True,
    )

    if url.startswith("sqlite"):
        @event.listens_for(eng, "connect")
        def _pragmas(dbapi_conn, _record):  # pragma: no cover - driver plumbing
            cur = dbapi_conn.cursor()
            # WAL is what allows readers to keep reading while one process
            # writes; without it the board polling every two seconds would
            # collide with every booking.
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA synchronous=NORMAL")
            cur.execute("PRAGMA foreign_keys=ON")
            # A racing writer waits for the lock instead of failing instantly.
            cur.execute("PRAGMA busy_timeout=30000")
            cur.close()

    return eng


def _add_missing_columns(eng: Engine) -> None:
    """
    Bring an existing database up to the current schema, one column at a time.

    ``create_all`` creates tables that are absent and then leaves the ones that
    exist exactly as they are. That is fine until a column is added to a table
    somebody is already running, at which point every query naming it fails with
    "no such column" — which is how a demo database written yesterday stopped
    the server from answering a single request this morning.

    Deliberately narrow. It adds nullable columns and nothing else: no drops, no
    type changes, no renames, no data movement. Those need a real migration tool
    with a version history and a way back, and pretending otherwise here would
    be worse than not doing it. ``ALTER TABLE … ADD COLUMN`` is spelled the same
    on SQLite, MySQL and Postgres, so this travels with the rest of the file.
    """
    inspector = inspect(eng)
    existing_tables = set(inspector.get_table_names())
    for table in METADATA.sorted_tables:
        if table.name not in existing_tables:
            continue                     # create_all just made it, in full
        have = {c["name"] for c in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in have:
                continue
            if not column.nullable:
                # Adding this needs a default and a decision about the rows
                # already there. Say so rather than failing three queries later.
                log.error("%s.%s is missing and not nullable — this needs a "
                          "migration, not a column add", table.name, column.name)
                continue
            kind = column.type.compile(eng.dialect)
            with eng.connect() as conn:
                conn.exec_driver_sql(
                    f"ALTER TABLE {table.name} ADD COLUMN {column.name} {kind}")
            log.info("added %s.%s to an existing database", table.name, column.name)


def engine() -> Engine:
    global _engine, _url
    if _engine is None:
        _url = _resolve_url()
        _engine = _make_engine(_url)
        METADATA.create_all(_engine)
        _add_missing_columns(_engine)
        log.info("storage ready at %s", _url)
    return _engine


def url() -> str:
    engine()
    return _url or ""


@contextmanager
def read() -> Iterator[Connection]:
    """A connection for queries. No transaction, so readers never block."""
    with engine().connect() as conn:
        yield conn


@contextmanager
def transaction() -> Iterator[Connection]:
    """
    A write transaction, committed on clean exit and rolled back on any error.

    ``BEGIN IMMEDIATE`` rather than a plain ``BEGIN``: the write lock is taken
    before the first read, so the read-then-write sequences below (check the
    slot is free, then claim it) cannot interleave with another writer's. That
    is the process-level half of the guarantee; the UNIQUE constraints are the
    half that holds even if this is somehow got wrong.
    """
    with engine().connect() as conn:
        conn.exec_driver_sql("BEGIN IMMEDIATE")
        try:
            yield conn
        except BaseException:
            conn.exec_driver_sql("ROLLBACK")
            raise
        conn.exec_driver_sql("COMMIT")


# --------------------------------------------------------------------------
# Counters
# --------------------------------------------------------------------------

def next_value(conn: Connection, name: str, start: int = 0) -> int:
    """
    Increment a counter and return the new value. Caller is inside a write
    transaction, so the read-modify-write cannot be interleaved.
    """
    row = conn.execute(
        counters.select().where(counters.c.name == name)).mappings().first()
    if row is None:
        value = start + 1
        conn.execute(counters.insert().values(name=name, value=value))
    else:
        value = row["value"] + 1
        conn.execute(counters.update().where(counters.c.name == name).values(value=value))
    return value


def reset(conn: Connection) -> None:
    """
    Empty every table. Used by the demo's reset button and by nothing else.

    Drafts and conversations are in the list for the reason the button exists:
    left behind, the next walkthrough opens on the previous person's half-filled
    form and Saarthi greets a stranger by name.
    """
    for table in (ledger, tokens, bookings, slots, slot_days,
                  applications, testers, rtos, counters,
                  drafts, conversations, signals):
        conn.execute(delete(table))


def is_populated() -> bool:
    """Whether a previous run left anything behind. Drives the startup log."""
    with read() as conn:
        return conn.execute(
            text("SELECT 1 FROM applications LIMIT 1")).first() is not None


# --------------------------------------------------------------------------
# ISO helpers — one definition, so a value written by one module is read the
# same way by every other.
# --------------------------------------------------------------------------

def d_out(value: date) -> str:
    return value.isoformat()


def d_in(value: str) -> date:
    return date.fromisoformat(value)


def t_out(value: time) -> str:
    return value.strftime("%H:%M")


def t_in(value: str) -> time:
    return time.fromisoformat(value)


def ts_out(value: datetime) -> str:
    return value.isoformat()


def ts_in(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None
