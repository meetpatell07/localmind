"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Mail01Icon,
  Calendar03Icon,
  FileAttachmentIcon,
  CheckmarkCircle02Icon,
  CircleIcon,
  RefreshIcon,
  Unlink01Icon,
  LinkSquare02Icon,
  AlertDiamondIcon,
  InformationCircleIcon,
  UserIcon,
  FloppyDiskIcon,
  Loading03Icon,
  Logout01Icon,
  Globe02Icon,
  SmartPhone01Icon,
  Location01Icon,
} from "hugeicons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface ConnectorStatus {
  connected: boolean;
  email?: string;
  lastSyncAt?: string | null;
  syncStatus?: string | null;
  connectedAt?: string | null;
}

interface ConnectorsPayload {
  connectors: {
    google?: ConnectorStatus;
    notion?: ConnectorStatus;
  };
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

// ── Field Component ──────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>
        )}
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "bg-white border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:ring-gray-200 h-9",
            icon && "pl-9",
          )}
        />
      </div>
    </div>
  );
}

// ── Profile Section ──────────────────────────────────────────────────────────

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
        const data = (await res.json()) as { profile: UserProfileData | null };
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
      (k) => (form[k] ?? "") !== (profile[k] ?? ""),
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
      const data = (await res.json()) as { profile: UserProfileData };
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
      <div className="space-y-5">
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5 space-y-4 animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-24" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 bg-gray-100 rounded w-16" />
                <div className="h-9 bg-gray-50 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const v = (k: keyof UserProfileData) => String(form[k] ?? "");

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Identity */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="size-7 rounded-lg bg-amber-50 flex items-center justify-center">
            <UserIcon className="size-3.5 text-amber-500" />
          </div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Identity
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Full name"
            value={v("displayName")}
            onChange={(val) => set("displayName", val)}
            placeholder="Meet Patel"
            icon={<UserIcon className="size-3.5" />}
          />
          <Field
            label="Email"
            value={v("email")}
            onChange={(val) => set("email", val)}
            placeholder="meet@example.com"
            type="email"
            icon={<Mail01Icon className="size-3.5" />}
          />
          <Field
            label="Phone"
            value={v("phone")}
            onChange={(val) => set("phone", val)}
            placeholder="+1 555 000 0000"
            type="tel"
            icon={<SmartPhone01Icon className="size-3.5" />}
          />
          <Field
            label="Address"
            value={v("address")}
            onChange={(val) => set("address", val)}
            placeholder="City, Country"
            icon={<Location01Icon className="size-3.5" />}
          />
        </div>
      </div>

      {/* Social / Professional */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="size-7 rounded-lg bg-blue-50 flex items-center justify-center">
            <Globe02Icon className="size-3.5 text-blue-500" />
          </div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Social &amp; Professional
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="LinkedIn URL"
            value={v("linkedin")}
            onChange={(val) => set("linkedin", val)}
            placeholder="https://linkedin.com/in/..."
          />
          <Field
            label="Portfolio / Website"
            value={v("portfolioWeb")}
            onChange={(val) => set("portfolioWeb", val)}
            placeholder="https://yoursite.com"
          />
          <Field
            label="Instagram"
            value={v("instagram")}
            onChange={(val) => set("instagram", val)}
            placeholder="@handle"
          />
          <Field
            label="X (Twitter)"
            value={v("xHandle")}
            onChange={(val) => set("xHandle", val)}
            placeholder="@handle"
          />
          <Field
            label="Facebook"
            value={v("facebook")}
            onChange={(val) => set("facebook", val)}
            placeholder="https://facebook.com/..."
          />
        </div>
      </div>

      {/* Save Bar */}
      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white shadow-sm px-5 py-3">
        <div>
          {profile.updatedAt && (
            <span className="text-xs text-gray-400">
              Last saved{" "}
              {new Date(profile.updatedAt).toLocaleDateString("en", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-xs font-medium text-emerald-500 flex items-center gap-1">
              <CheckmarkCircle02Icon className="size-3.5" />
              Saved
            </span>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || !isDirty()}
            className="gap-1.5 disabled:opacity-30"
          >
            {saving ? (
              <Loading03Icon className="size-3 animate-spin" />
            ) : (
              <FloppyDiskIcon className="size-3" />
            )}
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Connector Card ───────────────────────────────────────────────────────────

interface ConnectorCardProps {
  name: string;
  description: string;
  icon: React.ReactNode;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  status: ConnectorStatus | null;
  connectHref?: string;
  onDisconnect?: () => void;
  comingSoon?: boolean;
}

function ConnectorCard({
  name,
  description,
  icon,
  accentBg,
  accentText,
  accentBorder,
  status,
  connectHref,
  onDisconnect,
  comingSoon,
}: ConnectorCardProps) {
  const isConnected = status?.connected ?? false;
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    if (!onDisconnect) return;
    setDisconnecting(true);
    try {
      await onDisconnect();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-white shadow-sm p-5 flex flex-col gap-4 transition-all",
        isConnected ? accentBorder : "border-gray-100",
      )}
    >
      {/* Top Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "size-10 rounded-xl flex items-center justify-center shrink-0 border",
              isConnected ? `${accentBg} ${accentBorder}` : "bg-gray-50 border-gray-100",
            )}
          >
            <span className={isConnected ? accentText : "text-gray-400"}>{icon}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">{name}</span>
              {comingSoon && (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  Soon
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-1">
          {isConnected ? (
            <>
              <CheckmarkCircle02Icon className="size-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600">Connected</span>
            </>
          ) : (
            <>
              <CircleIcon className="size-3 text-gray-300" />
              <span className="text-xs text-gray-400">Not connected</span>
            </>
          )}
        </div>
      </div>

      {/* Connection Details */}
      {isConnected && (
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3.5 py-2.5 space-y-1.5">
          {status?.email && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Account</span>
              <span className="text-xs font-medium text-gray-700">{status.email}</span>
            </div>
          )}
          {status?.connectedAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Connected</span>
              <span className="text-xs text-gray-600">
                {new Date(status.connectedAt).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
          {status?.lastSyncAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Last sync</span>
              <span className="text-xs text-gray-600">
                {new Date(status.lastSyncAt).toLocaleString("en", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {comingSoon ? (
          <span className="text-xs text-gray-300">Coming soon</span>
        ) : isConnected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDisconnect()}
            disabled={disconnecting}
            className="text-xs gap-1.5 text-red-500 border-red-200 bg-red-50/50 hover:bg-red-50 hover:border-red-300 disabled:opacity-40 transition-colors"
          >
            <Unlink01Icon className="size-3" />
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </Button>
        ) : (
          <a
            href={connectHref}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-lg border transition-colors",
              `${accentBg} ${accentBorder} ${accentText} hover:opacity-90`,
            )}
          >
            <LinkSquare02Icon className="size-3" />
            Connect
          </a>
        )}
      </div>
    </div>
  );
}

// ── Setup Guide ──────────────────────────────────────────────────────────────

function SetupGuide({ show }: { show: boolean }) {
  const [isOpen, setIsOpen] = useState(show);
  if (!isOpen) return null;

  return (
    <div className="rounded-xl p-4 space-y-3 bg-amber-50/50 border border-amber-200/60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <InformationCircleIcon className="size-3.5 text-amber-600" />
          <span className="text-xs font-semibold text-amber-700">
            Google OAuth setup required
          </span>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setIsOpen(false)}
          className="text-xs text-amber-500 hover:text-amber-700"
        >
          Dismiss
        </Button>
      </div>
      <ol className="space-y-2 text-xs text-gray-600 leading-relaxed">
        <li>
          <span className="text-gray-400 mr-2 font-medium">1.</span>Go to{" "}
          <span className="font-medium text-amber-700">console.cloud.google.com</span> → New
          project → Enable Gmail API + Calendar API
        </li>
        <li>
          <span className="text-gray-400 mr-2 font-medium">2.</span>Create OAuth 2.0 credentials →
          Web Application → add redirect URI:
        </li>
        <li className="ml-5">
          <code className="text-[11px] px-2.5 py-1.5 rounded-lg bg-gray-900 text-gray-300 block">
            http://localhost:3000/api/connectors/google/callback
          </code>
        </li>
        <li>
          <span className="text-gray-400 mr-2 font-medium">3.</span>Add to{" "}
          <span className="font-medium text-amber-700">.env.local</span>:
          <div className="mt-1.5 ml-5">
            <code className="text-[11px] px-2.5 py-1.5 rounded-lg bg-gray-900 text-gray-300 block space-y-0.5">
              <div>GOOGLE_CLIENT_ID=your_client_id</div>
              <div>GOOGLE_CLIENT_SECRET=your_client_secret</div>
            </code>
          </div>
        </li>
        <li>
          <span className="text-gray-400 mr-2 font-medium">4.</span>Restart the dev server, then
          click <span className="font-medium text-emerald-600">Connect</span> below
        </li>
      </ol>
    </div>
  );
}

// ── Connections Section ──────────────────────────────────────────────────────

function ConnectionsSection({
  google,
  notion,
  loading,
  onRefresh,
  onDisconnect,
  onBanner,
}: {
  google: ConnectorStatus | null;
  notion: ConnectorStatus | null;
  loading: boolean;
  onRefresh: () => void;
  onDisconnect: (provider: string) => Promise<void>;
  onBanner: (b: { type: "success" | "error"; message: string }) => void;
}) {
  const showSetupGuide = !google?.connected && !loading;
  const [notionToken, setNotionToken] = useState("");
  const [notionSaving, setNotionSaving] = useState(false);
  const [showNotionInput, setShowNotionInput] = useState(false);

  async function handleGoogleLogout() {
    await onDisconnect("google");
    onBanner({
      type: "success",
      message: "Google account disconnected — tokens removed from database",
    });
  }

  async function handleNotionConnect() {
    if (!notionToken.trim()) return;
    setNotionSaving(true);
    try {
      const res = await fetch("/api/connectors/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: notionToken.trim() }),
      });
      if (res.ok) {
        setNotionToken("");
        setShowNotionInput(false);
        onBanner({ type: "success", message: "Notion connected — integration token saved" });
        onRefresh();
      } else {
        onBanner({ type: "error", message: "Failed to save Notion token" });
      }
    } catch {
      onBanner({ type: "error", message: "Failed to connect Notion" });
    } finally {
      setNotionSaving(false);
    }
  }

  async function handleNotionDisconnect() {
    await onDisconnect("notion");
    onBanner({ type: "success", message: "Notion disconnected — token removed" });
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          External Services
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={onRefresh}
          className="text-xs text-gray-400 hover:text-gray-700 transition-colors gap-1.5"
        >
          <RefreshIcon className="size-3" />
          Refresh
        </Button>
      </div>

      <SetupGuide show={showSetupGuide} />

      {/* Connector Cards */}
      <div className="space-y-3">
        <ConnectorCard
          name="Google (Gmail + Calendar)"
          description="Read emails, search inbox, access calendar events"
          icon={<Mail01Icon className="size-5" />}
          accentBg="bg-blue-50"
          accentText="text-blue-600"
          accentBorder="border-blue-200"
          status={google}
          connectHref="/api/connectors/google/auth"
          onDisconnect={handleGoogleLogout}
        />
        <ConnectorCard
          name="Notion"
          description="Search pages, create tasks, read databases"
          icon={<FileAttachmentIcon className="size-5" />}
          accentBg="bg-gray-50"
          accentText="text-gray-600"
          accentBorder="border-gray-200"
          status={notion}
          connectHref="#"
          onDisconnect={handleNotionDisconnect}
        />
        {/* Notion token input */}
        {!notion?.connected && (
          <div className="ml-1">
            {showNotionInput ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="password"
                  value={notionToken}
                  onChange={(e) => setNotionToken(e.target.value)}
                  placeholder="ntn_... or secret_..."
                  className="bg-white border-gray-200 text-sm h-8 max-w-xs"
                />
                <Button
                  size="sm"
                  onClick={() => void handleNotionConnect()}
                  disabled={notionSaving || !notionToken.trim()}
                  className="text-xs h-8"
                >
                  {notionSaving ? "Saving..." : "Save"}
                </Button>
                <button
                  onClick={() => { setShowNotionInput(false); setNotionToken(""); }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNotionInput(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-lg border bg-gray-50 border-gray-200 text-gray-600 hover:opacity-90 transition-colors"
              >
                <LinkSquare02Icon className="size-3" />
                Connect with token
              </button>
            )}
            <p className="text-[11px] text-gray-400 mt-1.5">
              Create an integration at{" "}
              <a
                href="https://www.notion.so/my-integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-600"
              >
                notion.so/my-integrations
              </a>
              {" "}and paste the token here.
            </p>
          </div>
        )}
        <ConnectorCard
          name="Google Calendar"
          description="View and create events (included with Google)"
          icon={<Calendar03Icon className="size-5" />}
          accentBg="bg-emerald-50"
          accentText="text-emerald-600"
          accentBorder="border-emerald-200"
          status={google ? { connected: google.connected } : null}
          connectHref="/api/connectors/google/auth"
          comingSoon={!google?.connected}
        />
      </div>

      {/* Logout Card */}
      {google?.connected && (
        <div className="rounded-xl p-4 flex items-center justify-between bg-red-50/40 border border-red-200/60">
          <div>
            <p className="text-sm font-medium text-red-600">Logout from Google</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Revokes access &amp; removes all tokens from the database
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleGoogleLogout()}
            className="text-xs gap-1.5 text-red-500 border-red-200 bg-red-50/50 hover:bg-red-100/60 transition-colors"
          >
            <Logout01Icon className="size-3.5" />
            Logout
          </Button>
        </div>
      )}

      {/* Info Card */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          What LocalMind does with access
        </p>
        <ul className="space-y-2.5">
          {[
            "Periodically embeds new emails/events into memory for semantic search",
            "Extracts entities (people, projects, deadlines) and builds the knowledge graph",
            "Lets the AI reference your inbox & calendar when you ask about them in chat",
            "All data stays in your local Neon DB — nothing sent to third parties",
            "Refresh tokens are stored encrypted in your database for persistent auth",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-xs text-gray-600 leading-relaxed">
              <span className="text-amber-500 mt-0.5 shrink-0">→</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── About Section ────────────────────────────────────────────────────────────

function AboutSection() {
  const specs: [string, string][] = [
    ["Model", "qwen3:8b (Ollama)"],
    ["Embeddings", "nomic-embed-text (768 dims)"],
    ["Database", "Neon Postgres + pgvector"],
    ["Memory layers", "L1 episodic · L2 semantic · L3 graph · L4 profile"],
    ["Decay", "Intelligent half-life per entity type"],
    ["Auth tokens", "Stored in settings table (DB), auto-refreshed"],
  ];

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5 space-y-5">
        {/* Logo + Version */}
        <div className="flex items-center gap-3.5">
          <div className="size-11 rounded-xl bg-gray-900 flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-white text-lg font-mono">◈</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">LocalMind</p>
            <p className="text-xs text-gray-400 mt-0.5">v0.1.0 · localhost</p>
          </div>
        </div>

        {/* Specs Table */}
        <div className="rounded-lg bg-gray-50 border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          {specs.map(([key, val]) => (
            <div key={key} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-gray-400">{key}</span>
              <span className="text-xs font-medium text-gray-700">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

function SettingsContent() {
  const searchParams = useSearchParams();
  const [connData, setConnData] = useState<ConnectorsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/connectors/status");
      setConnData((await res.json()) as ConnectorsPayload);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "google") {
      setBanner({
        type: "success",
        message: "Google account connected — refresh token saved to database",
      });
      window.history.replaceState({}, "", "/settings");
    } else if (error) {
      const messages: Record<string, string> = {
        access_denied:
          "Access was denied. Please try again and grant the requested permissions.",
        token_exchange_failed:
          "Failed to exchange OAuth code. Check your GOOGLE_CLIENT_SECRET.",
        missing_code: "No authorization code received from Google.",
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
  const notion = connData?.connectors?.notion ?? null;

  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-0 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500 mt-1">
              Profile, connectors, and system information.
            </p>
          </div>
          {loading && (
            <span className="text-xs font-medium text-gray-400 animate-pulse">Loading...</span>
          )}
        </div>
      </div>

      <Tabs defaultValue="profile" className="flex flex-col flex-1 overflow-hidden gap-0">
        <div className="px-4 md:px-6 shrink-0">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5">
          {/* Banner */}
          {banner && (
            <div
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border",
                banner.type === "success"
                  ? "bg-emerald-50/60 border-emerald-200/60"
                  : "bg-red-50/60 border-red-200/60",
              )}
            >
              {banner.type === "success" ? (
                <CheckmarkCircle02Icon className="size-4 shrink-0 text-emerald-500" />
              ) : (
                <AlertDiamondIcon className="size-4 shrink-0 text-red-500" />
              )}
              <span
                className={cn(
                  "text-sm flex-1",
                  banner.type === "success" ? "text-emerald-700" : "text-red-700",
                )}
              >
                {banner.message}
              </span>
              <button
                onClick={() => setBanner(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 p-0.5"
              >
                <svg
                  className="size-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          <TabsContent value="profile">
            <ProfileSection />
          </TabsContent>

          <TabsContent value="connections">
            <ConnectionsSection
              google={google}
              notion={notion}
              loading={loading}
              onRefresh={() => void load()}
              onDisconnect={handleDisconnect}
              onBanner={setBanner}
            />
          </TabsContent>

          <TabsContent value="about">
            <AboutSection />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <Loading03Icon className="size-5 animate-spin text-gray-300" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
