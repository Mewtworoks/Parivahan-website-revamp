"""Saarthi's safety boundary: model proposes; citizen confirms; tools execute."""

import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app import booking_engine as be  # noqa: E402
from app import voice_agent  # noqa: E402
from app.agent_tools import dispatch_tool  # noqa: E402
from app.main import app  # noqa: E402
from app.models import PASS_THRESHOLD, QUESTIONS_PER_TEST  # noqa: E402

client = TestClient(app)


def test_voice_tool_schema_hides_server_identifiers():
    for tool in voice_agent._chat_tools():
        props = tool["function"]["parameters"]["properties"]
        assert not {"citizen_id", "citizen_ref", "application_id", "token_id"} & set(props)


def test_voice_requires_server_configuration_before_model_call(monkeypatch):
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-no-key"}).json()
    response = client.post("/agent/voice/turn", json={
        "session_id": session["session_id"], "transcript": "मुझे लाइसेंस चाहिए",
    })
    assert response.status_code == 503
    assert "NVIDIA_API_KEY" in response.json()["detail"]


def test_voice_queues_mutation_until_visible_confirmation(monkeypatch):
    calls = []

    def fake_model(messages, tools=None, language=None):
        calls.append((messages, tools))
        if len(calls) == 1:
            return {
                "content": "",
                "tool_calls": [{
                    "id": "call_apply",
                    "function": {
                        "name": "apply_for_licence",
                        "arguments": '{"licence_kind":"learner","rto_id":"mh01"}',
                    },
                }],
            }
        if len(calls) == 2:
            return {"content": "मैं आवेदन बनाने के लिए तैयार हूँ। कृपया पुष्टि करें।"}
        return {"content": "आपका आवेदन बन गया है। अब मैं स्लॉट दिखा सकता हूँ।"}

    monkeypatch.setattr(voice_agent, "_call_nvidia", fake_model)
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-confirm-user"}).json()
    first = client.post("/agent/voice/turn", json={
        "session_id": session["session_id"], "transcript": "मुझे learner licence apply करना है",
    })
    assert first.status_code == 200
    body = first.json()
    assert body["pending_confirmation"]["label"] == "Create your learner-licence application"
    assert voice_agent._SESSIONS[session["session_id"]].application_id is None

    confirmed = client.post("/agent/voice/confirm", json={"session_id": session["session_id"]})
    assert confirmed.status_code == 200
    result = confirmed.json()
    assert result["tool_events"][0]["tool"] == "apply_for_licence"
    assert result["tool_events"][0]["result"]["application_id"]
    assert voice_agent._SESSIONS[session["session_id"]].application_id


def test_voice_confirmation_cannot_be_replayed():
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-empty-confirm"}).json()
    response = client.post("/agent/voice/confirm", json={"session_id": session["session_id"]})
    assert response.status_code == 409


def test_parallel_tool_calls_all_get_answered(monkeypatch):
    """
    A model may ask for two tools in one breath. Every call id must come back
    with a tool message: an unanswered one makes the stored transcript invalid,
    and the endpoint then rejects every later request on that session — so the
    citizen is told an action failed after the service had already run it.
    """
    replies = [
        {"content": "", "tool_calls": [
            {"id": "p1", "function": {"name": "apply_for_licence", "arguments": "{}"}},
            {"id": "p2", "function": {"name": "find_slots", "arguments": '{"rto_id":"mh01"}'}},
        ]},
        {"content": "कृपया पुष्टि करें।"},
    ]

    def strict_model(messages, tools=None, language=None):
        """Reject an invalid transcript the way an OpenAI-compatible endpoint does."""
        asked = {c["id"] for m in messages for c in (m.get("tool_calls") or [])}
        answered = {m.get("tool_call_id") for m in messages if m.get("role") == "tool"}
        assert not asked - answered, f"unanswered tool calls: {sorted(asked - answered)}"
        return replies.pop(0) if replies else {"content": "ठीक है।"}

    monkeypatch.setattr(voice_agent, "_call_nvidia", strict_model)
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-parallel"}).json()
    sid = session["session_id"]

    first = client.post("/agent/voice/turn", json={"session_id": sid, "transcript": "apply aur slot"})
    assert first.status_code == 200
    assert first.json()["pending_confirmation"]["label"] == "Create your learner-licence application"
    # The sibling call was answered but must not have run behind the gate.
    assert [e["status"] for e in first.json()["tool_events"]] == ["awaiting_confirmation", "deferred"]

    # The gated action still completes, and the session survives to keep talking.
    confirmed = client.post("/agent/voice/confirm", json={"session_id": sid})
    assert confirmed.status_code == 200
    assert confirmed.json()["tool_events"][0]["result"]["application_id"]
    assert client.post("/agent/voice/turn",
                       json={"session_id": sid, "transcript": "aage kya?"}).status_code == 200


