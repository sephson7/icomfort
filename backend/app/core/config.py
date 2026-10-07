"""Environment settings & Pydantic models for the iComfort backend."""
from enum import Enum

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings, overridable via environment variables."""

    app_name: str = "iComfort Climate API"
    database_url: str = "sqlite:///./comfort_data.db"
    deadband: float = 0.5  # °F hysteresis band around the setpoint
    cors_origins: list[str] = ["*"]

    class Config:
        env_prefix = "ICOMFORT_"


settings = Settings()


class Mode(str, Enum):
    AUTO = "AUTO"
    HEAT = "HEAT"
    COOL = "COOL"
    OFF = "OFF"


class Action(str, Enum):
    HEATING = "HEATING"
    COOLING = "COOLING"
    OFF = "OFF"


class TelemetryIn(BaseModel):
    """Payload accepted by POST /api/telemetry."""

    temperature: float = Field(..., description="Ambient temperature in °F")
    target_temp: float = Field(..., ge=50, le=90, description="Target setpoint in °F")
    mode: Mode = Mode.AUTO
    action: Action = Action.OFF
    origin: str = Field("unknown", description="Reporting node, e.g. 'Dashboard UI'")


class StatusOut(BaseModel):
    """Payload returned by GET /api/status."""

    ambient_temp: float
    target_temp: float
    mode: Mode
    action: Action
    origin: str
    updated_at: str
