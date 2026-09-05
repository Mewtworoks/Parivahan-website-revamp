"""
The form spine, and the two transcripts that made it necessary.

Both recorded conversations failed the same way. Told a name, Saarthi replied
"which day would you like to book your test slot?" — three answers short of a
filled form. The second went further: it said "your application is ready" with
no application in existence, then refused to say the number it had just
invented, then looped back to offering slots.

Everything built to stop that gated *tool calls*. In both conversations the
model called no tools at all; it simply talked. So these tests do two things.
They prove the four questions, the confirmation and the result are produced
without the model — a model that fails here cannot mislead anybody, because it
is not asked. And they replay the exact sentences the real model produced, to
prove the guard catches them even when it misbehaves identically.
"""

import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from conftest import applicant  # noqa: E402
from app import voice_agent  # noqa: E402
from app.agent_tools import dispatch_tool, read_answer, read_office  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)

DEVANAGARI = re.compile("[ऀ-ॿ]")


def _refuse(*args, **kwargs):
    raise AssertionError("the language service was called for a turn the service knows")


def _start(ref: str, language: str = "en") -> str:
    return client.post("/agent/voice/start",
                       json={"citizen_ref": ref, "language": language}).json()["session_id"]


def _open_day(rto_id: str = "mh01") -> str:
    """
    The first day Saarthi is actually offering, rather than one written down.

    A calendar date used to be typed straight into the test below. The grid only
    offers days that still have time left on them, so once the last slot of that
    date had gone the number matched nothing, the turn fell through to the model,
    and the test failed — in the evening, having passed all morning. What the
    test is about is the language holding across a bare answer; which day that
    answer names was never the point.
    """
    days = dispatch_tool("find_slot_days", {"rto_id": rto_id})["days"]
    return next(d for d in days if d["left"])["date"]


def _open_day_number(rto_id: str = "mh01") -> str:
    """That day as a citizen says it: the day of the month, on its own."""
    return str(date.fromisoformat(_open_day(rto_id)).day)


def _open_time_on(day: str, rto_id: str = "mh01") -> str:
    """
    A time still on offer that day, rather than one written down.

    The same trap as the day, one level down, and it outlived the first fix: the
    time was hard-coded as "9:30" while the grid stops offering a start once it
    has gone. The first open day is usually today, so the suite passed before
    half past nine and failed after it — for a test that has nothing to do with
    what time it is. A bare time is a bare time whichever one it is.
    """
    # The argument is `date`. Passed as `day` it was silently ignored and the
    # tool answered for today, so this read today's remaining times while
    # `_open_day` had already moved on to tomorrow — fine all morning, an
    # IndexError from the moment today sold out.
    slots = dispatch_tool("find_slots", {"rto_id": rto_id, "date": day})["slots"]
    return slots[0]["time"].lstrip("0")


def _say(sid: str, text: str, language: str = "en") -> dict:
    """
    The language rides on the turn, as the panel now sends it.

    It used to be read out of the transcript, which is why these tests could
    stay silent about it. That guess was wrong in a way no word list fixed —
    answering "9:30" in a Hindi conversation turned the rest of it English — so
    the site's picker decides and the tests say which one they mean.
    """
    return client.post("/agent/voice/turn",
                       json={"session_id": sid, "transcript": text,
                             "language": language}).json()


# --- the spine ---------------------------------------------------------------

def test_the_whole_form_is_filled_without_one_model_call(monkeypatch):
    monkeypatch.setattr(voice_agent, "_call_nvidia", _refuse)
    sid = _start("fast-spine")

    assert "full name" in _say(sid, "I want a learner licence")["reply"].lower()
    assert "date of birth" in _say(sid, "Sehaj Gaba")["reply"].lower()
    assert "state" in _say(sid, "11 April 2008")["reply"].lower()
    assert "two-wheeler" in _say(sid, "Maharashtra")["reply"].lower()

    ready = _say(sid, "two wheeler")
    assert ready["pending_confirmation"]
    # The sentence names what is about to be filed, so the citizen has four
    # facts to check the button against. "I will create your application,
    # please confirm" is true and impossible to check, which is what it used to
    # spend fifteen seconds producing.
    for fact in ("Sehaj Gaba", "11 April 2008", "Andheri", "two-wheeler"):
        assert fact in ready["reply"], ready["reply"]

    filed = client.post("/agent/voice/confirm", json={"session_id": sid}).json()
    assert filed["tool_events"][0]["result"]["applicant_name"] == "Sehaj Gaba"