def test_the_agent_quotes_the_real_numbers():
    """
    What the agent states about the test has to be what the service runs, and
    the fee has to carry actual figures.

    Both were wrong: the canned text said "15 questions, 9 to pass" against a
    service serving 10 and passing at 6, and the fee text had no numbers at
    all — so the model filled the gap and told a citizen a learner licence
    costs "about Rs.2,000".
    """
    fmt = dispatch_tool("explain_ll_step", {"step": "test_format"})["text"]
    criteria = dispatch_tool("explain_ll_step", {"step": "pass_criteria"})["text"]
    assert str(QUESTIONS_PER_TEST) in fmt and "15" not in fmt
    assert str(PASS_THRESHOLD) in criteria and str(QUESTIONS_PER_TEST) in criteria
    # The count and the pass mark travel together: reading the format alone and
    # guessing the rest, the model told a citizen all ten had to be correct.
    assert str(PASS_THRESHOLD) in fmt, "test_format omits the pass mark"

    # Payment is out of scope for the prototype, so the answer must say when the
    # fee is worked out and quote nothing. Left silent, the model filled the gap
    # and told a citizen a learner licence costs "about Rs.2,000".
    fee = dispatch_tool("explain_ll_step", {"step": "fee"})["text"]
    assert "prototype" in fee.lower() and "after all your details" in fee
    assert not re.search(r"(Rs\.?|₹)\s*\d", fee), "prototype must not quote an amount"

    # What a learner may do is law, not advice: the agent once finished an
    # explanation with "you can drive immediately".
    after = dispatch_tool("explain_ll_step", {"step": "after_pass"})["text"]
    assert "not drive alone" in after and "L plate" in after


def test_queue_states_the_place_in_the_lane_not_just_the_token():
    """
    The token number is issued across the office; the line is per inspector. A
    citizen told "number 3, nobody ahead of you" hears a contradiction, so the
    place in that inspector's lane has to be stated outright.
    """
    app_obj = dispatch_tool("apply_for_licence",
                            {"citizen_ref": "voice-lane", "licence_kind": "learner",
                             "rto_id": "mh01"})
    slots = dispatch_tool("find_slots", {"rto_id": "mh01"})
    dispatch_tool("book_slot", {"application_id": app_obj["application_id"],
                                "slot_id": slots["slots"][0]["slot_id"]})
    token = dispatch_tool("check_in", {"application_id": app_obj["application_id"]})
    queue = dispatch_tool("check_queue", {"token_id": token["token_id"]})

    assert queue["position_in_lane"] == queue["people_ahead"] + 1
    assert queue["position_in_lane"] <= queue["lane_size"]
    assert queue["tester"].startswith("Inspector")


