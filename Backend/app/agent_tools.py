"""
OpenAI Realtime API function-tools for the LL journey copilot.

The agent is a *citizen-side* voice copilot that guides someone through the
Learner Licence journey in Hindi/English. It is wired to the same backend
state as the test and the booking engine, so it can actually act — not just
chat.

Flow to register these:
  1. GET /agent/tools  -> this schema
  2. Add them to your Realtime session `tools` on session.update
  3. When the model emits a function_call, POST /agent/dispatch
     {tool, arguments} and return the result to the model.

Keep the *voice* layer on OpenAI Realtime (speech-to-speech, multilingual).
You can still use LangGraph as the higher-level planner if you like.
"""

from __future__ import annotations

import hashlib
from datetime import date

from . import booking_engine as be
from . import engine
from .booking_engine import AlreadyBooked, SlotTaken
from .booking_models import AppStatus, LicenceKind
from .seed_scenarios import SCENARIOS, scenario_by_id

DEFAULT_RTO = "rto_ggn_01"

# --- The JSON schema you hand to the Realtime session --------------------

AGENT_TOOL_SCHEMA = [
    {
        "type": "function",
        "name": "get_journey_status",
        "description": "Get the citizen's current stage in the LL/DL journey "
                       "so the agent knows what to guide them toward next.",
        "parameters": {
            "type": "object",
            "properties": {
                "citizen_id": {"type": "string"},
            },
            "required": ["citizen_id"],
        },
    },
    {
        "type": "function",
        "name": "explain_ll_step",
        "description": "Explain a step of the Learner Licence process in plain "
                       "language (documents, fee, test format, pass criteria).",
        "parameters": {
            "type": "object",
            "properties": {
                "step": {
                    "type": "string",
                    "enum": ["eligibility", "documents", "fee", "test_format",
                             "pass_criteria", "after_pass"],
                },
                "language": {"type": "string", "enum": ["en", "hi"]},
            },
            "required": ["step"],
        },
    },
    {
        "type": "function",
        "name": "start_practice_test",
        "description": "Start a practice run of the scenario LL test for the "
                       "citizen and return the first scenario.",
        "parameters": {
            "type": "object",
            "properties": {"citizen_id": {"type": "string"}},
            "required": ["citizen_id"],
        },
    },
    {
        "type": "function",
        "name": "list_competencies",
        "description": "List the driving-judgment competencies the test covers, "
                       "so the agent can tell the citizen what to prepare.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "type": "function",
        "name": "apply_for_licence",
        "description": "Submit a licence application for the citizen (retry-safe). "
                       "Use when the citizen says they want to start / apply.",
        "parameters": {
            "type": "object",
            "properties": {
                "citizen_ref": {"type": "string"},
                "licence_kind": {"type": "string", "enum": ["learner", "permanent"]},
                "rto_id": {"type": "string"},
            },
            "required": ["citizen_ref", "licence_kind"],
        },
    },
    {
        "type": "function",
        "name": "find_slots",
        "description": "List available test appointment times at an RTO so the "
                       "agent can read them to the citizen.",
        "parameters": {
            "type": "object",
            "properties": {"rto_id": {"type": "string"}},
        },
    },
    {
        "type": "function",
        "name": "book_slot",
        "description": "Book a specific test appointment for the citizen's "
                       "application. Atomic — one slot, one person.",
        "parameters": {
            "type": "object",
            "properties": {
                "application_id": {"type": "string"},
                "slot_id": {"type": "string"},
            },
            "required": ["application_id", "slot_id"],
        },
    },
    {
        "type": "function",
        "name": "check_in",
        "description": "The citizen has arrived at the RTO — issue their live "
                       "queue token. Safe to call twice; returns the same token.",
        "parameters": {
            "type": "object",
            "properties": {"application_id": {"type": "string"}},
            "required": ["application_id"],
        },
    },
    {
        "type": "function",
        "name": "check_queue",
        "description": "Tell the citizen their live position, assigned tester and "
                       "wait estimate on the day of the test.",
        "parameters": {
            "type": "object",
            "properties": {"token_id": {"type": "string"}},
            "required": ["token_id"],
        },
    },
]


# --- Dispatcher: executes a tool call from the agent ---------------------

# Minimal static content for the demo. In production, explain_ll_step should
# RAG over the Motor Vehicles Act / RRR (your DocuAgent pattern).
_LL_STEPS = {
    "eligibility": {
        "en": "You must be at least 18 for a car/motorcycle (16 for a 50cc "
              "moped with guardian consent) and pass a basic vision check.",
        "hi": "कार/मोटरसाइकिल के लिए न्यूनतम 18 वर्ष (अभिभावक की सहमति से 50cc "
              "मोपेड के लिए 16) और एक बुनियादी दृष्टि जाँच आवश्यक है।",
    },
    "documents": {
        "en": "Proof of age, proof of address, Form 1 self-declaration of "
              "fitness, and passport photos. Aadhaar enables faceless flow.",
        "hi": "आयु प्रमाण, पता प्रमाण, फ़ॉर्म 1 फ़िटनेस घोषणा, और पासपोर्ट फ़ोटो। "
              "आधार से पूरी प्रक्रिया बिना दफ़्तर जाए हो जाती है।",
    },
    "fee": {
        "en": "The LL fee is paid online on the portal during application.",
        "hi": "आवेदन के दौरान पोर्टल पर एलएल शुल्क ऑनलाइन भुगतान किया जाता है।",
    },
    "test_format": {
        "en": "15 questions. In our reimagined test each is a short driving "
              "scenario — you watch it, then choose the safest action.",
        "hi": "15 प्रश्न। हमारे नए टेस्ट में हर प्रश्न एक छोटा ड्राइविंग "
              "दृश्य है — उसे देखें, फिर सबसे सुरक्षित कार्य चुनें।",
    },
    "pass_criteria": {
        "en": "You must answer at least 9 of 15 correctly (60%) to pass.",
        "hi": "पास होने के लिए 15 में से कम से कम 9 सही (60%) चाहिए।",
    },
    "after_pass": {
        "en": "You download your Learner Licence, then complete the learner "
              "period before applying for the permanent driving licence.",
        "hi": "आप अपना लर्नर लाइसेंस डाउनलोड करें, फिर स्थायी ड्राइविंग लाइसेंस "
              "के लिए आवेदन से पहले लर्नर अवधि पूरी करें।",
    },
}

