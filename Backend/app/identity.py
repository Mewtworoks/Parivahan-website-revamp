"""
A stand-in for the portal's sign-in. Not authentication.

Read that again before building anything on top of this: the code is returned in
the response body. Anyone who can ask for a code can use it. That is deliberate
and it is the whole design — there is no SMS provider in this prototype, and a
demo that cannot show you the code is a demo nobody can drive.

Why it exists at all, given it verifies nothing: the journey needs *one*
identity. Until now the apply wizard filed under the phone number typed into
stage two, while Saarthi invented ``saarthi-demo-<random>`` every time its panel
opened — so the agent could not find the application you had just filled in, and
"which citizen is this?" had no answer at all. Pinning both to one number fixes
that, and it is honest as long as nothing here pretends to be more than a label.

What a real build puts here instead: the existing Parivahan Aadhaar/mobile
session. Everything downstream already keys off ``citizen_ref``, so that swap
touches this file and nothing else.
"""

from __future__ import annotations

import logging
import random
import re
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

log = logging.getLogger("identity")

CODE_TTL_MINUTES = 10
MAX_ATTEMPTS = 5

# Indian mobile numbers: ten digits starting 6-9. Checked because a typo here
# silently splits somebody's journey in two — the form filed under one number
# and the conversation under another.
_PHONE = re.compile(r"[6-9]\d{9}")

_lock = threading.Lock()


@dataclass
class Challenge:
    phone: str
    code: str
    expires_at: datetime
    attempts: int = 0


_ISSUED: dict[str, Challenge] = {}


class BadPhone(Exception):
    """Not a ten-digit Indian mobile number."""


class BadCode(Exception):
    """No live code for that number, or the wrong one, or too many tries."""


def normalise(phone: str) -> str:
    """Strip spaces, dashes and a +91 or 0 prefix, then validate."""
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    if not _PHONE.fullmatch(digits):
        raise BadPhone("Enter a ten-digit mobile number.")
    return digits


def request_code(phone: str) -> dict:
    """
    Issue a code for a number and hand it straight back to the caller.

    Requesting a second code replaces the first, so a citizen who pressed the
    button twice is not left guessing which of two codes is live.
    """
    number = normalise(phone)
    code = f"{random.randint(0, 9999):04d}"
    with _lock:
        _ISSUED[number] = Challenge(
            phone=number, code=code,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES),
        )
    # Never logged at info: even a fake code in a shared terminal trains the
    # wrong habit for whoever ports this to something real.
    log.debug("issued a sign-in code for %s", number)
    return {
        "phone": number,
        "code": code,
        "delivered": False,
        "expires_in_minutes": CODE_TTL_MINUTES,
        "note": ("No SMS was sent. The code is returned here because this is a "
                 "prototype with no messaging provider, and it verifies nothing "
                 "— it stands in for the portal's Aadhaar/mobile sign-in."),
    }


def verify(phone: str, code: str) -> dict:
    """
    Check a code and return the reference the whole journey is keyed on.

    A wrong code is counted. After MAX_ATTEMPTS the challenge is dropped and a
    new one has to be requested — not because this is protecting anything, but
    because a stand-in that behaves nothing like the thing it stands in for
    teaches the wrong shape to whoever replaces it.
    """
    number = normalise(phone)
    supplied = re.sub(r"\D", "", code or "")
    with _lock:
        challenge = _ISSUED.get(number)
        if challenge is None:
            raise BadCode("Ask for a code first.")
        if datetime.now(timezone.utc) > challenge.expires_at:
            del _ISSUED[number]
            raise BadCode("That code has expired. Ask for a new one.")
        challenge.attempts += 1
        if challenge.attempts > MAX_ATTEMPTS:
            del _ISSUED[number]
            raise BadCode("Too many tries. Ask for a new code.")
        if supplied != challenge.code:
            raise BadCode("That code does not match.")
        del _ISSUED[number]

    # The phone number *is* the reference. One value, so the wizard, the agent
    # and the tracker all read the same journey instead of three of them.
    return {"citizen_ref": number, "phone": number}
