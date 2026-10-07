"""Telemetry & system event DB schemas."""
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Telemetry(Base):
    __tablename__ = "telemetry"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    temperature: Mapped[float] = mapped_column(Float)
    target_temp: Mapped[float] = mapped_column(Float)
    mode: Mapped[str] = mapped_column(String(8))
    action: Mapped[str] = mapped_column(String(8))
    origin: Mapped[str] = mapped_column(String(64), default="unknown")


class SystemEvent(Base):
    __tablename__ = "system_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    event: Mapped[str] = mapped_column(String(128))
    detail: Mapped[str] = mapped_column(String(256), default="")
