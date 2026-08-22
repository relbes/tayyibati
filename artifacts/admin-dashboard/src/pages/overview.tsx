import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminFetch, API_BASE } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import {
  Users,
  UserCheck,
  UserPlus,
  Activity,
  Search,
  Database,
  Utensils,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Bot,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Camera,
  Tag,
  Clock,
  Zap,
  Flame,
  AlertTriangle,
} from "lucide-react";
import { useLang } from "@/contexts/LangContext";

const TEAL = "hsl(162, 64%, 29%)";
const GOLD = "hsl(43, 53%, 54%)";
const RED = "hsl(0, 67%, 55%)";
const GREEN = "hsl(145, 45%, 49%)";
const BLUE = "hsl(208, 40%, 54%)";
const PURPLE = "hsl(270, 50%, 55%)";
const INDIGO = "hsl(230, 60%, 58%)";

export interface DashboardData {
  summary: {
    totalUsers: number;
    newUsers: number;
    premiumUsers: number;
    totalAnalyses: number;
    analysesToday: number;
    averageScore: number;
    totalFoods: number;
    totalDishes: number;
  };
  userAnalytics: {
    dailyRegistrations: Array<{ date: string; count: number }>;
    freeVsPremium: { free: number; premium: number };
    planDistribution: Array<{ planName: string; userCount: number }>;
  };
  analysisAnalytics: {
    dailyAnalyses: Array<{ date: string; total: number; text: number; image: number; label: number }>;
    typeDistribution: { text: number; image: number; label: number };
    scoreDistribution: Array<{ range: string; count: number }>;
  };
  popularSearches: Array<{ query: string; count: number }>;
  knowledge: {
    pendingReviews: number;
    approvedReviews: number;
    rejectedReviews: number;
    mergedReviews: number;
    cacheEntries: number;
    cacheHits: number;
    avgConfidence: number;
  };
  foodStats: {
    total: number;
    allowed: number;
    forbidden: number;
    conditional: number;
    categories: number;
  };
  recentActivity: Array<{
    id: number;
    userId: string;
    userEmail: string;
    query: string;
    analysisType: string;
    compatibilityScore: number;
    createdAt: string;
  }>;
}

async function fetchDashboardData(range: string): Promise<DashboardData> {
  const res = await adminFetch(`${API_BASE}/api/admin/dashboard?range=${range}`);
  if (!res.ok) {
    throw new Error("Failed to load dashboard data");
  }
  return res.json();
}

