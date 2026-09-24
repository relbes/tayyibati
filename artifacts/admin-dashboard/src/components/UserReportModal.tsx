import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchUserReport,
  fetchUserSearches,
  type UserReportResponse,
  type RecentSearchItem,
} from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  BarChart3,
  Calendar,
  Clock,
  Search,
  Camera,
  Tag,
  Star,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Languages,
  RotateCcw,
  Sparkles,
  CreditCard,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserReportModalProps {
  userId: string | null;
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
  defaultLang?: "ar" | "en";
}

export function UserReportModal({
  userId,
  userName,
  isOpen,
  onClose,
  defaultLang = "ar",
}: UserReportModalProps) {
  // Report-scoped language and direction toggle.
  // Changes ONLY this modal's language and direction without touching global dashboard language.
  const [reportLang, setReportLang] = useState<"ar" | "en">(defaultLang);
  const [searchesPage, setSearchesPage] = useState<number>(1);
  const isRtl = reportLang === "ar";

  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["user-report", userId],
    queryFn: () => (userId ? fetchUserReport(userId) : Promise.reject("No userId")),
    enabled: isOpen && !!userId,
    staleTime: 30_000,
  });

  const {
    data: searchesData,
    isLoading: isLoadingSearches,
  } = useQuery({
    queryKey: ["user-searches", userId, searchesPage],
    queryFn: () => (userId ? fetchUserSearches(userId, { page: searchesPage, pageSize: 8 }) : Promise.reject("No userId")),
    enabled: isOpen && !!userId,
    staleTime: 30_000,
  });

  if (!isOpen) return null;

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return isRtl ? "غير متوفر" : "N/A";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(isRtl ? "ar-SA" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const formatShortDate = (isoString?: string | null) => {
    if (!isoString) return isRtl ? "غير متوفر" : "N/A";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(isRtl ? "ar-SA" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 border-border/80 shadow-2xl transition-all",
          isRtl ? "font-sans" : "font-sans"
        )}
        dir={isRtl ? "rtl" : "ltr"}
        style={{ direction: isRtl ? "rtl" : "ltr", textAlign: isRtl ? "right" : "left" }}
      >
        {/* Modal Top Header with Report-scoped RTL/LTR Toggle */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-muted/20 border-b p-5 sm:p-6 sticky top-0 z-10 backdrop-blur bg-background/95">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0 shadow-sm">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <span>{isRtl ? "تقرير نشاط واشتراك المستخدم" : "User Activity & Subscription Report"}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {isRtl
                    ? `إحصائيات كاملة وسجل زمني للمستخدم ${userName ? `(${userName})` : ""}`
                    : `Comprehensive statistics and activity audit for ${userName ? `(${userName})` : "user"}`}
                </DialogDescription>
              </div>
            </div>

            {/* RTL / LTR Direction Toggle Buttons */}
            <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-lg border border-border/60 shrink-0">
              <Languages className="h-3.5 w-3.5 text-muted-foreground mx-1" />
              <button
                type="button"
                onClick={() => setReportLang("ar")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                  isRtl
                    ? "bg-background text-primary shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                العربية (RTL)
              </button>
              <button
                type="button"
                onClick={() => setReportLang("en")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                  !isRtl
                    ? "bg-background text-primary shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                English (LTR)
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {isLoading && (
            <div className="space-y-4 py-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
              <Skeleton className="h-36 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          )}

          {isError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
              <h3 className="text-base font-semibold text-destructive">
                {isRtl ? "تعذر تحميل تقرير المستخدم" : "Failed to load user report"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {error instanceof Error ? error.message : String(error)}
              </p>
              <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-2">
                <RotateCcw className="h-3.5 w-3.5" />
                {isRtl ? "إعادة المحاولة" : "Try Again"}
              </Button>
            </div>
          )}

          {report && (
            <>
              {/* SECTION 1: User Profile Header Card */}
              <div className="rounded-xl border bg-card/60 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary font-bold text-lg flex items-center justify-center shrink-0 border border-primary/20">
                    {report.user.name?.charAt(0).toUpperCase() || report.user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-foreground">{report.user.name}</h2>
                      {report.user.isPremium ? (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 gap-1 text-xs">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                          {isRtl ? "مشترك مميز" : "Premium Member"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {isRtl ? "حساب مجاني" : "Free Plan"}
                        </Badge>
                      )}
                      {report.user.isLocked && (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <ShieldAlert className="h-3 w-3" />
                          {isRtl ? "محجوب" : "Locked"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{report.user.email}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {isRtl ? "تاريخ الانضمام: " : "Joined: "}
                      <span className="font-medium text-foreground">{formatShortDate(report.user.createdAt)}</span>
                      {" · "}
                      {isRtl ? "طريقة التسجيل: " : "Provider: "}
                      <span className="font-medium capitalize text-foreground">{report.user.provider}</span>
                    </p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground border-t sm:border-t-0 sm:border-r sm:rtl:border-r-0 sm:rtl:border-l pt-2 sm:pt-0 sm:px-4 sm:rtl:px-4 space-y-1">
                  <div>
                    <span className="text-muted-foreground">{isRtl ? "معرف المستخدم:" : "User ID:"} </span>
                    <span className="font-mono text-[11px] text-foreground font-semibold">{report.user.id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{isRtl ? "آخر نشاط:" : "Last Active:"} </span>
                    <span className="font-medium text-foreground">{formatDate(report.activity.lastActiveAt)}</span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: User Activity Summary Stats (Stat Cards) */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>{isRtl ? "ملخص النشاط والاستخدام" : "Activity Summary"}</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* Total Searches */}
                  <div className="rounded-xl border bg-card p-3 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-xs">{isRtl ? "إجمالي البحث" : "Total Searches"}</span>
                      <Search className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="text-xl font-extrabold text-foreground">{report.activity.totalSearches}</div>
                    <div className="text-[11px] text-muted-foreground">{isRtl ? "كل العمليات" : "All searches"}</div>
                  </div>

                  {/* Food Searches */}
                  <div className="rounded-xl border bg-card p-3 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-xs">{isRtl ? "البحث الغذائي" : "Food Searches"}</span>
                      <FileText className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                      {report.activity.foodSearches}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{isRtl ? "استعلامات نصية" : "Text queries"}</div>
                  </div>

                  {/* Image Analyses */}
                  <div className="rounded-xl border bg-card p-3 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-xs">{isRtl ? "فحص الصور" : "Image Analyses"}</span>
                      <Camera className="h-3.5 w-3.5 text-cyan-500" />
                    </div>
                    <div className="text-xl font-extrabold text-cyan-600 dark:text-cyan-400">
                      {report.activity.imageAnalyses}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{isRtl ? "صور المنتجات" : "Product images"}</div>
                  </div>

                  {/* Ingredient Analyses */}
                  <div className="rounded-xl border bg-card p-3 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-xs">{isRtl ? "فحص الملصقات" : "Ingredient Analyses"}</span>
                      <Tag className="h-3.5 w-3.5 text-purple-500" />
                    </div>
                    <div className="text-xl font-extrabold text-purple-600 dark:text-purple-400">
                      {report.activity.ingredientAnalyses}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{isRtl ? "ملصقات المكونات" : "Label scans"}</div>
                  </div>

                  {/* Logins */}
                  <div className="rounded-xl border bg-card p-3 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-xs">{isRtl ? "تسجيل الدخول" : "Logins"}</span>
                      <Key className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
                      {report.activity.logins != null ? report.activity.logins : (isRtl ? "غير متوفر" : "N/A")}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{isRtl ? "جلسات موثقة" : "Recorded sessions"}</div>
                  </div>

                  {/* Total Activity Events */}
                  <div className="rounded-xl border bg-card p-3 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-xs">{isRtl ? "سجل الأحداث" : "Total Events"}</span>
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                    </div>
                    <div className="text-xl font-extrabold text-foreground">{report.activity.totalEvents}</div>
                    <div className="text-[11px] text-muted-foreground">{isRtl ? "أحداث التدقيق" : "Audit events"}</div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Search Type Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary" />
                  <span>{isRtl ? "تفصيل أنواع البحث والتحليل" : "Search Type Breakdown"}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {report.searchBreakdown.map((item) => {
                    const iconMap = {
                      food: FileText,
                      image: Camera,
                      label: Tag,
                    };
                    const Icon = iconMap[item.type] || Search;
                    const percent =
                      report.activity.totalSearches > 0
                        ? Math.round((item.count / report.activity.totalSearches) * 100)
                        : 0;

                    return (
                      <div
                        key={item.type}
                        className="rounded-xl border bg-card p-4 space-y-2 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-foreground">
                                {isRtl ? item.labelAr : item.label}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {isRtl ? `${percent}% من العمليات` : `${percent}% of searches`}
                              </div>
                            </div>
                          </div>
                          <span className="text-lg font-extrabold text-foreground">{item.count}</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="text-[11px] text-muted-foreground pt-1 flex items-center justify-between">
                          <span>{isRtl ? "آخر عملية:" : "Last:"}</span>
                          <span className="font-medium text-foreground">{formatDate(item.lastAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 4: Subscription Summary & Dates */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  <span>{isRtl ? "ملخص وتواريخ الاشتراك" : "Subscription Summary & Dates"}</span>
                </h3>

                <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Current Plan */}
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">{isRtl ? "الخطة الحالية" : "Current Plan"}</div>
                      <div className="text-sm font-bold text-foreground">
                        {isRtl ? report.subscription.planName : report.subscription.planNameEn}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {report.subscription.dailyLimit === -1
                          ? (isRtl ? "استخدام غير محدود" : "Unlimited usage")
                          : (isRtl ? `${report.subscription.dailyLimit} طلب / شهر` : `${report.subscription.dailyLimit} req/mo`)}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">{isRtl ? "حالة الاشتراك" : "Subscription Status"}</div>
                      <div>
                        {report.subscription.status === "ACTIVE" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 gap-1 text-xs">
                            <CheckCircle2 className="h-3 w-3" />
                            {isRtl ? "اشتراك نشط" : "Active Subscription"}
                          </Badge>
                        ) : report.subscription.status === "EXPIRED" ? (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <XCircle className="h-3 w-3" />
                            {isRtl ? "منتهي الصلاحية" : "Expired"}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {isRtl ? "لا يوجد اشتراك نشط (مجاني)" : "No active subscription (Free)"}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {report.subscription.autoRenew
                          ? (isRtl ? "تجديد تلقائي مفعل" : "Auto-renew active")
                          : (isRtl ? "بدون تجديد تلقائي" : "No auto-renew")}
                      </div>
                    </div>

                    {/* Source */}
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">{isRtl ? "مصدر الاشتراك" : "Subscription Source"}</div>
                      <div className="text-sm font-semibold flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-primary" />
                        <span>
                          {report.subscription.source === "Admin Grant"
                            ? (isRtl ? "منحة إدارية" : "Admin Grant")
                            : report.subscription.source === "Google Play"
                            ? "Google Play"
                            : report.subscription.source === "None"
                            ? (isRtl ? "لا يوجد" : "None")
                            : report.subscription.source}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {report.subscription.source === "Admin Grant"
                          ? (isRtl ? "ممنوح عبر لوحة التحكم" : "Granted by administrator")
                          : report.subscription.source === "Google Play"
                          ? (isRtl ? "شراء عبر المتجر" : "In-App Billing")
                          : (isRtl ? "حساب افتراضي" : "Standard account")}
                      </div>
                    </div>

                    {/* Days Remaining / Expiration */}
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {isRtl ? "الأيام المتبقية وتاريخ الانتهاء" : "Days Remaining & Expiration"}
                      </div>
                      <div className="text-sm font-bold text-foreground">
                        {report.subscription.daysRemaining != null ? (
                          <span
                            className={cn(
                              report.subscription.daysRemaining > 7
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-amber-600 dark:text-amber-400"
                            )}
                          >
                            {isRtl
                              ? `${report.subscription.daysRemaining} يوم متبقي`
                              : `${report.subscription.daysRemaining} days left`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{isRtl ? "غير متوفر" : "N/A"}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {isRtl ? "ينتهي: " : "Expires: "}
                        {report.subscription.expirationDate
                          ? formatShortDate(report.subscription.expirationDate)
                          : (isRtl ? "غير محدد" : "None")}
                      </div>
                    </div>
                  </div>

                  {/* Dates Row */}
                  <div className="pt-3 border-t text-xs flex flex-wrap items-center justify-between gap-3 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{isRtl ? "تاريخ البدء:" : "Start Date:"} </span>
                      <span className="font-medium text-foreground">{formatDate(report.subscription.startDate)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{isRtl ? "تاريخ الانتهاء:" : "Expiration Date:"} </span>
                      <span className="font-medium text-foreground">{formatDate(report.subscription.expirationDate)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{isRtl ? "حد البحث الشهري:" : "Monthly Limit:"} </span>
                      <span className="font-medium text-foreground">
                        {report.subscription.dailyLimit === -1
                          ? (isRtl ? "غير محدود" : "Unlimited")
                          : report.subscription.dailyLimit}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 5: Subscription History (Admin Grant vs Google Play clearly shown) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <span>{isRtl ? "سجل الاشتراكات والتغييرات" : "Subscription History"}</span>
                  </h3>
                  <span className="text-xs text-muted-foreground font-mono">
                    {report.subscriptionHistory.length} {isRtl ? "سجلات" : "records"}
                  </span>
                </div>

                {report.subscriptionHistory.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">
                    {isRtl
                      ? "لا توجد سجلات اشتراك سابقة لهذا المستخدم."
                      : "No past subscription records recorded for this user."}
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="text-xs">{isRtl ? "الحدث" : "Event"}</TableHead>
                          <TableHead className="text-xs">{isRtl ? "المصدر" : "Source"}</TableHead>
                          <TableHead className="text-xs">{isRtl ? "الحالة" : "Status"}</TableHead>
                          <TableHead className="text-xs">{isRtl ? "المنفذ" : "Actor"}</TableHead>
                          <TableHead className="text-xs">{isRtl ? "التاريخ" : "Date"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.subscriptionHistory.map((sub) => (
                          <TableRow key={sub.id}>
                            <TableCell>
                              <div className="font-semibold text-xs text-foreground">{sub.eventName}</div>
                              {sub.description && (
                                <div className="text-[11px] text-muted-foreground">{sub.description}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={sub.source === "Admin Grant" ? "outline" : "default"}
                                className={cn(
                                  "text-[11px] font-medium",
                                  sub.source === "Admin Grant"
                                    ? "border-blue-300 text-blue-700 dark:text-blue-400 bg-blue-500/10"
                                    : "bg-emerald-600 text-white"
                                )}
                              >
                                {sub.source === "Admin Grant" ? (isRtl ? "منحة إدارية" : "Admin Grant") : sub.source}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "text-xs font-medium",
                                  sub.status === "Active"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-muted-foreground"
                                )}
                              >
                                {sub.status === "Active"
                                  ? (isRtl ? "نشط" : "Active")
                                  : (isRtl ? "منتهي" : "Expired")}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{sub.actorName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {formatDate(sub.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* SECTION 6: Recent Searches Table with Pagination */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    <span>{isRtl ? "سجل عمليات البحث الأخيرة" : "Recent Searches"}</span>
                  </h3>
                  {searchesData?.pagination && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {isRtl
                          ? `صفحة ${searchesData.pagination.page} من ${searchesData.pagination.totalPages}`
                          : `Page ${searchesData.pagination.page} of ${searchesData.pagination.totalPages}`}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        disabled={searchesData.pagination.page <= 1 || isLoadingSearches}
                        onClick={() => setSearchesPage((p) => Math.max(1, p - 1))}
                      >
                        {isRtl ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        disabled={
                          searchesData.pagination.page >= searchesData.pagination.totalPages ||
                          isLoadingSearches
                        }
                        onClick={() => setSearchesPage((p) => p + 1)}
                      >
                        {isRtl ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  )}
                </div>

                {isLoadingSearches ? (
                  <Skeleton className="h-32 w-full rounded-xl" />
                ) : !searchesData || searchesData.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                    {isRtl ? "لا توجد عمليات بحث مسجلة لهذا المستخدم." : "No searches found for this user."}
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="text-xs">{isRtl ? "نص البحث" : "Query"}</TableHead>
                          <TableHead className="text-xs">{isRtl ? "نوع التحليل" : "Type"}</TableHead>
                          <TableHead className="text-xs">{isRtl ? "درجة التوافق" : "Score"}</TableHead>
                          <TableHead className="text-xs">{isRtl ? "التاريخ" : "Date"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchesData.items.map((search) => (
                          <TableRow key={search.id}>
                            <TableCell className="font-medium text-xs text-foreground max-w-xs truncate">
                              {search.query}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[11px] capitalize">
                                {search.analysisType === "text"
                                  ? (isRtl ? "بحث نصي" : "Text Search")
                                  : search.analysisType === "image"
                                  ? (isRtl ? "صورة" : "Image Scan")
                                  : search.analysisType === "label"
                                  ? (isRtl ? "ملصق" : "Label")
                                  : search.analysisType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {search.compatibilityScore != null ? (
                                <span
                                  className={cn(
                                    "font-semibold text-xs",
                                    search.compatibilityScore >= 70
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : search.compatibilityScore >= 40
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  )}
                                >
                                  {search.compatibilityScore}%
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {formatDate(search.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* SECTION 7: Recent Activity Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{isRtl ? "الجدول الزمني للنشاط الأخير" : "Recent Activity Timeline"}</span>
                  </h3>
                  <span className="text-xs text-muted-foreground font-mono">
                    {report.timeline.length} {isRtl ? "أحداث" : "events"}
                  </span>
                </div>

                <div className="rounded-xl border bg-card p-4 space-y-3 max-h-72 overflow-y-auto">
                  {report.timeline.length === 0 ? (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      {isRtl ? "لا توجد أحداث نشاط مسجلة." : "No activity events recorded."}
                    </div>
                  ) : (
                    report.timeline.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 pb-3 border-b last:border-b-0 last:pb-0"
                      >
                        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                          <Sparkles className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground">{item.eventName}</span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {formatDate(item.createdAt)}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {item.category}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {isRtl ? "بواسطة: " : "By: "}
                              {item.actorName || item.actorType}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-muted/30 border-t p-4 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground font-mono">
            {report?.user ? `User: ${report.user.id}` : ""}
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            {isRtl ? "إغلاق التقرير" : "Close Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