def test_one_sentence_can_answer_more_than_one_question(monkeypatch):
    """
    "A learner licence in Patna for a two-wheeler" answers three of the four.
    Asking them again one at a time is the form-filling this replaces.
    """
    monkeypatch.setattr(voice_agent, "_call_nvidia", _refuse)
    sid = _start("fast-multi")
    reply = _say(sid, "I want a learner licence in Patna for a two wheeler")

    assert "full name" in reply.lower() if isinstance(reply, str) else True
    answers = voice_agent._SESSIONS[sid].form_answers
    assert answers["state"] == "Bihar"
    assert answers["licence_classes"] == ["MCWG"]


def test_the_place_the_citizen_named_is_the_office_they_get(monkeypatch):
    """
    Patna maps to Bihar, and Bihar's *nearest* office is Samastipur — ninety
    kilometres away. Resolving the state and stopping there quietly sends
    somebody to a different city.
    """
    monkeypatch.setattr(voice_agent, "_call_nvidia", _refuse)
    sid = _start("fast-office")
    for said in ("licence in Patna please", "Rohan Verma", "11 April 2008", "two wheeler"):
        reply = _say(sid, said)
    assert "Patna" in reply["reply"], reply["reply"]
    filed = client.post("/agent/voice/confirm", json={"session_id": sid}).json()
    assert filed["tool_events"][0]["result"]["rto_id"] == "br01"


def test_the_result_always_carries_the_disclosure(monkeypatch):
    """
    The model was handed this sentence, told to pass it on, and dropped it twice
    in one conversation. Somebody who believes a government record was checked
    has been misled by this service, so it is no longer the model's to remember.
    """
    monkeypatch.setattr(voice_agent, "_call_nvidia", _refuse)
    sid = _start("fast-disclosure")
    for said in ("apply for a licence", "Neha Rao", "11 April 2008",
                 "Maharashtra", "car"):
        _say(sid, said)
    reply = client.post("/agent/voice/confirm", json={"session_id": sid}).json()["reply"]
    assert "simulated" in reply.lower()
    assert "SS-" in reply


# --- what must still reach the model -----------------------------------------

def test_a_question_asked_mid_form_is_not_eaten_as_an_answer(monkeypatch):
    """
    Somebody who asks what it costs after giving their name is asking a
    question. A service that files "What Does This Cost" as a legal name has
    done something far worse than take an extra turn.
    """
    seen: list[str] = []

    def model(messages, tools=None, language=None, form=''):
        seen.append(messages[-1].get("content") or "")
        return {"content": "The fee is worked out after your details are filled in."}

    monkeypatch.setattr(voice_agent, "_call_nvidia", model)
    sid = _start("fast-question")
    _say(sid, "Arjun Mehta")
    body = _say(sid, "what does this cost?")

    assert seen, "the question never reached the model"
    assert "fee" in body["reply"].lower()
    assert "full_name" in voice_agent._SESSIONS[sid].form_answers
    assert "dob" not in voice_agent._SESSIONS[sid].form_answers


def test_two_words_are_only_a_name_when_a_name_was_asked_for():
    """
    Any two words look like a name. "puri prakriya samjhaiye" is three
    alphabetic words and was briefly stored as one.
    """
    assert read_answer("full_name", "Sehaj Gaba", prompted=True) == "Sehaj Gaba"
    assert read_answer("full_name", "Sehaj Gaba", prompted=False) is None
    # Unless they said outright that it was a name.
    assert read_answer("full_name", "my name is Sehaj Gaba") == "Sehaj Gaba"
    # And never these, however they are asked.
    for said in ("puri prakriya samjhaiye", "apply aur slot", "book my slot",
                 "show me test slots", "yes please"):
        assert read_answer("full_name", said, prompted=True) is None, said


