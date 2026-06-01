import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Activity,
  Target,
  Play,
  Square,
  Plus,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sun,
  Moon
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

import "./index.css";

// Utility: Format seconds into readable duration
function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0m";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);

  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

// Apple Tooltip design
const AppleAreaTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          border: '1px solid var(--colors-hairline)',
          background: 'var(--colors-canvas)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
        }}
      >
        <p style={{ color: 'var(--colors-ink-muted-48)', marginBottom: '2px' }}>{payload[0].payload.hour}</p>
        <p style={{ fontWeight: 600, color: 'var(--colors-primary)' }}>{payload[0].value}m active</p>
      </div>
    );
  }
  return null;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "analytics" | "focus" | "goals" | "settings">("dashboard");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    // Persist theme preference
    const saved = localStorage.getItem("aura-theme");
    return (saved === "dark" || saved === "light") ? saved : "light";
  });
  const [todayDate, setTodayDate] = useState(new Date().toISOString().split("T")[0]);

  // Telemetry state
  const [topApps, setTopApps] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [focusSessions, setFocusSessions] = useState<any[]>([]);

  // Focus Timer state
  const [focusActive, setFocusActive] = useState(false);
  const [focusDuration, setFocusDuration] = useState(1500);
  const [timeLeft, setTimeLeft] = useState(1500);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);

  // Form states
  const [goalType, setGoalType] = useState<"app" | "category">("category");
  const [goalLimitHours, setGoalLimitHours] = useState(2);
  const [goalValueName, setGoalValueName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Autostart state
  const [autostartEnabled, setAutostartEnabled] = useState(true);

  // Sync date every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setTodayDate(new Date().toISOString().split("T")[0]);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch telemetry
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const appsRes = await invoke<any[]>("get_top_apps", { dateStr: todayDate, limit: 10 });
        setTopApps(appsRes || []);

        const catRes = await invoke<any[]>("get_category_distribution", { dateStr: todayDate });
        setCategories(catRes || []);

        const timeRes = await invoke<any[]>("get_hourly_timeline", { dateStr: todayDate });
        const formattedTimeline = (timeRes || []).map(seg => ({
          hour: `${seg.hour.toString().padStart(2, '0')}:00`,
          Minutes: Math.round(seg.total_seconds / 60)
        }));
        setTimeline(formattedTimeline);

        const heatRes = await invoke<any[]>("get_heatmap_data");
        setHeatmapData(heatRes || []);

        const goalsRes = await invoke<any[]>("get_goals", { dateStr: todayDate });
        setGoals(goalsRes || []);

        const sessionRes = await invoke<any[]>("get_focus_sessions");
        setFocusSessions(sessionRes || []);
      } catch (err) {
        console.error("Error loading telemetry:", err);
      }
    };

    fetchTelemetry();

    // Live telemetry sync interval
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, [todayDate, refreshTrigger]);

  // Handle Theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("aura-theme", theme);
  }, [theme]);

  // Check autostart status on mount
  useEffect(() => {
    invoke<boolean>("get_autostart_enabled")
      .then(setAutostartEnabled)
      .catch(() => {});
  }, []);

  // Total screen time calculation
  const totalScreenTimeSecs = useMemo(() => {
    return topApps.reduce((acc, app) => acc + app.total_seconds, 0);
  }, [topApps]);

  // Focus Timer countdown effect
  useEffect(() => {
    let timerId: any = null;
    if (focusActive && timeLeft > 0) {
      timerId = setInterval(() => {
        setTimeLeft(t => t - 1);
      }, 1000);
    } else if (focusActive && timeLeft === 0) {
      completeFocusSession();
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [focusActive, timeLeft]);

  // Focus Mode handlers
  const startFocusSession = async () => {
    try {
      const sessId = await invoke<number>("start_focus_session", { targetSeconds: focusDuration });
      setCurrentSessionId(sessId);
      setTimeLeft(focusDuration);
      setFocusActive(true);
      setActiveTab("focus");
    } catch (e) {
      console.error(e);
    }
  };

  const cancelFocusSession = async () => {
    if (currentSessionId === null) return;
    try {
      const elapsed = focusDuration - timeLeft;
      await invoke("end_focus_session", {
        sessionId: currentSessionId,
        actualSeconds: elapsed,
        completed: false
      });
      setFocusActive(false);
      setCurrentSessionId(null);
      setRefreshTrigger(r => r + 1);
    } catch (e) {
      console.error(e);
    }
  };

  const completeFocusSession = async () => {
    if (currentSessionId === null) return;
    try {
      await invoke("end_focus_session", {
        sessionId: currentSessionId,
        actualSeconds: focusDuration,
        completed: true
      });
      setFocusActive(false);
      setCurrentSessionId(null);
      setTimeLeft(focusDuration);
      setRefreshTrigger(r => r + 1);

      new Notification("Focus Session Complete", {
        body: "Outstanding job staying focused! Take a well-deserved break.",
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Create screen limit goal
  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalValueName.trim()) return;

    try {
      const limitSecs = goalLimitHours * 3600;
      await invoke("create_goal", {
        appId: null,
        category: goalType === "category" ? goalValueName : null,
        limitSeconds: limitSecs,
        period: "daily"
      });
      setGoalValueName("");
      setRefreshTrigger(r => r + 1);
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle autostart
  const toggleAutostart = async (enabled: boolean) => {
    try {
      await invoke("set_autostart_enabled", { enabled });
      setAutostartEnabled(enabled);
    } catch (e) {
      console.error("Failed to toggle autostart:", e);
    }
  };

  // Export Data
  const exportTelemetry = (format: "json" | "csv") => {
    const dataToExport = {
      summaryDate: todayDate,
      totalScreenTimeSeconds: totalScreenTimeSecs,
      apps: topApps,
      categories
    };

    if (format === "json") {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `aura_report_${todayDate}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Application,Executable,Category,Usage (Seconds)\n";
      topApps.forEach(app => {
        csvContent += `"${app.display_name}","${app.executable_name}","${app.category}",${app.total_seconds}\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", encodedUri);
      downloadAnchor.setAttribute("download", `aura_report_${todayDate}.csv`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
  };

  // Heatmap mapping (120 days)
  const heatmapGridData = useMemo(() => {
    const grid = [];
    const now = new Date();
    for (let i = 119; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const match = heatmapData.find(p => p.date === dateStr);
      const seconds = match ? match.count : 0;

      let level = 0;
      if (seconds > 0 && seconds <= 1800) level = 1;
      else if (seconds > 1800 && seconds <= 7200) level = 2;
      else if (seconds > 7200 && seconds <= 14400) level = 3;
      else if (seconds > 14400) level = 4;

      grid.push({ dateStr, level, seconds });
    }
    return grid;
  }, [heatmapData]);

  // Color Constants for Category Pie
  const COLORS = ["#0066cc", "#2997ff", "#059669", "#d97706", "#e11d48", "#818cf8"];

  return (
    <div className="app-container">
      {/* Sub-nav-frosted — now the top-level navigation bar */}
      <header className="sub-nav-frosted">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Activity size={16} color="var(--colors-primary)" />
          <span className="sub-nav-title">Aura</span>
        </div>
        <div className="sub-nav-actions">
          <span className={`sub-nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Overview</span>
          <span className={`sub-nav-tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>Insights</span>
          <span className={`sub-nav-tab ${activeTab === 'focus' ? 'active' : ''}`} onClick={() => setActiveTab('focus')}>Focus Mode</span>
          <span className={`sub-nav-tab ${activeTab === 'goals' ? 'active' : ''}`} onClick={() => setActiveTab('goals')}>Limits</span>
          <span className={`sub-nav-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>Settings</span>

          {/* Theme toggle */}
          <div
            className="theme-toggle-wrapper"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{ cursor: 'pointer' }}
          >
            {theme === 'dark' ? <Moon size={14} color="var(--colors-ink-muted-48)" /> : <Sun size={14} color="var(--colors-ink-muted-48)" />}
            <div className={`theme-toggle-track ${theme === 'dark' ? 'active' : ''}`}>
              <div className="theme-toggle-thumb" />
            </div>
          </div>

          {/* Persistent Action Blue Pill CTA */}
          <button className="button-primary" onClick={startFocusSession} style={{ padding: '6px 14px', fontSize: '12px' }}>
            <Play size={11} fill="white" />
            <span>Start Focus</span>
          </button>
        </div>
      </header>

      {/* Main Scrollable Viewport */}
      <div className="main-viewport">

        {activeTab === "dashboard" && (
          <>
            {/* Tile 1: Core Cards */}
            <section className="viewport-tile light">
              <div>
                <h1 className="hero-display">Performance Overview</h1>
                <p className="lead-subcopy" style={{ marginTop: '8px' }}>Your daily wellbeing analytics captured in real time.</p>
              </div>

              {/* Grid of Store Cards — No productivity index */}
              <div className="store-grid-container">
                <div className="store-utility-card">
                  <div className="card-header">
                    <div>
                      <span className="card-subtitle">SCREEN TIME</span>
                      <h3 className="card-title" style={{ fontSize: '24px', marginTop: '6px' }}>{formatDuration(totalScreenTimeSecs)}</h3>
                    </div>
                    <Clock size={18} color="var(--colors-primary)" />
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--colors-ink-muted-48)' }}>Total Active Duration</span>
                </div>

                <div className="store-utility-card">
                  <div className="card-header">
                    <div>
                      <span className="card-subtitle">APPLICATIONS</span>
                      <h3 className="card-title" style={{ fontSize: '24px', marginTop: '6px' }}>{topApps.length}</h3>
                    </div>
                    <Activity size={18} color="var(--colors-primary)" />
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--colors-ink-muted-48)' }}>Unique Apps Tracked Today</span>
                </div>

                <div className="store-utility-card">
                  <div className="card-header">
                    <div>
                      <span className="card-subtitle">LIMIT RULES</span>
                      <h3 className="card-title" style={{ fontSize: '24px', marginTop: '6px' }}>
                        {goals.filter(g => g.current_usage_seconds > g.duration_limit_seconds).length} / {goals.length} Exceeded
                      </h3>
                    </div>
                    <Target size={18} color="var(--colors-warning)" />
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--colors-ink-muted-48)' }}>Active Daily Screentime Limits</span>
                </div>
              </div>
            </section>

            {/* Tile 2: Charts */}
            <section className="viewport-tile parchment">
              <div>
                <h2 className="hero-display" style={{ fontSize: '28px' }}>Daily Interactions</h2>
                <p className="lead-subcopy" style={{ fontSize: '15px', marginTop: '4px' }}>Hourly screen time and categorical activity distributions.</p>
              </div>

              <div className="store-grid-container" style={{ gridTemplateColumns: '2fr 1fr' }}>
                {/* Area timeline chart */}
                <div className="store-utility-card">
                  <span className="card-subtitle" style={{ marginBottom: '16px', display: 'block' }}>HOURLY ACTIVITY (MINUTES)</span>
                  <div style={{ width: '100%', height: '240px' }}>
                    {timeline.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={timeline} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--colors-primary)" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="var(--colors-primary)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="hour" stroke="var(--colors-ink-muted-48)" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="var(--colors-ink-muted-48)" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip content={<AppleAreaTooltip />} />
                          <Area type="monotone" dataKey="Minutes" stroke="var(--colors-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorMinutes)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: 'var(--colors-ink-muted-48)', fontSize: '13px' }}>
                        No tracking metrics captured today.
                      </div>
                    )}
                  </div>
                </div>

                {/* Pie Chart categories */}
                <div className="store-utility-card">
                  <span className="card-subtitle" style={{ marginBottom: '16px', display: 'block' }}>APP CLASSIFICATIONS</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <div style={{ width: '130px', height: '130px' }}>
                      {categories.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={categories}
                              cx="50%"
                              cy="50%"
                              innerRadius={44}
                              outerRadius={56}
                              paddingAngle={3}
                              dataKey="total_seconds"
                              nameKey="category"
                            >
                              {categories.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: 'var(--colors-ink-muted-48)', fontSize: '12px' }}>
                          Empty
                        </div>
                      )}
                    </div>
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {categories.map((cat, i) => (
                        <div key={cat.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: COLORS[i % COLORS.length] }}></div>
                            <span style={{ color: 'var(--colors-ink-muted-80)' }}>{cat.category}</span>
                          </div>
                          <span style={{ fontWeight: 600 }}>{formatDuration(cat.total_seconds)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Tile 3: App rankings */}
            <section className="viewport-tile light">
              <div>
                <h2 className="hero-display" style={{ fontSize: '28px' }}>Application Rankings</h2>
                <p className="lead-subcopy" style={{ fontSize: '15px', marginTop: '4px' }}>Ranking of most actively used processes on this device.</p>
              </div>

              <div className="store-utility-card">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {topApps.length > 0 ? (
                    topApps.map((app, index) => {
                      const percentage = Math.round((app.total_seconds / totalScreenTimeSecs) * 100);
                      return (
                        <div key={app.executable_name} style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'var(--colors-canvas-parchment)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--colors-ink-muted-80)'
                          }}>
                            {index + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--colors-ink)' }}>{app.display_name}</span>
                              <span style={{ fontSize: '13px', color: 'var(--colors-ink-muted-80)', fontWeight: 500 }}>{formatDuration(app.total_seconds)} ({percentage}%)</span>
                            </div>
                            <div className="capsule-progress-bar">
                              <div className="capsule-progress-fill" style={{ width: `${percentage}%` }}></div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--colors-ink-muted-48)', fontSize: '13px' }}>
                      No devices metrics captured yet today.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {activeTab === "analytics" && (
          <>
            {/* Tile 1: Heatmap */}
            <section className="viewport-tile light">
              <div>
                <h1 className="hero-display">Consistency Insights</h1>
                <p className="lead-subcopy" style={{ marginTop: '8px' }}>Your daily screen-time habits mapped over the past 120 days.</p>
              </div>

              <div className="heatmap-calendar-card">
                <span className="card-subtitle" style={{ marginBottom: '16px', display: 'block' }}>DAILY SCREEN TIME HEATMAP</span>
                <div className="heatmap-grid" style={{ padding: '8px 0' }}>
                  {heatmapGridData.map((day, index) => (
                    <div
                      key={index}
                      className={`heatmap-cell level-${day.level}`}
                      title={`${day.dateStr}: ${formatDuration(day.seconds)} tracked`}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', fontSize: '11px', color: 'var(--colors-ink-muted-48)', marginTop: '12px', alignItems: 'center' }}>
                  <span>Less</span>
                  <div className="heatmap-cell level-0" style={{ width: '10px', height: '10px' }}></div>
                  <div className="heatmap-cell level-1" style={{ width: '10px', height: '10px' }}></div>
                  <div className="heatmap-cell level-2" style={{ width: '10px', height: '10px' }}></div>
                  <div className="heatmap-cell level-3" style={{ width: '10px', height: '10px' }}></div>
                  <div className="heatmap-cell level-4" style={{ width: '10px', height: '10px' }}></div>
                  <span>More</span>
                </div>
              </div>
            </section>

            {/* Tile 2: Simplified app table — no category/productivity/actions columns */}
            <section className="viewport-tile parchment">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h2 className="hero-display" style={{ fontSize: '28px' }}>Application Directory</h2>
                  <p className="lead-subcopy" style={{ fontSize: '15px', marginTop: '4px' }}>All tracked applications and their screen time today.</p>
                </div>
                <div style={{ width: '240px' }}>
                  <input
                    type="text"
                    placeholder="Search apps..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-pill-input"
                    style={{ fontSize: '13.5px', padding: '8px 16px' }}
                  />
                </div>
              </div>

              <div className="store-utility-card" style={{ padding: '0px', overflow: 'hidden' }}>
                <table className="store-table">
                  <thead>
                    <tr>
                      <th>Executable</th>
                      <th>Display Name</th>
                      <th style={{ textAlign: 'right' }}>Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topApps.filter(app => app.executable_name.toLowerCase().includes(searchTerm.toLowerCase())).map(app => (
                      <tr key={app.executable_name}>
                        <td style={{ fontFamily: 'monospace', color: 'var(--colors-primary)' }}>{app.executable_name}</td>
                        <td style={{ fontWeight: 600 }}>{app.display_name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatDuration(app.total_seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {activeTab === "focus" && (
          <>
            {/* Tile 1: Focus timer */}
            <section className="viewport-tile light" style={{ alignItems: 'center', justifyContent: 'center', padding: '80px' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h1 className="hero-display">Focus Block</h1>
                <p className="lead-subcopy" style={{ marginTop: '8px', marginLeft: 'auto', marginRight: 'auto' }}>Concentrate deeply. Distractions are muted automatically.</p>
              </div>

              <div
                className={`product-focused-dial ${focusActive ? 'focused' : ''}`}
                style={{
                  width: '220px',
                  height: '220px',
                  borderRadius: '50%',
                  background: 'var(--colors-canvas)',
                  border: focusActive ? '2px solid var(--colors-primary)' : '1px solid var(--colors-hairline)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '32px'
                }}
              >
                <span style={{ fontSize: '44px', fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '-1.5px', color: 'var(--colors-ink)' }}>
                  {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:
                  {(timeLeft % 60).toString().padStart(2, '0')}
                </span>
                <span className="card-subtitle" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px', fontWeight: 600 }}>
                  {focusActive ? 'Focus Block Active' : 'Idle'}
                </span>
              </div>

              {/* Segmented Preset Capsule */}
              {!focusActive && (
                <div className="segmented-pill-container" style={{ marginBottom: '28px' }}>
                  {[15, 25, 45, 60].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      className={`segmented-pill-button ${focusDuration === mins * 60 ? 'active' : ''}`}
                      onClick={() => {
                        setFocusDuration(mins * 60);
                        setTimeLeft(mins * 60);
                      }}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '14px' }}>
                {!focusActive ? (
                  <button className="button-primary" onClick={startFocusSession}>
                    <Play size={13} fill="white" />
                    <span>Start Session</span>
                  </button>
                ) : (
                  <>
                    <button className="button-primary" onClick={completeFocusSession} style={{ background: 'var(--colors-success)' }}>
                      <CheckCircle2 size={13} />
                      <span>Complete Block</span>
                    </button>
                    <button className="button-secondary-pill" onClick={cancelFocusSession} style={{ color: 'var(--colors-danger)', borderColor: 'var(--colors-danger)' }}>
                      <Square size={13} />
                      <span>Interrupt</span>
                    </button>
                  </>
                )}
              </div>
            </section>

            {/* Tile 2: Cycle logs */}
            <section className="viewport-tile parchment">
              <div>
                <h2 className="hero-display" style={{ fontSize: '28px' }}>Logged Blocks</h2>
                <p className="lead-subcopy" style={{ fontSize: '15px', marginTop: '4px' }}>History of completed and interrupted focus blocks.</p>
              </div>

              <div className="store-utility-card">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                  {focusSessions.length > 0 ? (
                    focusSessions.map(sess => (
                      <div key={sess.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--colors-divider-soft)'
                      }}>
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 600 }}>
                            {Math.round(sess.target_duration_seconds / 60)}m concentration block
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--colors-ink-muted-48)' }}>
                            {new Date(sess.start_time).toLocaleDateString()}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: sess.completed ? 'var(--colors-success)' : 'var(--colors-danger)'
                        }}>
                          {sess.completed ? "Achieved" : "Interrupted"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--colors-ink-muted-48)', fontSize: '13px' }}>
                      No focus history recorded.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {activeTab === "goals" && (
          <>
            {/* Tile 1: Active limit bars */}
            <section className="viewport-tile light">
              <div>
                <h1 className="hero-display">Usage Guardrails</h1>
                <p className="lead-subcopy" style={{ marginTop: '8px' }}>Active boundaries to preserve your screen relationship.</p>
              </div>

              <div className="store-utility-card" style={{ gap: '24px' }}>
                <span className="card-subtitle">ACTIVE LIMIT ENFORCEMENTS</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {goals.length > 0 ? (
                    goals.map(goal => {
                      const targetName = goal.executable_name || goal.category || "General";
                      const percent = Math.min(Math.round((goal.current_usage_seconds / goal.duration_limit_seconds) * 100), 100);
                      const isExceeded = goal.current_usage_seconds > goal.duration_limit_seconds;

                      return (
                        <div key={goal.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {isExceeded ? <AlertTriangle size={13} color="var(--colors-danger)" /> : <ShieldCheck size={13} color="var(--colors-success)" />}
                              {targetName} Limit
                            </span>
                            <span style={{ color: isExceeded ? 'var(--colors-danger)' : 'var(--colors-ink-muted-80)', fontWeight: 500 }}>
                              {formatDuration(goal.current_usage_seconds)} / {formatDuration(goal.duration_limit_seconds)}
                            </span>
                          </div>
                          <div className="capsule-progress-bar">
                            <div className="capsule-progress-fill" style={{
                              width: `${percent}%`,
                              background: isExceeded ? 'var(--colors-danger)' : 'var(--colors-primary)'
                            }}></div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--colors-ink-muted-48)', fontSize: '13px' }}>
                      No active screen limits configured.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Tile 2: Limit enforcer form */}
            <section className="viewport-tile parchment">
              <div>
                <h2 className="hero-display" style={{ fontSize: '28px' }}>Apply Daily Limits</h2>
                <p className="lead-subcopy" style={{ fontSize: '15px', marginTop: '4px' }}>Configure new boundaries for apps or categories.</p>
              </div>

              <div className="store-utility-card" style={{ maxWidth: '480px' }}>
                <form onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--colors-ink-muted-48)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Rule Context</label>
                    <div className="segmented-pill-container">
                      <button
                        type="button"
                        className={`segmented-pill-button ${goalType === 'category' ? 'active' : ''}`}
                        onClick={() => setGoalType("category")}
                      >
                        Category
                      </button>
                      <button
                        type="button"
                        className={`segmented-pill-button ${goalType === 'app' ? 'active' : ''}`}
                        onClick={() => setGoalType("app")}
                      >
                        App Executable
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--colors-ink-muted-48)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      {goalType === 'category' ? 'Category Name' : 'Executable Target'}
                    </label>
                    <input
                      type="text"
                      placeholder={goalType === 'category' ? "Social" : "chrome.exe"}
                      value={goalValueName}
                      onChange={(e) => setGoalValueName(e.target.value)}
                      required
                      className="search-pill-input"
                      style={{ borderRadius: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--colors-ink-muted-48)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Daily Allotment (Hours)</label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={goalLimitHours}
                      onChange={(e) => setGoalLimitHours(parseInt(e.target.value) || 1)}
                      required
                      className="search-pill-input"
                      style={{ borderRadius: '12px' }}
                    />
                  </div>

                  <button type="submit" className="button-primary" style={{ justifyContent: 'center' }}>
                    <Plus size={14} />
                    <span>Apply Limit</span>
                  </button>
                </form>
              </div>
            </section>
          </>
        )}

        {activeTab === "settings" && (
          <>
            <section className="viewport-tile light">
              <div>
                <h1 className="hero-display">System Settings</h1>
                <p className="lead-subcopy" style={{ marginTop: '8px' }}>Configure launch habits and database operations.</p>
              </div>

              <div className="store-utility-card" style={{ gap: '28px' }}>
                {/* Autostart toggle - functional */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--colors-divider-soft)', paddingBottom: '20px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Launch on Startup</h4>
                    <p className="lead-subcopy" style={{ fontSize: '12px', marginTop: '2px', color: 'var(--colors-ink-muted-48)' }}>Automatically start Aura in the background when you log in.</p>
                  </div>
                  <div
                    className={`theme-toggle-track ${autostartEnabled ? 'active' : ''}`}
                    onClick={() => toggleAutostart(!autostartEnabled)}
                    style={{ cursor: 'pointer', flexShrink: 0 }}
                  >
                    <div className="theme-toggle-thumb" />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--colors-divider-soft)', paddingBottom: '20px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Idle Monitor Tracking</h4>
                    <p className="lead-subcopy" style={{ fontSize: '12px', marginTop: '2px', color: 'var(--colors-ink-muted-48)' }}>Pause telemetry automatically after 60 seconds of mouse/keyboard inactivity.</p>
                  </div>
                  <input type="checkbox" defaultChecked style={{ width: '16px', height: '16px', accentColor: 'var(--colors-primary)' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--colors-divider-soft)', paddingBottom: '20px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Local-First Privacy</h4>
                    <p className="lead-subcopy" style={{ fontSize: '12px', marginTop: '2px', color: 'var(--colors-ink-muted-48)' }}>All logs remain strictly local. Export or audit your data.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="button-secondary-pill" onClick={() => exportTelemetry("csv")} style={{ padding: '6px 12px', fontSize: '11px' }}>Export CSV</button>
                    <button className="button-secondary-pill" onClick={() => exportTelemetry("json")} style={{ padding: '6px 12px', fontSize: '11px' }}>Export JSON</button>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--colors-ink-muted-48)', textTransform: 'uppercase', marginBottom: '8px' }}>Specification</h4>
                  <p className="lead-subcopy" style={{ fontSize: '12.5px', color: 'var(--colors-ink-muted-80)' }}>
                    Aura Wellbeing • Version 1.0.0 • Native Desktop (Tauri v2 + Rust SQLite Core)
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

      </div>
    </div>
  );
}
