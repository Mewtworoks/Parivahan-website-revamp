"""State has to survive a restart: a demo that resets mid-judging has failed."""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import booking_engine as be  # noqa: E402
from app import store  # noqa: E402
from app.booking_models import LicenceKind  # noqa: E402


def _round_trip(tmp_path, monkeypatch):
    """Snapshot to a real file, wipe memory, load it back — a restart in miniature."""
    monkeypatch.setattr(store, "STATE_PATH", tmp_path / "state.json")
    store.save(be)
    for bucket in (be._APPS, be._APPS_BY_IDEM, be._APPS_BY_CITIZEN, be._APPS_BY_NUMBER,
                   be._RTOS, be._TESTERS, be._SLOTS, be._BOOKINGS, be._TOKENS, be._TOKEN_SEQ):
        bucket.clear()
    be._SLOT_DAYS.clear()
    assert store.load(be) is True


def test_a_whole_journey_survives_a_restart(tmp_path, monkeypatch):
    be.seed_catalogue()
    app = be.apply("persist-citizen", LicenceKind.LL, "mh01", "persist-key-1")
    slot = be.list_free_slots("mh01", date.today())[0]
    be.book_slot(app.id, slot.id)
    token = be.check_in(app.id)
    number, app_no, chain_head = token.number, app.display_no, app.ledger[-1].hash

    _round_trip(tmp_path, monkeypatch)

    revived = be.get_application(app.id)
    assert revived is not None
    assert revived.display_no == app_no
    assert revived.status == app.status
    # The hash chain has to come back intact, or the receipt's whole claim is void.
    assert revived.verify_ledger() is True
    assert revived.ledger[-1].hash == chain_head

    assert be.queue_status(token.id)["token_number"] == number
    # Indexes too, or the tracker cannot find the application by its number.
    assert be.find_by_number(app_no, revived.dob) is not None or revived.dob is None
    assert be._APPS_BY_NUMBER[app_no] == app.id


def test_a_booked_slot_is_still_booked_after_a_restart(tmp_path, monkeypatch):
    be.seed_catalogue()
    app = be.apply("persist-slot", LicenceKind.LL, "mh02", "persist-key-2")
    slot = be.list_free_slots("mh02", date.today())[0]
    be.book_slot(app.id, slot.id)
    taken = slot.id

    _round_trip(tmp_path, monkeypatch)

    assert be._SLOTS[taken].is_free is False, "a restart handed a held slot back out"
    assert taken not in {s.id for s in be.list_free_slots("mh02", date.today())}


def test_the_application_counter_does_not_reissue_numbers(tmp_path, monkeypatch):
    be.seed_catalogue()
    first = be.apply("persist-seq", LicenceKind.LL, "mh01", "persist-key-3").display_no
    _round_trip(tmp_path, monkeypatch)
    second = be.apply("persist-seq-2", LicenceKind.LL, "mh01", "persist-key-4").display_no
    assert second != first, "the counter reset, so two applications share a number"


def test_a_corrupt_state_file_starts_clean_rather_than_half_loaded(tmp_path, monkeypatch):
    path = tmp_path / "state.json"
    path.write_text('{"version": 1, "_APPS": {"x": {"nonsense": true}}}', encoding="utf-8")
    monkeypatch.setattr(store, "STATE_PATH", path)
    assert store.load(be) is False
    assert be._APPS == {}, "a file that failed validation left partial state behind"
    be.seed_catalogue()


def test_a_stale_schema_version_is_refused(tmp_path, monkeypatch):
    path = tmp_path / "state.json"
    path.write_text('{"version": 0, "_APPS": {}}', encoding="utf-8")
    monkeypatch.setattr(store, "STATE_PATH", path)
    assert store.load(be) is False
