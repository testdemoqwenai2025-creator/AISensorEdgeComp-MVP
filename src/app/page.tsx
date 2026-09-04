"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import {
  Activity, AlertTriangle, Brain, CheckCircle2, Cloud, Cpu, Gauge,
  LogIn, Menu, Moon, Radio, Search, Server, Settings, Sun, X, Zap,
  MapPin, ChevronRight, Sparkles, Wifi, Database, TrendingUp, TrendingDown,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip, Area, AreaChart, BarChart, Bar, Cell, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface SensorReading {
  id: string;
  name: string;
  modality: "vibration" | "temperature" | "pressure" | "gas" | "vision" | "soil";
  value: number;
  unit: string;
  status: "nominal" | "warning" | "critical" | "offline";
  sampleRateHz: number;
  edgeDevice: string;
  location: string;
  trend: "up" | "down" | "stable";
  confidence: number;
  inferredAt: "edge" | "cloud";
}

interface SystemStats {
  edgeDevices: number;
  totalSensors: number;
  nominalCount: number;
  warningCount: number;
  criticalCount: number;
  offlineCount: number;
  inferenceEdge: number;
  inferenceCloud: number;
  avgConfidence: number;
  dataRateKBps: number;
  anomalyDetected: boolean;
}

interface SensorData {
  timestamp: number;
  readings: SensorReading[];
  series: Record<string, { t: number; v: number }[]>;
  systemStats: SystemStats;
}

const STATUS_COLOR: Record<SensorReading["status"], string> = {
  nominal: "text-emerald-500",
  warning: "text-amber-500",
  critical: "text-red-500",
  offline: "text-slate-400",
};

