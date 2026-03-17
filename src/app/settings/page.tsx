"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Mail01Icon, Calendar03Icon, FileAttachmentIcon, CheckmarkCircle02Icon, CircleIcon,
  RefreshIcon, Unlink01Icon, LinkSquare02Icon, AlertDiamondIcon, InformationCircleIcon,
  UserIcon, FloppyDiskIcon, Loading03Icon, Logout01Icon,
} from "hugeicons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConnectorStatus {
  connected: boolean;
  email?: string;
  lastSyncAt?: string | null;
  syncStatus?: string | null;
  connectedAt?: string | null;
}

interface ConnectorsPayload {
  connectors: { google?: ConnectorStatus };
}

interface UserProfileData {
  id?: number;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  linkedin?: string | null;
  portfolioWeb?: string | null;
  instagram?: string | null;
  xHandle?: string | null;
  facebook?: string | null;
  updatedAt?: string | null;
}

// ── Field component ───────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm tracking-wider uppercase opacity-40">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

// ── Profile section ───────────────────────────────────────────────────────────

function ProfileSection() {
  const [profile, setProfile] = useState<UserProfileData>({});
  const [form, setForm] = useState<UserProfileData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/user/profile");
        const data = await res.json() as { profile: UserProfileData | null };
        const p = data.profile ?? {};
        setProfile(p);
        setForm(p);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function set(field: keyof UserProfileData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function isDirty() {
    return (Object.keys(form) as (keyof UserProfileData)[]).some(
      (k) => (form[k] ?? "") !== (profile[k] ?? "")
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { profile: UserProfileData };
      setProfile(data.profile);
      setForm(data.profile);
      setSaved(true);
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loading03Icon className="h-4 w-4 animate-spin" style={{ color: "hsl(215 12% 35%)" }} />
      </div>
    );
  }

  const v = (k: keyof UserProfileData) => String(form[k] ?? "");

  return (
    <div className="space-y-5">
      {/* Identity */}
      <div
        className="rounded-sm p-5 space-y-4"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <UserIcon className="h-3.5 w-3.5" style={{ color: "var(--amber)" }} />
          <span className="text-sm tracking-widest uppercase opacity-40">Identity</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Full name"    value={v("displayName")} onChange={(v) => set("displayName", v)} placeholder="Meet Patel" />
          <Field label="Email"        value={v("email")}       onChange={(v) => set("email", v)}       placeholder="meet@example.com" type="email" />
          <Field label="Phone"        value={v("phone")}       onChange={(v) => set("phone", v)}       placeholder="+1 555 000 0000" type="tel" />
        </div>
        <Field label="Address"        value={v("address")}     onChange={(v) => set("address", v)}     placeholder="City, Country" />
      </div>

      {/* Social / Professional */}
      <div
        className="rounded-sm p-5 space-y-4"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
      >
        <span className="text-sm tracking-widest uppercase opacity-40">Social &amp; professional</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="LinkedIn URL"    value={v("linkedin")}     onChange={(v) => set("linkedin", v)}     placeholder="https://linkedin.com/in/..." />
          <Field label="Portfolio / Web" value={v("portfolioWeb")} onChange={(v) => set("portfolioWeb", v)} placeholder="https://yoursite.com" />
          <Field label="Instagram"       value={v("instagram")}    onChange={(v) => set("instagram", v)}    placeholder="@handle" />
          <Field label="X (Twitter)"     value={v("xHandle")}      onChange={(v) => set("xHandle", v)}      placeholder="@handle" />
          <Field label="Facebook"        value={v("facebook")}     onChange={(v) => set("facebook", v)}     placeholder="https://facebook.com/..." />
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        {profile.updatedAt && (
          <span className="text-sm opacity-25">
            Last saved {new Date(profile.updatedAt).toLocaleDateString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <div className="flex items-center gap-3 ml-auto">
          {saved && (
            <span className="text-sm" style={{ color: "#4ade80" }}>
              ✓ saved
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || !isDirty()}
            className="transition-all disabled:opacity-30"
            style={{
              background: "var(--amber-dim)",
              border: "1px solid rgba(240,160,21,0.25)",
              color: "var(--amber)",
            }}
          >
            {saving ? <Loading03Icon className="h-3 w-3 animate-spin" /> : <FloppyDiskIcon className="h-3 w-3" />}
            {saving ? "saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Connector card ────────────────────────────────────────────────────────────

interface ConnectorCardProps {
  name: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  status: ConnectorStatus | null;
  connectHref?: string;
  onDisconnect?: () => void;
  comingSoon?: boolean;
}

function ConnectorCard({
  name, description, icon, accentColor, status,
  connectHref, onDisconnect, comingSoon,
}: ConnectorCardProps) {
  const connected = status?.connected ?? false;
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    if (!onDisconnect) return;
    setDisconnecting(true);
    try { await onDisconnect(); } finally { setDisconnecting(false); }
  }

  return (
    <div
      className="rounded-sm p-5 flex flex-col gap-4 relative overflow-hidden"
      style={{
        background: "var(--surface-raised)",
        border: `1px solid ${connected ? accentColor + "33" : "var(--line)"}`,
      }}
    >
      {connected && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accentColor}08, transparent)` }}
        />
      )}

      <div className="flex items-start justify-between gap-3 relative">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-sm flex items-center justify-center shrink-0"
            style={{
              background: connected ? accentColor + "18" : "rgba(255,255,255,0.03)",
              border: `1px solid ${connected ? accentColor + "33" : "var(--line)"}`,
            }}
          >
            <span style={{ color: connected ? accentColor : "hsl(215 12% 40%)" }}>{icon}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: "hsl(210 18% 85%)" }}>{name}</span>
              {comingSoon && (
                <span className="text-sm px-1.5 py-0.5 rounded-sm" style={{ background: "rgba(255,255,255,0.04)", color: "hsl(215 12% 40%)" }}>
                  soon
                </span>
              )}
            </div>
            <p className="text-sm mt-0.5" style={{ color: "hsl(215 12% 40%)" }}>{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {connected ? (
            <>
              <CheckmarkCircle02Icon className="h-3.5 w-3.5" style={{ color: "#4ade80" }} />
              <span className="text-sm" style={{ color: "#4ade80" }}>connected</span>
            </>
          ) : (
            <>
              <CircleIcon className="h-3 w-3 opacity-20" />
              <span className="text-sm opacity-30">not connected</span>
            </>
          )}
        </div>
      </div>

      {connected && (
        <div className="rounded-sm px-3 py-2 space-y-1 relative" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--line)" }}>
          {status?.email && (
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-40">account</span>
              <span className="text-sm" style={{ color: "hsl(210 18% 70%)" }}>{status.email}</span>
            </div>
          )}
          {status?.connectedAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-40">connected</span>
              <span className="text-sm" style={{ color: "hsl(210 18% 70%)" }}>
                {new Date(status.connectedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          )}
          {status?.lastSyncAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-40">last sync</span>
              <span className="text-sm" style={{ color: "hsl(210 18% 70%)" }}>
                {new Date(status.lastSyncAt).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 relative">
        {comingSoon ? (
          <span className="text-sm opacity-20">coming soon</span>
        ) : connected ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleDisconnect()}
            disabled={disconnecting}
            className="transition-all disabled:opacity-40"
            style={{ border: "1px solid rgba(248,113,113,0.2)", color: "rgba(248,113,113,0.7)", background: "rgba(248,113,113,0.04)" }}
          >
            <Unlink01Icon className="h-3 w-3" />
            {disconnecting ? "disconnecting..." : "disconnect"}
          </Button>
        ) : (
          <a
            href={connectHref}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-sm transition-all"
            style={{ border: `1px solid ${accentColor}33`, color: accentColor, background: accentColor + "0d" }}
          >
            <LinkSquare02Icon className="h-3 w-3" />
            connect
          </a>
        )}
      </div>
    </div>
  );
}

// ── Setup guide ───────────────────────────────────────────────────────────────

function SetupGuide({ show }: { show: boolean }) {
  const [open, setOpen] = useState(show);
  if (!open) return null;
  return (
    <div className="rounded-sm p-4 space-y-3" style={{ background: "rgba(240,160,21,0.05)", border: "1px solid rgba(240,160,21,0.15)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <InformationCircleIcon className="h-3.5 w-3.5" style={{ color: "var(--amber)" }} />
          <span className="text-sm" style={{ color: "var(--amber)" }}>Google OAuth setup required</span>
        </div>
        <Button variant="ghost" size="xs" onClick={() => setOpen(false)} className="opacity-30 hover:opacity-60">dismiss</Button>
      </div>
      <ol className="space-y-1.5 text-sm" style={{ color: "hsl(210 18% 60%)" }}>
        <li><span className="opacity-40 mr-2">1.</span>Go to <span style={{ color: "var(--amber)" }}>console.cloud.google.com</span> → New project → Enable Gmail API + Calendar API</li>
        <li><span className="opacity-40 mr-2">2.</span>Create OAuth 2.0 credentials → Web Application → add redirect URI:</li>
        <li className="ml-4 px-2 py-1 rounded-sm" style={{ background: "rgba(0,0,0,0.3)", color: "hsl(210 18% 75%)" }}>http://localhost:3000/api/connectors/google/callback</li>
        <li><span className="opacity-40 mr-2">3.</span>Add to <span style={{ color: "var(--amber)" }}>.env.local</span>:
          <div className="mt-1 ml-4 px-2 py-1 rounded-sm space-y-0.5" style={{ background: "rgba(0,0,0,0.3)", color: "hsl(210 18% 75%)" }}>
            <div>GOOGLE_CLIENT_ID=your_client_id</div>
            <div>GOOGLE_CLIENT_SECRET=your_client_secret</div>
          </div>
        </li>
        <li><span className="opacity-40 mr-2">4.</span>Restart the dev server, then click <span style={{ color: "#4ade80" }}>connect</span> above</li>
      </ol>
    </div>
  );
}

// ── Connections section ───────────────────────────────────────────────────────

function ConnectionsSection({
  google,
  loading,
  onRefresh,
  onDisconnect,
  onBanner,
}: {
  google: ConnectorStatus | null;
  loading: boolean;
  onRefresh: () => void;
  onDisconnect: (provider: string) => Promise<void>;
  onBanner: (b: { type: "success" | "error"; message: string }) => void;
}) {
  const showSetupGuide = !google?.connected && !loading;

  async function handleGoogleLogout() {
    await onDisconnect("google");
    onBanner({ type: "success", message: "Google account disconnected — tokens removed from database" });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm tracking-widest uppercase" style={{ color: "hsl(215 12% 35%)" }}>
          External services
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={onRefresh}
          className="opacity-30 hover:opacity-60 transition-opacity"
        >
          <RefreshIcon className="h-3 w-3" />
          refresh
        </Button>
      </div>

      <SetupGuide show={showSetupGuide} />

      <div className="grid grid-cols-1 gap-3">
        <ConnectorCard
          name="Google (Gmail + Calendar)"
          description="Read emails, search inbox, access calendar events"
          icon={<Mail01Icon className="h-5 w-5" />}
          accentColor="#4285F4"
          status={google}
          connectHref="/api/connectors/google/auth"
          onDisconnect={handleGoogleLogout}
        />
        <ConnectorCard
          name="Notion"
          description="Search pages, create tasks, read databases"
          icon={<FileAttachmentIcon className="h-5 w-5" />}
          accentColor="#ffffff"
          status={null}
          connectHref="/settings"
          comingSoon
        />
        <ConnectorCard
          name="Google Calendar"
          description="View and create events (included with Google)"
          icon={<Calendar03Icon className="h-5 w-5" />}
          accentColor="#0F9D58"
          status={google ? { connected: google.connected } : null}
          connectHref="/api/connectors/google/auth"
          comingSoon={!google?.connected}
        />
      </div>

      {/* Logout card — only shown when Google is connected */}
      {google?.connected && (
        <div
          className="rounded-sm p-4 flex items-center justify-between"
          style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.15)" }}
        >
          <div>
            <p className="text-sm" style={{ color: "rgba(248,113,113,0.8)" }}>
              Logout from Google
            </p>
            <p className="text-sm opacity-50 mt-0.5">
              Revokes access &amp; removes all tokens from the database
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleGoogleLogout()}
            className="transition-all"
            style={{
              border: "1px solid rgba(248,113,113,0.3)",
              color: "rgba(248,113,113,0.9)",
              background: "rgba(248,113,113,0.06)",
            }}
          >
            <Logout01Icon className="h-3.5 w-3.5" />
            logout
          </Button>
        </div>
      )}

      <div className="rounded-sm p-4" style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}>
        <p className="text-sm tracking-widest uppercase opacity-30 mb-3">What LocalMind does with access</p>
        <ul className="space-y-2 text-sm" style={{ color: "hsl(210 18% 55%)" }}>
          {[
            "Periodically embeds new emails/events into memory for semantic search",
            "Extracts entities (people, projects, deadlines) and builds the knowledge graph",
            "Lets the AI reference your inbox & calendar when you ask about them in chat",
            "All data stays in your local Neon DB — nothing sent to third parties",
            "Refresh tokens are stored encrypted in your database for persistent auth",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span style={{ color: "var(--amber)" }}>→</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function SettingsContent() {
  const searchParams = useSearchParams();
  const [connData, setConnData] = useState<ConnectorsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/connectors/status");
      setConnData(await res.json() as ConnectorsPayload);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "google") {
      setBanner({ type: "success", message: "Google account connected — refresh token saved to database" });
      window.history.replaceState({}, "", "/settings");
    } else if (error) {
      const messages: Record<string, string> = {
        access_denied:          "Access was denied. Please try again and grant the requested permissions.",
        token_exchange_failed:  "Failed to exchange OAuth code. Check your GOOGLE_CLIENT_SECRET.",
        missing_code:           "No authorization code received from Google.",
      };
      setBanner({ type: "error", message: messages[error] ?? `OAuth error: ${error}` });
      window.history.replaceState({}, "", "/settings");
    }
  }, [load, searchParams]);

  async function handleDisconnect(provider: string) {
    await fetch(`/api/connectors/status?provider=${provider}`, { method: "DELETE" });
    await load();
  }

  const google = connData?.connectors?.google ?? null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-0 shrink-0">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="font-display italic text-2xl leading-none text-brand">
              Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">profile · connectors · about</p>
          </div>
          {loading && <span className="text-sm text-muted-foreground mb-1 animate-pulse">loading...</span>}
        </div>
      </div>

      <Tabs defaultValue="profile" className="flex flex-col flex-1 overflow-hidden gap-0">
        <div className="px-6 shrink-0">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Banner */}
          {banner && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-sm mb-5"
              style={{
                background: banner.type === "success" ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
                border: `1px solid ${banner.type === "success" ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
              }}
            >
              {banner.type === "success"
                ? <CheckmarkCircle02Icon className="h-3.5 w-3.5 shrink-0" style={{ color: "#4ade80" }} />
                : <AlertDiamondIcon className="h-3.5 w-3.5 shrink-0" style={{ color: "#f87171" }} />
              }
              <span className="text-sm flex-1" style={{ color: banner.type === "success" ? "#4ade80" : "#f87171" }}>
                {banner.message}
              </span>
              <Button variant="ghost" size="icon-xs" onClick={() => setBanner(null)} className="opacity-30 hover:opacity-60 shrink-0">×</Button>
            </div>
          )}

          <TabsContent value="profile">
            <ProfileSection />
          </TabsContent>

          <TabsContent value="connections">
            <ConnectionsSection
              google={google}
              loading={loading}
              onRefresh={() => void load()}
              onDisconnect={handleDisconnect}
              onBanner={setBanner}
            />
          </TabsContent>

          <TabsContent value="about">
            <div className="space-y-4">
              <div className="rounded-sm p-5 space-y-4" style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm flex items-center justify-center shrink-0 bg-brand/10 border border-brand/20">
                    <span className="text-brand text-lg font-mono">◈</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground">LocalMind</p>
                    <p className="text-sm text-muted-foreground">v0.1.0 · localhost</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {[
                    ["Model",          "qwen3:8b (Ollama)"],
                    ["Embeddings",     "nomic-embed-text (768 dims)"],
                    ["Database",       "Neon Postgres + pgvector"],
                    ["Memory layers",  "L1 episodic · L2 semantic · L3 graph · L4 profile"],
                    ["Decay",          "Intelligent half-life per entity type"],
                    ["Auth tokens",    "Stored in settings table (DB), auto-refreshed"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="opacity-60">{k}</span>
                      <span className="text-foreground/70">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-sm opacity-30">loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
