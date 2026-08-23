"""Saarthi's safety boundary: model proposes; citizen confirms; tools execute."""

import json
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

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


def test_voice_cancel_discards_server_pending_action():
    session = voice_agent.start_session("voice-cancel")
    session.pending = voice_agent.PendingAction("check_in", {"application_id": "x"}, "Check in")
    response = client.post("/agent/voice/cancel", json={"session_id": session.id})
    assert response.status_code == 200
    assert response.json()["cancelled"] is True
    assert session.pending is None
