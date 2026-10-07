"""Pure 0.5°F deadband decision logic.

Given the current mode, ambient temperature, target setpoint and the
previous HVAC action, decide what the system should do next. The deadband
prevents rapid cycling: once heating/cooling starts it continues until the
ambient temperature crosses the setpoint itself, not just the band edge.
"""
from app.core.config import Action, Mode, settings


def decide_action(
    mode: Mode,
    ambient: float,
    target: float,
    previous: Action,
    band: float | None = None,
) -> Action:
    band = settings.deadband if band is None else band
    if mode == Mode.OFF:
        return Action.OFF

    lo, hi = target - band, target + band
    can_heat = mode in (Mode.AUTO, Mode.HEAT)
    can_cool = mode in (Mode.AUTO, Mode.COOL)

    if can_heat and ambient < lo:
        return Action.HEATING
    if can_cool and ambient > hi:
        return Action.COOLING
    # Hysteresis: keep going until we cross the setpoint itself.
    if previous == Action.HEATING and can_heat and ambient < target:
        return Action.HEATING
    if previous == Action.COOLING and can_cool and ambient > target:
        return Action.COOLING
    return Action.OFF