# What the agent should push the citizen toward, per application status.
_NEXT_ACTION = {
    AppStatus.SUBMITTED: "Wait for document verification — it is automatic.",
    AppStatus.VERIFIED: "Pick a test appointment time (find_slots, then book_slot).",
    AppStatus.SLOT_BOOKED: "Arrive at the RTO at your slot time, then check in.",
    AppStatus.CHECKED_IN: "You are in the queue — watch your token and ETA.",
    AppStatus.COMPLETED: "Test done. Download the licence from the receipt.",
    AppStatus.REJECTED: "Application rejected — see the ledger for the reason.",
}


def _stable_idempotency_key(citizen_ref: str, kind: LicenceKind, rto_id: str) -> str:
    """
    Derive the key from the request itself so an agent that repeats a call —
    the model retries, the citizen says "apply" twice, the socket drops — gets
    the same application back. A fresh uuid per call would silently defeat
    guarantee #1 for every agent-initiated apply.
    """
    payload = f"{citizen_ref}|{kind.value}|{rto_id}"
    return "agent:" + hashlib.sha256(payload.encode()).hexdigest()[:32]


def dispatch_tool(tool: str, args: dict) -> dict:
    if tool == "get_journey_status":
        cid = args["citizen_id"]
        app_obj = be.latest_application_for(cid)
        if app_obj is None:
            attempt = engine.latest_attempt_for(cid)
            return {
                "citizen_id": cid,
                "stage": "not_started",
                "practice_attempts": 1 if attempt else 0,
                "next_action": "Apply for the licence, and try the practice "
                               "scenario test while you wait.",
            }

        out = {
            "citizen_id": cid,
            "stage": app_obj.status.value,
            "application_id": app_obj.id,
            "licence_kind": app_obj.licence_kind.value,
            "next_action": _NEXT_ACTION.get(app_obj.status, "Check your ledger."),
            "last_event": app_obj.ledger[-1].note if app_obj.ledger else None,
        }
        if app_obj.booking_id:
            b = be.get_booking(app_obj.booking_id)
            if b:
                out["appointment"] = {"date": str(b.slot_date),
                                      "time": b.start.strftime("%H:%M"),
                                      "tester_id": b.tester_id}
        if app_obj.token_id:
            out["queue"] = be.queue_status(app_obj.token_id)
        return out

    if tool == "explain_ll_step":
        step = args["step"]
        lang = args.get("language", "en")
        if step not in _LL_STEPS:
            return {"error": f"Unknown step: {step}",
                    "known_steps": sorted(_LL_STEPS)}
        texts = _LL_STEPS[step]
        return {"step": step, "language": lang if lang in texts else "en",
                "text": texts.get(lang, texts["en"])}

    if tool == "start_practice_test":
        attempt = engine.build_test(args["citizen_id"])
        first_id = engine.next_scenario_id(attempt)
        return {
            "attempt_id": attempt.id,
            "total_questions": len(attempt.scenario_ids),
            "first_scenario": scenario_by_id(first_id).public_view().model_dump(),
        }

    if tool == "list_competencies":
        comps = sorted({s.competency.value for s in SCENARIOS})
        return {"competencies": comps}

    if tool == "apply_for_licence":
        kind = LicenceKind(args.get("licence_kind", "learner"))
        rto = args.get("rto_id") or DEFAULT_RTO
        citizen_ref = args["citizen_ref"]
        key = _stable_idempotency_key(citizen_ref, kind, rto)
        app_obj = be.apply(citizen_ref, kind, rto, key)
        return {"application_id": app_obj.id, "status": app_obj.status.value,
                "next_action": _NEXT_ACTION.get(app_obj.status, "")}

    if tool == "find_slots":
        rto = args.get("rto_id") or DEFAULT_RTO
        slots = be.list_free_slots(rto, date.today())[:6]
        return {"slots": [{"slot_id": s.id, "time": s.start.strftime("%H:%M"),
                           "tester_id": s.tester_id} for s in slots]}

    if tool == "book_slot":
        try:
            b = be.book_slot(args["application_id"], args["slot_id"])
        except SlotTaken:
            return {"ok": False, "reason": "That time was just taken — pick another."}
        except AlreadyBooked:
            return {"ok": False, "reason": "You already have an appointment booked."}
        except KeyError as e:
            return {"ok": False, "reason": str(e)}
        return {"ok": True, "date": str(b.slot_date),
                "time": b.start.strftime("%H:%M"), "tester_id": b.tester_id}

    if tool == "check_in":
        try:
            t = be.check_in(args["application_id"])
        except KeyError:
            return {"ok": False, "reason": "No appointment found to check in against."}
        return {"ok": True, "token_id": t.id, "token_number": t.number,
                "tester_id": t.tester_id}

    if tool == "check_queue":
        try:
            return be.queue_status(args["token_id"])
        except KeyError:
            return {"error": "No active queue token found."}

    raise KeyError(tool)
