"""Application-wide logging configuration.

Single-source structured-ish format. Suppresses noisy third-party loggers so the
backend stdout stays readable on Render.
"""
import logging
import sys


def setup_logging(level: str = "INFO") -> None:
    fmt = "%(asctime)s [%(levelname)s] %(name)s · %(message)s"
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format=fmt,
        datefmt="%H:%M:%S",
        stream=sys.stdout,
        force=True,
    )
    for noisy in ("httpx", "httpcore", "anyio"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