def test_spoken_tool_results_never_carry_internal_ids():
    """Tool output is read aloud, so it must name the inspector, not a row key."""
    app_obj = dispatch_tool("apply_for_licence",
                            {"citizen_ref": "voice-no-ids", "licence_kind": "learner",
                             "rto_id": "mh01"})
    slots = dispatch_tool("find_slots", {"rto_id": "mh01"})
    assert slots["slots"], "no free slots to check"
    booked = dispatch_tool("book_slot", {"application_id": app_obj["application_id"],
                                         "slot_id": slots["slots"][0]["slot_id"]})
    checked = dispatch_tool("check_in", {"application_id": app_obj["application_id"]})
    for payload in (slots["slots"][0], booked, checked):
        assert "tester_id" not in payload, f"internal tester id exposed in {payload}"
        assert not payload.get("tester", "").endswith(("_t1", "_t2", "_t3"))
    assert booked["tester"].startswith("Inspector")


def test_harmony_channel_markers_are_stripped_from_tool_names(monkeypatch):
    """
    gpt-oss emits names like ``find_slots<|channel|>commentary``. Taken
    literally that is an unknown tool, and the model burns one of its few
    rounds re-issuing the call — a round a mutating action may not have spare.
    """
    replies = [
        {"content": "", "tool_calls": [{
            "id": "h1",
            "function": {"name": "find_slots<|channel|>commentary",
                         "arguments": '{"rto_id":"mh01"}'},
        }]},
        {"content": "09:30 पर Inspector A उपलब्ध हैं।"},
    ]
    monkeypatch.setattr(voice_agent, "_call_nvidia",
                        lambda messages, tools=None, language=None: replies.pop(0))
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-harmony"}).json()
    body = client.post("/agent/voice/turn", json={
        "session_id": session["session_id"], "transcript": "slot dikhao",
    }).json()
    assert body["tool_events"] == [{"tool": "find_slots", "status": "complete"}]


def test_scratchpad_is_never_spoken_to_the_citizen(monkeypatch):
    """
    gpt-oss can return an empty answer channel with its deliberation in
    reasoning_content. Reading that aloud recites the model's private thinking
    and the system prompt at the citizen, so the empty answer is re-asked for
    instead of being papered over with the scratchpad.
    """
    leak = ("User wants slot. We should pick one. But guidelines say "
            "\"Do not ask permission in words first\"...")
    replies = [
        {"content": "", "reasoning_content": leak},
        {"content": "मैं आपके लिए स्लॉट देख रहा हूँ।"},
    ]
    monkeypatch.setattr(voice_agent, "_call_nvidia",
                        lambda messages, tools=None, language=None: replies.pop(0))
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-scratchpad"}).json()
    body = client.post("/agent/voice/turn", json={
        "session_id": session["session_id"], "transcript": "slot",
    }).json()
    assert body["reply"] == "मैं आपके लिए स्लॉट देख रहा हूँ।"
    assert "guidelines" not in body["reply"]


def test_empty_answer_never_leaves_the_citizen_with_nothing(monkeypatch):
    """If even the re-ask comes back empty, say something rather than nothing."""
    monkeypatch.setattr(voice_agent, "_call_nvidia",
                        lambda messages, tools=None, language=None: {"content": "", "reasoning_content": "hmm"})
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-silent"}).json()
    body = client.post("/agent/voice/turn", json={
        "session_id": session["session_id"], "transcript": "namaste",
    }).json()
    assert body["reply"] == "मैं आपकी मदद के लिए तैयार हूँ।"


def test_tool_call_markup_never_reaches_the_citizen(monkeypatch):
    """
    On the final tool-free ask the model still wants a tool, so it writes the
    call into its answer. Read aloud, the citizen hears
    "<call to=functions.explain_ll_step>{...}".
    """
    monkeypatch.setattr(voice_agent, "_call_nvidia",
                        lambda messages, tools=None, language=None: {
                            "content": 'मैं बताता हूँ।\n<call to=functions.explain_ll_step>'
                                       '{"step":"full_process"}</call>',
                        })
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-markup"}).json()
    reply = client.post("/agent/voice/turn", json={
        "session_id": session["session_id"], "transcript": "पूरी प्रक्रिया बताइए",
    }).json()["reply"]
    assert reply == "मैं बताता हूँ।"
    assert "<call" not in reply and "functions." not in reply


