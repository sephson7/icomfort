"""Interactive CLI environment simulator.

Pushes synthetic ambient-temperature readings to the FastAPI bridge every
couple of seconds so the dashboard has live data without real hardware.

Usage:
    python simulator.py                 # against http://localhost:8000
    python simulator.py --api http://host:8000 --interval 2
"""
import argparse
import random
import time
import urllib.request
import json


def post(api: str, payload: dict) -> dict:
    req = urllib.request.Request(
        f"{api}/api/telemetry",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read())


def main() -> None:
    parser = argparse.ArgumentParser(description="iComfort environment simulator")
    parser.add_argument("--api", default="http://localhost:8000")
    parser.add_argument("--interval", type=float, default=2.0)
    args = parser.parse_args()

    ambient = 73.5
    target = 71.0
    print(f"Simulating against {args.api} — Ctrl+C to stop.")
    try:
        while True:
            state = post(
                args.api,
                {
                    "temperature": round(ambient, 2),
                    "target_temp": target,
                    "mode": "AUTO",
                    "action": "OFF",
                    "origin": "Simulator",
                },
            )
            action = state["action"]
            drift = 0.12 if action == "HEATING" else -0.12 if action == "COOLING" else (72.5 - ambient) * 0.01
            ambient += drift + random.uniform(-0.02, 0.02)
            print(f"ambient={ambient:6.2f}°F target={target:5.1f}°F action={action}")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
