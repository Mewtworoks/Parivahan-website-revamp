"""Saarthi's safety boundary: model proposes; citizen confirms; tools execute."""

import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from conftest import BOOKABLE_DAY, applicant
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
    """
    A turn that needs the model says so plainly when there is no key.

    This used to send "मुझे लाइसेंस चाहिए" and expect a 503. That transcript no
    longer reaches the model at all — it is a request to start the form, which
    the service now answers itself — so it stopped testing anything. The
    property is about turns that genuinely need the model, and asking what the
    fee is, is one.
    """
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-no-key"}).json()
    response = client.post("/agent/voice/turn", json={
        "session_id": session["session_id"], "transcript": "फ़ीस के बारे में बताइए",
    })
    assert response.status_code == 503
    assert "NVIDIA_API_KEY" in response.json()["detail"]


def test_the_form_still_fills_when_the_language_service_is_gone(monkeypatch):
    """
    The journey the demo is judged on no longer depends on an upstream API.

    Worth stating as its own guarantee rather than as a side effect: the four
    questions, the confirmation and the result are composed from what the
    citizen said, so an NVIDIA outage costs explanations and slot negotiation
    and costs the application nothing.
    """
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)

    def must_not_be_called(*args, **kwargs):
        raise AssertionError("the form spine called the language service")

    monkeypatch.setattr(voice_agent, "_call_nvidia", must_not_be_called)
    sid = client.post("/agent/voice/start",
                      json={"citizen_ref": "voice-offline"}).json()["session_id"]

    for said in ("I want a learner licence", "Sehaj Gaba", "11 April 2008",
                 "Maharashtra", "two wheeler"):
        body = client.post("/agent/voice/turn",
                           json={"session_id": sid, "transcript": said})
        assert body.status_code == 200, body.text
        answer = body.json()

    assert answer["pending_confirmation"], "never reached the confirmation"
    filed = client.post("/agent/voice/confirm", json={"session_id": sid}).json()
    result = filed["tool_events"][0]["result"]
    assert result["application_no"].startswith("SS-")
    assert result["applicant_name"] == "Sehaj Gaba"
    # And the one sentence that must never be missing is in the spoken reply.
    assert "simulated" in filed["reply"].lower()


def test_voice_queues_mutation_until_visible_confirmation(monkeypatch):
    calls = []

    def fake_model(messages, tools=None, language=None, form=''):
        calls.append((messages, tools))
        if len(calls) == 1:
            return {
                "content": "",
                "tool_calls": [{
                    "id": "call_apply",
                    "function": {
                        "name": "apply_for_licence",
                        "arguments": '{"licence_kind":"learner","rto_id":"mh01","full_name":"Test Applicant","dob":"2008-04-11","state":"Maharashtra","licence_classes":["MCWG"]}',
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
            {"id": "p1", "function": {"name": "apply_for_licence",
             "arguments": '{"licence_kind":"learner","full_name":"Test Applicant","dob":"2008-04-11","state":"Maharashtra","licence_classes":["MCWG"]}'}},
            {"id": "p2", "function": {"name": "find_slots", "arguments": '{"rto_id":"mh01"}'}},
        ]},
        {"content": "कृपया पुष्टि करें।"},
    ]

    def strict_model(messages, tools=None, language=None, form=''):
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
    app_obj = dispatch_tool("apply_for_licence", applicant("voice-lane", rto_id="mh01"))
    slots = dispatch_tool("find_slots", {"rto_id": "mh01", "date": BOOKABLE_DAY.isoformat()})
    dispatch_tool("book_slot", {"application_id": app_obj["application_id"],
                                "slot_id": slots["slots"][0]["slot_id"]})
    token = dispatch_tool("check_in", {"application_id": app_obj["application_id"]})
    queue = dispatch_tool("check_queue", {"token_id": token["token_id"]})

    assert queue["position_in_lane"] == queue["people_ahead"] + 1
    assert queue["position_in_lane"] <= queue["lane_size"]
    assert queue["tester"].startswith("Inspector")


def test_spoken_tool_results_never_carry_internal_ids():
    """Tool output is read aloud, so it must name the inspector, not a row key."""
    app_obj = dispatch_tool("apply_for_licence", applicant("voice-no-ids", rto_id="mh01"))
    slots = dispatch_tool("find_slots", {"rto_id": "mh01", "date": BOOKABLE_DAY.isoformat()})
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
                        lambda messages, tools=None, language=None, form='': replies.pop(0))
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-harmony"}).json()
    # Slot lookups are refused before an application exists, so give this one
    # the application it would have. The subject here is the mangled tool name,
    # not the gate.
    filed = dispatch_tool("apply_for_licence", applicant("voice-harmony"))
    voice_agent._SESSIONS[session["session_id"]].application_id = filed["application_id"]
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
                        lambda messages, tools=None, language=None, form='': replies.pop(0))
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-scratchpad"}).json()
    body = client.post("/agent/voice/turn", json={
        "session_id": session["session_id"], "transcript": "slot",
    }).json()
    assert body["reply"] == "मैं आपके लिए स्लॉट देख रहा हूँ।"
    assert "guidelines" not in body["reply"]


