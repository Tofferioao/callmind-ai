from __future__ import annotations

import unicodedata


INTENT_KEYWORDS = [
    (
        "vpn_issue",
        ["vpn", "forticlient", "cisco anyconnect", "conectarme", "conectar", "acceso remoto"],
    ),
    (
        "password_reset",
        ["contrasena", "password", "bloqueada", "login", "reiniciar", "acceso", "usuario"],
    ),
    (
        "email_issue",
        ["correo", "outlook", "email", "mail", "buzon", "mensaje", "enviar correo"],
    ),
    (
        "network_issue",
        ["internet", "red", "wifi", "conexion", "conectividad", "network", "lentitud"],
    ),
    (
        "device_issue",
        ["laptop", "portatil", "pantalla", "teclado", "mouse", "monitor", "equipo"],
    ),
    (
        "software_issue",
        ["instalar", "aplicacion", "software", "licencia", "programa", "actualizar", "error"],
    ),
]


def normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.lower())
    return "".join(char for char in normalized if not unicodedata.combining(char))


def detect_intent(transcription: str) -> str:
    normalized_text = normalize_text(transcription)
    for intent, keywords in INTENT_KEYWORDS:
        if any(keyword in normalized_text for keyword in keywords):
            return intent
    return "unknown"
