import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, Clock, Database, Flame, Minus, Plus, Power, Settings, Snowflake, Target,
  Thermometer, Wifi, WifiOff, X, Zap,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "iComfort | Smart Climate Control" },
      { name: "description", content: "Live IoT thermostat dashboard with heating, cooling and telemetry analytics." },
      { property: "og:title", content: "iComfort | Smart Climate Control" },
      { property: "og:description", content: "Live IoT thermostat dashboard with heating, cooling and telemetry analytics." },
    ],
  }),
  component: Dashboard,
});

type Mode = "AUTO" | "HEAT" | "COOL" | "OFF";
type Action = "HEATING" | "COOLING" | "OFF";
type Point = { t: string; ambient: number; target: number };
type LogRow = { id: number; time: string; temp: number; target: number; action: Action; origin: string };

const BAND = 0.5;

function decide(mode: Mode, ambient: number, target: number, prev: Action): Action {
  if (mode === "OFF") return "OFF";
  const lo = target - BAND, hi = target + BAND;
  const canHeat = mode === "AUTO" || mode === "HEAT";
  const canCool = mode === "AUTO" || mode === "COOL";
  if (canHeat && ambient < lo) return "HEATING";
  if (canCool && ambient > hi) return "COOLING";
  if (prev === "HEATING" && canHeat && ambient < target) return "HEATING";
  if (prev === "COOLING" && canCool && ambient > target) return "COOLING";
  return "OFF";
}

