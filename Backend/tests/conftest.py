"""
Test-wide setup.

The engine's store is a SQLite database. A test run must neither inherit
whatever the running demo has built up nor overwrite it, so the location is
pointed elsewhere before any application module is imported — ``db`` reads the
variable the first time a connection is opened.

``:memory:`` here does not mean SQLite's in-memory database. That cannot be
shared between connections, and sharing one connection across threads would put
the serialisation back inside the process — which is exactly what
test_concurrency.py exists to disprove. It means a private temporary file,
deleted when the process ends: real connections, real locking, real proof.
"""

import os
from datetime import date, timedelta

import pytest

os.environ["STATE_FILE"] = ":memory:"
os.environ.pop("DATABASE_URL", None)


@pytest.fixture(autouse=True)
def _fresh_rate_limits():
    """
    Saarthi's rate limits are per caller, and the whole suite is one caller.

    Sixty turns in five minutes is generous for a person and nothing at all for
    a test file: adding tests started failing unrelated ones with a 429, which
    reads as a broken agent rather than as a shared bucket. The limits are
    tested directly in test_voice_agent.py, so clearing them here removes the
    coupling without removing the coverage.
    """
    from app import voice_agent
    voice_agent._CALLER_HITS.clear()
    yield
    voice_agent._CALLER_HITS.clear()

def applicant(ref: str, **overrides) -> dict:
    """
    A complete set of answers for ``apply_for_licence``.

    The tool refuses to file an application containing details the citizen never
    gave — that is the whole point of it, and the schema's "required" list is
    advice to the model rather than a rule, so the service checks too. A test
    that only wants an application to exist still has to answer the questions,
    which is what this is for. Override the field under test.
    """
    return {
        "citizen_ref": ref,
        "licence_kind": "learner",
        "full_name": "Test Applicant",
        "dob": "2008-04-11",
        "state": "Maharashtra",
        "licence_classes": ["MCWG"],
        **overrides,
    }


# The day tests book into.
#
# Not today: a slot whose start time has gone is no longer offered, so a suite
# run after about three in the afternoon found today empty and every booking
# test failed. That was the tests depending on the clock, not on the engine —
# tomorrow is always wholly open, so the guarantees under test are the only
# thing that can break them.
BOOKABLE_DAY = date.today() + timedelta(days=1)