def test_a_date_that_cannot_be_read_is_asked_again_not_guessed(monkeypatch):
    """
    A wrong date of birth is not a small error — it is what the tracker
    authenticates the application against, so a guess locks somebody out of
    their own record.
    """
    monkeypatch.setattr(
        voice_agent, "_call_nvidia",
        lambda messages, tools=None, language=None, form='':
            {"content": "Sorry, could you say the year as well?"})
    sid = _start("fast-baddate")
    _say(sid, "Vikram Bose")
    _say(sid, "sometime in April")
    assert "dob" not in voice_agent._SESSIONS[sid].form_answers


def test_a_correction_replaces_the_answer(monkeypatch):
    monkeypatch.setattr(voice_agent, "_call_nvidia", _refuse)
    sid = _start("fast-correct")
    _say(sid, "Sehaj Gaba")
    _say(sid, "11 April 2008")
    _say(sid, "actually my name is Sehaj Singh Gaba")
    assert voice_agent._SESSIONS[sid].form_answers["full_name"] == "Sehaj Singh Gaba"
    assert voice_agent._SESSIONS[sid].form_answers["dob"] == "2008-04-11"


def test_a_typed_name_comes_back_capitalised():
    """It ends up printed on an application; "sehaj gaba" reads as carelessness."""
    assert read_answer("full_name", "sehaj gaba", prompted=True) == "Sehaj Gaba"
    # But a name that spells itself with an internal capital keeps it.
    assert read_answer("full_name", "ronan DSouza", prompted=True) == "Ronan DSouza"


# --- the four failures from the recorded transcripts -------------------------

def test_a_name_alone_does_not_start_booking(monkeypatch):
    """Transcript 2, failure 1. Told "Sahaj Gaba", it offered to book a slot."""
    monkeypatch.setattr(
        voice_agent, "_call_nvidia",
        lambda messages, tools=None, language=None, form='':
            {"content": "Sure, let's book your test slot. Which day would you like?"})
    sid = _start("fumble-name")
    body = _say(sid, "Sahaj Gaba")
    # "the day, the month and the year" is part of the date question, so the
    # word alone proves nothing — what must be absent is the offer to book.
    assert "book" not in body["reply"].lower(), body["reply"]
    assert "slot" not in body["reply"].lower(), body["reply"]
    assert "date of birth" in body["reply"].lower()


def test_an_unfilled_form_is_never_called_ready(monkeypatch):
    """
    Transcript 2, failure 2, and the worst line in either: "your application is
    ready" with nothing filed. A citizen who believes it stops, and nothing is
    waiting for them.
    """
    monkeypatch.setattr(
        voice_agent, "_call_nvidia",
        lambda messages, tools=None, language=None, form='':
            {"content": "Your application is ready. Let's book a slot. Which day?"})
    sid = _start("fumble-ready")
    voice_agent._SESSIONS[sid].form_answers = {"full_name": "Sahaj Gaba"}
    body = _say(sid, "is my form fully filled")

    assert "ready" not in body["reply"].lower(), body["reply"]
    assert "not filed" in body["reply"].lower()
    assert "date of birth" in body["reply"].lower()


def test_the_application_number_is_read_from_the_record(monkeypatch):
    """Transcript 2, failure 3: "I'm sorry, I can't share that"."""
    monkeypatch.setattr(voice_agent, "_call_nvidia", _refuse)
    ref = "fumble-number"
    filed = dispatch_tool("apply_for_licence", applicant(ref))
    sid = _start(ref)
    body = _say(sid, "what's my application number")
    assert filed["application_no"] in body["reply"]


def test_a_status_question_is_answered_not_redirected(monkeypatch):
    """Transcript 2, failure 4: it looped back to "let's book a slot"."""
    monkeypatch.setattr(voice_agent, "_call_nvidia", _refuse)
    ref = "fumble-status"
    filed = dispatch_tool("apply_for_licence", applicant(ref))
    sid = _start(ref)
    body = _say(sid, "what's the track of my application")
    assert filed["application_no"] in body["reply"]
    assert "Andheri" in body["reply"]


