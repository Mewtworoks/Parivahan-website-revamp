"""
Dev entry point. Keeps `python main.py` working from the Backend directory,
while the app itself lives in the `app` package (app.main:app) so uvicorn,
pytest and Docker can all import it the same way.
"""

import os

import uvicorn

from app.main import app  # re-exported so `uvicorn main:app` also works

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
