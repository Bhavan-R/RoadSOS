"""RoadSOS FastAPI app entry point.

Wires routers, middleware, and CORS for production deployment on Render.

Middleware stack (order matters):
1. ErrorHandlingMiddleware — outermost: catches every unhandled exception
2. RequestLogMiddleware    — logs every request with request_id
3. RequestIDMiddleware     — stamps requests with UUID
4. GZipMiddleware          — compresses responses
5. CORSMiddleware          — innermost (closest to handlers)
"""

import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from logging_config import setup_logging
from middleware import (
    ErrorHandlingMiddleware,
    RequestIDMiddleware,
    RequestLogMiddleware,
)
from services.dispatch_service import dispatch_router
from services.health_service import VERSION, health_router
from services.offline_service import offline_router
from services.search_service import search_router
from services.tracking_service import tracking_router
from services.triage_service import triage_router

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup + shutdown lifecycle (replaces deprecated @on_event)."""
    cors_label = cors_origins if cors_origins != ["*"] else "*"
    logger.info(
        "RoadSOS API v%s starting · gemini=%s · google_places=%s · cors=%s",
        VERSION,
        bool(os.getenv("GEMINI_API_KEY")),
        bool(os.getenv("GOOGLE_PLACES_API_KEY")),
        cors_label,
    )
    yield
    logger.info("RoadSOS API v%s shutting down", VERSION)


# ─── CORS ────────────────────────────────────────────────────────────────
# Default to permissive for the hackathon demo; tighten via env in prod.
cors_origins_env = os.getenv("CORS_ALLOW_ORIGINS", "*")
cors_origins = (
    [o.strip() for o in cors_origins_env.split(",")] if cors_origins_env != "*" else ["*"]
)


app = FastAPI(
    title="RoadSOS API",
    description=(
        "Location-aware emergency contact API for road accidents. "
        "Combines OpenStreetMap Overpass + Google Places + AI triage. "
        "Built for the National Road Safety Hackathon 2026 (CoERS × IIT Madras).\n\n"
        "**Reliability features:**\n"
        "- Per-IP rate limiting on `/search` (30 req/min) and `/triage` (20 req/min)\n"
        "- Request-ID tracing via `x-request-id` response header\n"
        "- Overpass retry with mirror fallback (3 mirrors × 3 retries)\n"
        "- Graceful degradation: AI failures fall back to deterministic rules\n"
        "- Cached results (1h Overpass / 24h geocode) prevent upstream abuse\n"
        "- All errors return clean JSON, never leak stack traces"
    ),
    version=VERSION,
    contact={"name": "RoadSOS Team", "url": "https://github.com/Arthrevs/Roadproj"},
    license_info={"name": "MIT"},
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["x-request-id"],
)

# ─── Compression ─────────────────────────────────────────────────────────
app.add_middleware(GZipMiddleware, minimum_size=512)

# ─── Observability + Error handling (outer-most first) ───────────────────
app.add_middleware(RequestIDMiddleware)
app.add_middleware(RequestLogMiddleware)
app.add_middleware(ErrorHandlingMiddleware)

# ─── Routers ─────────────────────────────────────────────────────────────
app.include_router(health_router, tags=["Observability"])
app.include_router(search_router, tags=["Search"])
app.include_router(triage_router, tags=["AI Triage"])
app.include_router(dispatch_router, tags=["Dispatch"])
app.include_router(offline_router, tags=["Offline"])
app.include_router(tracking_router, tags=["Tracking"])


@app.get("/", summary="Service index", tags=["Observability"])
def root():
    return {
        "service": "RoadSOS API",
        "version": VERSION,
        "docs": "/docs",
        "openapi": "/openapi.json",
        "endpoints": [
            "/health",
            "/search",
            "/triage",
            "/dispatch-summary",
            "/offline-pack",
            "/track",
        ],
    }