def test_the_reply_language_is_decided_from_the_message(monkeypatch):
    """
    Decided here, not left to the model: a prompt rule alone did not hold, and
    English questions kept coming back in Hindi several turns into a call.
    """
    assert "English" in voice_agent._language_steer("how much time does it take?")
    assert "Devanagari" in voice_agent._language_steer("टेस्ट के दिन क्या लाना होगा?")
    assert "Hinglish" in voice_agent._language_steer("mujhe learner licence banwana hai")

    seen: list[Any] = []

    def capture(messages, tools=None, language=None):
        seen.append(language)
        return {"content": "ok"}

    monkeypatch.setattr(voice_agent, "_call_nvidia", capture)
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-lang"}).json()
    client.post("/agent/voice/turn", json={
        "session_id": session["session_id"], "transcript": "what documents do I bring?",
    })
    assert seen and "English" in seen[0]


def test_a_broad_question_still_gets_an_answer(monkeypatch):
    """
    "Explain the whole process" legitimately costs several lookups. Spending
    the round budget used to end the turn with a canned apology, throwing away
    everything the model had just gathered.
    """
    calls = {"n": 0}

    def researching_model(messages, tools=None, language=None):
        calls["n"] += 1
        if tools is None:                      # the final, tool-free ask
            return {"content": "कागज़, शुल्क और टेस्ट का पूरा ब्यौरा यह है।"}
        step = ["documents", "fee", "test_format", "pass_criteria"][calls["n"] % 4]
        return {"content": "", "tool_calls": [{
            "id": f"r{calls['n']}",
            "function": {"name": "explain_ll_step",
                         "arguments": json.dumps({"step": step})},
        }]}

    monkeypatch.setattr(voice_agent, "_call_nvidia", researching_model)
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-broad"}).json()
    body = client.post("/agent/voice/turn", json={
        "session_id": session["session_id"], "transcript": "puri prakriya samjhaiye",
    }).json()
    assert body["reply"] == "कागज़, शुल्क और टेस्ट का पूरा ब्यौरा यह है।"
    assert len(body["tool_events"]) == voice_agent.MAX_TOOL_ROUNDS


def test_paid_turns_are_rate_limited(monkeypatch):
    """
    The turn endpoint has no login in front of it and every hit is a paid
    upstream call, so a caller has to run out of budget before the bill does.
    """
    monkeypatch.setattr(voice_agent, "_call_nvidia",
                        lambda messages, tools=None, language=None: {"content": "ठीक है।"})
    voice_agent._CALLER_HITS.clear()
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-flood"}).json()
    sid = session["session_id"]

    codes = [client.post("/agent/voice/turn",
                         json={"session_id": sid, "transcript": f"turn {i}"}).status_code
             for i in range(voice_agent.TURNS_PER_SESSION + 3)]
    assert codes[:voice_agent.TURNS_PER_SESSION] == [200] * voice_agent.TURNS_PER_SESSION
    assert set(codes[voice_agent.TURNS_PER_SESSION:]) == {429}
    voice_agent._CALLER_HITS.clear()


def test_a_gated_turn_is_free(monkeypatch):
    """
    A turn refused because an action awaits confirmation never reaches the
    model, so it must not spend the caller's budget either.
    """
    replies = [{"content": "", "tool_calls": [{
        "id": "g1", "function": {"name": "apply_for_licence", "arguments": "{}"}}]},
        {"content": "कृपया पुष्टि करें।"}]
    monkeypatch.setattr(voice_agent, "_call_nvidia",
                        lambda messages, tools=None, language=None: replies.pop(0) if replies else {"content": "ok"})
    voice_agent._CALLER_HITS.clear()
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-free-gate"}).json()
    sid = session["session_id"]
    client.post("/agent/voice/turn", json={"session_id": sid, "transcript": "apply"})
    spent = len(voice_agent._SESSIONS[sid].turn_stamps)
    for _ in range(4):
        client.post("/agent/voice/turn", json={"session_id": sid, "transcript": "jaldi karo"})
    assert len(voice_agent._SESSIONS[sid].turn_stamps) == spent
    voice_agent._CALLER_HITS.clear()


