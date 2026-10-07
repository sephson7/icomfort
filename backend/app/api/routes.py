"""GET /api/status, POST /api/telemetry."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import Action, Mode, StatusOut, TelemetryIn
from app.core.hysteresis import decide_action
from app.database.models import Telemetry
from app.database.session import get_db

router = APIRouter(prefix="/api")

# In-memory view of the latest known system state. Seeded with sane
# defaults so /api/status works before the first telemetry POST.
_state = {
    "ambient_temp": 72.4,
    "target_temp": 71.0,
    "mode": Mode.AUTO,
    "action": Action.OFF,
    "origin": "boot",
    "updated_at": datetime.now(timezone.utc).isoformat(),
}


@router.get("/status", response_model=StatusOut)
def get_status() -> StatusOut:
    return StatusOut(**_state)


@router.post("/telemetry", response_model=StatusOut)
def post_telemetry(payload: TelemetryIn, db: Session = Depends(get_db)) -> StatusOut:
    action = decide_action(payload.mode, payload.temperature, payload.target_temp, payload.action)

    db.add(
        Telemetry(
            temperature=payload.temperature,
            target_temp=payload.target_temp,
            mode=payload.mode.value,
            action=action.value,
            origin=payload.origin,
        )
    )
    db.commit()

    _state.update(
        ambient_temp=payload.temperature,
        target_temp=payload.target_temp,
        mode=payload.mode,
        action=action,
        origin=payload.origin,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    return StatusOut(**_state)
