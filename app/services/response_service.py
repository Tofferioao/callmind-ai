from __future__ import annotations

import hashlib
import os
from typing import Optional


RESPONSES = {
    "vpn_issue": (
        "Entiendo que tienes problemas para conectarte a la VPN corporativa. "
        "Primero verifica tu conexión a internet, luego confirma que tus credenciales estén correctas, "
        "reinicia el cliente VPN y prueba nuevamente. Si el error continúa, comparte el código de error "
        "con soporte para revisar tu perfil de acceso."
    ),
    "password_reset": (
        "Parece que necesitas ayuda con acceso o restablecimiento de contraseña. "
        "Verifica que el bloqueo no sea temporal, usa el flujo oficial de restablecimiento de contraseña, "
        "confirma que tu usuario esté activo y vuelve a intentar el inicio de sesión. Si no funciona, "
        "soporte puede desbloquear tu cuenta y validar tus permisos."
    ),
    "email_issue": (
        "Entiendo que presentas problemas con el correo electrónico. "
        "Revisa primero tu conexión, confirma que Outlook o tu cliente de correo esté sincronizando, "
        "verifica el espacio disponible en el buzón y vuelve a enviar el mensaje. "
        "Si el incidente persiste, comparte el mensaje de error para revisar la configuración de tu cuenta."
    ),
    "network_issue": (
        "Gracias por el detalle. Si el problema está relacionado con red o internet, "
        "verifica si otros dispositivos navegan correctamente, reinicia el adaptador de red, "
        "prueba en otra conexión y confirma si el fallo ocurre solo en una aplicación o en todo el equipo. "
        "Si continúa, soporte puede revisar la ruta, el estado de tu enlace o tu configuración local."
    ),
    "device_issue": (
        "Entiendo que tienes un incidente de equipo o periférico. "
        "Revisa conexiones físicas, reinicia el dispositivo, verifica si el problema se repite en otro puerto "
        "o con otro accesorio y confirma si el sistema operativo detecta el hardware. "
        "Si el fallo continúa, soporte puede coordinar revisión técnica o reemplazo."
    ),
    "software_issue": (
        "Comprendo que el inconveniente está relacionado con una aplicación o software. "
        "Confirma la versión instalada, reinicia la aplicación, verifica permisos y licencias, "
        "y prueba una reinstalación limpia si el error persiste. Si necesitas apoyo adicional, "
        "soporte puede revisar compatibilidad, licenciamiento o dependencias del sistema."
    ),
    "unknown": (
        "Necesito un poco más de detalle para identificar el incidente. "
        "Describe el problema, el sistema afectado, el mensaje de error y desde cuándo ocurre. "
        "Con esa información podré orientar mejor el siguiente paso de soporte."
    ),
}


def _use_openai() -> bool:
    return os.getenv("USE_OPENAI", "false").strip().lower() in {"1", "true", "yes", "on"}


def _openai_response(transcription: str, intent: str) -> Optional[str]:
    if not _use_openai():
        return None

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        from openai import OpenAI
    except Exception:
        return None

    try:
        client = OpenAI(api_key=api_key)
        completion = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Eres un asistente de soporte técnico IT. Responde siempre en español, "
                        "con tono profesional, claro y orientado a resolución."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Transcripción: {transcription}\n"
                        f"Intención detectada: {intent}\n"
                        "Redacta una respuesta breve y útil para el usuario."
                    ),
                },
            ],
            temperature=0.2,
        )
        content = completion.choices[0].message.content
        return content.strip() if content else None
    except Exception:
        return None


def generate_support_response(transcription: str, intent: str) -> str:
    openai_response = _openai_response(transcription, intent)
    if openai_response:
        return openai_response
    return RESPONSES.get(intent, RESPONSES["unknown"])


def calculate_satisfaction_score(intent: str, transcription: str) -> int:
    digest = hashlib.sha256(f"{intent}|{transcription}".encode("utf-8")).hexdigest()
    value = int(digest, 16)
    if intent == "unknown":
        return 70 + value % 13
    return 88 + value % 11