def test_find_slots_searches_the_day_the_citizen_asked_for():
    """
    The day was hardcoded to today, so a citizen asking for the 25th was read
    the 24th's times — and the voice path could not book any other day at all,
    though the grid runs six days ahead.
    """
    tomorrow = date.today() + timedelta(days=1)
    found = dispatch_tool("find_slots", {"rto_id": "mh01", "date": tomorrow.isoformat()})
    assert found["date"] == tomorrow.isoformat()
    assert found["slots"], "tomorrow has no bookable times"
    assert {s["date"] for s in found["slots"]} == {tomorrow.isoformat()}

    slot = be.get_slot(found["slots"][0]["slot_id"])
    assert slot is not None and slot.slot_date == tomorrow

    # A day outside the window is refused with the window, not with a bare no:
    # given nothing to offer instead, the model picks a date of its own.
    far = dispatch_tool("find_slots", {"rto_id": "mh01",
                                       "date": (date.today() + timedelta(days=90)).isoformat()})
    assert far["slots"] == [] and far["error"]
    assert far["bookable_to"] == (date.today()
                                  + timedelta(days=be.SLOT_DAYS_AHEAD - 1)).isoformat()
    assert dispatch_tool("find_slots", {"date": "next tuesday"})["error"]


def test_find_slots_offers_every_time_of_day_once():
    """
    Two failures in one line of code. Truncating to six slots covered only the
    first two times — three inspectors each — so the agent told a citizen 11:00
    was unavailable when it was free. And three entries for one time, differing
    only by an opaque uuid, is what made it offer "10:15 with Inspector A" and
    then book Inspector C's row.
    """
    found = dispatch_tool("find_slots", {"rto_id": "mh01",
                                         "date": (date.today() + timedelta(days=2)).isoformat()})
    times = [s["time"] for s in found["slots"]]
    assert times == sorted(times) and len(times) == len(set(times)), times
    # The whole working day is on offer, not just the opening times.
    assert "11:00" in times and times[-1] > "14:00", times

    # One id per time, and it belongs to the inspector that was named with it.
    for entry in found["slots"]:
        slot = be.get_slot(entry["slot_id"])
        assert slot is not None
        assert slot.start.strftime("%H:%M") == entry["time"]
        assert be.get_tester(slot.tester_id).name == entry["tester"]
        assert entry["left"] >= 1


def test_the_confirmation_names_the_appointment_it_will_actually_book():
    """
    The gate handed the model nothing but "Book the selected test appointment",
    so the sentence spoken before the button was invented: it promised the 25th
    with Inspector A, then read the booking back as the 24th with Inspector C.
    """
    applied = dispatch_tool("apply_for_licence", {"citizen_ref": "voice-gate-detail",
                                                  "licence_kind": "learner",
                                                  "rto_id": "mh01"})
    on = (date.today() + timedelta(days=3)).isoformat()
    slot = dispatch_tool("find_slots", {"rto_id": "mh01", "date": on})["slots"][0]

    details = voice_agent.pending_details("book_slot", {"slot_id": slot["slot_id"]})
    assert details["date"] == on
    assert details["time"] == slot["time"] and details["tester"] == slot["tester"]

    label = voice_agent._action_label("book_slot", details)
    assert slot["time"] in label and slot["tester"] in label and details["day"] in label

    # And what the gate reports is what booking it returns — the pre-press
    # sentence and the post-press sentence cannot come from different rows.
    booked = dispatch_tool("book_slot", {"application_id": applied["application_id"],
                                         "slot_id": slot["slot_id"]})
    assert booked["ok"]
    assert (booked["date"], booked["time"], booked["tester"]) == (
        details["date"], details["time"], details["tester"])


