import { useState, useEffect, useCallback } from "react";
import { setBaseUrl } from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/LangContext";
import { tr } from "@/lib/i18n";
import { CheckCircle, XCircle, RefreshCw, Globe, Trash2, Shield, Info, Eye, EyeOff, Key, Sparkles, Palette, AlertCircle } from "lucide-react";

import { getApiBaseUrl, adminFetch } from "@/lib/api";

const STORAGE_KEY = "tayyibati_api_url";

const API_BASE = () => getApiBaseUrl();

interface ConfigRow { id: number; key: string; value: string; description: string | null; isPublic: string; }

async function fetchConfig(): Promise<ConfigRow[]> {
  const res = await adminFetch(`${API_BASE()}/api/config`);

  if (!res.ok) {
    throw new Error("Failed to fetch config");
  }

  return res.json();
}

async function patchConfig(key: string, value: string): Promise<ConfigRow> {
  const res = await adminFetch(`${API_BASE()}/api/config/${key}`, {
    method: "PATCH",
    body: JSON.stringify({ value }),
  });

  if (!res.ok) {
    throw new Error("Failed to update config");
  }

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

function ChangeAdminPasswordCard({ isAr }: { isAr: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const getStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 10) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const strength = getStrength(newPassword);

  const getStrengthLabel = (score: number) => {
    if (score === 0) return { label: isAr ? "غير مدخلة" : "None", color: "bg-muted" };
    if (score <= 1) return { label: isAr ? "ضعيفة (10 أحرف مطلوب)" : "Weak (min 10 chars)", color: "bg-red-500" };
    if (score <= 2) return { label: isAr ? "متوسطة" : "Medium", color: "bg-amber-500" };
    if (score <= 3) return { label: isAr ? "جيدة" : "Good", color: "bg-blue-500" };
    return { label: isAr ? "قوية جداً" : "Strong", color: "bg-emerald-500" };
  };

  const strengthInfo = getStrengthLabel(strength);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage(isAr ? "جميع الحقول مطلوبة" : "All password fields are required");
      return;
    }

    if (newPassword.length < 10) {
      setErrorMessage(isAr ? "كلمة المرور الجديدة يجب أن تحتوي على 10 أحرف على الأقل" : "New password must be at least 10 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(isAr ? "كلمة المرور الجديدة وتأكيدها غير متطابقين" : "New password and confirmation do not match");
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMessage(isAr ? "كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية" : "New password must be different from current password");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adminFetch(`${API_BASE()}/api/admin/change-password`, {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any = {};

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error(
          isAr
            ? "تعذر الاتصال بخادم الإدارة (استجابة غير متوقعة من الخادم)"
            : "Admin server returned an unexpected response"
        );
      }

      if (!res.ok) {
        throw new Error(data.error || (isAr ? "فشل تغيير كلمة المرور" : "Failed to change password"));
      }

      toast({
        title: isAr ? "تم تغيير كلمة المرور بنجاح" : "Password Changed Successfully",
        description: isAr ? "تم إنهاء الجلسة، يرجى تسجيل الدخول مجدداً." : "All sessions invalidated. Please log in again.",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        window.location.href = "/login";
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message);
      toast({
        title: isAr ? "خطأ في تغيير كلمة المرور" : "Password Change Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4 text-primary" />
          {isAr ? "تغيير كلمة مرور المدير" : "Change Admin Password"}
        </CardTitle>
        <CardDescription>
          {isAr
            ? "قم بتحديث كلمة مرور حساب المدير الخاص بك. سيؤدي هذا الإجراء إلى إنهاء كافة الجلسات النشطة المطابقة."
            : "Update your admin account password. This will invalidate all existing active sessions."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="current-pwd">{isAr ? "كلمة المرور الحالية" : "Current Password"}</Label>
            <div className="relative">
              <Input
                id="current-pwd"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowCurrent((v) => !v)}
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-pwd">{isAr ? "كلمة المرور الجديدة" : "New Password"}</Label>
            <div className="relative">
              <Input
                id="new-pwd"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNew((v) => !v)}
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {newPassword && (
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{isAr ? "قوة كلمة المرور:" : "Strength:"}</span>
                  <span className="font-semibold">{strengthInfo.label}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden flex gap-1">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-full flex-1 transition-all ${
                        strength >= step ? strengthInfo.color : "bg-transparent"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-pwd">{isAr ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}</Label>
            <div className="relative">
              <Input
                id="confirm-pwd"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto gap-2">
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                {isAr ? "جاري الحفظ..." : "Saving..."}
              </>
            ) : (
              <>
                <Key className="h-4 w-4" />
                {isAr ? "حفظ كلمة المرور الجديدة" : "Save New Password"}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const [apiUrl, setApiUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();
  const { lang } = useLang();
  const queryClient = useQueryClient();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    setApiUrl(stored);
    setSaved(!!stored);
  }, []);

  const [healthState, setHealthState] = useState<{
    status: "idle" | "checking" | "online" | "warning" | "notFound" | "unreachable";
    message: string;
    detail?: string;
    statusCode?: number;
  }>({
    status: "idle",
    message: lang === "ar" ? "اضغط على اختبار لفحص الاتصال" : "Click Test to check connection status",
  });

  const runHealthTest = useCallback(async (customInputUrl?: string) => {
    setHealthState((prev) => ({
      ...prev,
      status: "checking",
      message: lang === "ar" ? "جاري فحص الاتصال..." : "Testing connection...",
      detail: undefined,
    }));

    let raw = (customInputUrl !== undefined ? customInputUrl : (localStorage.getItem(STORAGE_KEY) || "")).trim();
    let healthUrl: string;
    let healthzUrl: string;

    if (!raw) {
      const base = getApiBaseUrl().replace(/\/+$/, "");
      if (!base || base.startsWith("/")) {
        healthUrl = "/api/health";
        healthzUrl = "/api/healthz";
      } else if (base.endsWith("/api")) {
        healthUrl = `${base}/health`;
        healthzUrl = `${base}/healthz`;
      } else {
        healthUrl = `${base}/api/health`;
        healthzUrl = `${base}/api/healthz`;
      }
    } else {
      const clean = raw.replace(/\/+$/, "");
      if (clean.endsWith("/api")) {
        healthUrl = `${clean}/health`;
        healthzUrl = `${clean}/healthz`;
      } else {
        healthUrl = `${clean}/api/health`;
        healthzUrl = `${clean}/api/healthz`;
      }
    }

    const tryFetch = async (url: string) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      try {
        const res = await fetch(url, { method: "GET", signal: controller.signal });
        clearTimeout(timer);
        return res;
      } catch (err) {
        clearTimeout(timer);
        throw err;
      }
    };

    let res: Response | null = null;
    let fetchError: any = null;

    try {
      res = await tryFetch(healthUrl);
    } catch (err: any) {
      fetchError = err;
    }

    if (!res || res.status === 404) {
      try {
        const resFallback = await tryFetch(healthzUrl);
        if (resFallback.ok || resFallback.status !== 404) {
          res = resFallback;
          fetchError = null;
        }
      } catch (fallbackErr) {
        if (!fetchError) fetchError = fallbackErr;
      }
    }

    if (res) {
      if (res.status === 200) {
        setHealthState({
          status: "online",
          message: lang === "ar" ? "خادم API متصل ويعمل بشكل سليم" : "API server is online",
          statusCode: 200,
        });
        return;
      } else if (res.status === 401 || res.status === 403) {
        setHealthState({
          status: "warning",
          message: lang === "ar"
            ? "خادم API متصل لكن يتطلب المصادقة"
            : "API server is reachable but authentication is required",
          statusCode: res.status,
        });
        return;
      } else if (res.status === 404) {
        setHealthState({
          status: "notFound",
          message: lang === "ar"
            ? "خادم API متصل ولكن لم يتم العثور على نقطة فحص الصحة"
            : "API server is reachable but health endpoint was not found",
          statusCode: 404,
        });
        return;
      } else {
        setHealthState({
          status: "warning",
          message: lang === "ar"
            ? `استجاب الخادم بالحالة HTTP ${res.status}`
            : `API responded with HTTP ${res.status}`,
          statusCode: res.status,
        });
        return;
      }
    }

    if (fetchError) {
      const isTimeout = fetchError.name === "AbortError";
      const isCorsOrTypeError = fetchError instanceof TypeError || fetchError.name === "TypeError";
      const detailMsg = isTimeout
        ? (lang === "ar" ? "انتهت مهلة الطلب (لم يستجب الخادم خلال 6 ثوانٍ)" : "Request timed out after 6 seconds")
        : isCorsOrTypeError
        ? (lang === "ar" ? "قيود CORS أو حجب شبكي (Failed to fetch)" : "CORS restriction or network block (TypeError: Failed to fetch)")
        : fetchError.message || String(fetchError);

      setHealthState({
        status: "unreachable",
        message: lang === "ar" ? "تعذر الوصول إلى خادم API" : "Unable to reach API server",
        detail: detailMsg,
      });
      return;
    }

    setHealthState({
      status: "unreachable",
      message: lang === "ar" ? "تعذر الوصول إلى خادم API" : "Unable to reach API server",
    });
  }, [lang]);

  useEffect(() => {
    runHealthTest();
  }, [runHealthTest]);

  const { data: configRows = [] } = useQuery({ queryKey: ["config"], queryFn: fetchConfig });

  const patchMut = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => patchConfig(key, value),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["config"] }); toast({ title: "Setting saved" }); },
    onError: () => toast({ title: "Failed to save setting", variant: "destructive" }),
  });

  const getConfig = (key: string) => configRows.find((r) => r.key === key)?.value ?? "";
  const setConfig = (key: string, value: string) => patchMut.mutate({ key, value });

  const googleEnabled = getConfig("google_login_enabled") === "true";
  const freeMonthlyLimit = getConfig("free_monthly_limit") || "10";
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
    setTimeout(() => runHealthTest(trimmed), 300);
  }

  function handleClear() {
    setApiUrl("");
    localStorage.removeItem(STORAGE_KEY);
    setBaseUrl(null);
    setSaved(false);
    queryClient.clear();
    toast({ title: "Cleared", description: "Using default relative API path." });
    setTimeout(() => runHealthTest(""), 300);
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">{tr(lang, "settings")}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {lang === "ar" ? "إعداد API الطيباتي وميزات التطبيق" : "Configure the Tayyibati API and app features"}
        </p>
      </div>

      {/* Change Admin Password */}
      <ChangeAdminPasswordCard isAr={lang === "ar"} />

      {/* API Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            {tr(lang, "apiConnection")}
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
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium">{lang === "ar" ? "حالة الاتصال بالخادم" : "Connection Status"}</p>
                {healthState.status === "online" && (
                  <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-xs">
                    200 OK
                  </Badge>
                )}
                {healthState.status === "warning" && (
                  <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs">
                    HTTP {healthState.statusCode}
                  </Badge>
                )}
                {healthState.status === "notFound" && (
                  <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-xs">
                    HTTP 404
                  </Badge>
                )}
                {healthState.status === "unreachable" && (
                  <Badge variant="destructive" className="text-xs">
                    {lang === "ar" ? "غير متصل" : "Offline / Blocked"}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {healthState.message}
              </p>
              {healthState.detail && (
                <p className="text-[11px] text-destructive/80 font-mono mt-1 truncate">
                  {healthState.detail}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {healthState.status === "checking" ? (
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : healthState.status === "online" ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : healthState.status === "warning" ? (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              ) : healthState.status === "notFound" ? (
                <AlertCircle className="h-5 w-5 text-orange-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => runHealthTest(apiUrl)}
                disabled={healthState.status === "checking"}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${healthState.status === "checking" ? "animate-spin" : ""}`} />
                {lang === "ar" ? "اختبار" : "Test"}
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
          <CardDescription>
            Legacy free-tier fallback limit. Per-plan monthly limits are now set in the Subscription Plans page and take precedence over this value.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Free Monthly Analysis Limit <span className="text-xs font-normal text-muted-foreground">(legacy — use Plans page instead)</span></Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                className="w-32"
                value={freeMonthlyLimit}
                onChange={(e) => setConfig("free_monthly_limit", e.target.value)}
                min={1}
                max={100}
              />
              <span className="text-sm text-muted-foreground">analyses / month</span>
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
