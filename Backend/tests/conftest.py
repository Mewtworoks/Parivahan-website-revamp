"""
Test-wide setup.

The engine now snapshots its state to disk. A test run must neither inherit
whatever the running demo has built up nor overwrite it, so persistence is
switched off before any application module is imported — ``store`` reads the
variable at import time.
"""

import os

os.environ["STATE_FILE"] = ":memory:"