def test_an_unbookable_slot_never_reaches_the_confirm_button(monkeypatch):
    """
    A button that is certain to fail costs the citizen a press and tells them
    nothing. The model is sent back to find_slots on that same turn instead.
    """
    applied = dispatch_tool("apply_for_licence", {"citizen_ref": "voice-stale-slot",
                                                  "licence_kind": "learner",
                                                  "rto_id": "mh01"})
    on = (date.today() + timedelta(days=4)).isoformat()
    slot = dispatch_tool("find_slots", {"rto_id": "mh01", "date": on})["slots"][0]
    # Somebody else takes it between the agent reading it out and booking it.
    dispatch_tool("book_slot", {"application_id": applied["application_id"],
                                "slot_id": slot["slot_id"]})
    assert voice_agent.pending_details("book_slot", {"slot_id": slot["slot_id"]}) \
        == {"unavailable": "taken"}
    assert voice_agent.pending_details("book_slot", {"slot_id": "no-such-slot"}) \
        == {"unavailable": "unknown"}

    replies = [
        {"content": "", "tool_calls": [{"id": "s1", "function": {
            "name": "book_slot", "arguments": json.dumps({"slot_id": slot["slot_id"]})}}]},
        {"content": "वह समय अभी किसी और ने ले लिया।"},
    ]
    monkeypatch.setattr(voice_agent, "_call_nvidia",
                        lambda messages, tools=None, language=None: replies.pop(0))
    session = voice_agent.start_session("voice-stale-slot")
    session.application_id = applied["application_id"]
    body = client.post("/agent/voice/turn",
                       json={"session_id": session.id, "transcript": "wahi book karo"}).json()
    assert body["tool_events"] == [{"tool": "book_slot", "status": "error"}]
    assert "pending_confirmation" not in body
    assert session.pending is None


def test_the_model_is_told_what_day_it_is(monkeypatch):
    """
    It has no clock, and find_slots needs a YYYY-MM-DD. Given nothing to count
    from, it invented a date for "the 25th" and the tool searched another day.
    """
    sent: list[dict] = []
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key")

    class Fake:
        status_code = 200

        @staticmethod
        def json():
            return {"choices": [{"message": {"content": "ठीक है।"}}]}

    def capture(url, headers=None, json=None, timeout=None):
        sent.append(json)
        return Fake()

    monkeypatch.setattr(voice_agent.httpx, "post", capture)
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-clock"}).json()
    client.post("/agent/voice/turn", json={"session_id": session["session_id"],
                                           "transcript": "25 तारीख का slot chahiye"})
    steer = sent[0]["messages"][-1]
    assert steer["role"] == "system"
    # The engine builds its grids on the local date, so the model must be told
    # that same date — not UTC, which is a different day for part of every night.
    assert date.today().isoformat() in steer["content"]
    assert "Devanagari" in steer["content"], "the language steer was dropped"


def test_a_session_picks_up_the_application_the_citizen_already_has():
    """
    Someone who filled in the wizard and then opened Saarthi to book was told to
    apply first — the session only ever learned an id from a tool it had run
    itself. Taking that answer filed a second application at the default office,
    and the appointment then hung off a record the tracker was not showing.
    """
    ref = "voice-resume-wizard"
    existing = client.post("/apply", json={
        "citizen_ref": ref, "licence_kind": "learner", "rto_id": "br33",
        "idempotency_key": "wizard-key-1", "applicant_name": "Asha Devi",
    }).json()

    session = voice_agent.start_session(ref)
    assert session.application_id == existing["application_id"]
    assert session.rto_id == "br33"

    # And booking now goes through that application, not a fresh one.
    args = voice_agent._tool_arguments(session, "book_slot", {"slot_id": "x"})
    assert args["application_id"] == existing["application_id"]


