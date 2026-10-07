"""Unit tests for 0.5°F boundary logic."""
from app.core.config import Action, Mode
from app.core.hysteresis import decide_action

T = 71.0  # setpoint; band edges are 70.5 / 71.5


def test_off_mode_always_off():
    assert decide_action(Mode.OFF, 60, T, Action.HEATING) == Action.OFF


def test_heat_below_band():
    assert decide_action(Mode.AUTO, 70.4, T, Action.OFF) == Action.HEATING
    assert decide_action(Mode.HEAT, 70.4, T, Action.OFF) == Action.HEATING


def test_cool_above_band():
    assert decide_action(Mode.AUTO, 71.6, T, Action.OFF) == Action.COOLING
    assert decide_action(Mode.COOL, 71.6, T, Action.OFF) == Action.COOLING


def test_mode_restricts_action():
    assert decide_action(Mode.COOL, 60, T, Action.OFF) == Action.OFF
    assert decide_action(Mode.HEAT, 90, T, Action.OFF) == Action.OFF


def test_hysteresis_holds_until_setpoint():
    # Inside the band but below setpoint: heating continues.
    assert decide_action(Mode.AUTO, 70.8, T, Action.HEATING) == Action.HEATING
    # Once the setpoint is crossed, it stops.
    assert decide_action(Mode.AUTO, 71.1, T, Action.HEATING) == Action.OFF
    # Same for cooling.
    assert decide_action(Mode.AUTO, 71.2, T, Action.COOLING) == Action.COOLING
    assert decide_action(Mode.AUTO, 70.9, T, Action.COOLING) == Action.OFF


def test_idle_inside_band():
    assert decide_action(Mode.AUTO, 71.0, T, Action.OFF) == Action.OFF
