from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BASE_DIR / "storage"
AUDIO_DIR = STORAGE_DIR / "audio"
TTS_DIR = STORAGE_DIR / "tts"
REPORTS_DIR = STORAGE_DIR / "reports"
DATABASE_PATH = STORAGE_DIR / "callmind.sqlite3"
DATABASE_URL = f"sqlite:///{DATABASE_PATH.as_posix()}"


def ensure_storage_directories() -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    TTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)


ensure_storage_directories()

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def init_database() -> None:
    ensure_storage_directories()
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