def test_slot_searches_follow_the_office_the_application_was_filed_at():
    """
    find_slots defaulted to mh01 whatever the application said, so a citizen who
    applied in Samastipur was read Andheri's times and booked there — six
    hundred kilometres from the office holding their papers.
    """
    ref = "voice-office-follows"
    client.post("/apply", json={"citizen_ref": ref, "licence_kind": "learner",
                                "rto_id": "br06", "idempotency_key": "wizard-key-2"}).json()
    session = voice_agent.start_session(ref)

    for tool in ("find_slots", "find_slot_days"):
        assert voice_agent._tool_arguments(session, tool, {})["rto_id"] == "br06"
    # Named explicitly, another office still wins — the citizen may be moving.
    assert voice_agent._tool_arguments(
        session, "find_slots", {"rto_id": "mh01"})["rto_id"] == "mh01"

    found = dispatch_tool("find_slots", voice_agent._tool_arguments(session, "find_slots", {}))
    assert found["rto_id"] == "br06" and "Darbhanga" in found["office"]
    assert be.get_slot(found["slots"][0]["slot_id"]).rto_id == "br06"

    # Browsing another office must not repoint the session at it.
    voice_agent._remember_ids(session, dispatch_tool("find_slot_days", {"rto_id": "mh01"}))
    assert session.rto_id == "br06"


def test_the_offices_and_days_the_agent_offers_are_the_ones_the_wizard_shows():
    """
    The wizard asks for an office first and then a day, because both are real
    choices. With neither tool the agent could only ever apply at the default
    office and guess at dates one call at a time.
    """
    bihar = dispatch_tool("list_offices", {"state": "Bihar"})["offices"]
    assert {o["rto_id"] for o in bihar} == {"br33", "br06", "br01"}
    assert [o["km"] for o in bihar] == sorted(o["km"] for o in bihar), "not nearest first"
    for office in bihar:
        assert office["load"] in {"light", "busy"} and office["name"]

    days = dispatch_tool("find_slot_days", {"rto_id": "br33"})
    assert [d["date"] for d in days["days"]] == [
        (date.today() + timedelta(days=n)).isoformat()
        for n in range(be.SLOT_DAYS_AHEAD)
    ]
    assert all(d["left"] >= 0 and d["day"] for d in days["days"])
    assert "Samastipur" in days["office"]


def test_a_second_booking_is_refused_with_the_appointment_already_held():
    """
    An application holds one appointment. Left to the booking call, the citizen
    presses Confirm and is told afterwards that it did nothing — and a citizen
    asking to book twice is usually one who does not believe the first worked.
    """
    ref = "voice-double-book"
    applied = dispatch_tool("apply_for_licence", {"citizen_ref": ref,
                                                  "licence_kind": "learner",
                                                  "rto_id": "mh02"})
    on = (date.today() + timedelta(days=2)).isoformat()
    slots = dispatch_tool("find_slots", {"rto_id": "mh02", "date": on})["slots"]
    dispatch_tool("book_slot", {"application_id": applied["application_id"],
                                "slot_id": slots[0]["slot_id"]})

    blocked = voice_agent.pending_details("book_slot", {
        "application_id": applied["application_id"], "slot_id": slots[1]["slot_id"]})
    assert blocked["unavailable"] == "already_booked"
    assert blocked["time"] == slots[0]["time"] and "Wadala" in blocked["office"]

    told = voice_agent._unbookable(blocked)
    assert slots[0]["time"] in told and blocked["day"] in told and "Wadala" in told