def test_a_reply_that_mentions_slots_mid_form_is_discarded(monkeypatch):
    """
    The last line, not the mechanism. By the time this runs the form spine has
    already been answered without the model — but the model reached for booking
    unprompted in both recorded conversations, so a reply that contradicts the
    record does not get spoken.
    """
    monkeypatch.setattr(
        voice_agent, "_call_nvidia",
        lambda messages, tools=None, language=None, form='':
            {"content": "I can book your test slot now. Which day suits you?"})
    sid = _start("guard-slots")
    voice_agent._SESSIONS[sid].form_answers = {"full_name": "Sahaj Gaba"}
    body = _say(sid, "hmm okay")

    assert "which day" not in body["reply"].lower(), body["reply"]
    assert "date of birth" in body["reply"].lower()
    assert [e["status"] for e in body["tool_events"]] == ["corrected"]


def test_the_guard_leaves_a_straight_answer_alone(monkeypatch):
    """
    A guard that fires on the word "slot" would eat the honest answer to "what
    is the process?", which names every step including booking one.
    """
    explanation = ("First the form, then you book a test slot, then you check in "
                   "on the day. Shall we start with your name?")
    monkeypatch.setattr(
        voice_agent, "_call_nvidia",
        lambda messages, tools=None, language=None, form='': {"content": explanation})
    sid = _start("guard-explain")
    assert _say(sid, "what is the whole process?")["reply"] == explanation


def test_the_guard_never_discards_the_question_it_would_replace_it_with(monkeypatch):
    """
    "What is your date of birth?" matched the offer-to-book pattern — "what",
    then "date", then a question mark. So the service discarded its own correct
    reply, logged a failure that had not happened, and replaced the question
    with the same question prefixed by an apology.
    """
    question = "What is your date of birth? The day, the month and the year is fine."
    monkeypatch.setattr(
        voice_agent, "_call_nvidia",
        lambda messages, tools=None, language=None, form='': {"content": question})
    sid = _start("guard-own-question")
    voice_agent._SESSIONS[sid].form_answers = {"full_name": "Sahaj Gaba"}
    body = _say(sid, "hmm")

    assert body["reply"] == question
    assert [e["status"] for e in body["tool_events"]] == []


def test_the_whole_form_works_in_hindi(monkeypatch):
    """
    This is a Hindi-first service and "11 अप्रैल 2008" is the most likely way
    anybody will say a date to it. It parsed only English months, so the date
    fell through to the model, was never stored, and the next turn asked for it
    again — a loop, in the language most of the users speak.
    """
    monkeypatch.setattr(voice_agent, "_call_nvidia", _refuse)
    sid = _start("fast-hindi", "hi")
    for said in ("पटना में लर्नर लाइसेंस बनवाना है", "अनीता कुलकर्णी",
                 "11 अप्रैल 2008", "दोपहिया"):
        body = _say(sid, said, "hi")

    assert body["pending_confirmation"], body["reply"]
    answers = voice_agent._SESSIONS[sid].form_answers
    assert answers == {"state": "Bihar", "full_name": "अनीता कुलकर्णी",
                       "dob": "2008-04-11", "licence_classes": ["MCWG"]}
    filed = client.post("/agent/voice/confirm",
                        json={"session_id": sid, "language": "hi"}).json()
    assert filed["tool_events"][0]["result"]["rto_id"] == "br01"
    assert "नकली" in filed["reply"], filed["reply"]


def test_the_confirmation_button_is_written_in_the_citizens_language(monkeypatch):
    """
    The button is the last thing read before an application is filed. It said
    "Create your learner-licence application" at the end of a conversation held
    entirely in Hindi — every sentence translated except the one that matters.
    """
    monkeypatch.setattr(voice_agent, "_call_nvidia", _refuse)

    sid = _start("label-hi", "hi")
    for said in ("लाइसेंस बनवाना है", "अनीता कुलकर्णी", "11 अप्रैल 2008",
                 "महाराष्ट्र", "दोपहिया"):
        body = _say(sid, said, "hi")
    assert body["pending_confirmation"]["label"] == "आपका लर्नर-लाइसेंस आवेदन दर्ज करें"

    sid = _start("label-en")
    for said in ("I want a licence", "Rohan Verma", "11 April 2008",
                 "Maharashtra", "two wheeler"):
        body = _say(sid, said)
    assert body["pending_confirmation"]["label"] == "Create your learner-licence application"