def _devanagari(text: str) -> bool:
    return any("ऀ" <= ch <= "ॿ" for ch in text)


def test_empty_answer_never_leaves_the_citizen_with_nothing(monkeypatch):
    """If even the re-ask comes back empty, say something rather than nothing."""
    monkeypatch.setattr(voice_agent, "_call_nvidia",
                        lambda messages, tools=None, language=None, form='': {"content": "", "reasoning_content": "hmm"})
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-silent"}).json()
    body = client.post("/agent/voice/turn", json={
        "session_id": session["session_id"], "transcript": "नमस्ते",
    }).json()
    assert body["reply"].strip()
    assert "guidelines" not in body["reply"]


def test_the_services_own_words_follow_the_citizens_language(monkeypatch):
    """
    The fallbacks are the service speaking, not the model, and they used to be
    hardcoded Hindi. Asked "I want a learner licence" in English, a citizen was
    answered "कृपया स्क्रीन पर पुष्टि करें" — which defeats the whole point of
    deciding the language per turn.
    """
    monkeypatch.setattr(voice_agent, "_call_nvidia",
                        lambda messages, tools=None, language=None, form='': {"content": "", "reasoning_content": "hmm"})

    english = client.post("/agent/voice/start", json={"citizen_ref": "voice-en"}).json()
    reply_en = client.post("/agent/voice/turn", json={
        "session_id": english["session_id"], "transcript": "I want a learner licence",
    }).json()["reply"]

    hindi = client.post("/agent/voice/start", json={"citizen_ref": "voice-hi"}).json()
    reply_hi = client.post("/agent/voice/turn", json={
        "session_id": hindi["session_id"], "transcript": "मुझे लाइसेंस चाहिए",
    }).json()["reply"]

    assert reply_en.strip() and not _devanagari(reply_en), reply_en
    assert reply_hi.strip() and _devanagari(reply_hi), reply_hi


def test_a_promised_action_that_never_ran_is_not_left_standing(monkeypatch):
    """
    The model sometimes says it will apply and calls nothing. Left alone the
    citizen is told to confirm, no button appears because nothing was queued,
    and they believe an application exists. After one correction that still
    produces no tool call, the service says so instead.
    """
    calls: list[dict] = []

    def never_calls_a_tool(messages, tools=None, language=None, form=''):
        calls.append({"tools": bool(tools)})
        return {"content": "I will book that appointment for you, please confirm."}

    monkeypatch.setattr(voice_agent, "_call_nvidia", never_calls_a_tool)
    # Booking rather than applying. The apply turn no longer reaches the model —
    # the service files the form itself — so the promise-without-a-call failure
    # can only happen on the steps the model still drives, which is where this
    # now proves it is caught.
    dispatch_tool("apply_for_licence", applicant("voice-promise"))
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-promise"}).json()
    body = client.post("/agent/voice/turn", json={
        "session_id": session["session_id"], "transcript": "book the 10:15 one",
    }).json()

    assert "please confirm" not in body["reply"].lower(), body["reply"]
    assert "nothing has been submitted" in body["reply"].lower(), body["reply"]
    assert not body.get("pending_confirmation")
    # Asked again after the correction, and only once — a model that keeps
    # promising must not loop the citizen.
    assert len(calls) == 2, calls


