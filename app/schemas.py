from datetime import datetime

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    status: str


class CallResponse(BaseModel):
    call_id: int
    transcription: str
    intent: str
    support_response: str
    satisfaction_score: int
    tts_audio_url: str
    report_url: str


class CallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    audio_filename: str
    transcription: str
    intent: str
    support_response: str
    satisfaction_score: int
    report_filename: str
    created_at: datetime


class ReportOut(BaseModel):
    call_id: int
    transcription: str
    intent: str
    support_response: str
    satisfaction_score: int
    created_at: datetime