const MODALITY_ICON: Record<SensorReading["modality"], React.ReactNode> = {
  vibration: <Radio className="h-4 w-4" />,
  temperature: <Gauge className="h-4 w-4" />,
  pressure: <Zap className="h-4 w-4" />,
  gas: <Activity className="h-4 w-4" />,
  vision: <Cpu className="h-4 w-4" />,
  soil: <MapPin className="h-4 w-4" />,
};

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [loginOpen, setLoginOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<string>("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<{ q: string; a: string; ts: number; grounded: boolean }[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const [historySeries, setHistorySeries] = useState<{ t: string; vib: number; temp: number; press: number; gas: number }[]>([]);
  const { toast } = useToast();

  useEffect(() => setMounted(true), []);

  // Poll sensor data every 3 seconds
  const fetchSensors = useCallback(async () => {
    try {
      const res = await fetch(`/api/sensors?since=${lastUpdate}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data: SensorData = await res.json();
      setSensorData(data);
      setLastUpdate(data.timestamp);

      // Append to history series (last 30 points)
      const vib = data.readings.find(r => r.id === "vib_a3_l3")?.value ?? 0;
      const temp = data.readings.find(r => r.id === "temp_a3_l3")?.value ?? 0;
      const press = data.readings.find(r => r.id === "press_a3_l3")?.value ?? 0;
      const gas = data.readings.find(r => r.id === "gas_a3_l3")?.value ?? 0;
      const t = new Date(data.timestamp).toLocaleTimeString("en-GB", { hour12: false });
      setHistorySeries(prev => {
        const next = [...prev, { t, vib, temp, press, gas }];
        return next.slice(-30);
      });

      // Toast on anomaly
      if (data.systemStats.anomalyDetected) {
        toast({
          title: "Anomaly detected by TS-FM",
          description: "Compressor A · Bearing 1 · Line 3 vibration elevated — edge inference flagged in real-time.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      console.error("Sensor fetch failed:", e?.message);
    } finally {
      setLoading(false);
    }
  }, [lastUpdate, toast]);

  useEffect(() => {
    fetchSensors();
    const interval = setInterval(fetchSensors, 3000);
    return () => clearInterval(interval);
  }, [fetchSensors]);

  const handleSearch = useCallback(async (q?: string) => {
    const query = (q ?? searchQuery).trim();
    if (!query) return;
    setSearchQuery(query);
    setSearchLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResult(data.answer);
      setSearchHistory(prev => [{ q: query, a: data.answer, ts: Date.now(), grounded: data.grounded }, ...prev].slice(0, 8));
    } catch (e: any) {
      setSearchResult("Search failed. Please try again, or email partners@aisensoredgecomp.ai.");
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  const handleLogin = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      setLoginOpen(false);
      toast({
        title: "Signed in (demo mode)",
        description: `Welcome, ${data.user.name}. Design-partner dashboard access — for full MVP features, contact design@aisensoredgecomp.ai.`,
      });
    } catch (e: any) {
      toast({ title: "Login failed", description: e?.message, variant: "destructive" });
    }
  }, [toast]);

  if (!mounted) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <NavBar
        theme={theme ?? "dark"}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        onLoginClick={() => setLoginOpen(true)}
        onSearchClick={() => document.getElementById("search-section")?.scrollIntoView({ behavior: "smooth" })}
        navOpen={navOpen}
        setNavOpen={setNavOpen}
      />

      <main className="flex-1 pt-16">
        <HeroSection onGetStarted={() => document.getElementById("search-section")?.scrollIntoView({ behavior: "smooth" })}
                     onSearch={() => document.getElementById("search-section")?.scrollIntoView({ behavior: "smooth" })}
                     onLogin={() => setLoginOpen(true)} />

        <LiveStatsSection stats={sensorData?.systemStats} lastUpdate={lastUpdate} loading={loading} />

        <SensorMeshSection data={sensorData} loading={loading} />

        <EdgeAISection data={sensorData} />

        <TimeSeriesChart history={historySeries} />

        <SearchWithAISection
          query={searchQuery}
          setQuery={setSearchQuery}
          result={searchResult}
          loading={searchLoading}
          onSearch={() => handleSearch()}
          history={searchHistory}
          onPickSuggestion={(q) => { setSearchQuery(q); handleSearch(q); }}
        />

        <ArchitectureStrip />

        <Footer />
      </main>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} onSubmit={handleLogin} />
    </div>
  );
}

// =====================================================================
// NAVBAR
// =====================================================================
function NavBar({
  theme, onToggleTheme, onLoginClick, onSearchClick, navOpen, setNavOpen,
}: {
  theme: string;
  onToggleTheme: () => void;
  onLoginClick: () => void;
  onSearchClick: () => void;
  navOpen: boolean;
  setNavOpen: (v: boolean) => void;
}) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-cyan-400 to-violet-500 relative shadow-lg shadow-cyan-500/30">
            <div className="absolute inset-1.5 rounded-sm bg-background" />
            <div className="absolute inset-2.5 rounded-sm bg-gradient-to-br from-cyan-400 to-violet-500" />
          </div>
          <span className="font-semibold text-sm tracking-tight">AISensorEdgeComp</span>
          <Badge variant="outline" className="ml-2 hidden sm:inline-flex text-[10px] font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 live-pulse" /> Live MVP
          </Badge>
        </div>

        <div className="hidden md:flex items-center gap-1">
          <a href="#sensors" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Sensors</a>
          <a href="#edge-ai" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Edge AI</a>
          <a href="#charts" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Charts</a>
          <a href="#search" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Search</a>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onToggleTheme} className="h-9 w-9 p-0" aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="outline" onClick={onSearchClick} className="hidden sm:inline-flex">
            <Search className="h-4 w-4 mr-1.5" /> Search
          </Button>
          <Button size="sm" variant="outline" onClick={onLoginClick}>
            <LogIn className="h-4 w-4 mr-1.5" /> <span className="hidden sm:inline">Login</span>
          </Button>
          <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:opacity-90">
            Get Started
          </Button>
          <Button size="sm" variant="ghost" className="md:hidden h-9 w-9 p-0" onClick={() => setNavOpen(!navOpen)}>
            {navOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {navOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="px-4 py-3 flex flex-col gap-1">
            <a href="#sensors" onClick={() => setNavOpen(false)} className="px-3 py-2 text-sm hover:bg-muted rounded">Sensors</a>
            <a href="#edge-ai" onClick={() => setNavOpen(false)} className="px-3 py-2 text-sm hover:bg-muted rounded">Edge AI</a>
            <a href="#charts" onClick={() => setNavOpen(false)} className="px-3 py-2 text-sm hover:bg-muted rounded">Charts</a>
            <a href="#search" onClick={() => setNavOpen(false)} className="px-3 py-2 text-sm hover:bg-muted rounded">Search</a>
          </div>
        </div>
      )}
    </header>
  );
}

// =====================================================================
// HERO
// =====================================================================
function HeroSection({ onGetStarted, onSearch, onLogin }: {
  onGetStarted: () => void; onSearch: () => void; onLogin: () => void;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 grid-bg opacity-30" style={{ maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)", WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)" }} />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-violet-500/15 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
        <Badge variant="outline" className="mb-6 font-mono text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 mr-2 live-pulse" /> Series A cycle · Q4 2026 · Live MVP
        </Badge>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-br from-foreground via-foreground to-cyan-500 bg-clip-text text-transparent">
          The planetary sensor fabric,<br />
          <span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent italic">intelligenced.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Multi-modal IoT sensors + edge AI silicon + time-series foundation models, fused into one queryable
          planetary-scale intelligence fabric. This is the live MVP — explore the sensor mesh, edge inference,
          and natural-language query layer in real time.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={onGetStarted} className="bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:opacity-90 h-11 px-6">
            Get Started <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <Button onClick={onSearch} variant="outline" className="h-11">
            <Search className="h-4 w-4 mr-2" /> Search with AI
          </Button>
          <Button onClick={onLogin} variant="ghost" className="h-11">
            <LogIn className="h-4 w-4 mr-2" /> Sign in
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto">
          {[
            { num: "50B+", label: "Sensors by 2030" },
            { num: "$547B", label: "IoT Market TAM" },
            { num: "0.89", label: "Zero-shot AUC-ROC" },
            { num: "−63%", label: "Inference cost (liquid)" },
          ].map(s => (
            <div key={s.label} className="text-left border-t border-border pt-4">
              <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-foreground to-cyan-500 bg-clip-text text-transparent">{s.num}</div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// LIVE STATS BAR
// =====================================================================
function LiveStatsSection({ stats, lastUpdate, loading }: {
  stats?: SystemStats; lastUpdate: number; loading: boolean;
}) {
  if (loading || !stats) {
    return (
      <section className="border-b border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" /> Connecting to live sensor mesh…
        </div>
      </section>
    );
  }
  const stats_ = [
    { icon: <Cpu className="h-4 w-4" />, label: "Edge devices", value: stats.edgeDevices, color: "text-cyan-500" },
    { icon: <Radio className="h-4 w-4" />, label: "Sensors streaming", value: stats.totalSensors, color: "text-cyan-500" },
    { icon: <CheckCircle2 className="h-4 w-4" />, label: "Nominal", value: stats.nominalCount, color: "text-emerald-500" },
    { icon: <AlertTriangle className="h-4 w-4" />, label: "Warning", value: stats.warningCount, color: "text-amber-500" },
    { icon: <AlertTriangle className="h-4 w-4" />, label: "Critical", value: stats.criticalCount, color: "text-red-500" },
    { icon: <Server className="h-4 w-4" />, label: "Edge inferences", value: stats.inferenceEdge, color: "text-cyan-500" },
    { icon: <Cloud className="h-4 w-4" />, label: "Cloud inferences", value: stats.inferenceCloud, color: "text-violet-500" },
    { icon: <Database className="h-4 w-4" />, label: "Data rate", value: `${stats.dataRateKBps} KB/s`, color: "text-cyan-500" },
  ];
  return (
    <section className="border-b border-border bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="h-2 w-2 rounded-full bg-emerald-500 live-pulse" />
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Live · updated {new Date(lastUpdate).toLocaleTimeString("en-GB", { hour12: false })}
          </span>
          {stats.anomalyDetected && (
            <Badge variant="destructive" className="ml-2 text-[10px] font-mono">
              <AlertTriangle className="h-3 w-3 mr-1" /> TS-FM anomaly
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {stats_.map(s => (
            <Card key={s.label} className="bg-card/60 border-border/60">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <span className={s.color}>{s.icon}</span>
                  <span className="text-[10px] font-mono uppercase tracking-wider">{s.label}</span>
                </div>
                <div className="text-xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// SENSOR MESH
// =====================================================================
function SensorMeshSection({ data, loading }: { data: SensorData | null; loading: boolean }) {
  return (
    <section id="sensors" className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <SectionHeader num="01" label="Sensing Layer" title="Live sensor mesh" subtitle="Multi-modal sensor data, normalized to a canonical schema, streaming in real time. Every reading carries TS-FM confidence and inference location (edge or cloud)." />

      {loading || !data ? (
        <div className="text-center text-muted-foreground py-12">Streaming sensor data…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.readings.map(r => <SensorCard key={r.id} reading={r} />)}
        </div>
      )}
    </section>
  );
}

function SensorCard({ reading }: { reading: SensorReading }) {
  const statusColor = STATUS_COLOR[reading.status];
  return (
    <Card className="bg-card hover:border-cyan-500/40 transition-colors group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-gradient-to-br from-cyan-500/15 to-violet-500/15 border border-border flex items-center justify-center text-cyan-500">
              {MODALITY_ICON[reading.modality]}
            </div>
            <div>
              <CardTitle className="text-sm leading-tight">{reading.name}</CardTitle>
              <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{reading.id} · {reading.sampleRateHz} Hz</div>
            </div>
          </div>
          <span className={`text-xs font-mono uppercase tracking-wider ${statusColor}`}>{reading.status}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{reading.value}</span>
          <span className="text-sm text-muted-foreground">{reading.unit}</span>
          <span className="ml-auto">
            {reading.trend === "up" && <TrendingUp className="h-4 w-4 text-amber-500" />}
            {reading.trend === "down" && <TrendingDown className="h-4 w-4 text-amber-500" />}
            {reading.trend === "stable" && <div className="h-4 w-4" />}
          </span>
        </div>
        <Separator className="my-3" />
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3 w-3" /> {reading.edgeDevice}
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3" /> {reading.location}
          </div>
          <div className="flex items-center gap-1.5">
            <Brain className="h-3 w-3" /> TS-FM conf: {(reading.confidence * 100).toFixed(0)}%
          </div>
          <div className="flex items-center gap-1.5">
            {reading.inferredAt === "edge"
              ? <><Server className="h-3 w-3 text-cyan-500" /> inferred @ edge</>
              : <><Cloud className="h-3 w-3 text-violet-500" /> inferred @ cloud</>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================================
// EDGE AI PANEL
// =====================================================================
function EdgeAISection({ data }: { data: SensorData | null }) {
  if (!data) return null;
  const stats = data.systemStats;
  const total = stats.inferenceEdge + stats.inferenceCloud;
  const edgePct = total ? (stats.inferenceEdge / total) * 100 : 0;
  const cloudPct = 100 - edgePct;

  return (
    <section id="edge-ai" className="bg-muted/30 border-y border-border py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeader num="02" label="Edge Compute Layer" title="Liquid workload placement" subtitle="The scheduler runs every 30s, scoring each inference job across latency, bandwidth, accuracy drift, battery state, and carbon intensity — then routes optimally." />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Server className="h-4 w-4 text-cyan-500" /> Edge inferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tabular-nums mb-2">{stats.inferenceEdge}</div>
              <Progress value={edgePct} className="h-2 mb-2" />
              <div className="text-xs text-muted-foreground font-mono">{edgePct.toFixed(0)}% of total · Hailo-8 + Jetson Orin</div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Cloud className="h-4 w-4 text-violet-500" /> Cloud inferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tabular-nums mb-2">{stats.inferenceCloud}</div>
              <Progress value={cloudPct} className="h-2 mb-2" />
              <div className="text-xs text-muted-foreground font-mono">{cloudPct.toFixed(0)}% of total · secure enclave</div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Brain className="h-4 w-4 text-cyan-500" /> TS-FM avg confidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tabular-nums mb-2">{(stats.avgConfidence * 100).toFixed(0)}%</div>
              <Progress value={stats.avgConfidence * 100} className="h-2 mb-2" />
              <div className="text-xs text-muted-foreground font-mono">350M-param TS-FM · 0.89 AUC-ROC zero-shot</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4 bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-500" /> Liquid placement decisions (last cycle)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.readings.slice(0, 6).map(r => (
                <div key={r.id} className="flex items-center gap-3 text-xs font-mono py-2 border-b border-border/40 last:border-0">
                  <div className="w-32 truncate text-muted-foreground">{r.id}</div>
                  <div className="flex-1 truncate">{r.name}</div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Wifi className="h-3 w-3" /> {r.sampleRateHz} Hz
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Brain className="h-3 w-3" /> {(r.confidence * 100).toFixed(0)}%
                  </div>
                  <div className={`flex items-center gap-1.5 font-semibold ${r.inferredAt === "edge" ? "text-cyan-500" : "text-violet-500"}`}>
                    {r.inferredAt === "edge" ? <Server className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
                    {r.inferredAt}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Scheduler reduces inference cost by 63% vs. hardcoded cloud-only placement and lowers p99 latency by 4×.
              Real-time decisions are persisted for audit.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// =====================================================================
// TIME SERIES CHART
// =====================================================================
function TimeSeriesChart({ history }: { history: { t: string; vib: number; temp: number; press: number; gas: number }[] }) {
  return (
    <section id="charts" className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <SectionHeader num="03" label="Time-Series Foundation Model" title="Live sensor stream" subtitle="Streaming sensor values, ingested at the edge, scored by the 350M-parameter TS-FM. Anomalies flagged in real time when confidence exceeds 0.85." />

      <Card className="bg-card">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-500" /> 4-modal sensor stream
            </CardTitle>
            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
              <Legend2 color="#06b6d4" label="vibration" />
              <Legend2 color="#a855f7" label="temperature" />
              <Legend2 color="#22c55e" label="pressure" />
              <Legend2 color="#f59e0b" label="gas" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))", fontFamily: "monospace" }}
                />
                <Line type="monotone" dataKey="vib" stroke="#06b6d4" strokeWidth={2} dot={false} name="vibration" isAnimationActive={false} />
                <Line type="monotone" dataKey="temp" stroke="#a855f7" strokeWidth={2} dot={false} name="temperature" isAnimationActive={false} />
                <Line type="monotone" dataKey="press" stroke="#22c55e" strokeWidth={2} dot={false} name="pressure" isAnimationActive={false} />
                <Line type="monotone" dataKey="gas" stroke="#f59e0b" strokeWidth={2} dot={false} name="gas" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-3 font-mono">
            Polling /api/sensors every 3s · window: last 30 samples · TS-FM v1 (350M params, 50M hours pretrain)
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function Legend2({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> {label}
    </span>
  );
}

// =====================================================================
// SEARCH WITH AI
// =====================================================================
function SearchWithAISection({
  query, setQuery, result, loading, onSearch, history, onPickSuggestion,
}: {
  query: string; setQuery: (v: string) => void; result: string;
  loading: boolean; onSearch: () => void; history: { q: string; a: string; ts: number; grounded: boolean }[];
  onPickSuggestion: (q: string) => void;
}) {
  const suggestions = [
    "What is your TAM and how is it calculated?",
    "How does zero-shot anomaly detection work without labels?",
    "Which verticals are you going after first and why?",
    "What is the Series A use of funds?",
    "How does the edge-cloud liquid placement scheduler work?",
    "Who are the founders and what's their background?",
    "What is your moat vs AWS IoT or Azure IoT?",
  ];
  return (
    <section id="search" className="bg-muted/30 border-y border-border py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeader num="04" label="Intelligence Layer" title="Search with AI" subtitle="Natural-language query grounded in our architecture, verticals, team, and roadmap. Powered by z-ai-web-dev-sdk on the server side, with retrieval-augmented reasoning over sensor streams and ERP records." />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Search box */}
          <div>
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4 text-cyan-500" /> Ask the platform
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. How does the edge-cloud workload placement work?"
                    onKeyDown={(e) => { if (e.key === "Enter") onSearch(); }}
                    className="font-mono text-sm"
                  />
                  <Button onClick={onSearch} disabled={loading || !query.trim()} className="bg-gradient-to-r from-cyan-500 to-violet-500 text-white">
                    {loading ? <><Sparkles className="h-4 w-4 mr-1 animate-pulse" /> Thinking</> : <><Search className="h-4 w-4 mr-1" /> Ask</>}
                  </Button>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Try:</div>
                  <div className="flex flex-col gap-1.5">
                    {suggestions.map(s => (
                      <button
                        key={s}
                        onClick={() => onPickSuggestion(s)}
                        className="text-left text-xs px-3 py-2 rounded-md border border-border/60 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-colors"
                      >
                        <Sparkles className="h-3 w-3 inline mr-2 text-cyan-500" />{s}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {history.length > 0 && (
              <Card className="mt-4 bg-card">
                <CardHeader>
                  <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                    Recent queries
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-64 pr-3">
                    <div className="space-y-3">
                      {history.map((h, i) => (
                        <div key={i} className="border-l-2 border-cyan-500/40 pl-3">
                          <div className="text-xs font-mono text-cyan-500 mb-1">{h.q}</div>
                          <div className="text-xs text-muted-foreground">{h.a.slice(0, 220)}{h.a.length > 220 ? "…" : ""}</div>
                          <div className="text-[10px] font-mono text-muted-foreground mt-1">
                            {new Date(h.ts).toLocaleTimeString()} · {h.grounded ? "LLM-grounded" : "fallback"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Answer */}
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-violet-500" /> AI response
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-full bg-muted rounded animate-pulse" />
                  <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                  <div className="text-xs text-muted-foreground mt-4 font-mono">Grounding in architecture docs + sensor streams…</div>
                </div>
              ) : result ? (
                <div>
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-foreground/90 leading-relaxed">
                    {result}
                  </div>
                  <Separator className="my-4" />
                  <div className="text-[10px] font-mono text-muted-foreground">
                    Generated via z-ai-web-dev-sdk · system prompt grounded in AISensorEdgeComp architecture, verticals, team, roadmap.
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-12 text-center">
                  Ask a question to see the AI's grounded response.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// ARCHITECTURE STRIP
// =====================================================================
function ArchitectureStrip() {
  const layers = [
    { num: "04", name: "Intelligence", tech: ["TS-FM", "Graph RAG", "Causal", "PINN"], icon: <Brain className="h-5 w-5" /> },
    { num: "03", name: "Edge Compute", tech: ["KubeEdge", "TinyML", "WASM", "Federated"], icon: <Server className="h-5 w-5" /> },
    { num: "02", name: "Connectivity", tech: ["LoRaWAN", "5G mMTC", "OPC-UA", "MQTT"], icon: <Wifi className="h-5 w-5" /> },
    { num: "01", name: "Sensing", tech: ["MEMS", "mmWave", "Hyperspectral", "EO Fusion"], icon: <Radio className="h-5 w-5" /> },
  ];
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <SectionHeader num="05" label="The Stack" title="Four layers. One substrate." subtitle="Vertically-integrated platform — any sensor, any protocol, any vertical plugs in. Full architecture details in the technical deep dive (linked below)." />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {layers.map(l => (
          <Card key={l.num} className="bg-card hover:border-cyan-500/40 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl font-mono font-medium bg-gradient-to-br from-cyan-400 to-violet-500 bg-clip-text text-transparent">{l.num}</span>
                <span className="text-cyan-500">{l.icon}</span>
              </div>
              <div className="font-semibold mb-3">{l.name}</div>
              <div className="flex flex-wrap gap-1.5">
                {l.tech.map(t => (
                  <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-500 border border-violet-500/20">{t}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="text-center mt-8">
        <a href="https://testdemoqwenai2025-creator.github.io/DemoSentinelEdge/architecture-deep.html" target="_blank" rel="noopener noreferrer">
          <Button variant="outline">
            Read the technical deep dive <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </a>
      </div>
    </section>
  );
}

// =====================================================================
// FOOTER
// =====================================================================
function Footer() {
  return (
    <footer className="border-t border-border bg-background mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Investor Relations</div>
            <a href="mailto:partners@aisensoredgecomp.ai" className="text-sm hover:text-cyan-500 transition-colors">partners@aisensoredgecomp.ai</a>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Design Partners</div>
            <a href="mailto:design@aisensoredgecomp.ai" className="text-sm hover:text-cyan-500 transition-colors">design@aisensoredgecomp.ai</a>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Press</div>
            <a href="mailto:press@aisensoredgecomp.ai" className="text-sm hover:text-cyan-500 transition-colors">press@aisensoredgecomp.ai</a>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Public Preview</div>
            <a href="https://testdemoqwenai2025-creator.github.io/DemoSentinelEdge/" target="_blank" rel="noopener noreferrer" className="text-sm hover:text-cyan-500 transition-colors">DemoSentinelEdge ↗</a>
          </div>
        </div>
        <Separator className="mb-6" />
        <div className="text-xs font-mono text-muted-foreground text-center">
          © 2026 AISensorEdgeComp · MVP dashboard v0.4 · For demo only
        </div>
      </div>
    </footer>
  );
}

// =====================================================================
// LOGIN DIALOG
// =====================================================================
function LoginDialog({ open, onOpenChange, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onSubmit: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-4 w-4 text-cyan-500" /> Sign in to AISensorEdgeComp
          </DialogTitle>
          <DialogDescription>
            Access the live MVP dashboard, sensor streams, and AI query console. Design partners get free seats.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="email" className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Work Email</Label>
            <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="password" className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5" />
          </div>
          <p className="text-xs text-muted-foreground">
            Demo mode — any email + 6+ char password will sign you in. Real auth (NextAuth.js + Prisma) ships at GA.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => onSubmit(email, password)}
            disabled={!email || password.length < 6}
            className="bg-gradient-to-r from-cyan-500 to-violet-500 text-white"
          >
            Sign In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================================
// SHARED: SECTION HEADER
// =====================================================================
function SectionHeader({ num, label, title, subtitle }: {
  num: string; label: string; title: string; subtitle: string;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-px w-6 bg-cyan-500" />
        <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-500">{num} · {label}</span>
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">{title}</h2>
      <p className="text-muted-foreground max-w-2xl">{subtitle}</p>
    </div>
  );
}
