# iComfort — Smart Climate Control

Full-stack IoT thermostat: a FastAPI telemetry bridge with 0.5°F hysteresis
logic, a SQLite store (`comfort_data.db`), a CLI environment simulator, and a
React + Tailwind dashboard (this repo's `src/`, generated with Lovable).

## Repository layout

```
comfort-app/
├── README.md                      # This file
├── docker-compose.yml             # One-command orchestration for API & Simulator
├── simulator.py                   # Interactive CLI environment simulator
├── requirements.txt               # Backend Python dependencies
├── backend/                       # FastAPI core engine & telemetry bridge
│   ├── app/
│   │   ├── main.py                # FastAPI entrypoint + CORS middleware
│   │   ├── core/
│   │   │   ├── config.py          # Environment settings & Pydantic models
│   │   │   └── hysteresis.py      # Pure 0.5°F deadband decision logic
│   │   ├── database/
│   │   │   ├── session.py         # SQLite connection (comfort_data.db)
│   │   │   └── models.py          # Telemetry & system event DB schemas
│   │   └── api/
│   │       └── routes.py          # GET /api/status, POST /api/telemetry
│   ├── tests/
│   │   ├── test_hysteresis.py     # Unit tests for 0.5°F boundary logic
│   │   └── test_api.py            # Integration tests (FastAPI TestClient)
│   └── Dockerfile                 # Multi-stage production Docker build
└── src/                           # React + Tailwind dashboard (Lovable)
```

## Quick start

```bash
# Backend
pip install -r requirements.txt
cd backend && uvicorn app.main:app --reload --port 8000

# Simulator (separate terminal)
python simulator.py

# Or everything at once
docker compose up --build
```

## API

### `GET /api/status`
Returns the latest known system state:

```json
{
  "ambient_temp": 72.4,
  "target_temp": 71.0,
  "mode": "AUTO",
  "action": "COOLING",
  "origin": "Simulator",
  "updated_at": "2026-10-07T05:59:00+00:00"
}
```

### `POST /api/telemetry`
Accepts a reading, runs it through the hysteresis engine, persists it, and
returns the new state:

```json
{
  "temperature": 68.0,
  "target_temp": 72.0,
  "mode": "AUTO",
  "action": "OFF",
  "origin": "Dashboard UI"
}
```

- `mode`: `AUTO | HEAT | COOL | OFF`
- `action`: `HEATING | COOLING | OFF`
- `target_temp` must be within 50–90°F.

## Hysteresis logic

Heating starts below `target - 0.5°F`, cooling above `target + 0.5°F`. Once
running, a stage keeps going until the ambient temperature crosses the
setpoint itself — this deadband prevents rapid relay cycling.

## Tests

```bash
cd backend && pytest
```

## Dashboard connection

Open the dashboard's settings (gear icon), set the API base URL
(default `http://localhost:8000`) and flip on **Use Live API**. The dashboard
polls `/api/status` every 2 seconds and posts setpoint/mode changes to
`/api/telemetry`.