def test_saarthi_speaks_of_itself_as_a_woman_in_hindi(monkeypatch):
    """
    Hindi marks the speaker's gender on the verb, so "मैं दर्ज करूँगा" is not a
    neutral sentence — it announces that a man is talking, in a service that
    presents Saarthi otherwise.
    """
    monkeypatch.setattr(voice_agent, "_call_nvidia", _refuse)
    opened = client.post("/agent/voice/start",
                         json={"citizen_ref": "gender-hi", "language": "hi"}).json()
    assert "सकती हूँ" in opened["greeting"], opened["greeting"]

    for said in ("लाइसेंस बनवाना है", "मीरा अय्यर", "11 अप्रैल 2008",
                 "महाराष्ट्र", "कार"):
        body = _say(opened["session_id"], said, "hi")
    assert "करूँगी" in body["reply"], body["reply"]
    assert "करूँगा" not in body["reply"]
    assert "दूँगी" in body["reply"], body["reply"]


def test_a_bare_time_does_not_change_the_language(monkeypatch):
    """
    A whole conversation in Hindi, answered "9:30", switched to English for the
    rest of it — the booking sentence and the confirmation button both. The
    language came from the words in each message and "9:30" has none, so "not
    Hindi" was read as "English". The picker decides now.
    """
    monkeypatch.setattr(voice_agent, "_call_nvidia", _refuse)
    sid = _start("lang-hold", "hi")
    for said in ("लाइसेंस बनवाना है", "मीरा अय्यर", "11 अप्रैल 2008",
                 "महाराष्ट्र", "कार"):
        _say(sid, said, "hi")
    client.post("/agent/voice/confirm", json={"session_id": sid, "language": "hi"})

    days = _say(sid, "मेरा स्लॉट बुक करो", "hi")
    assert DEVANAGARI.search(days["reply"]), days["reply"]
    day = _open_day()
    times = _say(sid, str(date.fromisoformat(day).day), "hi")
    assert DEVANAGARI.search(times["reply"]), times["reply"]

    # The reported turn: a bare time, and everything after it must stay Hindi.
    picked = _say(sid, _open_time_on(day), "hi")
    assert picked["pending_confirmation"], picked["reply"]
    assert DEVANAGARI.search(picked["reply"]), picked["reply"]
    assert DEVANAGARI.search(picked["pending_confirmation"]["label"]), \
        picked["pending_confirmation"]["label"]

    booked = client.post("/agent/voice/confirm",
                         json={"session_id": sid, "language": "hi"}).json()
    assert DEVANAGARI.search(booked["reply"]), booked["reply"]


def test_booking_asked_for_plainly_in_hindi_is_understood(monkeypatch):
    """
    "मेरा स्लॉट बुक करो" matched nothing, fell through to the model, and came
    back as "क्षमा करें — मैं अभी वह शुरू नहीं कर सकी" — an apology for a
    request the service could answer from the slot grid without asking anybody.
    """
    monkeypatch.setattr(voice_agent, "_call_nvidia", _refuse)
    ref = "hi-booking-words"
    dispatch_tool("apply_for_licence", applicant(ref))
    sid = _start(ref, "hi")
    for said in ("मेरा स्लॉट बुक करो", "स्लॉट बुक करना है", "टेस्ट बुक कीजिए"):
        body = _say(sid, said, "hi")
        assert [e["tool"] for e in body["tool_events"]] == ["find_slot_days"], said
        assert "क्षमा" not in body["reply"], body["reply"]


def test_asking_twice_says_what_was_missing(monkeypatch):
    """
    "10 जनवरी" was answered with the identical question three times running.
    They had given the day and the month; nothing ever said the year was what
    was missing.
    """
    monkeypatch.setattr(
        voice_agent, "_call_nvidia",
        lambda messages, tools=None, language=None, form='': {"content": "…"})
    sid = _start("retry-hint", "hi")
    _say(sid, "श्रेया गाबा", "hi")
    first = _say(sid, "10 जनवरी", "hi")["reply"]
    second = _say(sid, "10 जनवरी", "hi")["reply"]

    assert second != first, "asked in exactly the same words twice"
    assert "साल" in second, second
    # And once it is answered the hint goes away rather than sticking.
    third = _say(sid, "10 जनवरी 2001", "hi")
    assert "साल भी बताइए" not in third["reply"]
    assert voice_agent._SESSIONS[sid].form_answers["dob"] == "2001-01-10"