function KpiCard({
  title,
  value,
  icon: Icon,
  color,
  sub,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
  trend?: string;
}) {
  return (
    <Card className="hover:shadow-md transition-all duration-200 border-border/80">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            {trend && <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">{trend}</p>}
          </div>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 shadow-sm"
            style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}
          >
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KpiCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Overview() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("7d");
  const { lang } = useLang();
  const isAr = lang === "ar";
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["adminDashboard", range],
    queryFn: () => fetchDashboardData(range),
  });

  const handleRefresh = () => {
    refetch();
  };

  if (isError) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-lg font-bold">
            {isAr ? "تعذّر تحميل بيانات لوحة التحكم" : "Failed to load dashboard data"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isAr ? "يرجى التحقق من الاتصال بالخادم ثم إعادة المحاولة." : "Please check your network connection and try again."}
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {isAr ? "إعادة المحاولة" : "Retry"}
        </Button>
      </div>
    );
  }

  const { summary, userAnalytics, analysisAnalytics, popularSearches, knowledge, foodStats, recentActivity } = data || {};

  const subPieData = userAnalytics
    ? [
        { name: isAr ? "مجاني" : "Free", value: userAnalytics.freeVsPremium.free, color: BLUE },
        { name: isAr ? "مميز (Premium)" : "Premium", value: userAnalytics.freeVsPremium.premium, color: GOLD },
      ]
    : [];

  const foodPieData = foodStats
    ? [
        { name: isAr ? "مسموح" : "Allowed", value: foodStats.allowed, color: GREEN },
        { name: isAr ? "ممنوع" : "Forbidden", value: foodStats.forbidden, color: RED },
        { name: isAr ? "مشروط" : "Conditional", value: foodStats.conditional, color: GOLD },
      ]
    : [];

  return (
    <div className="p-6 space-y-8" dir={isAr ? "rtl" : "ltr"}>
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {isAr ? "لوحة التحكم V2" : "Admin Dashboard V2"}
            </h1>
            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
              Live
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {isAr
              ? "مراقبة متقدمة وإحصائيات فورية لنظام طيباتي بالبيانات الفعلية"
              : "Real-time monitoring, usage analytics & system health overview"}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Range Selector */}
          <div className="flex items-center rounded-xl bg-muted p-1 border border-border/60">
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  range === r
                    ? "bg-background text-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === "7d" ? (isAr ? "7 أيام" : "7 Days") : r === "30d" ? (isAr ? "30 يوماً" : "30 Days") : (isAr ? "90 يوماً" : "90 Days")}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={isRefetching || isLoading}
            className="gap-2 rounded-xl"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin text-primary" : ""}`} />
            <span className="hidden sm:inline">{isAr ? "تحديث" : "Refresh"}</span>
          </Button>
        </div>
      </div>

      {/* SECTION 1 — KPI CARDS GRID */}
      <div>
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
          {isAr ? "مؤشرات الأداء الرئيسية (KPIs)" : "Key Performance Indicators"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <KpiCardSkeleton key={i} />)
          ) : (
            <>
              <KpiCard
                title={isAr ? "إجمالي المستخدمين" : "Total Users"}
                value={summary?.totalUsers ?? 0}
                icon={Users}
                color={TEAL}
                sub={`${isAr ? "جدد في النطاق" : "New in window"}: +${summary?.newUsers ?? 0}`}
              />
              <KpiCard
                title={isAr ? "إجمالي التحليلات" : "Total Analyses"}
                value={summary?.totalAnalyses ?? 0}
                icon={Activity}
                color={BLUE}
                sub={`${isAr ? "تحليلات اليوم" : "Today's searches"}: ${summary?.analysesToday ?? 0}`}
              />
              <KpiCard
                title={isAr ? "المشتركون المميزون" : "Premium Users"}
                value={summary?.premiumUsers ?? 0}
                icon={UserCheck}
                color={GOLD}
                sub={`${summary?.totalUsers ? Math.round(((summary.premiumUsers || 0) / summary.totalUsers) * 100) : 0}% ${isAr ? "من القاعدة" : "of user base"}`}
              />
              <KpiCard
                title={isAr ? "متوسط التوافق" : "Average Score"}
                value={`${summary?.averageScore ?? 0}%`}
                icon={TrendingUp}
                color={GREEN}
                sub={isAr ? "متوسط درجة ملائمة الأغذية" : "Compatibility score avg"}
              />
              <KpiCard
                title={isAr ? "الأغذية المسجلة" : "Total Foods"}
                value={summary?.totalFoods ?? 0}
                icon={Database}
                color={INDIGO}
                sub={`${foodStats?.categories ?? 0} ${isAr ? "فئات معرفية" : "food categories"}`}
              />
              <KpiCard
                title={isAr ? "الأطباق والوجبات" : "Total Dishes"}
                value={summary?.totalDishes ?? 0}
                icon={Utensils}
                color={PURPLE}
                sub={isAr ? "وجبات جاهزة في النظام" : "Prepared dishes in system"}
              />
              <KpiCard
                title={isAr ? "بحث اليوم" : "Analyses Today"}
                value={summary?.analysesToday ?? 0}
                icon={Search}
                color={BLUE}
                sub={isAr ? "عمليات بحث تم تنفذها اليوم" : "Searches executed today"}
              />
              <KpiCard
                title={isAr ? "المستخدمون الجدد" : "New Registrations"}
                value={summary?.newUsers ?? 0}
                icon={UserPlus}
                color={TEAL}
                sub={isAr ? `خلال الفترة (${range})` : `In selected ${range}`}
              />
            </>
          )}
        </div>
      </div>

      {/* SECTION 2 — USER GROWTH & SUBSCRIPTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Growth Line Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-teal-600" />
              {isAr ? "نمو وتسجيلات المستخدمين" : "User Registrations Trend"}
            </CardTitle>
            <CardDescription>
              {isAr ? `معدل تسجيل الحسابات الجديدة خلال (${range})` : `New user signups over the last ${range}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={userAnalytics?.dailyRegistrations ?? []}>
                  <defs>
                    <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={TEAL} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={TEAL} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="count" stroke={TEAL} strokeWidth={2} fillOpacity={1} fill="url(#userGrad)" name={isAr ? "المستخدمون" : "Users"} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Subscription Distribution Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-amber-500" />
              {isAr ? "توزيع اشتراكات المستخدمين" : "Subscription Distribution"}
            </CardTitle>
            <CardDescription>
              {isAr ? "نسبة الحسابات المجانية إلى المميزة" : "Free vs Premium account ratio"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={subPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {subPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="w-full space-y-2.5 mt-2">
                  {subPieData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="font-medium">{d.name}</span>
                      </div>
                      <span className="font-bold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SECTION 3 — ANALYSIS ACTIVITY */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            {isAr ? "نشاط التحليلات المباشر والأنواع" : "Daily Analysis Activity by Type"}
          </CardTitle>
          <CardDescription>
            {isAr ? `توزيع عمليات البحث والتحليل اليومية خلال فترة (${range})` : `Volume of daily searches split by input format over ${range}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analysisAnalytics?.dailyAnalyses ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="text" stackId="a" fill={TEAL} radius={[0, 0, 0, 0]} name={isAr ? "بحث نصي" : "Text Search"} />
                <Bar dataKey="image" stackId="a" fill={BLUE} radius={[0, 0, 0, 0]} name={isAr ? "تحليل صورة" : "Image Analysis"} />
                <Bar dataKey="label" stackId="a" fill={GOLD} radius={[4, 4, 0, 0]} name={isAr ? "قراءة ملصق" : "Label / OCR"} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* SECTION 4 & 5 GRID: COMPATIBILITY SCORE & POPULAR SEARCHES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 4 — Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              {isAr ? "توزيع درجات الملائمة والتوافق" : "Compatibility Score Distribution"}
            </CardTitle>
            <CardDescription>
              {isAr ? "تصنيف نتائج التحليل حسب نطاقات نسبة الملائمة والصحة" : "Frequency of search result scores in 20% bucket intervals"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={analysisAnalytics?.scoreDistribution ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill={GREEN} radius={[6, 6, 0, 0]} name={isAr ? "عدد التحليلات" : "Count"} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Section 5 — Popular Searches Top 10 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-500" />
              {isAr ? "أكثر الاستعلامات بحثاً (Top 10)" : "Most Popular Search Queries"}
            </CardTitle>
            <CardDescription>
              {isAr ? "أكثر الكلمات والأطعمة طلباً من مستخدمي المنصة" : "Top 10 searched food & dish keywords"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto pe-1">
                {popularSearches && popularSearches.length > 0 ? (
                  popularSearches.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-sm">{item.query}</span>
                      </div>
                      <Badge variant="outline" className="font-mono bg-background">
                        {item.count} {isAr ? "مرة" : "searches"}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {isAr ? "لا تتوفر استعلامات بحث حتى الآن" : "No popular searches recorded yet."}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SECTION 6 & 7 GRID: KNOWLEDGE / AI & FOOD DATABASE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 6 — Knowledge Review & AI Intelligence */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Bot className="h-4 w-4 text-purple-600" />
              {isAr ? "حالة المعرفة والذكاء الاصطناعي" : "Knowledge Review & AI Intelligence"}
            </CardTitle>
            <CardDescription>
              {isAr ? "متابعة مراجعات المكونات المعلقة والذاكرة المخبئية" : "Pending knowledge audits & AI cache metrics"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1">
                  <Sparkles className="h-5 w-5 text-amber-500 mx-auto" />
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{knowledge?.pendingReviews ?? 0}</p>
                  <p className="text-xs text-muted-foreground font-medium">{isAr ? "مراجعات معلقة" : "Pending Audit"}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                  <CheckCircle className="h-5 w-5 text-emerald-500 mx-auto" />
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{knowledge?.approvedReviews ?? 0}</p>
                  <p className="text-xs text-muted-foreground font-medium">{isAr ? "تم اعتمادها" : "Approved"}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center space-y-1">
                  <Zap className="h-5 w-5 text-purple-500 mx-auto" />
                  <p className="text-xl font-bold text-purple-700 dark:text-purple-400">{knowledge?.cacheEntries ?? 0}</p>
                  <p className="text-xs text-muted-foreground font-medium">{isAr ? "سجلات المخبأ" : "AI Cache Entries"}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center space-y-1">
                  <Activity className="h-5 w-5 text-blue-500 mx-auto" />
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{knowledge?.cacheHits ?? 0}</p>
                  <p className="text-xs text-muted-foreground font-medium">{isAr ? "مرات استخدام المخبأ" : "Cache Hits"}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-center space-y-1">
                  <Bot className="h-5 w-5 text-teal-500 mx-auto" />
                  <p className="text-xl font-bold text-teal-700 dark:text-teal-400">{knowledge?.avgConfidence ?? 0}%</p>
                  <p className="text-xs text-muted-foreground font-medium">{isAr ? "متوسط الثقة" : "AI Confidence"}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-center space-y-1">
                  <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                  <p className="text-xl font-bold text-red-700 dark:text-red-400">{knowledge?.rejectedReviews ?? 0}</p>
                  <p className="text-xs text-muted-foreground font-medium">{isAr ? "مرفوضة" : "Rejected"}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 7 — Food Database Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-600" />
              {isAr ? "حالات قاعدة بيانات الأغذية" : "Food Database Breakdown"}
            </CardTitle>
            <CardDescription>
              {isAr ? "نسب الأطعمة المسموحة والممنوعة والمشروطة" : "Allowed, forbidden & conditional distribution"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{isAr ? "إجمالي الأصناف المسجلة" : "Total Food Items"}</span>
                  <span className="text-2xl font-bold text-indigo-600">{foodStats?.total ?? 0}</span>
                </div>

                {/* Status Progress Bar */}
                <div className="h-4 w-full rounded-full bg-muted overflow-hidden flex shadow-inner">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${foodStats?.total ? ((foodStats.allowed / foodStats.total) * 100).toFixed(1) : 0}%` }}
                    title={`Allowed: ${foodStats?.allowed}`}
                  />
                  <div
                    className="h-full bg-red-500 transition-all"
                    style={{ width: `${foodStats?.total ? ((foodStats.forbidden / foodStats.total) * 100).toFixed(1) : 0}%` }}
                    title={`Forbidden: ${foodStats?.forbidden}`}
                  />
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{ width: `${foodStats?.total ? ((foodStats.conditional / foodStats.total) * 100).toFixed(1) : 0}%` }}
                    title={`Conditional: ${foodStats?.conditional}`}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-emerald-500/10">
                    <p className="text-xs text-muted-foreground font-semibold">{isAr ? "مسموح" : "Allowed"}</p>
                    <p className="text-lg font-bold text-emerald-600">{foodStats?.allowed ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-red-500/10">
                    <p className="text-xs text-muted-foreground font-semibold">{isAr ? "ممنوع" : "Forbidden"}</p>
                    <p className="text-lg font-bold text-red-600">{foodStats?.forbidden ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/10">
                    <p className="text-xs text-muted-foreground font-semibold">{isAr ? "مشروط" : "Conditional"}</p>
                    <p className="text-lg font-bold text-amber-600">{foodStats?.conditional ?? 0}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SECTION 8 — RECENT ACTIVITY TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Clock className="h-4 w-4 text-teal-600" />
            {isAr ? "آخر عمليات التحليل والبحث المباشرة" : "Recent Activity Feed"}
          </CardTitle>
          <CardDescription>
            {isAr ? "سجل بأحدث 15 عملية تحليل جرت عبر التطبيق" : "Latest 15 user search and evaluation requests"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="py-3 px-3 text-start font-semibold">{isAr ? "المستخدم" : "User"}</th>
                    <th className="py-3 px-3 text-start font-semibold">{isAr ? "نص الاستعلام" : "Query"}</th>
                    <th className="py-3 px-3 text-start font-semibold">{isAr ? "النوع" : "Type"}</th>
                    <th className="py-3 px-3 text-start font-semibold">{isAr ? "الدرجة" : "Score"}</th>
                    <th className="py-3 px-3 text-start font-semibold">{isAr ? "التاريخ والوقت" : "Timestamp"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {recentActivity && recentActivity.length > 0 ? (
                    recentActivity.map((act) => (
                      <tr key={act.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-3 font-medium text-xs max-w-[180px] truncate" title={act.userEmail}>
                          {act.userEmail}
                        </td>
                        <td className="py-3 px-3 font-semibold text-sm">{act.query}</td>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className="capitalize text-xs font-normal">
                            {act.analysisType === "text" ? (
                              <span className="flex items-center gap-1 text-teal-600"><FileText className="h-3 w-3" /> {isAr ? "نص" : "Text"}</span>
                            ) : act.analysisType === "image" ? (
                              <span className="flex items-center gap-1 text-blue-600"><Camera className="h-3 w-3" /> {isAr ? "صورة" : "Image"}</span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-600"><Tag className="h-3 w-3" /> {isAr ? "ملصق" : "Label"}</span>
                            )}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            className={
                              act.compatibilityScore >= 70
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                                : act.compatibilityScore >= 40
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                                : "bg-red-500/15 text-red-700 dark:text-red-400 hover:bg-red-500/20"
                            }
                          >
                            {act.compatibilityScore}%
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                          {act.createdAt ? new Date(act.createdAt).toLocaleString(isAr ? "ar-SA" : "en-US", { dateStyle: "short", timeStyle: "short" }) : "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                        {isAr ? "لا تتوفر أنشطة سابقة حتى الآن" : "No recent activity recorded."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
