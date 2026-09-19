import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch, API_BASE } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/LangContext";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Activity,
  Cpu,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  DollarSign,
  Zap,
  Layers,
  ArrowRight,
  ShieldCheck,
  Mail,
  Send,
  Sliders,
  Sparkles,
  Info,
  ChevronLeft,
  ChevronRight,
  FileCode2,
} from "lucide-react";

const TEAL = "hsl(162, 64%, 29%)";
const GOLD = "hsl(43, 53%, 54%)";
const RED = "hsl(0, 67%, 55%)";
const BLUE = "hsl(208, 40%, 54%)";
const PURPLE = "hsl(270, 50%, 55%)";
const GREEN = "hsl(145, 45%, 49%)";
const GRAY = "hsl(220, 9%, 46%)";

export default function AiMonitoring() {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [chartRange, setChartRange] = useState<"today" | "7d" | "30d">("7d");
  const [logPage, setLogPage] = useState(1);
  const [providerFilter, setProviderFilter] = useState("all");
  const [featureFilter, setFeatureFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");

  // 1. Fetch Providers Status Cards
  const { data: providersData, isLoading: loadingProviders, refetch: refetchProviders } = useQuery({
    queryKey: ["admin-ai-providers"],
    queryFn: async () => {
      const res = await adminFetch(`${API_BASE}/api/admin/ai-monitoring/providers`);
      if (!res.ok) throw new Error("Failed to fetch provider status");
      return res.json();
    },
    refetchInterval: 30000,
  });

  // 2. Fetch Charts Data
  const { data: chartsData, isLoading: loadingCharts, refetch: refetchCharts } = useQuery({
    queryKey: ["admin-ai-charts", chartRange],
    queryFn: async () => {
      const res = await adminFetch(`${API_BASE}/api/admin/ai-monitoring/charts?range=${chartRange}`);
      if (!res.ok) throw new Error("Failed to fetch charts data");
      return res.json();
    },
    refetchInterval: 30000,
  });

  // 3. Fetch API Usage Logs
  const { data: usageData, isLoading: loadingUsage, refetch: refetchUsage } = useQuery({
    queryKey: ["admin-ai-usage", logPage, providerFilter, featureFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(logPage),
        limit: "15",
        provider: providerFilter,
        feature: featureFilter,
        status: statusFilter,
      });
      const res = await adminFetch(`${API_BASE}/api/admin/ai-monitoring/usage?${params}`);
      if (!res.ok) throw new Error("Failed to fetch usage logs");
      return res.json();
    },
    refetchInterval: 15000,
  });

  // 4. Fetch Record Detail
  const { data: detailData, isLoading: loadingDetail } = useQuery({
    queryKey: ["admin-ai-record-detail", selectedRecordId],
    queryFn: async () => {
      if (!selectedRecordId) return null;
      const res = await adminFetch(`${API_BASE}/api/admin/ai-monitoring/usage/${selectedRecordId}`);
      if (!res.ok) throw new Error("Failed to fetch record detail");
      return res.json();
    },
    enabled: !!selectedRecordId,
  });

  // 5. Fetch Settings
  const { data: settingsData, refetch: refetchSettings } = useQuery({
    queryKey: ["admin-ai-settings"],
    queryFn: async () => {
      const res = await adminFetch(`${API_BASE}/api/admin/ai-monitoring/settings`);
      if (!res.ok) throw new Error("Failed to fetch alert settings");
      return res.json();
    },
  });

  // Mutation: Run Health Check
  const healthCheckMut = useMutation({
    mutationFn: async (provider?: "openai" | "gemini") => {
      const res = await adminFetch(`${API_BASE}/api/admin/ai-monitoring/health-check`, {
        method: "POST",
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new Error("Health check request failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-providers"] });
      toast({
        title: isAr ? "اكتمل فحص الاتصال" : "Connectivity Check Completed",
        description: isAr
          ? "تم تحديث حالة اتصال المزودين بدون استهلاك أي رموز مدفوعة."
          : "Provider reachability checked successfully with zero paid tokens.",
      });
    },
    onError: (err: any) => {
      toast({
        title: isAr ? "فشل فحص الاتصال" : "Health Check Failed",
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  // Mutation: Save Settings
  const saveSettingsMut = useMutation({
    mutationFn: async (payload: any) => {
      const res = await adminFetch(`${API_BASE}/api/admin/ai-monitoring/settings`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-ai-providers"] });
      toast({
        title: isAr ? "تم حفظ الإعدادات" : "Settings Saved",
        description: isAr ? "تم تحديث حدود الميزانية والتنبيهات بنجاح." : "Alert thresholds updated successfully.",
      });
      setSettingsOpen(false);
    },
  });

  // Mutation: Test Email
  const testEmailMut = useMutation({
    mutationFn: async (targetEmail: string) => {
      const res = await adminFetch(`${API_BASE}/api/admin/ai-monitoring/test-email`, {
        method: "POST",
        body: JSON.stringify({ targetEmail }),
      });
      if (!res.ok) throw new Error("Test email request failed");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: isAr ? "تم إرسال بريد الاختبار" : "Test Email Sent",
          description: data.message,
        });
      } else {
        toast({
          title: isAr ? "فشل إرسال البريد" : "Email Dispatch Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (err: any) => {
      toast({
        title: isAr ? "خطأ في الإرسال" : "Dispatch Error",
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  const providers = providersData?.providers || [];
  const dailyChartData = chartsData?.dailyData || [];
  const featureData = chartsData?.features || [];
  const summary = chartsData?.summary || {};
  const usageItems = usageData?.items || [];
  const pagination = usageData?.pagination || { page: 1, totalPages: 1, total: 0 };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "HEALTHY":
        return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20">{isAr ? "سليم وجاهز" : "HEALTHY"}</Badge>;
      case "LOW":
        return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20">{isAr ? "استهلاك مرتفع" : "LOW"}</Badge>;
      case "CRITICAL":
        return <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30 hover:bg-orange-500/20">{isAr ? "حرج (تجاوز الميزانية)" : "CRITICAL"}</Badge>;
      case "EXHAUSTED":
        return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 hover:bg-red-500/20">{isAr ? "الكوتا مستنفدة" : "EXHAUSTED"}</Badge>;
      case "ERROR":
        return <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 hover:bg-rose-500/20">{isAr ? "أخطاء متكررة" : "ERROR"}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConnectivityBadge = (status: string, latencyMs?: number | null) => {
    if (status === "CONNECTED") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {isAr ? "متصل بالخدمة" : "Connected"} {latencyMs ? `(${latencyMs}ms)` : ""}
        </span>
      );
    }
    if (status === "DISCONNECTED") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          {isAr ? "غير متصل / خطأ" : "Disconnected"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
        <span className="h-2 w-2 rounded-full bg-gray-400" />
        {isAr ? "لم يتم الفحص" : "Unchecked"}
      </span>
    );
  };

  const pieData = useMemo(() => {
    return [
      { name: "OpenAI", value: summary.openaiCalls || 0, color: TEAL },
      { name: "Gemini", value: summary.geminiCalls || 0, color: BLUE },
    ].filter((d) => d.value > 0);
  }, [summary]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">
              {isAr ? "مراقبة الذكاء الاصطناعي وتنبيهات الكوتا" : "AI Monitoring & Quota Alerts"}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr
              ? "مراقبة مركزية لاستهلاك OpenAI و Gemini، التكاليف التقديرية، الفوترة، سلاسل المحاولات البديلة، وفحص الاتصال."
              : "Centralized monitoring for OpenAI and Gemini calls, costs, provider health, fallback chains, and alerts."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => healthCheckMut.mutate(undefined)}
            disabled={healthCheckMut.isPending}
            className="gap-1.5"
          >
            <Zap className={`h-4 w-4 ${healthCheckMut.isPending ? "animate-spin text-amber-500" : "text-amber-500"}`} />
            <span>{healthCheckMut.isPending ? (isAr ? "جارِ الفحص..." : "Checking...") : isAr ? "فحص الاتصال (مجاني)" : "Check Connectivity"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="gap-1.5"
          >
            <Sliders className="h-4 w-4 text-primary" />
            <span>{isAr ? "إعدادات التنبيهات" : "Alert Settings"}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              refetchProviders();
              refetchCharts();
              refetchUsage();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Provider Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {providers.map((p: any) => {
          const isOpenAI = p.provider === "openai";
          const todayCost = p.todayEstimatedCost || 0;
          const dailyLimit = p.dailySpendLimit || 10;
          const dailyPercent = Math.min(100, Math.round((todayCost / dailyLimit) * 100));

          const monthCost = p.monthEstimatedCost || 0;
          const monthlyLimit = p.monthlySpendLimit || 100;
          const monthPercent = Math.min(100, Math.round((monthCost / monthlyLimit) * 100));

          return (
            <Card key={p.provider} className="relative overflow-hidden border-2 shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isOpenAI ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"}`}>
                      <Cpu className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {p.displayName}
                        {getStatusBadge(p.operationalStatus)}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {p.isConfigured
                          ? isAr
                            ? "مفتاح الربط مُهيأ ونشط"
                            : "API credentials configured"
                          : isAr
                            ? "غير مهيأ"
                            : "Not configured"}
                      </CardDescription>
                    </div>
                  </div>

                  <div>{getConnectivityBadge(p.connectivityStatus, p.connectivityLatencyMs)}</div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* Cost Tracking vs Budget */}
                <div className="rounded-lg bg-muted/40 p-3 space-y-3 border">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5 text-primary" />
                      {isAr ? "التكلفة التقديرية للاستخدام (Estimated Usage Cost)" : "Estimated Usage Cost"}
                    </span>
                    <span className="text-[11px] font-normal text-muted-foreground/70">
                      {isAr ? "محسوبة بالرموز" : "Calculated via tokens"}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>{isAr ? "اليوم:" : "Today:"}</span>
                      <span className="font-semibold">
                        ${todayCost.toFixed(4)} / ${dailyLimit.toFixed(2)}
                        <span className="text-muted-foreground font-normal ml-1">({dailyPercent}%)</span>
                      </span>
                    </div>
                    <Progress value={dailyPercent} className={`h-2 ${dailyPercent > 90 ? "bg-red-200" : ""}`} />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>{isAr ? "هذا الشهر:" : "This Month:"}</span>
                      <span className="font-semibold">
                        ${monthCost.toFixed(4)} / ${monthlyLimit.toFixed(2)}
                        <span className="text-muted-foreground font-normal ml-1">({monthPercent}%)</span>
                      </span>
                    </div>
                    <Progress value={monthPercent} className={`h-2 ${monthPercent > 90 ? "bg-red-200" : ""}`} />
                  </div>
                </div>

                {/* Real Traffic Statistics */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="border rounded-md p-2.5 bg-background">
                    <p className="text-muted-foreground">{isAr ? "طلبات اليوم / الشهر" : "Calls Today / Month"}</p>
                    <p className="text-base font-bold mt-0.5">
                      {p.callsToday.toLocaleString()} <span className="text-muted-foreground text-xs font-normal">/ {p.callsThisMonth.toLocaleString()}</span>
                    </p>
                  </div>

                  <div className="border rounded-md p-2.5 bg-background">
                    <p className="text-muted-foreground">{isAr ? "الناجحة / الفاشلة" : "Successful / Failed"}</p>
                    <p className="text-base font-bold mt-0.5 text-emerald-600">
                      {p.successfulCalls.toLocaleString()}{" "}
                      <span className="text-rose-500 font-normal text-xs">({p.failedCalls} فشل)</span>
                    </p>
                  </div>
                </div>

                {/* Last Real Call & Error Code */}
                <div className="space-y-1 text-xs border-t pt-3">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{isAr ? "آخر استدعاء ناجح:" : "Last Real Success:"}</span>
                    <span className="font-medium text-foreground">
                      {p.lastSuccessfulCallAt ? new Date(p.lastSuccessfulCallAt).toLocaleTimeString(isAr ? "ar-SA" : "en-US") : isAr ? "لا يوجد بعد" : "None yet"}
                    </span>
                  </div>

                  {p.lastFailedCallAt && (
                    <div className="flex justify-between text-rose-600">
                      <span>{isAr ? "آخر فشل تشغيلي:" : "Last Failure:"}</span>
                      <span className="font-medium">
                        {new Date(p.lastFailedCallAt).toLocaleTimeString(isAr ? "ar-SA" : "en-US")} {p.lastErrorCode ? `(${p.lastErrorCode})` : ""}
                      </span>
                    </div>
                  )}

                  {p.consecutiveFailures > 0 && (
                    <div className="flex justify-between text-amber-600 font-semibold">
                      <span>{isAr ? "محاولات فشل متتالية:" : "Consecutive Failures:"}</span>
                      <span>{p.consecutiveFailures}</span>
                    </div>
                  )}
                </div>

                {/* Provider Balance & Official Dashboard Link */}
                <div className="flex items-center justify-between pt-2 border-t text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{isAr ? "رصيد الكوتا الرسمي:" : "Provider Balance:"}</span>
                    <Badge variant="outline" className="text-[11px] font-normal py-0">
                      {p.balanceStatus === "AVAILABLE" && p.balanceAmount != null
                        ? `$${p.balanceAmount.toFixed(2)}`
                        : isAr
                          ? "غير متاح عبر API"
                          : "Unavailable via API"}
                    </Badge>
                  </div>

                  <a
                    href={p.billingDashboardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-xs"
                  >
                    <span>{isOpenAI ? "OpenAI Billing" : "Google Cloud Billing"}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Analytics Charts Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">{isAr ? "تحليلات الاستهلاك والتكاليف" : "Usage & Cost Analytics"}</CardTitle>
            <CardDescription className="text-xs">
              {isAr ? "متابعة تطور الطلبات اليومية والتكلفة التقديرية حسب المزود" : "Track daily request volume, estimated cost, and provider breakdown."}
            </CardDescription>
          </div>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            {(["today", "7d", "30d"] as const).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={chartRange === r ? "default" : "ghost"}
                className="h-7 text-xs px-3"
                onClick={() => setChartRange(r)}
              >
                {r === "today" ? (isAr ? "اليوم" : "Today") : r === "7d" ? (isAr ? "7 أيام" : "7 Days") : isAr ? "30 يوماً" : "30 Days"}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {/* Row 1: Calls & Cost */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Calls */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">{isAr ? "عدد الاستدعاءات اليومية" : "Daily Calls"}</h4>
              <div className="h-56 w-full">
                {dailyChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="openaiCalls" name="OpenAI" fill={TEAL} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="geminiCalls" name="Gemini" fill={BLUE} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    {isAr ? "لا توجد بيانات كافية للفترة المحددة" : "No usage data for selected range"}
                  </div>
                )}
              </div>
            </div>

            {/* Daily Cost */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">{isAr ? "التكلفة التقديرية اليومية ($)" : "Daily Estimated Cost ($)"}</h4>
              <div className="h-56 w-full">
                {dailyChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val: any) => `$${Number(val).toFixed(5)}`} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Area type="monotone" dataKey="openaiCost" name="OpenAI ($)" stroke={TEAL} fill={TEAL} fillOpacity={0.2} />
                      <Area type="monotone" dataKey="geminiCost" name="Gemini ($)" stroke={BLUE} fill={BLUE} fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    {isAr ? "لا توجد تكاليف مسجلة للفترة المحددة" : "No cost recorded for selected range"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t pt-4">
            <div className="p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground">{isAr ? "إجمالي الطلبات" : "Total Calls"}</p>
              <p className="text-xl font-bold mt-1">{(summary.totalCalls || 0).toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isAr ? `نسبة النجاح: ${summary.successRate || 100}%` : `Success Rate: ${summary.successRate || 100}%`}
              </p>
            </div>

            <div className="p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground">{isAr ? "التكلفة التقديرية الإجمالية" : "Total Estimated Cost"}</p>
              <p className="text-xl font-bold mt-1 text-emerald-600">${(summary.totalCost || 0).toFixed(4)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                OpenAI: ${(summary.openaiCost || 0).toFixed(4)} | Gemini: ${(summary.geminiCost || 0).toFixed(4)}
              </p>
            </div>

            <div className="p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground">{isAr ? "استخدام المزود البديل (Fallback)" : "Fallback Invocations"}</p>
              <p className="text-xl font-bold mt-1 text-primary">{(summary.fallbackCalls || 0).toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isAr ? `معدل التحويل للبديل: ${summary.fallbackRate || 0}%` : `Fallback Rate: ${summary.fallbackRate || 0}%`}
              </p>
            </div>

            <div className="p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground">{isAr ? "توزيع الطلبات" : "Provider Share"}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-semibold text-emerald-700">OpenAI: {summary.openaiCalls || 0}</span>
                <span className="text-xs text-muted-foreground">|</span>
                <span className="text-xs font-semibold text-blue-700">Gemini: {summary.geminiCalls || 0}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Call Log Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                {isAr ? "سجل استدعاءات الذكاء الاصطناعي (API Call Log)" : "AI API Call Log"}
              </CardTitle>
              <CardDescription className="text-xs">
                {isAr
                  ? "سجل دائم ومحمي من التسريب لجميع طلبات الذكاء الاصطناعي مع تتبع سلاسل التحويل للبديل."
                  : "Persistent, sanitized log of every real AI request with multi-leg fallback chain correlation."}
              </CardDescription>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={providerFilter}
                onChange={(e) => {
                  setProviderFilter(e.target.value);
                  setLogPage(1);
                }}
                className="h-8 text-xs border rounded-md px-2 bg-background"
              >
                <option value="all">{isAr ? "كل المزودين" : "All Providers"}</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>

              <select
                value={featureFilter}
                onChange={(e) => {
                  setFeatureFilter(e.target.value);
                  setLogPage(1);
                }}
                className="h-8 text-xs border rounded-md px-2 bg-background"
              >
                <option value="all">{isAr ? "كل الميزات" : "All Features"}</option>
                <option value="IMAGE_ANALYSIS">IMAGE_ANALYSIS</option>
                <option value="FOOD_SEARCH">FOOD_SEARCH</option>
                <option value="INGREDIENT_ANALYSIS">INGREDIENT_ANALYSIS</option>
                <option value="DISH_ANALYSIS">DISH_ANALYSIS</option>
                <option value="AI_FALLBACK">AI_FALLBACK</option>
                <option value="OTHER">OTHER</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setLogPage(1);
                }}
                className="h-8 text-xs border rounded-md px-2 bg-background"
              >
                <option value="all">{isAr ? "كل الحالات" : "All Status"}</option>
                <option value="SUCCESS">{isAr ? "ناجح (SUCCESS)" : "SUCCESS"}</option>
                <option value="FAILED">{isAr ? "فشل (FAILED)" : "FAILED"}</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-muted/50 border-y text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2.5 px-3">{isAr ? "الوقت" : "Timestamp"}</th>
                  <th className="py-2.5 px-3">{isAr ? "المزود والنموذج" : "Provider & Model"}</th>
                  <th className="py-2.5 px-3">{isAr ? "الميزة" : "Feature"}</th>
                  <th className="py-2.5 px-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="py-2.5 px-3">{isAr ? "الاستجابة" : "Latency"}</th>
                  <th className="py-2.5 px-3">{isAr ? "الرموز (Tokens)" : "Tokens"}</th>
                  <th className="py-2.5 px-3">{isAr ? "التكلفة التقديرية" : "Est. Cost"}</th>
                  <th className="py-2.5 px-3">{isAr ? "السلسلة" : "Chain"}</th>
                  <th className="py-2.5 px-3 text-center">{isAr ? "التفاصيل" : "Details"}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loadingUsage ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      {isAr ? "جارِ تحميل السجل..." : "Loading records..."}
                    </td>
                  </tr>
                ) : usageItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      {isAr ? "لا توجد استدعاءات مطابقة للفلاتر الحالية" : "No API calls matching current filters"}
                    </td>
                  </tr>
                ) : (
                  usageItems.map((item: any) => {
                    const isSuccess = item.requestStatus === "SUCCESS";
                    const isFallback = item.isFallback;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedRecordId(item.id)}
                      >
                        <td className="py-2.5 px-3 text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                          {new Date(item.timestamp).toLocaleString(isAr ? "ar-SA" : "en-US")}
                        </td>

                        <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${item.provider === "openai" ? "bg-emerald-500" : "bg-blue-500"}`} />
                            <span className="capitalize">{item.provider}</span>
                            <span className="text-muted-foreground text-[11px]">({item.model})</span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-[11px] font-mono py-0">
                            {item.feature}
                          </Badge>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              200 OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-[11px]">
                              <XCircle className="h-3.5 w-3.5" />
                              {item.errorCode || "FAILED"}
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-muted-foreground font-mono whitespace-nowrap">
                          {item.latencyMs}ms
                        </td>

                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          {item.tokensAvailable ? (
                            <span>
                              {item.inputTokens + item.outputTokens} <span className="text-[10px]">({item.inputTokens} / {item.outputTokens})</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 text-[11px]">غير متاح</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-mono font-medium text-emerald-700 whitespace-nowrap">
                          ${Number(item.estimatedCost || 0).toFixed(5)}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {isFallback ? (
                            <Badge className="bg-purple-500/15 text-purple-700 border-purple-300 text-[10px] py-0">
                              {isAr ? "بديل ناجح" : "Fallback"}
                            </Badge>
                          ) : item.chainFinalStatus === "SUCCESS" && !isSuccess ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] py-0">
                              {isAr ? "فشل تم تعويضه" : "Recovered"}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/40 text-[10px]">-</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2">
                            {isAr ? "معاينة" : "View"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
            <div>
              {isAr
                ? `عرض ${(pagination.page - 1) * pagination.limit + 1} إلى ${Math.min(pagination.page * pagination.limit, pagination.total)} من إجمالي ${pagination.total} استدعاء`
                : `Showing ${pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1} to ${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} calls`}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={pagination.page <= 1}
                onClick={() => setLogPage((p) => Math.max(1, p - 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="px-2 font-medium">
                {pagination.page} / {pagination.totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setLogPage((p) => p + 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Record Detail Modal / Fallback Chain Timeline */}
      <Dialog open={!!selectedRecordId} onOpenChange={(open) => !open && setSelectedRecordId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-primary" />
              {isAr ? "تفاصيل استدعاء الذكاء الاصطناعي ومسار السلسلة" : "AI Call Details & Fallback Timeline"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isAr ? "فحص آمن لبيانات الطلب، الاستجابة، الرموز، وسلسلة التحويل للبديل (خالٍ تماماً من الأسرار والصور)." : "Sanitized call telemetry, latency, token metrics, and multi-leg fallback sequence."}
            </DialogDescription>
          </DialogHeader>

          {loadingDetail || !detailData ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {isAr ? "جارِ تحميل التفاصيل..." : "Loading call details..."}
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Fallback Chain Timeline if applicable */}
              {detailData.chain?.isChained && (
                <div className="border rounded-lg p-3 bg-purple-500/5 border-purple-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-900 flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-purple-600" />
                      {isAr ? "سلسلة التحويل التلقائي للبديل (Fallback Chain)" : "Multi-Leg Fallback Sequence"}
                    </span>
                    <Badge className="bg-purple-600 text-white text-[10px]">
                      {isAr ? `النتيجة النهائية للمستخدم: ${detailData.record.chainFinalStatus}` : `Final User Outcome: ${detailData.record.chainFinalStatus}`}
                    </Badge>
                  </div>

                  <div className="space-y-2 pt-2">
                    {detailData.chain.attempts.map((attempt: any, idx: number) => {
                      const isAttSuccess = attempt.requestStatus === "SUCCESS";
                      return (
                        <div
                          key={attempt.id}
                          className={`p-2.5 rounded-md border text-xs flex items-start justify-between gap-2 ${
                            isAttSuccess ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <p className="font-semibold flex items-center gap-1.5">
                              <span>
                                {isAr ? `المحاولة ${idx + 1}:` : `Attempt ${idx + 1}:`} {attempt.provider.toUpperCase()} ({attempt.model})
                              </span>
                              <Badge variant={isAttSuccess ? "default" : "destructive"} className="text-[10px] py-0">
                                {isAttSuccess ? "SUCCESS 200" : attempt.errorCode || "FAILED"}
                              </Badge>
                            </p>
                            {attempt.errorMessage && (
                              <p className="text-rose-700 text-[11px] font-mono">{attempt.errorMessage}</p>
                            )}
                            {attempt.fallbackReason && (
                              <p className="text-purple-700 text-[11px]">
                                {isAr ? "سبب التبديل:" : "Trigger:"} {attempt.fallbackReason}
                              </p>
                            )}
                          </div>
                          <div className="text-left text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                            {attempt.latencyMs}ms | ${Number(attempt.estimatedCost).toFixed(5)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Call Overview Grid */}
              <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg border">
                <div>
                  <span className="text-muted-foreground">{isAr ? "معرّف الطلب (Request ID):" : "Request ID:"}</span>
                  <p className="font-mono text-[11px] font-medium mt-0.5 break-all">{detailData.record.requestId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{isAr ? "معرّف السلسلة (Chain ID):" : "Chain ID:"}</span>
                  <p className="font-mono text-[11px] font-medium mt-0.5 break-all">{detailData.record.chainId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{isAr ? "المزود والنموذج:" : "Provider & Model:"}</span>
                  <p className="font-semibold capitalize mt-0.5">
                    {detailData.record.provider} ({detailData.record.model})
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">{isAr ? "الميزة المستخدمة:" : "Feature:"}</span>
                  <p className="font-semibold font-mono mt-0.5">{detailData.record.feature}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{isAr ? "زمن الاستجابة:" : "Latency:"}</span>
                  <p className="font-semibold font-mono mt-0.5">{detailData.record.latencyMs}ms</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{isAr ? "التكلفة التقديرية:" : "Estimated Usage Cost:"}</span>
                  <p className="font-semibold font-mono text-emerald-700 mt-0.5">
                    ${Number(detailData.record.estimatedCost || 0).toFixed(6)}
                  </p>
                </div>
              </div>

              {/* Tokens Breakdown */}
              <div className="border rounded-lg p-3 space-y-2">
                <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  {isAr ? "تفاصيل الرموز المستهلكة (Tokens)" : "Token Usage Breakdown"}
                </span>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 bg-muted/40 rounded">
                    <p className="text-[11px] text-muted-foreground">{isAr ? "رموز الإدخال (Input)" : "Input Tokens"}</p>
                    <p className="text-base font-bold font-mono mt-0.5">{detailData.record.inputTokens}</p>
                  </div>
                  <div className="p-2 bg-muted/40 rounded">
                    <p className="text-[11px] text-muted-foreground">{isAr ? "رموز الإخراج (Output)" : "Output Tokens"}</p>
                    <p className="text-base font-bold font-mono mt-0.5">{detailData.record.outputTokens}</p>
                  </div>
                  <div className="p-2 bg-muted/40 rounded">
                    <p className="text-[11px] text-muted-foreground">{isAr ? "الرموز المؤقتة (Cached)" : "Cached Tokens"}</p>
                    <p className="text-base font-bold font-mono mt-0.5">{detailData.record.cachedTokens}</p>
                  </div>
                </div>
              </div>

              {/* Error Details if Failed */}
              {detailData.record.errorMessage && (
                <div className="border border-red-200 bg-red-50/70 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-700 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{isAr ? "تفاصيل الخطأ المعقمة (Sanitized Error):" : "Sanitized Error Details:"}</span>
                  </div>
                  <p className="font-mono text-[11px] text-rose-900 break-all pt-1">
                    {detailData.record.errorMessage}
                  </p>
                </div>
              )}

              {/* Security confirmation */}
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 bg-muted/30 p-2 rounded border">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  {isAr
                    ? "تم فحص هذا السجل تلقائياً لضمان عدم احتوائه على مفاتيح API، بيانات اعتماد، أو صور مرفوعة."
                    : "Zero-secrets verified: No API keys, passwords, or image blobs are retained in telemetry logs."}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedRecordId(null)}>
              {isAr ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Sliders className="h-5 w-5 text-primary" />
              {isAr ? "إعدادات تنبيهات الميزانية ورصيد الذكاء الاصطناعي" : "AI Alert & Budget Settings"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isAr
                ? "تحديد حدود التحذير والإنفاق الحرج، فترات التهدئة (Cooldown) لمنع الإزعاج، والبريد الإداري المستلم."
                : "Configure budget warning & critical thresholds, cooldown periods, and alert recipient email."}
            </DialogDescription>
          </DialogHeader>

          {settingsData?.settings ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                saveSettingsMut.mutate({
                  enabled: formData.get("enabled") === "on",
                  alertEmail: String(formData.get("alertEmail") || ""),
                  openaiDailySpendWarning: Number(formData.get("openaiDailySpendWarning") || 5),
                  openaiDailySpendCritical: Number(formData.get("openaiDailySpendCritical") || 10),
                  openaiMonthlySpendWarning: Number(formData.get("openaiMonthlySpendWarning") || 50),
                  openaiMonthlySpendCritical: Number(formData.get("openaiMonthlySpendCritical") || 100),
                  geminiDailySpendWarning: Number(formData.get("geminiDailySpendWarning") || 5),
                  geminiDailySpendCritical: Number(formData.get("geminiDailySpendCritical") || 10),
                  geminiMonthlySpendWarning: Number(formData.get("geminiMonthlySpendWarning") || 50),
                  geminiMonthlySpendCritical: Number(formData.get("geminiMonthlySpendCritical") || 100),
                  alertOnQuotaExhaustion: formData.get("alertOnQuotaExhaustion") === "on",
                  alertOnBillingFailure: formData.get("alertOnBillingFailure") === "on",
                  alertOnRepeatedFailures: formData.get("alertOnRepeatedFailures") === "on",
                  consecutiveFailureThreshold: Number(formData.get("consecutiveFailureThreshold") || 3),
                  cooldownMinutes: Number(formData.get("cooldownMinutes") || 60),
                  sendRecoveryEmail: formData.get("sendRecoveryEmail") === "on",
                });
              }}
              className="space-y-4 text-xs"
            >
              {/* Enable Alerts Toggle */}
              <div className="flex items-center justify-between border p-3 rounded-lg bg-muted/20">
                <div>
                  <Label htmlFor="enabled" className="text-xs font-semibold">
                    {isAr ? "تفعيل نظام التنبيهات التلقائي" : "Enable Automated Alert System"}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {isAr ? "إرسال إشعارات فورية عبر البريد عند حدوث أي طارئ" : "Send email alerts on quota errors or budget overruns"}
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="enabled"
                  name="enabled"
                  defaultChecked={settingsData.settings.enabled}
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                />
              </div>

              {/* Recipient Email */}
              <div className="space-y-1.5 border p-3 rounded-lg">
                <Label htmlFor="alertEmail" className="text-xs font-semibold">
                  {isAr ? "البريد الإلكتروني لاستلام التنبيهات الإدارية" : "Admin Alert Recipient Email"}
                </Label>
                <Input
                  id="alertEmail"
                  name="alertEmail"
                  type="email"
                  defaultValue={settingsData.settings.alertEmail || settingsData.resolvedRecipientEmail || ""}
                  placeholder="admin@tayyibati.xyz"
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  {isAr
                    ? `مزود البريد النشط: ${settingsData.emailProviderType}`
                    : `Active Email Provider: ${settingsData.emailProviderType}`}
                </p>
              </div>

              {/* OpenAI Thresholds */}
              <div className="border p-3 rounded-lg space-y-2">
                <h4 className="font-semibold text-xs text-primary flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" />
                  {isAr ? "حدود ميزانية OpenAI (بالدولار $)" : "OpenAI Budget Thresholds (USD)"}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{isAr ? "تحذير يومي ($)" : "Daily Warning ($)"}</Label>
                    <Input
                      name="openaiDailySpendWarning"
                      type="number"
                      step="0.5"
                      defaultValue={settingsData.settings.openaiDailySpendWarning}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{isAr ? "حد حرج يومي ($)" : "Daily Critical ($)"}</Label>
                    <Input
                      name="openaiDailySpendCritical"
                      type="number"
                      step="0.5"
                      defaultValue={settingsData.settings.openaiDailySpendCritical}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{isAr ? "تحذير شهري ($)" : "Monthly Warning ($)"}</Label>
                    <Input
                      name="openaiMonthlySpendWarning"
                      type="number"
                      step="1"
                      defaultValue={settingsData.settings.openaiMonthlySpendWarning}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{isAr ? "حد حرج شهري ($)" : "Monthly Critical ($)"}</Label>
                    <Input
                      name="openaiMonthlySpendCritical"
                      type="number"
                      step="1"
                      defaultValue={settingsData.settings.openaiMonthlySpendCritical}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Gemini Thresholds */}
              <div className="border p-3 rounded-lg space-y-2">
                <h4 className="font-semibold text-xs text-blue-600 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" />
                  {isAr ? "حدود ميزانية Google Gemini (بالدولار $)" : "Gemini Budget Thresholds (USD)"}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{isAr ? "تحذير يومي ($)" : "Daily Warning ($)"}</Label>
                    <Input
                      name="geminiDailySpendWarning"
                      type="number"
                      step="0.5"
                      defaultValue={settingsData.settings.geminiDailySpendWarning}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{isAr ? "حد حرج يومي ($)" : "Daily Critical ($)"}</Label>
                    <Input
                      name="geminiDailySpendCritical"
                      type="number"
                      step="0.5"
                      defaultValue={settingsData.settings.geminiDailySpendCritical}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{isAr ? "تحذير شهري ($)" : "Monthly Warning ($)"}</Label>
                    <Input
                      name="geminiMonthlySpendWarning"
                      type="number"
                      step="1"
                      defaultValue={settingsData.settings.geminiMonthlySpendWarning}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{isAr ? "حد حرج شهري ($)" : "Monthly Critical ($)"}</Label>
                    <Input
                      name="geminiMonthlySpendCritical"
                      type="number"
                      step="1"
                      defaultValue={settingsData.settings.geminiMonthlySpendCritical}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Smart Alert Toggles & Cooldown */}
              <div className="border p-3 rounded-lg space-y-3">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase">{isAr ? "سلوك التنبيهات وفترة التهدئة" : "Alert Rules & Cooldown"}</h4>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="alertOnQuotaExhaustion" className="text-xs">
                      {isAr ? "تنبيه فوري عند نفاد الكوتا (429 / Quota Exhausted)" : "Alert immediately on Quota Exhaustion"}
                    </Label>
                    <input
                      type="checkbox"
                      id="alertOnQuotaExhaustion"
                      name="alertOnQuotaExhaustion"
                      defaultChecked={settingsData.settings.alertOnQuotaExhaustion}
                      className="h-4 w-4"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="alertOnRepeatedFailures" className="text-xs">
                      {isAr ? "تنبيه عند تكرار الفشل المتتالي" : "Alert on repeated consecutive failures"}
                    </Label>
                    <input
                      type="checkbox"
                      id="alertOnRepeatedFailures"
                      name="alertOnRepeatedFailures"
                      defaultChecked={settingsData.settings.alertOnRepeatedFailures}
                      className="h-4 w-4"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="sendRecoveryEmail" className="text-xs">
                      {isAr ? "إرسال بريد تأكيد عند تعافي المزود وعودته للعمل" : "Send recovery email when provider returns to normal"}
                    </Label>
                    <input
                      type="checkbox"
                      id="sendRecoveryEmail"
                      name="sendRecoveryEmail"
                      defaultChecked={settingsData.settings.sendRecoveryEmail}
                      className="h-4 w-4"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{isAr ? "حد مرات الفشل المتتالية:" : "Failure Threshold:"}</Label>
                    <Input
                      name="consecutiveFailureThreshold"
                      type="number"
                      defaultValue={settingsData.settings.consecutiveFailureThreshold}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{isAr ? "فترة التهدئة (دقائق Cooldown):" : "Cooldown (Minutes):"}</Label>
                    <Input
                      name="cooldownMinutes"
                      type="number"
                      defaultValue={settingsData.settings.cooldownMinutes}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Test Email Section */}
              <div className="border border-blue-200 bg-blue-50/50 p-3 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-900 flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-blue-600" />
                    {isAr ? "اختبار وصول التنبيهات (Send Test Email)" : "Test Email Delivery"}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-100"
                    disabled={testEmailMut.isPending}
                    onClick={() => {
                      const email = testEmailAddress.trim() || settingsData.settings.alertEmail || settingsData.resolvedRecipientEmail;
                      if (!email) {
                        toast({
                          title: isAr ? "يرجى إدخال البريد" : "Email Required",
                          description: isAr ? "أدخل عنوان بريد إلكتروني لإرسال الاختبار." : "Enter recipient email.",
                          variant: "destructive",
                        });
                        return;
                      }
                      testEmailMut.mutate(email);
                    }}
                  >
                    <Send className={`h-3 w-3 ${testEmailMut.isPending ? "animate-spin" : ""}`} />
                    <span>{testEmailMut.isPending ? (isAr ? "جارِ الإرسال..." : "Sending...") : isAr ? "إرسال بريد تجريبي" : "Send Test Email"}</span>
                  </Button>
                </div>
                <Input
                  type="email"
                  placeholder={settingsData.settings.alertEmail || settingsData.resolvedRecipientEmail || "admin@tayyibati.xyz"}
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  className="h-7 text-xs bg-white"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSettingsOpen(false)}>
                  {isAr ? "إلغاء" : "Cancel"}
                </Button>
                <Button type="submit" size="sm" disabled={saveSettingsMut.isPending}>
                  {saveSettingsMut.isPending ? (isAr ? "جارِ الحفظ..." : "Saving...") : isAr ? "حفظ الإعدادات" : "Save Settings"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {isAr ? "جارِ تحميل الإعدادات..." : "Loading settings..."}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
