from pathlib import Path


def generate_tts_audio(text: str, output_path: Path) -> Path:
    from gtts import gTTS

    output_path.parent.mkdir(parents=True, exist_ok=True)
    tts = gTTS(text=text, lang="es")
    tts.save(str(output_path))
    return output_path
