from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path


def build_report_payload(
    call_id: int,
    transcription: str,
    intent: str,
    support_response: str,
    satisfaction_score: int,
    created_at: datetime,
) -> dict:
    return {
        "call_id": call_id,
        "transcription": transcription,
        "intent": intent,
        "support_response": support_response,
        "satisfaction_score": satisfaction_score,
        "created_at": created_at.isoformat(),
    }


def save_report(report_path: Path, payload: dict) -> Path:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return report_path


def load_report(report_path: Path) -> dict:
    return json.loads(report_path.read_text(encoding="utf-8"))