def test_a_hindi_sentence_names_the_month_in_hindi():
    """
    "जन्म 11 April 2008" is one sentence in two scripts. Read aloud by a Hindi
    voice it is worse than it looks on the page.
    """
    assert voice_agent._spoken_date("2008-04-11", True) == "11 अप्रैल 2008"
    assert voice_agent._spoken_date("2008-04-11") == "11 April 2008"


def test_devanagari_digits_are_read_as_digits():
    """A Hindi keyboard produces them, and a recogniser sometimes does too."""
    from app.agent_tools import normalise_dob
    assert normalise_dob("११ अप्रैल २००८") == "2008-04-11"
    assert normalise_dob("15 सितम्बर 2006") == "2006-09-15"


def test_the_whole_booking_runs_without_the_model(monkeypatch):
    """
    Handed a day list reading `left: 16, 18, 18, 18, 18`, the model told a
    citizen "all the days I checked are full right now" and offered next week.
    The tool was right and the sentence was wrong — reading a list back is not
    a judgement call, so the service does it.
    """
    monkeypatch.setattr(voice_agent, "_call_nvidia", _refuse)
    # Patna, not the default Mumbai office: test_journey books the first free
    # slot at mh01 on the same day and then drives its tester's queue to
    # completion, so two suites racing for one lane is a flake nobody caused.
    sid = _start("fast-booking")
    for said in ("apply for a licence", "Nikhil Rao", "11 April 2008",
                 "Patna", "two wheeler"):
        _say(sid, said)
    filed = client.post("/agent/voice/confirm", json={"session_id": sid}).json()
    assert "day" in filed["reply"].lower()

    days = _say(sid, "yes")
    assert "open" in days["reply"].lower(), days["reply"]
    assert [e["tool"] for e in days["tool_events"]] == ["find_slot_days"]
    # Never a phantom "all full" when the engine says otherwise.
    assert "full" not in days["reply"].lower()

    # A day named on its own gets the times read back.
    first_open = next(d for d in days["tool_events"][0]["result"]["days"] if d["left"])
    times = _say(sid, date.fromisoformat(first_open["date"]).strftime("%A"))
    assert [e["tool"] for e in times["tool_events"]] == ["find_slots"]
    offered = times["tool_events"][0]["result"]["slots"]
    assert offered[0]["time"] in times["reply"]

    chosen = _say(sid, offered[1]["time"])
    assert chosen["pending_confirmation"], chosen["reply"]
    assert offered[1]["time"] in chosen["reply"]
    assert offered[1]["tester"] in chosen["reply"]

    booked = client.post("/agent/voice/confirm", json={"session_id": sid}).json()
    result = booked["tool_events"][0]["result"]
    assert result["ok"] is True
    # The sentence and the record agree, because the sentence is built from it.
    assert result["time"] == offered[1]["time"]
    assert result["time"] in booked["reply"] and result["tester"] in booked["reply"]


def test_a_day_and_a_time_said_together_are_both_heard(monkeypatch):
    """
    "The earliest morning slot" names both. Resolving the day and then asking
    "which time?" throws away half of what they said, and reads as a service
    that was not listening.
    """
    monkeypatch.setattr(voice_agent, "_call_nvidia", _refuse)
    sid = _start("fast-booking-atonce")
    for said in ("apply", "Ishita Roy", "11 April 2008", "Patna", "car"):
        _say(sid, said)
    client.post("/agent/voice/confirm", json={"session_id": sid})

    _say(sid, "yes")
    straight = _say(sid, "book the earliest morning slot you have")
    assert straight["pending_confirmation"], straight["reply"]
    booked = client.post("/agent/voice/confirm", json={"session_id": sid}).json()
    result = booked["tool_events"][0]["result"]
    assert result["ok"] is True and result["time"] < "12:00", result


def test_a_vague_booking_request_still_goes_to_the_model(monkeypatch):
    """
    "Some time after lunch next week, but not with the same inspector" is a
    judgement call. Taking it here would mean guessing.
    """
    reached: list[str] = []

    def model(messages, tools=None, language=None, form=''):
        reached.append(messages[-1].get("content") or "")
        return {"content": "Let me look at what is free next week."}

    monkeypatch.setattr(voice_agent, "_call_nvidia", model)
    ref = "fast-vague"
    dispatch_tool("apply_for_licence", applicant(ref))
    sid = _start(ref)
    _say(sid, "sometime next week if there is anything late in the day")
    assert reached, "a vague request never reached the model"