def test_tool_call_markup_never_reaches_the_citizen(monkeypatch):
    """
    On the final tool-free ask the model still wants a tool, so it writes the
    call into its answer. Read aloud, the citizen hears
    "<call to=functions.explain_ll_step>{...}".
    """
    monkeypatch.setattr(voice_agent, "_call_nvidia",
                        lambda messages, tools=None, language=None, form='': {
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

    def capture(messages, tools=None, language=None, form=''):
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

    def researching_model(messages, tools=None, language=None, form=''):
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
                        lambda messages, tools=None, language=None, form='': {"content": "ठीक है।"})
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
        "id": "g1", "function": {"name": "apply_for_licence",
        "arguments": '{"licence_kind":"learner","full_name":"Test Applicant","dob":"2008-04-11","state":"Maharashtra","licence_classes":["MCWG"]}'}}]},
        {"content": "कृपया पुष्टि करें।"}]
    monkeypatch.setattr(voice_agent, "_call_nvidia",
                        lambda messages, tools=None, language=None, form='': replies.pop(0) if replies else {"content": "ok"})
    voice_agent._CALLER_HITS.clear()
    session = client.post("/agent/voice/start", json={"citizen_ref": "voice-free-gate"}).json()
    sid = session["session_id"]
    # Answer the form so there is a real confirmation to be gated behind. "apply"
    # on its own used to reach the model and raise the button; it is answered by
    # the service now, so it gates nothing and this tested nothing.
    for said in ("apply", "Deepa Menon", "11 April 2008", "Maharashtra", "car"):
        client.post("/agent/voice/turn", json={"session_id": sid, "transcript": said})
    assert voice_agent._SESSIONS[sid].pending, "no confirmation to gate behind"
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
    applied = dispatch_tool("apply_for_licence", applicant("voice-gate-detail", rto_id="mh01"))
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
    applied = dispatch_tool("apply_for_licence", applicant("voice-stale-slot", rto_id="mh01"))
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
                        lambda messages, tools=None, language=None, form='': replies.pop(0))
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

    found = dispatch_tool("find_slots", voice_agent._tool_arguments(
        session, "find_slots", {"date": BOOKABLE_DAY.isoformat()}))
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
    applied = dispatch_tool("apply_for_licence", applicant(ref, rto_id="mh02"))
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
    script: list[dict] = []

    def scripted(messages, tools=None, language=None, form=''):
        return script.pop(0) if script else {"content": "आपका आवेदन बन गया है।"}

    monkeypatch.setattr(voice_agent, "_call_nvidia", scripted)
    started = client.post("/agent/voice/start",
                          json={"citizen_ref": "voice-journey", "language": "hi"}).json()
    sid = started["session_id"]

    # Applying is no longer a model conversation. This half of the test used to
    # script list_offices and apply_for_licence through the model and assert the
    # tool events came back "complete, awaiting_confirmation". That assertion
    # was testing the wrong thing once the service started filling the form: it
    # proved the model *could* be walked through the questions, not that the
    # citizen gets through them. What matters is unchanged and asserted below —
    # the office the citizen named is the office it is filed at, and nothing is
    # filed until the button is pressed.
    applying = client.post("/agent/voice/turn", json={
        "session_id": sid, "transcript": "पटना में लर्नर लाइसेंस बनवाना है"}).json()
    assert not applying.get("pending_confirmation"), "filed with no name or date"

    # A real-looking name on purpose: "Test Applicant" is refused, because
    # "test" is a word this service uses constantly and no name parser should
    # accept "book my test" as somebody's name.
    for said in ("Rohan Verma", "11 April 2008", "two wheeler"):
        applying = client.post("/agent/voice/turn",
                               json={"session_id": sid, "transcript": said}).json()
    # Patna was heard on the very first turn and never asked about again.
    assert applying["pending_confirmation"]
    assert "Patna" in applying["reply"], applying["reply"]

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
    spoken = [dispatch_tool("apply_for_licence", applicant("voice-no-toolnames"))["next_action"]]
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


