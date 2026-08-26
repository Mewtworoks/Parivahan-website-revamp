"""
Picking a journey up where it was left.

The failure these exist to stop: Saarthi's form answers lived on a dict with a
thirty-minute timer, so somebody who gave their name and date of birth and then
closed the tab came back to a service that had never heard of them. Nothing
about a half-filled form is ephemeral except where it used to be stored.

The strongest of these kills the in-memory cache outright — the same thing a
backend restart does — and asserts the conversation carries on. Under the old
store that was not a bug to be fixed, it was impossible.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from conftest import BOOKABLE_DAY, applicant  # noqa: E402
from app import booking_engine as be  # noqa: E402
from app import drafts, voice_agent  # noqa: E402
from app.agent_tools import dispatch_tool  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def _start(ref: str, language: str = "en") -> dict:
    return client.post("/agent/voice/start",
                       json={"citizen_ref": ref, "language": language}).json()


def _say(sid: str, text: str) -> dict:
    return client.post("/agent/voice/turn",
                       json={"session_id": sid, "transcript": text}).json()


def test_an_answer_given_out_loud_is_written_down_immediately():
    """Not at the end of the form — the citizen may not reach the end."""
    ref = "resume-writes"
    sid = _start(ref)["session_id"]
    _say(sid, "Sehaj Gaba")
    assert drafts.load(ref) == {"full_name": "Sehaj Gaba"}
    # And what we were asking next, so the greeting can say where we got to.
    assert drafts.current_field(ref) == "dob"


def test_a_new_conversation_opens_where_the_last_one_stopped():
    ref = "resume-across"
    sid = _start(ref)["session_id"]
    _say(sid, "Anita Kulkarni")
    _say(sid, "11 April 2008")
    client.delete(f"/agent/voice/{sid}")

    opened = _start(ref)
    assert opened["resumed"] is True
    greeting = opened["greeting"]
    assert "Anita Kulkarni" in greeting
    assert "11 April 2008" in greeting
    # And it asks the outstanding question rather than starting from the top.
    assert "state" in greeting.lower()
    assert "full name" not in greeting.lower()


def test_the_conversation_survives_the_process_that_held_it():
    """
    The in-memory cache is emptied, which is what a backend restart does.

    Before this the citizen was told "voice session expired, start Saarthi
    again" mid-sentence — including, once, in front of a confirmation button.
    """
    ref = "resume-restart"
    sid = _start(ref)["session_id"]
    _say(sid, "Rohan Verma")
    _say(sid, "11 April 2008")

    voice_agent._SESSIONS.clear()

    body = client.post("/agent/voice/turn",
                       json={"session_id": sid, "transcript": "Maharashtra"})
    assert body.status_code == 200, body.text
    assert voice_agent._SESSIONS[sid].form_answers["full_name"] == "Rohan Verma"
    assert "two-wheeler" in body.json()["reply"].lower()


def test_a_confirmation_still_stands_after_a_restart():
    ref = "resume-pending"
    sid = _start(ref)["session_id"]
    for said in ("Meera Iyer", "11 April 2008", "Maharashtra", "two wheeler"):
        answer = _say(sid, said)
    assert answer["pending_confirmation"]

    voice_agent._SESSIONS.clear()

    filed = client.post("/agent/voice/confirm", json={"session_id": sid}).json()
    assert filed["tool_events"][0]["result"]["applicant_name"] == "Meera Iyer"


def test_filing_the_application_clears_the_draft():
    """
    Otherwise the next conversation offers to resume a form already submitted,
    and the citizen reasonably concludes the submission did not work.
    """
    ref = "resume-cleared"
    sid = _start(ref)["session_id"]
    for said in ("Kabir Shah", "11 April 2008", "Maharashtra", "two wheeler"):
        _say(sid, said)
    client.post("/agent/voice/confirm", json={"session_id": sid})

    assert drafts.load(ref) == {}
    greeting = _start(ref)["greeting"]
    assert "SS-" in greeting and "book" in greeting.lower()


def test_signing_out_forgets_the_conversation_but_not_the_form():
    """
    The transcript holds the last person's name and date of birth, so it goes.
    The draft is keyed to their own number, so signing back in resumes it.
    """
    ref = "resume-signout"
    sid = _start(ref)["session_id"]
    _say(sid, "Priya Nair")
    client.delete(f"/agent/voice/{sid}")

    assert client.post("/agent/voice/turn",
                       json={"session_id": sid, "transcript": "hello"}).status_code == 404
    assert drafts.load(ref)["full_name"] == "Priya Nair"


def test_the_opening_line_reads_back_an_appointment_that_exists():
    ref = "resume-booked"
    # Patna: mh01's first free slot on this day belongs to test_journey, which
    # checks in and drives that tester's lane to completion.
    filed = dispatch_tool("apply_for_licence", applicant(ref, state="Bihar", rto_id="br01"))
    free = be.list_free_slots("br01", BOOKABLE_DAY)
    be.book_slot(filed["application_id"], free[0].id)

    greeting = _start(ref)["greeting"]
    assert free[0].start.strftime("%H:%M") in greeting
    assert BOOKABLE_DAY.strftime("%A") in greeting
    # Named by their name, never by a row key — this is read aloud.
    assert "mh01" not in greeting and free[0].id not in greeting


def test_the_opening_line_is_hindi_when_the_site_is():
    """
    The greeting is composed before the citizen has said anything, so there is
    nothing to detect the language from. Greeting a Hindi reader in English is
    an invitation to switch, which is not what they chose.
    """
    ref = "resume-hindi"
    greeting = _start(ref, language="hi")["greeting"]
    assert any("ऀ" <= ch <= "ॿ" for ch in greeting), greeting


def test_an_unreadable_draft_does_not_break_the_conversation():
    """A corrupt scratchpad costs a repeated question, never a failed turn."""
    ref = "resume-corrupt"
    drafts.save(ref, {"full_name": "Ravi Desai"}, "dob")
    with __import__("app.db", fromlist=["db"]).transaction() as conn:
        from app import db
        conn.execute(db.drafts.update()
                     .where(db.drafts.c.citizen_ref == ref)
                     .values(answers="{not json"))

    assert drafts.load(ref) == {}
    opened = _start(ref)
    assert opened["greeting"]
    assert client.post("/agent/voice/turn",
                       json={"session_id": opened["session_id"],
                             "transcript": "Ravi Desai"}).status_code == 200
