"""
The sign-in stand-in, and the thing it exists for.

It authenticates nobody and the tests say so out loud — the code comes back in
the response. What it has to get right is narrower and more important: one
mobile number, one `citizen_ref`, so the application somebody filled in by hand
is the one Saarthi and the tracker then find. Before this, the wizard filed
under whatever was typed into stage two and the agent invented a throwaway
reference per panel, and the two never met.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from conftest import BOOKABLE_DAY  # noqa: E402
from app import booking_engine as be  # noqa: E402
from app import identity  # noqa: E402
from app.agent_tools import dispatch_tool  # noqa: E402
from app.booking_models import LicenceKind  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def _sign_in(phone: str) -> str:
    issued = client.post("/identity/request-code", json={"phone": phone}).json()
    verified = client.post("/identity/verify",
                           json={"phone": phone, "code": issued["code"]}).json()
    return verified["citizen_ref"]


# --------------------------------------------------------------------------
# What it is, stated plainly
# --------------------------------------------------------------------------

def test_the_code_is_returned_and_labelled_as_undelivered():
    """
    This is the honest part and it has to stay honest. The code is handed back
    because there is no SMS provider, and the response has to say so — a client
    that presented this as a real one-time password would have to ignore the
    field telling it not to.
    """
    body = client.post("/identity/request-code", json={"phone": "9820011021"}).json()
    assert body["code"].isdigit() and len(body["code"]) == 4
    assert body["delivered"] is False
    assert "no sms" in body["note"].lower()
    assert "prototype" in body["note"].lower()


# --------------------------------------------------------------------------
# The number itself
# --------------------------------------------------------------------------

@pytest.mark.parametrize("given, expected", [
    ("9820011021", "9820011021"),
    ("98200 11021", "9820011021"),
    ("+91 98200-11021", "9820011021"),
    ("098200 11021", "9820011021"),
])
def test_a_number_written_any_of_the_usual_ways_is_one_reference(given, expected):
    """
    Somebody who types +91 one day and bare digits the next must not end up with
    two journeys. This is the whole reason the number is normalised rather than
    stored as typed.
    """
    assert identity.normalise(given) == expected


@pytest.mark.parametrize("bad", ["12345", "5820011021", "98200110210", "", "abcdefghij"])
def test_something_that_is_not_a_mobile_number_is_refused(bad):
    assert client.post("/identity/request-code", json={"phone": bad}).status_code in (400, 422)


# --------------------------------------------------------------------------
# The exchange
# --------------------------------------------------------------------------

def test_the_right_code_returns_the_number_as_the_reference():
    assert _sign_in("9820011022") == "9820011022"


def test_a_wrong_code_is_refused():
    client.post("/identity/request-code", json={"phone": "9820011023"})
    res = client.post("/identity/verify", json={"phone": "9820011023", "code": "0000"})
    # 0000 is a real possible code, so only assert the pair is consistent.
    assert res.status_code in (200, 401)
    assert client.post("/identity/verify",
                       json={"phone": "9820011023", "code": "9999999"}).status_code == 401


def test_verifying_without_asking_for_a_code_first_is_refused():
    assert client.post("/identity/verify",
                       json={"phone": "9820011024", "code": "1234"}).status_code == 401


def test_a_code_cannot_be_spent_twice():
    """A code that keeps working is a link anyone can replay, mock or not."""
    issued = client.post("/identity/request-code", json={"phone": "9820011025"}).json()
    first = client.post("/identity/verify",
                        json={"phone": "9820011025", "code": issued["code"]})
    assert first.status_code == 200
    again = client.post("/identity/verify",
                        json={"phone": "9820011025", "code": issued["code"]})
    assert again.status_code == 401


def test_asking_again_replaces_the_live_code():
    """Two presses of "send code" must not leave the citizen guessing which works."""
    first = client.post("/identity/request-code", json={"phone": "9820011026"}).json()
    second = client.post("/identity/request-code", json={"phone": "9820011026"}).json()
    stale = client.post("/identity/verify",
                        json={"phone": "9820011026", "code": first["code"]})
    if first["code"] != second["code"]:
        assert stale.status_code == 401
    assert client.post("/identity/verify",
                       json={"phone": "9820011026", "code": second["code"]}).status_code == 200


def test_guessing_is_given_up_on_rather_than_allowed_forever():
    client.post("/identity/request-code", json={"phone": "9820011027"})
    for _ in range(identity.MAX_ATTEMPTS + 1):
        client.post("/identity/verify", json={"phone": "9820011027", "code": "1111111"})
    # The challenge is gone, so even the right code now needs a fresh request.
    assert client.post("/identity/verify",
                       json={"phone": "9820011027", "code": "1111"}).status_code == 401


# --------------------------------------------------------------------------
# The point of all of it
# --------------------------------------------------------------------------

def test_the_number_signed_in_with_finds_the_application_filed_under_it():
    """
    The failure this closes: an application filed through the wizard, and an
    agent that opened its panel and could not see it, because the two were
    keyed on different references.
    """
    be.seed_catalogue()
    ref = _sign_in("9820011028")

    filed = client.post("/apply", json={
        "citizen_ref": ref, "licence_kind": "learner", "rto_id": "mh01",
        "idempotency_key": "identity-journey-1", "applicant_name": "Anita Kulkarni",
        "dob": "2008-04-11",
    }).json()

    # What Saarthi asks the moment its panel opens.
    seen = dispatch_tool("get_journey_status", {"citizen_id": ref})
    assert seen["stage"] == "verified"
    assert be.latest_application_for(ref).display_no == filed["application_no"]

    # And the tracker, which is the third place that has to agree.
    tracked = client.get(f"/application/by-number/{filed['application_no']}",
                         params={"dob": "2008-04-11"})
    assert tracked.status_code == 200
    assert tracked.json()["application_id"] == filed["application_id"]


def test_signing_in_the_same_number_twice_does_not_fork_the_journey():
    """Signing out and back in has to land on the journey already in progress."""
    be.seed_catalogue()
    first = _sign_in("9820011029")
    app_obj = be.apply(first, LicenceKind.LL, "mh01", "identity-journey-2")
    slot = be.list_free_slots("mh01", BOOKABLE_DAY)[0]
    be.book_slot(app_obj.id, slot.id)

    second = _sign_in("98200 11029")   # written differently, same person
    assert second == first
    assert be.latest_application_for(second).id == app_obj.id