# --------------------------------------------------------------------------
# Saarthi fills the form. What it fills it with has to be the citizen's.
# --------------------------------------------------------------------------

def test_an_application_is_never_filed_with_details_the_citizen_never_gave():
    """
    The tool schema's "required" list is advice to a model, not a rule. Asked to
    apply with nothing but a licence kind, the service used to file a nameless
    application and report success — so a model that skipped the questions
    produced a record belonging to nobody, and said it was verified.

    Refused, and refused usefully: the reply carries the questions to ask.
    """
    result = dispatch_tool("apply_for_licence",
                           {"citizen_ref": "guard-empty", "licence_kind": "learner"})
    assert "application_id" not in result, "an application was filed with no details"
    assert set(result["needs"]) == {"full_name", "dob", "state", "licence_classes"}
    # Each one has to arrive as something Saarthi can say out loud. A field name
    # read to somebody who cannot read the form is not a question. Contains a
    # question rather than ends with one: the date of birth deliberately adds
    # "say the day, the month and the year" after the question mark.
    for item in result["ask_for"]:
        assert "?" in item["ask"] and len(item["ask"].split()) > 3, item


def test_a_date_of_birth_is_taken_however_the_citizen_says_it():
    """
    Saarthi used to demand the date "in the format YYYY-MM-DD", out loud, to a
    person. That is a machine interrogating a citizen, and it is exactly the
    voice this build exists to replace — so the service reads what people
    actually say instead, and the format never has to be mentioned.

    Day-first for slashed dates, because that is how a date is written in India.
    """
    from app.agent_tools import normalise_dob

    for said in ["2008-04-11", "11/04/2008", "11-04-2008", "11.04.2008",
                 "11 April 2008", "11 apr 2008", "April 11, 2008"]:
        assert normalise_dob(said) == "2008-04-11", said

    filed = dispatch_tool("apply_for_licence", applicant("guard-dob", dob="11 April 2008"))
    assert filed["form_prefill"]["dob"] == "2008-04-11"


def test_a_date_that_cannot_be_read_is_asked_again_rather_than_guessed():
    """
    The tracker authenticates on date of birth, so a wrong one locks somebody
    out of their own application. Anything genuinely ambiguous or impossible is
    a question, never a stored guess.
    """
    from app.agent_tools import normalise_dob

    for nonsense in ["", "sometime in 2008", "11/04/08", "2008-13-40",
                     "32 April 2008", "next Tuesday", "2035-01-01"]:
        assert normalise_dob(nonsense) is None, nonsense

    result = dispatch_tool("apply_for_licence", applicant("guard-dob-2", dob="sometime in 2008"))
    assert result.get("needs") == ["dob"]
    assert "application_id" not in result
    # And the question it comes back with must not name a format.
    asked = next(m["ask"] for m in result["ask_for"] if m["field"] == "dob")
    assert "YYYY" not in asked and "format" not in asked.lower()


def test_the_office_follows_the_state_the_citizen_named():
    """Saying "Bihar" and being filed in Mumbai is a wasted journey, not a typo."""
    result = dispatch_tool("apply_for_licence",
                           applicant("guard-state", state="Bihar"))
    assert result["rto_id"].startswith("br"), result["rto_id"]
    # And what comes back is the office's own name, not the row key, because it
    # is read aloud.
    assert result["office"] and not result["office"].startswith("br")
    assert result["form_prefill"]["state"] == "Bihar"


