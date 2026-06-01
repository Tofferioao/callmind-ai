from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class SupportCall(Base):
    __tablename__ = "support_calls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    audio_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    transcription: Mapped[str] = mapped_column(Text, nullable=False)
    intent: Mapped[str] = mapped_column(String(64), nullable=False)
    support_response: Mapped[str] = mapped_column(Text, nullable=False)
    satisfaction_score: Mapped[int] = mapped_column(Integer, nullable=False)
    report_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
    )