def test_the_whole_apply_to_booked_journey_over_voice(monkeypatch):
    """
    The journey the demo is judged on, end to end through the gate: apply at the
    office the citizen named, find the day, find the time, book it. Every
    spoken-facing string has to come from the tools, and the two mutating steps
    each have to stop at a confirmation.
    """
    on = (date.today() + timedelta(days=3)).isoformat()
    script = [
        {"content": "", "tool_calls": [{"id": "o1", "function": {
            "name": "list_offices", "arguments": '{"state":"Bihar"}'}}]},
        {"content": "", "tool_calls": [{"id": "a1", "function": {
            "name": "apply_for_licence", "arguments": '{"rto_id":"br01"}'}}]},
        {"content": "मैं पटना में आपका आवेदन बनाऊँगा। कृपया पुष्टि करें।"},
    ]

    def scripted(messages, tools=None, language=None):
        return script.pop(0) if script else {"content": "आपका आवेदन बन गया है।"}

    monkeypatch.setattr(voice_agent, "_call_nvidia", scripted)
    started = client.post("/agent/voice/start",
                          json={"citizen_ref": "voice-journey"}).json()
    sid = started["session_id"]

    applying = client.post("/agent/voice/turn", json={
        "session_id": sid, "transcript": "पटना में लर्नर लाइसेंस बनवाना है"}).json()
    assert [e["status"] for e in applying["tool_events"]] == ["complete", "awaiting_confirmation"]
    applied = client.post("/agent/voice/confirm", json={"session_id": sid}).json()
    result = applied["tool_events"][0]["result"]
    assert result["rto_id"] == "br01" and "Patna" in result["office"]

    session = voice_agent._SESSIONS[sid]
    assert session.application_id and session.rto_id == "br01"

    # Booking: days, then times, then the action — all inside one turn.
    found = dispatch_tool("find_slots", {"rto_id": "br01", "date": on})
    chosen = found["slots"][1]
    script[:] = [
        {"content": "", "tool_calls": [{"id": "d1", "function": {
            "name": "find_slot_days", "arguments": "{}"}}]},
        {"content": "", "tool_calls": [{"id": "t1", "function": {
            "name": "find_slots", "arguments": json.dumps({"date": on})}}]},
        {"content": "", "tool_calls": [{"id": "b1", "function": {
            "name": "book_slot", "arguments": json.dumps({"slot_id": chosen["slot_id"]})}}]},
        {"content": "मैं यह समय बुक करूँगा। कृपया पुष्टि करें।"},
    ]
    booking = client.post("/agent/voice/turn", json={
        "session_id": sid, "transcript": f"{on} को slot book karo"}).json()
    assert [e["status"] for e in booking["tool_events"]] == [
        "complete", "complete", "awaiting_confirmation"]

    # The button names the appointment the confirm will actually make.
    label = booking["pending_confirmation"]["label"]
    assert chosen["time"] in label and chosen["tester"] in label and "Patna" in label

    booked = client.post("/agent/voice/confirm",
                         json={"session_id": sid}).json()["tool_events"][0]["result"]
    assert booked["ok"] is True
    # The panel needs this to put a spoken booking on the same screens as a
    # wizard one; every other field here is what gets read aloud.
    assert booked["booking_id"]
    assert (booked["date"], booked["time"], booked["tester"]) == (
        on, chosen["time"], chosen["tester"])
    assert "Patna" in booked["office"]

    # And the journey now reads back the same appointment it just made.
    status = dispatch_tool("get_journey_status", {"citizen_id": "voice-journey"})
    assert status["stage"] == "slot_booked"
    assert status["appointment"]["date"] == on
    assert status["appointment"]["time"] == chosen["time"]
    assert "Patna" in status["appointment"]["office"]


def test_no_tool_name_ever_reaches_a_field_the_agent_reads_aloud():
    """
    The agent is told never to name a tool, and was then handed
    "Pick a test appointment time (find_slots, then book_slot)" to read out.
    """
    names = {t["name"] for t in voice_agent.AGENT_TOOL_SCHEMA}
    spoken = [dispatch_tool("apply_for_licence", {"citizen_ref": "voice-no-toolnames",
                                                  "licence_kind": "learner"})["next_action"]]
    spoken += [step["text"] for step in
               (dispatch_tool("explain_ll_step", {"step": s}) for s in
                ("eligibility", "documents", "fee", "test_format",
                 "pass_criteria", "after_pass"))]
    for text in spoken:
        assert text, "an empty line is not an answer"
        for name in names:
            assert name not in text, f"tool name {name!r} in text read aloud: {text!r}"


def test_voice_cancel_discards_server_pending_action():
    session = voice_agent.start_session("voice-cancel")
    session.pending = voice_agent.PendingAction("check_in", {"application_id": "x"}, "Check in")
    response = client.post("/agent/voice/cancel", json={"session_id": session.id})
    assert response.status_code == 200
    assert response.json()["cancelled"] is True
    assert session.pending is None
