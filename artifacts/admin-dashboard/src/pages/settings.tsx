import { useState, useEffect } from "react";
import { setBaseUrl, useHealthCheck } from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, RefreshCw, Globe, Trash2, Shield, Info, Eye, EyeOff, Key, Sparkles, Palette } from "lucide-react";

const STORAGE_KEY = "tayyibati_api_url";

const API_BASE = () => localStorage.getItem(STORAGE_KEY) || "";

interface ConfigRow { id: number; key: string; value: string; description: string | null; isPublic: string; }

async function fetchConfig(): Promise<ConfigRow[]> {
  const res = await fetch(`${API_BASE()}/api/config`);
  if (!res.ok) throw new Error("Failed to fetch config");
  return res.json();
}

async function patchConfig(key: string, value: string): Promise<ConfigRow> {
  const res = await fetch(`${API_BASE()}/api/config/${key}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error("Failed to update config");
  return res.json();
}

function Toggle({ enabled, onChange, label, desc }: { enabled: boolean; onChange: (v: boolean) => void; label: string; desc?: string; }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${enabled ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

export default function Settings() {
  const [apiUrl, setApiUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    setApiUrl(stored);
    setSaved(!!stored);
  }, []);

  const { data: health, isLoading: checking, refetch, isError } = useHealthCheck();
  const { data: configRows = [] } = useQuery({ queryKey: ["config"], queryFn: fetchConfig });

  const patchMut = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => patchConfig(key, value),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["config"] }); toast({ title: "Setting saved" }); },
    onError: () => toast({ title: "Failed to save setting", variant: "destructive" }),
  });

  const getConfig = (key: string) => configRows.find((r) => r.key === key)?.value ?? "";
  const setConfig = (key: string, value: string) => patchMut.mutate({ key, value });

  const googleEnabled = getConfig("google_login_enabled") === "true";
  const freeDailyLimit = getConfig("free_daily_limit") || "10";
  const subscriptionEnabled = getConfig("subscription_enabled") === "true";

  const [branding, setBranding] = useState({ app_name: "", app_description: "", app_logo_url: "" });
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  useEffect(() => {
    if (!brandingLoaded && configRows.length > 0) {
      setBranding({
        app_name: getConfig("app_name"),
        app_description: getConfig("app_description"),
        app_logo_url: getConfig("app_logo_url"),
      });
      setBrandingLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configRows, brandingLoaded]);

  function handleBrandingSave() {
    setConfig("app_name", branding.app_name.trim());
    setConfig("app_description", branding.app_description.trim());
    setConfig("app_logo_url", branding.app_logo_url.trim());
  }

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const storedApiKey = getConfig("openai_api_key");
  const apiKeyMasked = storedApiKey
    ? storedApiKey.slice(0, 7) + "••••••••••••••••••" + storedApiKey.slice(-4)
    : "";

  function handleApiKeySave() {
    if (!apiKeyInput.trim()) return;
    patchMut.mutate(
      { key: "openai_api_key", value: apiKeyInput.trim() },
      {
        onSuccess: () => {
          setApiKeyInput("");
          setApiKeyVisible(false);
          setApiKeySaved(true);
          setTimeout(() => setApiKeySaved(false), 3000);
        },
      },
    );
  }

  function handleApiKeyClear() {
    patchMut.mutate({ key: "openai_api_key", value: "" });
    setApiKeyInput("");
  }

  function handleSave() {
    const trimmed = apiUrl.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
      setBaseUrl(trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setBaseUrl(null);
    }
    setSaved(!!trimmed);
    queryClient.clear();
    toast({ title: "Settings saved", description: "API URL updated." });
    setTimeout(() => refetch(), 300);
  }

  function handleClear() {
    setApiUrl("");
    localStorage.removeItem(STORAGE_KEY);
    setBaseUrl(null);
    setSaved(false);
    queryClient.clear();
    toast({ title: "Cleared", description: "Using default relative API path." });
  }

  const isConnected = !!health?.status;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Configure the Tayyibati API and app features</p>
      </div>

      {/* API Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            API Connection
          </CardTitle>
          <CardDescription>
            By default the dashboard connects to the API on the same server. If self-hosting separately, enter your API server's full base URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-url">API Base URL</Label>
            <div className="flex gap-2">
              <Input
                id="api-url"
                placeholder="https://your-api-server.com (leave blank for default)"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="font-mono text-sm"
              />
              <Button onClick={handleSave}>Save</Button>
              {saved && (
                <Button variant="outline" size="icon" onClick={handleClear}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {saved ? `Custom API URL: ${localStorage.getItem(STORAGE_KEY)}` : "Using default relative /api path"}
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-4 bg-muted/30">
            <div className="flex-1">
              <p className="text-sm font-medium">Connection Status</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {checking ? "Checking…" : isConnected ? "API server is reachable" : "Unable to reach API server"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {checking ? (
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : isConnected ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={checking}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Test
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OpenAI API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            AI / OpenAI API Key
          </CardTitle>
          <CardDescription>
            The key used for ingredient extraction and image analysis. Overrides the server environment variable when set here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {storedApiKey ? (
            <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
              <Key className="h-4 w-4 text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Current key</p>
                <p className="font-mono text-sm truncate">{apiKeyMasked}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive shrink-0"
                onClick={handleApiKeyClear}
                disabled={patchMut.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-muted-foreground text-sm">
              <Info className="h-4 w-4 shrink-0" />
              No key stored — using the <code className="bg-muted px-1 rounded text-xs">OPENAI_API_KEY</code> environment variable
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="openai-key">{storedApiKey ? "Replace key" : "Set key"}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="openai-key"
                  type={apiKeyVisible ? "text" : "password"}
                  placeholder="sk-proj-..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="font-mono text-sm pr-10"
                  onKeyDown={(e) => e.key === "Enter" && handleApiKeySave()}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setApiKeyVisible((v) => !v)}
                  tabIndex={-1}
                >
                  {apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={handleApiKeySave}
                disabled={!apiKeyInput.trim() || patchMut.isPending}
              >
                {apiKeySaved ? <><CheckCircle className="h-3.5 w-3.5 mr-1.5 text-green-400" />Saved</> : "Save"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The key is stored in the database and never exposed via the public API. Get yours at{" "}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">
                platform.openai.com/api-keys
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Authentication Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Authentication
          </CardTitle>
          <CardDescription>Control which sign-in methods are available in the mobile app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Toggle
            enabled={googleEnabled}
            onChange={(v) => setConfig("google_login_enabled", v ? "true" : "false")}
            label="Google Sign-In"
            desc='Show "تسجيل الدخول بـ Google" button on the login screen'
          />
          <div className="rounded-lg bg-muted/40 border p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">To activate Google Sign-In, set these environment secrets in Replit:</p>
                <ul className="space-y-1 font-mono">
                  <li><code className="bg-muted px-1 rounded">EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB</code> — Web client ID</li>
                  <li><code className="bg-muted px-1 rounded">EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS</code> — iOS client ID</li>
                  <li><code className="bg-muted px-1 rounded">EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID</code> — Android client ID</li>
                </ul>
                <p className="mt-2">Get these from <strong>console.cloud.google.com</strong> → APIs &amp; Services → Credentials → OAuth 2.0 Client IDs.</p>
                <p>Authorized redirect URI: <code className="bg-muted px-1 rounded">https://auth.expo.io/@your-expo-username/tayyibati</code></p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* App Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage Limits</CardTitle>
          <CardDescription>Control free-tier analysis limits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Free Daily Analysis Limit</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                className="w-32"
                value={freeDailyLimit}
                onChange={(e) => setConfig("free_daily_limit", e.target.value)}
                min={1}
                max={100}
              />
              <span className="text-sm text-muted-foreground">analyses / day</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscription & Payments</CardTitle>
          <CardDescription>Control whether users can subscribe to premium plans.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Toggle
            enabled={subscriptionEnabled}
            onChange={(v) => setConfig("subscription_enabled", v ? "true" : "false")}
            label="Enable Premium Subscriptions"
            desc="Show upgrade plans and allow users to subscribe"
          />
        </CardContent>
      </Card>

      {/* App Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            App Branding
          </CardTitle>
          <CardDescription>Customize the name, tagline, and logo shown on the mobile app home screen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>App Name (Arabic)</Label>
            <Input
              dir="rtl"
              value={branding.app_name}
              onChange={(e) => setBranding({ ...branding, app_name: e.target.value })}
              placeholder="طيباتي"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tagline (Arabic)</Label>
            <Input
              dir="rtl"
              value={branding.app_description}
              onChange={(e) => setBranding({ ...branding, app_description: e.target.value })}
              placeholder="تحقق من توافق أي طعام"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Logo URL (optional)</Label>
            <Input
              value={branding.app_logo_url}
              onChange={(e) => setBranding({ ...branding, app_logo_url: e.target.value })}
              placeholder="https://…/logo.png"
              className="font-mono text-sm"
            />
          </div>
          <Button onClick={handleBrandingSave} disabled={patchMut.isPending}>
            Save Branding
          </Button>
        </CardContent>
      </Card>

      {/* Store Submission Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">App Store Submission Checklist</CardTitle>
          <CardDescription>Steps to publish on Apple App Store & Google Play</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-semibold mb-2 flex items-center gap-2">🍎 Apple App Store</p>
            <ol className="space-y-1.5 list-decimal list-inside text-muted-foreground">
              <li>Enroll in Apple Developer Program ($99/year) at <strong>developer.apple.com</strong></li>
              <li>Create an App ID with bundle ID: <code className="bg-muted px-1 rounded text-xs">com.tayyibati.app</code></li>
              <li>Run <code className="bg-muted px-1 rounded text-xs">eas build --platform ios</code> to create an IPA</li>
              <li>Upload via Transporter or Xcode to App Store Connect</li>
              <li>Fill in Arabic + English metadata, screenshots (6.7" required), privacy policy URL</li>
              <li>Set age rating — likely 4+ (no mature content)</li>
              <li>Privacy policy URL required — create a simple page disclosing camera/photo access</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold mb-2 flex items-center gap-2">🤖 Google Play</p>
            <ol className="space-y-1.5 list-decimal list-inside text-muted-foreground">
              <li>Pay one-time $25 registration at <strong>play.google.com/console</strong></li>
              <li>Run <code className="bg-muted px-1 rounded text-xs">eas build --platform android</code> to create an AAB</li>
              <li>Upload AAB to Play Console → Internal Testing first</li>
              <li>Complete the Data Safety section — disclose camera/photos, no data sold to third parties</li>
              <li>Provide privacy policy URL</li>
              <li>Fill Arabic store listing (title, description, screenshots)</li>
              <li>Submit for review (~1–3 days)</li>
            </ol>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <strong>EAS build command:</strong>
            <pre className="mt-1 font-mono">npx eas-cli build --platform all --profile production</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
