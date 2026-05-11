from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.triage_service import triage_router
from services.search_service import search_router
from services.offline_service import offline_router

app = FastAPI(title="RoadSOS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router)
app.include_router(triage_router)
app.include_router(offline_router)


@app.get("/")
def health():
    return {"status": "ok", "service": "RoadSOS API"}
