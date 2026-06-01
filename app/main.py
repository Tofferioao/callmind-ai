from __future__ import annotations

import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .database import AUDIO_DIR, REPORTS_DIR, STORAGE_DIR, TTS_DIR, SessionLocal, init_database
from .models import SupportCall
from .schemas import CallOut, CallResponse, HealthResponse
from .services.intent_service import detect_intent
from .services.report_service import build_report_payload, save_report
from .services.response_service import calculate_satisfaction_score, generate_support_response
from .services.transcription_service import transcribe_audio
from .services.tts_service import generate_tts_audio


load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
INDEX_FILE = STATIC_DIR / "index.html"

app = FastAPI(title="CallMind AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/storage", StaticFiles(directory=STORAGE_DIR), name="storage")


@app.on_event("startup")
def on_startup() -> None:
    init_database()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _call_to_out(call: SupportCall) -> CallOut:
    return CallOut.model_validate(call)


def _tts_url(call_id: int) -> str:
    return f"/storage/tts/call_{call_id}.mp3"


def _report_url(call_id: int) -> str:
    return f"/api/calls/{call_id}/report"


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(INDEX_FILE)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.post("/api/calls", response_model=CallResponse)
def create_call(
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> CallResponse:
    if not audio.filename:
        raise HTTPException(status_code=400, detail="El archivo de audio es obligatorio.")

    audio_suffix = Path(audio.filename).suffix or ".webm"
    call_id = int(uuid.uuid4().int % 1_000_000_000)
    audio_filename = f"call_{call_id}{audio_suffix}"
    audio_path = AUDIO_DIR / audio_filename

    with audio_path.open("wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)

    transcription = transcribe_audio(audio_path)
    intent = detect_intent(transcription)
    support_response = generate_support_response(transcription, intent)
    satisfaction_score = calculate_satisfaction_score(intent, transcription)
    tts_filename = f"call_{call_id}.mp3"
    tts_path = TTS_DIR / tts_filename
    report_filename = f"call_{call_id}.json"
    report_path = REPORTS_DIR / report_filename

    try:
        generate_tts_audio(support_response, tts_path)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"No fue posible generar TTS: {error}") from error

    created_at = datetime.now(timezone.utc)
    report_payload = build_report_payload(
        call_id=call_id,
        transcription=transcription,
        intent=intent,
        support_response=support_response,
        satisfaction_score=satisfaction_score,
        created_at=created_at,
    )
    save_report(report_path, report_payload)

    call = SupportCall(
        id=call_id,
        audio_filename=audio_filename,
        transcription=transcription,
        intent=intent,
        support_response=support_response,
        satisfaction_score=satisfaction_score,
        report_filename=report_filename,
        created_at=created_at,
    )
    db.add(call)
    db.commit()
    db.refresh(call)

    return CallResponse(
        call_id=call.id,
        transcription=call.transcription,
        intent=call.intent,
        support_response=call.support_response,
        satisfaction_score=call.satisfaction_score,
        tts_audio_url=_tts_url(call.id),
        report_url=_report_url(call.id),
    )


@app.get("/api/calls", response_model=list[CallOut])
def list_calls(db: Session = Depends(get_db)) -> list[CallOut]:
    calls = db.query(SupportCall).order_by(SupportCall.created_at.desc()).all()
    return [_call_to_out(call) for call in calls]


@app.get("/api/calls/{call_id}", response_model=CallOut)
def get_call(call_id: int, db: Session = Depends(get_db)) -> CallOut:
    call = db.get(SupportCall, call_id)
    if call is None:
        raise HTTPException(status_code=404, detail="Llamada no encontrada.")
    return _call_to_out(call)


@app.get("/api/calls/{call_id}/report")
def download_report(call_id: int, db: Session = Depends(get_db)):
    call = db.get(SupportCall, call_id)
    if call is None:
        raise HTTPException(status_code=404, detail="Llamada no encontrada.")

    report_path = REPORTS_DIR / call.report_filename
    if not report_path.exists():
        payload = build_report_payload(
            call_id=call.id,
            transcription=call.transcription,
            intent=call.intent,
            support_response=call.support_response,
            satisfaction_score=call.satisfaction_score,
            created_at=call.created_at,
        )
        save_report(report_path, payload)

    return FileResponse(report_path, media_type="application/json", filename=report_path.name)


@app.get("/api/calls/{call_id}/tts")
def get_tts(call_id: int, db: Session = Depends(get_db)):
    call = db.get(SupportCall, call_id)
    if call is None:
        raise HTTPException(status_code=404, detail="Llamada no encontrada.")

    tts_path = TTS_DIR / f"call_{call.id}.mp3"
    if not tts_path.exists():
        raise HTTPException(status_code=404, detail="Audio TTS no encontrado.")

    return FileResponse(tts_path, media_type="audio/mpeg", filename=tts_path.name)


@app.exception_handler(Exception)
def generic_exception_handler(_request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": str(exc)})


def run() -> None:
    import uvicorn

    init_database()
    uvicorn.run("app.main:app", host="127.0.0.1", port=int(os.getenv("PORT", "8000")), reload=False)