def test_what_the_citizen_said_comes_back_for_the_form_they_will_see():
    """
    Saarthi tells them the form is filled, so the form has to actually hold
    their answers — otherwise the browser has nothing to put on screen and the
    claim is another decoration.
    """
    result = dispatch_tool("apply_for_licence", applicant(
        "guard-prefill", full_name="Anita Shubhangi Kulkarni",
        dob="2008-04-11", state="Maharashtra", licence_classes=["MCWG", "LMV-NT"]))
    assert result["applicant_name"] == "Anita Shubhangi Kulkarni"
    assert result["licence_classes"] == ["MCWG", "LMV-NT"]
    prefill = result["form_prefill"]
    assert prefill["full_name"] == "Anita Shubhangi Kulkarni"
    assert prefill["dob"] == "2008-04-11"
    assert prefill["classes"] == ["MCWG", "LMV-NT"]


def test_the_simulated_verification_is_handed_to_the_agent_to_say():
    """
    The ledger row has always read "Documents verified (mock)". The one place
    that qualifier never reached was the sentence a citizen actually hears,
    which is the sentence that matters — "created and verified at Andheri RTO"
    invites them to believe a government record was checked. Nothing was.
    """
    result = dispatch_tool("apply_for_licence", applicant("guard-disclosure"))
    assert result["verification"] == "mocked"
    disclosure = result["disclosure"].lower()
    for word in ("aadhaar", "otp", "simulated"):
        assert word in disclosure, f"{word!r} missing from what the agent is told to say"


# --------------------------------------------------------------------------
# The transcript that went wrong, turned into tests.
#
#   citizen: help me with ll
#   Saarthi: Sure! What's your full name?
#   citizen: sehaj gaba
#   Saarthi: Which day would you like to book your test slot?      <- lost it
#   citizen: is my form fully filled
#   Saarthi: I need your date of birth ... (Use the format YYYY-MM-DD)
#
# Three failures in six turns: it forgot what it was collecting, jumped to a
# step three answers early, and read a machine format out to a person.
# --------------------------------------------------------------------------

def _fresh_session(ref: str) -> str:
    return client.post("/agent/voice/start", json={"citizen_ref": ref}).json()["session_id"]


def test_the_service_remembers_answers_the_model_forgets():
    """
    The model gave one field and dropped the rest. It no longer has to hold
    them: each answer is kept on the session and put back on every later call,
    so four questions answered across four turns still file one application.
    """
    sid = _fresh_session("flow-memory")
    session = voice_agent._SESSIONS[sid]

    # One field per turn, each call "forgetting" everything said before it.
    for supplied in [{"full_name": "Sehaj Gaba"},
                     {"dob": "11 April 2008"},
                     {"state": "Maharashtra"},
                     {"licence_classes": ["MCWG"]}]:
        args = voice_agent._tool_arguments(session, "apply_for_licence", dict(supplied))

    assert args["full_name"] == "Sehaj Gaba"
    assert args["state"] == "Maharashtra"
    assert args["licence_classes"] == ["MCWG"]
    # And the whole thing files, from answers no single tool call ever carried.
    filed = dispatch_tool("apply_for_licence", args)
    assert filed["applicant_name"] == "Sehaj Gaba"
    assert filed["form_prefill"]["dob"] == "2008-04-11"


def test_a_correction_overwrites_the_earlier_answer():
    """Remembering answers must not mean refusing to change one."""
    sid = _fresh_session("flow-correction")
    session = voice_agent._SESSIONS[sid]
    voice_agent._tool_arguments(session, "apply_for_licence", {"full_name": "Sehaj Gaba"})
    args = voice_agent._tool_arguments(session, "apply_for_licence",
                                       {"full_name": "Sehaj Singh Gaba"})
    assert args["full_name"] == "Sehaj Singh Gaba"