const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function Dashboard() {
  const [useLive, setUseLive] = useState(false);
  const [baseUrl, setBaseUrl] = useState("http://localhost:8000");
  const [drawer, setDrawer] = useState(false);
  const [connected, setConnected] = useState(false);
  const [ambient, setAmbient] = useState(72.4);
  const [target, setTarget] = useState(71.0);
  const [mode, setMode] = useState<Mode>("AUTO");
  const [action, setAction] = useState<Action>("COOLING");
  const [updated, setUpdated] = useState<Date | null>(null);
  const [history, setHistory] = useState<Point[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const idRef = useRef(0);
  const st = useRef({ ambient, target, mode, action });
  st.current = { ambient, target, mode, action };

  const push = useCallback((a: number, t: number, act: Action, origin: string) => {
    const now = new Date();
    setUpdated(now);
    setHistory((h) => [...h, { t: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), ambient: +a.toFixed(2), target: t }].slice(-900));
    setLog((l) => [{ id: ++idRef.current, time: fmt(now), temp: a, target: t, action: act, origin }, ...l].slice(0, 12));
  }, []);

  // seed history (client only)
  useEffect(() => {
    const now = Date.now();
    const pts: Point[] = [];
    let a = 73.5;
    for (let i = 30; i > 0; i--) {
      a += (71 - a) * 0.08 + (Math.random() - 0.5) * 0.15;
      pts.push({ t: new Date(now - i * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), ambient: +a.toFixed(2), target: 71 });
    }
    setHistory(pts);
    setUpdated(new Date());
  }, []);

  // poll loop
  useEffect(() => {
    let lastLog = 0;
    const tick = async () => {
      const s = st.current;
      if (useLive) {
        try {
          const r = await fetch(`${baseUrl}/api/status`);
          if (!r.ok) throw new Error();
          const d = await r.json();
          const a = Number(d.ambient_temp ?? d.temperature ?? s.ambient);
          const t = Number(d.target_temp ?? d.setpoint ?? s.target);
          const act = (String(d.action ?? d.hvac_action ?? "OFF").toUpperCase()) as Action;
          setConnected(true);
          setAmbient(a); setTarget(t); setAction(act);
          if (d.mode) setMode(String(d.mode).toUpperCase() as Mode);
          push(a, t, act, d.origin ?? "Hardware Gateway");
        } catch { setConnected(false); }
        return;
      }
      setConnected(false);
      const drift = s.action === "HEATING" ? 0.12 : s.action === "COOLING" ? -0.12 : (72.5 - s.ambient) * 0.01;
      const a = s.ambient + drift + (Math.random() - 0.5) * 0.04;
      const act = decide(s.mode, a, s.target, s.action);
      setAmbient(a); setAction(act);
      if (Date.now() - lastLog > 6000 || act !== s.action) { lastLog = Date.now(); push(a, s.target, act, "Simulator"); }
      else setUpdated(new Date());
    };
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [useLive, baseUrl, push]);

  const send = async (t: number, m: Mode) => {
    const act = useLive ? action : decide(m, ambient, t, action);
    if (!useLive) setAction(act);
    push(ambient, t, act, useLive ? "Dashboard UI" : "Simulator");
    if (!useLive) return;
    try {
      await fetch(`${baseUrl}/api/telemetry`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temperature: +ambient.toFixed(2), target_temp: t, mode: m, action: act, origin: "Dashboard UI" }),
      });
    } catch { setConnected(false); }
  };

  const step = (d: number) => { const t = Math.min(90, Math.max(50, +(target + d).toFixed(1))); setTarget(t); send(t, mode); };
  const pickMode = (m: Mode) => { setMode(m); send(target, m); };

  const badge = action === "HEATING" ? "HEATING ACTIVE" : action === "COOLING" ? "COOLING ACTIVE" : `IDLE (WITHIN ${BAND}°F DEADBAND)`;
  const ActIcon = action === "HEATING" ? Flame : action === "COOLING" ? Snowflake : Power;
  const pct = (target - 50) / 40;
  const R = 110, C = 2 * Math.PI * R, arc = C * 0.75;

  return (
    <div data-hvac={action} className="ambient-bg min-h-screen font-sans text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-hvac/15 text-hvac transition-colors duration-700"><Thermometer className="size-5" /></div>
            <div>
              <h1 className="text-lg font-semibold leading-tight sm:text-xl">iComfort App <span className="text-muted-foreground font-normal">| Smart Climate Control</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {useLive && connected ? (
              <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs text-success"><Wifi className="size-3.5" />Connected to FastAPI Bridge</span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs text-warning"><WifiOff className="size-3.5" />{useLive ? "Bridge unreachable · " : ""}Simulated Mode</span>
            )}
            <button aria-label="Settings" onClick={() => setDrawer(true)} className="glass grid size-9 place-items-center !rounded-full hover:text-hvac"><Settings className="size-4" /></button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          {/* Hero */}
          <section className="glass glass-glow p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Ambient</span>
              <span className="flex items-center gap-2 rounded-full bg-hvac/15 px-3 py-1 text-[11px] font-semibold tracking-wider text-hvac transition-colors duration-700">
                <span className="relative flex size-2">
                  {action !== "OFF" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-hvac opacity-75" />}
                  <span className="relative inline-flex size-2 rounded-full bg-hvac" />
                </span>
                {badge}
              </span>
            </div>
            <div className="mt-2 font-mono text-6xl font-semibold tracking-tight sm:text-7xl">{ambient.toFixed(1)}<span className="text-3xl text-muted-foreground">°F</span></div>

            <div className="my-6 flex items-center justify-center gap-4 sm:gap-8">
              <button aria-label="Decrease" onClick={() => step(-0.5)} className="glass grid size-14 place-items-center !rounded-full hover:text-hvac active:scale-95 transition"><Minus /></button>
              <div className="relative size-56 sm:size-64">
                <svg viewBox="0 0 260 260" className="size-full -rotate-[225deg]">
                  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--accent-c)" /><stop offset="1" stopColor="var(--accent-c2)" /></linearGradient></defs>
                  <circle cx="130" cy="130" r={R} fill="none" stroke="var(--muted)" strokeWidth="14" strokeDasharray={`${arc} ${C}`} strokeLinecap="round" />
                  <circle cx="130" cy="130" r={R} fill="none" stroke="url(#g)" strokeWidth="14" strokeDasharray={`${arc * pct} ${C}`} strokeLinecap="round" style={{ transition: "stroke-dasharray .5s ease", filter: "drop-shadow(0 0 8px var(--glow))" }} />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-center">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Target</div>
                    <div className="font-mono text-5xl font-semibold text-hvac transition-colors duration-700">{target.toFixed(1)}</div>
                    <div className="text-sm text-muted-foreground">°F</div>
                  </div>
                </div>
              </div>
              <button aria-label="Increase" onClick={() => step(0.5)} className="glass grid size-14 place-items-center !rounded-full hover:text-hvac active:scale-95 transition"><Plus /></button>
            </div>

            <div className="mb-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
              <span className="text-hvac font-mono">{BAND}°F</span> Hysteresis Deadband{" "}
              <span className="font-mono text-muted-foreground">({(target - BAND).toFixed(1)}°F – {(target + BAND).toFixed(1)}°F)</span>
            </div>

            <div className="grid grid-cols-4 gap-1 rounded-full border border-border bg-muted/40 p-1">
              {(["AUTO", "HEAT", "COOL", "OFF"] as Mode[]).map((m) => (
                <button key={m} onClick={() => pickMode(m)}
                  className={`rounded-full py-2 text-xs font-semibold tracking-wider transition-all duration-300 ${mode === m ? "bg-hvac text-background shadow-lg" : "text-muted-foreground hover:text-foreground"}`}>
                  {m}
                </button>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-4">
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <Metric icon={<ActIcon className="size-4" />} label="HVAC Action" value={action} accent />
              <Metric icon={<Target className="size-4" />} label="Target Setpoint" value={`${target.toFixed(1)}°F`} />
              <Metric icon={<Clock className="size-4" />} label="Last Update" value={updated ? fmt(updated) : "—"} />
              <Metric icon={<Database className="size-4" />} label="Database" value="comfort_data.db" sub="Synchronized" />
            </div>

            {/* Chart */}
            <section className="glass flex-1 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-medium"><Activity className="size-4 text-hvac" />Temperature · last 30 min</h2>
                <div className="flex gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><i className="h-0.5 w-3 bg-hvac" />Ambient</span>
                  <span className="flex items-center gap-1"><i className="h-0 w-3 border-t border-dashed border-muted-foreground" />Setpoint</span>
                </div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ left: -20, right: 4, top: 4 }}>
                    <defs><linearGradient id="fa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent-c)" stopOpacity={0.4} /><stop offset="1" stopColor="var(--accent-c)" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="t" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={40} />
                    <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => Number(v).toFixed(0)} />
                    <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                    <Area type="monotone" dataKey="ambient" name="Ambient" stroke="var(--accent-c)" strokeWidth={2} fill="url(#fa)" isAnimationActive={false} />
                    <Line type="stepAfter" dataKey="target" name="Setpoint" stroke="var(--muted-foreground)" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>

        {/* Log */}
        <section className="glass mt-4 overflow-hidden">
          <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-medium"><Zap className="size-4 text-hvac" />Live Telemetry Log <span className="font-mono text-xs text-muted-foreground">/api/telemetry</span></h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>{["Time", "Recorded", "Setpoint", "Action", "Node Origin"].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="font-mono">
                {log.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground font-sans">Waiting for telemetry…</td></tr>}
                {log.map((r) => (
                  <tr key={r.id} className="border-t border-border animate-in fade-in slide-in-from-top-1">
                    <td className="px-4 py-2 text-muted-foreground">{r.time}</td>
                    <td className="px-4 py-2">{r.temp.toFixed(2)}°F</td>
                    <td className="px-4 py-2">{r.target.toFixed(1)}°F</td>
                    <td className="px-4 py-2"><span data-hvac={r.action} className="rounded-md bg-hvac/15 px-2 py-0.5 text-xs text-hvac">{r.action}</span></td>
                    <td className="px-4 py-2 font-sans text-muted-foreground">{r.origin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-sm animate-in fade-in" onClick={() => setDrawer(false)}>
          <aside onClick={(e) => e.stopPropagation()} className="glass h-full w-full max-w-sm !rounded-none !rounded-l-2xl bg-background/90 p-6 animate-in slide-in-from-right">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-semibold">Connection Settings</h2>
              <button aria-label="Close" onClick={() => setDrawer(false)} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
            </div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">API Base URL</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 font-mono text-sm outline-none focus:border-hvac" />
            <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-muted/40 p-4">
              <div>
                <div className="text-sm font-medium">{useLive ? "Use Live API" : "Use Mock Data"}</div>
                <div className="text-xs text-muted-foreground">Polls /api/status every 2s</div>
              </div>
              <button role="switch" aria-checked={useLive} onClick={() => setUseLive((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${useLive ? "bg-success" : "bg-muted"}`}>
                <span className={`absolute top-0.5 size-5 rounded-full bg-foreground transition-all ${useLive ? "left-5.5" : "left-0.5"}`} />
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`glass p-4 ${accent ? "glass-glow" : ""}`}>
      <div className={`mb-2 flex items-center gap-2 text-xs text-muted-foreground ${accent ? "[&>svg]:text-hvac" : ""}`}>{icon}{label}</div>
      <div className={`truncate font-mono text-base font-semibold sm:text-lg ${accent ? "text-hvac transition-colors duration-700" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 flex items-center gap-1 text-xs text-success"><span className="size-1.5 rounded-full bg-success" />{sub}</div>}
    </div>
  );
}