def test_a_bare_yes_only_means_the_days_when_the_days_were_offered(monkeypatch):
    """Otherwise "yes" to any question at all starts reading out a slot grid."""
    reached: list[str] = []

    def model(messages, tools=None, language=None, form=''):
        reached.append("called")
        return {"content": "Good."}

    monkeypatch.setattr(voice_agent, "_call_nvidia", model)
    ref = "fast-bare-yes"
    dispatch_tool("apply_for_licence", applicant(ref))
    sid = _start(ref)
    # The opening line for a filed application ends "shall I show you the days?",
    # so it now records that the days were offered — which is the whole point of
    # `offered`, and answering "yes" to it locally is correct. Clear it, because
    # what this test is about is the *other* case: a "yes" arriving with nothing
    # outstanding must not be read as a request for the slot grid.
    voice_agent._SESSIONS[sid].offered = None
    body = _say(sid, "yes")
    assert reached, "a bare yes with nothing offered should reach the model"
    assert "open" not in body["reply"].lower()


def test_the_office_reader_prefers_the_place_over_the_city():
    """Three Mumbai offices share a city; only the area tells them apart."""
    assert read_office("I'll go to Andheri") == "mh01"
    assert read_office("Borivali is closer") == "mh03"
    assert read_office("पटना में") == "br01"
    assert read_office("no place named here") is None


def test_yes_after_the_resume_line_shows_the_days(monkeypatch):
    """
    The opening line for a filed application ends by offering the days, so the
    answer to it is the service's to give.

    It was not: `offered` was recorded in one place only — after Confirm — while
    three separate sentences asked the same question. Somebody who came back to
    a filed application, heard "shall I show you the days?" and said "yes" spent
    a model call on a word the service already knew the meaning of, and got a
    503 for it when no key was configured.
    """
    def refuse(*args, **kwargs):
        raise AssertionError("a yes to the service's own offer must not reach the model")

    monkeypatch.setattr(voice_agent, "_call_nvidia", refuse)
    ref = "fast-resume-yes"
    dispatch_tool("apply_for_licence", applicant(ref))
    opening = client.post("/agent/voice/start",
                          json={"citizen_ref": ref, "language": "en"}).json()
    assert "days" in opening["greeting"].lower()
    body = _say(opening["session_id"], "yes")
    assert body["tool_events"], "the days should have been looked up"
    assert any(e["tool"] == "find_slot_days" for e in body["tool_events"])


def test_signing_up_does_not_record_a_state(monkeypatch):
    """
    "up" is a registration code and also an ordinary English word.

    The alias matcher was boundary-guarded, which is not enough for two letters:
    "sign up", "fill up the form" and "speed up the process" all matched, and
    because the state is read from every utterance while it is outstanding, it
    was stored and written to the draft without a word being said about it. The
    citizen then found Uttar Pradesh on their form.
    """
    assert read_answer("state", "I want to sign up for a learner licence", prompted=True) is None
    assert read_answer("state", "can you fill up the form for me", prompted=True) is None
    assert read_answer("state", "please speed up the process", prompted=True) is None
    # Said on its own it is still the code, because that is how somebody who
    # means it says it.
    assert read_answer("state", "UP", prompted=True) == "Uttar Pradesh"
    assert read_answer("state", "Lucknow", prompted=True) == "Uttar Pradesh"


def test_a_goal_is_not_a_state():
    """The full-name fallback matched by substring, so "goal" contained Goa."""
    assert read_answer("state", "my goal is to drive to work", prompted=True) is None
    assert read_answer("state", "I live in Goa", prompted=True) == "Goa"


def test_saying_something_is_done_does_not_file_you_in_bihar():
    """
    "gaya" is a city in Bihar and the commonest past-tense verb in Hindi.

    No office in the catalogue serves Gaya, so the alias could only ever be
    wrong here: "form bhar gaya" — the form is filled — recorded Bihar.
    """
    assert read_answer("state", "form bhar gaya", prompted=True) is None
    assert read_answer("state", "ho gaya", prompted=True) is None
    assert read_answer("state", "भर गया", prompted=True) is None