def test_slots_are_refused_while_the_form_is_still_half_filled(monkeypatch):
    """
    "Which day would you like to book your test slot?" — asked after one answer
    of four. There is nothing to book against, so the lookup sends the model
    back to the form carrying the next question instead of answering.
    """
    replies = [
        {"content": "", "tool_calls": [{
            "id": "s1", "function": {"name": "find_slot_days", "arguments": "{}"}}]},
        {"content": "Pehle form pura karte hain."},
    ]
    monkeypatch.setattr(voice_agent, "_call_nvidia",
                        lambda messages, tools=None, language=None, form='': replies.pop(0))
    sid = _fresh_session("flow-early-slots")
    voice_agent._SESSIONS[sid].form_answers = {"full_name": "Sehaj Gaba"}

    body = client.post("/agent/voice/turn", json={
        "session_id": sid, "transcript": "book my slot"}).json()

    assert [e["status"] for e in body["tool_events"]] == ["redirected"]
    handed_back = json.loads(voice_agent._SESSIONS[sid].messages[-2]["content"])
    assert "blocked" in handed_back
    assert set(handed_back["needs"]) == {"dob", "state", "licence_classes"}
    assert handed_back["have"] == {"full_name": "Sehaj Gaba"}


def test_every_turn_restates_what_is_answered_and_what_is_left():
    """
    The model is not asked to remember across turns — it is told, as the last
    thing it reads before replying.
    """
    sid = _fresh_session("flow-steer")
    session = voice_agent._SESSIONS[sid]
    session.form_answers = {"full_name": "Sehaj Gaba"}

    steer = voice_agent._form_steer(session)
    assert "Sehaj Gaba" in steer
    assert "dob" in steer and "state" in steer and "licence_classes" in steer
    assert "date of birth" in steer          # the exact next question to ask
    assert "mention test slots" in steer
    # Told only to ask the next question, it looked up the fee, said nothing
    # about it, and asked for a date of birth. A turn that reaches the model at
    # all is usually a question, and a question deserves an answer.
    assert "answer it first" in steer


def test_the_steer_stops_asking_once_the_form_is_filed():
    """Being asked your name again after applying reads as the service losing it."""
    sid = _fresh_session("flow-steer-done")
    session = voice_agent._SESSIONS[sid]
    session.application_id = "already-filed"
    steer = voice_agent._form_steer(session)
    assert "already filed" in steer
    assert "booking the test slot" in steer


def test_no_date_format_is_ever_put_in_front_of_the_model_to_repeat():
    """
    "(Use the format YYYY-MM-DD)" reached the citizen because the service handed
    that string to the model. Nothing it is told about the citizen's date may
    carry a format for it to read out.
    """
    sid = _fresh_session("flow-no-format")
    session = voice_agent._SESSIONS[sid]
    steer = voice_agent._form_steer(session)
    spoken_instruction = steer.split("Still needed")[0]
    assert "YYYY" not in spoken_instruction

    missing = voice_agent.missing_application_details("", None, "", [])
    for item in missing:
        assert "YYYY" not in item["ask"]
        assert "format" not in item["ask"].lower()


def test_verified_is_never_said_without_saying_it_was_simulated():
    """
    The model was handed the disclosure and told to pass it on, and still said
    "your application has been created and verified" and stopped there. So the
    service appends it rather than trusting the model to remember.
    """
    filed = {"application_no": "SS-2026-004182", "verification": "mocked"}
    said = voice_agent._with_disclosure(
        "Your application SS-2026-004182 has been created and verified.", filed, None)
    assert "simulated" in said.lower()

    # Not repeated when the model did remember.
    already = voice_agent._with_disclosure(
        "Created. Document checks are simulated in this prototype.", filed, None)
    assert already.lower().count("simulated") == 1

    # Hindi conversation, Hindi qualifier.
    hindi = voice_agent._with_disclosure(
        "आपका आवेदन बन गया है।", filed, "Answer in Hindi.")
    assert "नकली" in hindi

    # Nothing appended to results that make no such claim.
    assert voice_agent._with_disclosure("Booked.", {"ok": True}, None) == "Booked."


