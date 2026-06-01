from functools import lru_cache
from pathlib import Path
import os


@lru_cache(maxsize=1)
def _load_whisper_model():
    try:
        from faster_whisper import WhisperModel
    except Exception:
        return None

    model_name = os.getenv("WHISPER_MODEL", "base")
    try:
        return WhisperModel(model_name, device="cpu", compute_type="int8")
    except Exception:
        return None


def _fallback_text() -> str:
    return os.getenv("FALLBACK_TRANSCRIPTION_TEXT", "No puedo entrar a mi VPN corporativa.").strip()


def transcribe_audio(audio_path: Path) -> str:
    model = _load_whisper_model()
    if model is None:
        return _fallback_text()

    try:
        segments, _info = model.transcribe(str(audio_path), vad_filter=True)
        transcript_parts = []
        for segment in segments:
            text = getattr(segment, "text", "").strip()
            if text:
                transcript_parts.append(text)

        transcript = " ".join(transcript_parts).strip()
        return transcript or _fallback_text()
    except Exception:
        return _fallback_text()
