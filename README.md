# CallMind AI

CallMind AI es un MVP de asistente de voz para soporte técnico IT. Permite grabar audio desde el navegador, transcribirlo, detectar la intención del problema, generar una respuesta de soporte, convertir esa respuesta a voz, guardar el resumen en SQLite y exportar un reporte JSON.

## Features

- Grabación de audio desde el navegador.
- Carga del audio al backend FastAPI.
- Transcripción local con `faster-whisper` cuando está disponible.
- Fallback configurable para desarrollo si el modelo falla o no está instalado.
- Detección de intención por keywords.
- Respuestas profesionales en español.
- Generación de voz con `gTTS`.
- Persistencia en SQLite con SQLAlchemy.
- Exportación de reporte JSON por llamada.
- Interfaz HTML/CSS/JavaScript simple y responsive.

## Arquitectura

- `app/main.py`: endpoints, montaje de estáticos y orquestación.
- `app/database.py`: engine SQLite, sesiones y creación de carpetas.
- `app/models.py`: modelo `support_calls`.
- `app/schemas.py`: schemas Pydantic.
- `app/services/`: transcripción, intención, respuesta, TTS y reportes.
- `app/static/`: frontend del MVP.
- `app/storage/`: audio original, MP3 generados y reportes JSON.

## Instalación

### Windows

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

### macOS / Linux

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py
```

## Configuración

Copia `.env.example` a `.env` y ajusta los valores si lo necesitas.

- `OPENAI_API_KEY`: opcional.
- `USE_OPENAI`: `true` o `false`.
- `WHISPER_MODEL`: modelo de `faster-whisper`, por defecto `base`.
- `FALLBACK_TRANSCRIPTION_TEXT`: texto usado si la transcripción local falla.

## Ejecución

Una vez levantada la app, abre `http://127.0.0.1:8000`.

## Endpoints

- `GET /`: sirve el frontend.
- `POST /api/calls`: recibe audio, procesa la llamada y devuelve resultados.
- `GET /api/calls`: lista todas las llamadas guardadas.
- `GET /api/calls/{call_id}`: detalle de una llamada.
- `GET /api/calls/{call_id}/report`: descarga el reporte JSON.
- `GET /api/health`: estado de la aplicación.

## Demo workflow

1. Abre la página principal.
2. Pulsa **Iniciar grabación** y dicta un problema de soporte.
3. Pulsa **Detener grabación**.
4. Espera a que el backend procese la llamada.
5. Revisa transcripción, intención, respuesta, score y audio TTS.
6. Descarga el reporte JSON.

## Capturas sugeridas

- Pantalla principal del dashboard.
- Estado de grabación en curso.
- Resultado con transcripción, intención y respuesta.
- Reproductor de audio TTS.
- Vista del reporte JSON descargado.

## Roadmap

- Procesamiento asíncrono con cola de tareas.
- Autenticación y control de acceso.
- Historial con filtros y búsqueda.
- Métricas agregadas por tipo de incidencia.
- Mejoras de STT con modelos más grandes.
- Intent detection híbrida con reglas + LLM opcional.

## License

MIT.

## Disclaimer

Proyecto educativo/MVP. No reemplaza un sistema real de soporte IT ni una solución de producción con garantías operativas, seguridad, auditoría y cumplimiento.