def test_the_next_question_is_asked_in_the_citizens_language():
    """
    The form questions are spoken by the service, not the model, so they have to
    carry the language themselves.
    """
    sid = _fresh_session("flow-language")
    session = voice_agent._SESSIONS[sid]
    assert voice_agent._next_question(session) == \
        "What is your full name, first name and surname?"

    session.language = "Answer in Hindi."
    assert "पूरा नाम" in voice_agent._next_question(session)

    # Nothing left to ask once the answers are in.
    session.form_answers = {"full_name": "Sehaj Gaba", "dob": "2008-04-11",
                            "state": "Maharashtra", "licence_classes": ["MCWG"]}
    assert voice_agent._next_question(session) is None


def test_a_half_filled_form_never_raises_a_confirmation_button(monkeypatch):
    """
    Called with two answers of four, apply used to reach the gate and put
    "Create your learner-licence application" on screen — offering to file
    something that cannot be filed.
    """
    replies = [
        {"content": "", "tool_calls": [{
            "id": "c1", "function": {"name": "apply_for_licence",
                                     "arguments": '{"full_name":"Sehaj Gaba"}'}}]},
        {"content": "ok"},
    ]
    monkeypatch.setattr(voice_agent, "_call_nvidia",
                        lambda messages, tools=None, language=None, form='': replies.pop(0))
    sid = _fresh_session("flow-partial-gate")
    body = client.post("/agent/voice/turn", json={
        "session_id": sid, "transcript": "my name is sehaj gaba"}).json()

    assert body.get("pending_confirmation") is None, "offered to file a half-filled form"
    assert [e["status"] for e in body["tool_events"]] == ["collecting"]
    # And the reply is the next question, said by the service without a second
    # model call — the model is not asked to paraphrase what it already knows.
    assert body["reply"] == "What is your date of birth? The day, the month and the year is fine."
    assert voice_agent._SESSIONS[sid].form_answers["full_name"] == "Sehaj Gaba"


def test_a_later_turn_cannot_say_verified_bare_either(monkeypatch):
    """
    The confirmation is not the only place it claims this. Asked afterwards "is
    my form fully filled?", the model answered "fully filled and verified" —
    same false impression, a different turn. Guarded at the turn boundary so no
    reply path can miss it.

    Two changes from what this used to do. It set `application_id` on the
    session by hand, which is a state the service can no longer be in — the
    record is what is read now, not the session's belief about it — so it files
    a real application. And "is my form fully filled" is answered from that
    record without the model, so the model has to be provoked by a question it
    still handles.
    """
    monkeypatch.setattr(
        voice_agent, "_call_nvidia",
        lambda messages, tools=None, language=None, form='':
            {"content": "Your details are fully verified and on record."})
    dispatch_tool("apply_for_licence", applicant("flow-verified-later"))
    sid = _fresh_session("flow-verified-later")

    body = client.post("/agent/voice/turn", json={
        "session_id": sid, "transcript": "did anyone check my documents"}).json()
    assert "simulated" in body["reply"].lower()


def test_the_qualifier_is_not_bolted_onto_unrelated_answers(monkeypatch):
    """A note appended to every sentence stops being read."""
    monkeypatch.setattr(
        voice_agent, "_call_nvidia",
        lambda messages, tools=None, language=None, form='':
            {"content": "Thursday has 9:30, 10:15 and 11 free."})
    sid = _fresh_session("flow-no-noise")
    voice_agent._SESSIONS[sid].application_id = "already-filed"

    body = client.post("/agent/voice/turn", json={
        "session_id": sid, "transcript": "what times are free"}).json()
    assert "simulated" not in body["reply"].lower()
