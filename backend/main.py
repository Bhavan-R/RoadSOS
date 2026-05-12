from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from logging_config import setup_logging
from services.dispatch_service import dispatch_router
from services.health_service import health_router
from services.offline_service import offline_router
from services.search_service import search_router
from services.triage_service import triage_router

setup_logging()

app = FastAPI(
    title="RoadSOS API",
    description=(
        "Location-aware emergency contact API for road accidents. "
        "Combines OpenStreetMap Overpass + Google Places + AI triage. "
        "Built for the National Road Safety Hackathon 2026 (CoERS × IIT Madras)."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=512)

app.include_router(health_router)
app.include_router(search_router)
app.include_router(triage_router)
app.include_router(dispatch_router)
app.include_router(offline_router)


@app.get("/", summary="Service index")
def root():
    return {
        "service": "RoadSOS API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": [
            "/health",
            "/search",
            "/triage",
            "/dispatch-summary",
            "/offline-pack",
        ],
    }
