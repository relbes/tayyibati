import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchUserHistory, fetchUserReport, type UserActivityHistoryItem } from "@/lib/api";
import { UserReportModal } from "@/components/UserReportModal";
import { useLang } from "@/contexts/LangContext";
import { tr } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Shield,
  Key,
  Camera,
  Tag,
  Star,
  CreditCard,
  Bell,
  User,
  AlertTriangle,
  Cpu,
  Clock,
  Eye,
  RotateCcw,
  Sparkles,
  BarChart3,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserHistoryTabProps {
  userId: string;
  userName?: string;
  userEmail?: string;
  isActive?: boolean;
}

const CATEGORY_CONFIG: Record<
  string,
  { labelAr: string; labelEn: string; icon: any; color: string; badgeVariant?: string }
> = {
  ALL: { labelAr: "جميع الأحداث", labelEn: "All Events", icon: Sparkles, color: "text-foreground" },
  AUTH: { labelAr: "المصادقة والأمان", labelEn: "Authentication", icon: Key, color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  SEARCH: { labelAr: "البحث الغذائي", labelEn: "Food Search", icon: Search, color: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  IMAGE_ANALYSIS: { labelAr: "فحص الصور", labelEn: "Image Analysis", icon: Camera, color: "bg-cyan-500/10 text-cyan-600 border-cyan-200" },
  INGREDIENT_ANALYSIS: { labelAr: "فحص الملصقات", labelEn: "Ingredients", icon: Tag, color: "bg-purple-500/10 text-purple-600 border-purple-200" },
  SUBSCRIPTION: { labelAr: "الاشتراكات", labelEn: "Subscription", icon: Star, color: "bg-amber-500/10 text-amber-600 border-amber-200" },
  PAYMENT: { labelAr: "المدفوعات", labelEn: "Payment", icon: CreditCard, color: "bg-teal-500/10 text-teal-600 border-teal-200" },
  NOTIFICATION: { labelAr: "الإشعارات", labelEn: "Notifications", icon: Bell, color: "bg-orange-500/10 text-orange-600 border-orange-200" },
  ADMIN_ACTION: { labelAr: "إجراءات الإدارة", labelEn: "Admin Actions", icon: Shield, color: "bg-rose-500/10 text-rose-600 border-rose-200" },
  PROFILE: { labelAr: "الملف الشخصي", labelEn: "Profile", icon: User, color: "bg-indigo-500/10 text-indigo-600 border-indigo-200" },
  ERROR: { labelAr: "الأخطاء", labelEn: "Errors", icon: AlertTriangle, color: "bg-red-500/10 text-red-600 border-red-200" },
  SYSTEM: { labelAr: "النظام", labelEn: "System", icon: Cpu, color: "bg-slate-500/10 text-slate-600 border-slate-200" },
};

function formatEventTime(dateStr: string, lang: "ar" | "en"): { full: string; relative: string } {
  try {
    const d = new Date(dateStr);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = "";
    if (diffMins < 1) {
      relative = lang === "ar" ? "الآن" : "Just now";
    } else if (diffMins < 60) {
      relative = lang === "ar" ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      relative = lang === "ar" ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    } else if (diffDays < 30) {
      relative = lang === "ar" ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
    } else {
      relative = d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric" });
    }

    const full = d.toLocaleString(lang === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    return { full, relative };
  } catch {
    return { full: dateStr, relative: dateStr };
  }
}

export function UserHistoryTab({ userId, userName, userEmail, isActive }: UserHistoryTabProps) {
  const { lang } = useLang();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<UserActivityHistoryItem | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const PAGE_SIZE = 50;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["user-history", userId, page, category, search, dateFrom, dateTo],
    queryFn: () =>
      fetchUserHistory(userId, {
        page,
        pageSize: PAGE_SIZE,
        category: category === "ALL" ? undefined : category,
        search: search.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    enabled: !!userId && (isActive !== undefined ? isActive : true),
  });

  const { data: reportData } = useQuery({
    queryKey: ["user-report-summary", userId],
    queryFn: () => fetchUserReport(userId),
    enabled: !!userId && (isActive !== undefined ? isActive : true),
    staleTime: 30_000,
  });

  const items = data?.items || [];
  const pagination = data?.pagination || { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 };

  const handleResetFilters = () => {
    setCategory("ALL");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Activity & Subscription Summary Header Card */}
      <div className="rounded-xl border bg-gradient-to-r from-card via-card to-muted/20 p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {tr(lang, "activitySummary")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {lang === "ar"
                  ? "إحصائيات الاستخدام والبحث وتفاصيل الاشتراك"
                  : "Usage statistics, searches, and subscription details"}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="default"
            onClick={() => setIsReportOpen(true)}
            className="gap-1.5 text-xs shadow-xs"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            {tr(lang, "openReportModal")}
          </Button>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {/* Total Searches */}
          <div className="rounded-lg border bg-background/80 p-2.5 space-y-0.5">
            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>{tr(lang, "totalSearches")}</span>
              <Search className="h-3 w-3 text-primary" />
            </div>
            <div className="text-base font-bold text-foreground">
              {reportData ? reportData.activity.totalSearches : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {reportData
                ? `${reportData.activity.foodSearches} ${lang === "ar" ? "نصي" : "text"} · ${reportData.activity.imageAnalyses} ${lang === "ar" ? "صورة" : "img"}`
                : "—"}
            </div>
          </div>

          {/* Activity Events */}
          <div className="rounded-lg border bg-background/80 p-2.5 space-y-0.5">
            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>{tr(lang, "totalActivityEvents")}</span>
              <Clock className="h-3 w-3 text-amber-500" />
            </div>
            <div className="text-base font-bold text-foreground">
              {reportData ? reportData.activity.totalEvents : pagination.total}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {lang === "ar" ? "أحداث التدقيق" : "Audit events"}
            </div>
          </div>

          {/* Logins */}
          <div className="rounded-lg border bg-background/80 p-2.5 space-y-0.5">
            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>{tr(lang, "loginCount")}</span>
              <Key className="h-3 w-3 text-blue-500" />
            </div>
            <div className="text-base font-bold text-blue-600 dark:text-blue-400">
              {reportData
                ? reportData.activity.logins != null
                  ? reportData.activity.logins
                  : tr(lang, "notAvailable")
                : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {lang === "ar" ? "تسجيلات الدخول" : "Sessions"}
            </div>
          </div>

          {/* Subscription Status & Source */}
          <div className="rounded-lg border bg-background/80 p-2.5 space-y-0.5">
            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>{tr(lang, "subStatus")}</span>
              <Star className="h-3 w-3 text-amber-500" />
            </div>
            <div className="text-xs font-bold truncate">
              {reportData?.subscription.status === "ACTIVE" ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  {lang === "ar" ? "نشط" : "Active"}
                </span>
              ) : reportData?.subscription.status === "EXPIRED" ? (
                <span className="text-rose-600 dark:text-rose-400">
                  {lang === "ar" ? "منتهي" : "Expired"}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {tr(lang, "basic")}
                </span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {reportData?.subscription.source === "Admin Grant"
                ? tr(lang, "adminGrant")
                : reportData?.subscription.source === "Google Play"
                ? "Google Play"
                : reportData?.subscription.source === "None"
                ? (lang === "ar" ? "بدون اشتراك" : "No sub")
                : reportData?.subscription.source || "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-muted/40 p-3 rounded-lg border space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Category Select */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {tr(lang, "type")}
            </label>
            <Select
              value={category}
              onValueChange={(val) => {
                setCategory(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 bg-background">
                <SelectValue placeholder={tr(lang, "allEvents")} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{lang === "ar" ? cfg.labelAr : cfg.labelEn}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Search Box */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {tr(lang, "search")}
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={lang === "ar" ? "بحث في الأحداث..." : "Search in events..."}
                className="h-9 pl-8 bg-background"
              />
            </div>
          </div>

          {/* Date From */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {tr(lang, "dateFrom")}
            </label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="h-9 pl-8 bg-background text-xs"
              />
            </div>
          </div>

          {/* Date To */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {tr(lang, "dateTo")}
            </label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="h-9 pl-8 bg-background text-xs"
              />
            </div>
          </div>
        </div>

        {/* Filter stats & clear button */}
        {(category !== "ALL" || search || dateFrom || dateTo) && (
          <div className="flex items-center justify-between pt-1 border-t text-xs text-muted-foreground">
            <span>
              {lang === "ar"
                ? `تصفية نشطة · تم العثور على ${pagination.total} حدث`
                : `Active filter · ${pagination.total} events found`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              {tr(lang, "clearFilters")}
            </Button>
          </div>
        )}
      </div>

      {/* Events List / Timeline */}
      {isLoading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3 p-3 rounded-lg border bg-card">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center space-y-2">
          <p className="text-sm font-medium text-destructive">
            {lang === "ar" ? "تعذر تحميل سجل النشاط. يرجى المحاولة لاحقاً." : "Failed to load user activity history."}
          </p>
          {error instanceof Error && error.message && (
            <p className="text-xs text-muted-foreground font-mono max-w-md mx-auto truncate">
              {error.message}
            </p>
          )}
          <div className="pt-2">
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              {lang === "ar" ? "إعادة المحاولة" : "Retry"}
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center space-y-2">
          <Clock className="h-8 w-8 text-muted-foreground/60 mx-auto" />
          <p className="text-sm font-medium text-foreground">
            {tr(lang, "noHistoryYet")}
          </p>
          <p className="text-xs text-muted-foreground">
            {category !== "ALL" || search || dateFrom || dateTo
              ? (lang === "ar" ? "لا توجد نتائج مطابقة لخيارات التصفية المحددة." : "No events matched the chosen filters.")
              : (lang === "ar" ? "ستظهر عمليات تسجيل الدخول والبحث الغذائي وإجراءات الإدارة هنا." : "Logins, food searches, and administrative actions will appear here.")}
          </p>
          {(category !== "ALL" || search || dateFrom || dateTo) && (
            <Button size="sm" variant="outline" onClick={handleResetFilters} className="mt-2 text-xs">
              {tr(lang, "clearFilters")}
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border divide-y overflow-hidden bg-card">
          {items.map((event) => {
            const cfg = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.SYSTEM;
            const Icon = cfg.icon;
            const timeInfo = formatEventTime(event.createdAt, lang);
            const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;

            return (
              <div
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className="p-3.5 hover:bg-muted/40 transition-colors flex items-start gap-3.5 cursor-pointer group"
              >
                {/* Category Icon Badge */}
                <div
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border mt-0.5",
                    cfg.color
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                {/* Event Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">
                        {event.eventName}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border",
                          cfg.color
                        )}
                      >
                        {lang === "ar" ? cfg.labelAr : cfg.labelEn}
                      </span>
                      {event.actorType === "ADMIN" && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-rose-300 text-rose-700 bg-rose-50/50">
                          <Shield className="h-2.5 w-2.5" />
                          {event.actorName ? `${event.actorName} (Admin)` : "Admin"}
                        </Badge>
                      )}
                      {event.actorType === "SYSTEM" && (
                        <Badge variant="outline" className="text-[10px] gap-1 text-slate-600 bg-slate-50">
                          <Cpu className="h-2.5 w-2.5" /> System
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                      <span title={timeInfo.full}>{timeInfo.relative}</span>
                      <Eye className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                    </div>
                  </div>

                  {/* Description */}
                  {event.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  {/* Quick preview badges for metadata */}
                  {event.metadata && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {event.metadata.compatibilityScore !== undefined && (
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.2 rounded border",
                            Number(event.metadata.compatibilityScore) >= 70
                              ? "bg-green-50 text-green-700 border-green-200"
                              : Number(event.metadata.compatibilityScore) >= 50
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          )}
                        >
                          {event.metadata.compatibilityScore}%
                        </span>
                      )}
                      {event.metadata.planName && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {event.metadata.planName}
                        </span>
                      )}
                      {event.metadata.source && (
                        <span className="text-[10px] text-muted-foreground/70 italic">
                          {String(event.metadata.source)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 flex-wrap gap-2 text-xs text-muted-foreground">
          <div>
            {lang === "ar"
              ? `صفحة ${pagination.page} من ${pagination.totalPages} (إجمالي ${pagination.total} حدث)`
              : `Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} total)`}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {tr(lang, "prev")}
            </Button>
            <span className="px-2 text-xs font-medium">
              {page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="h-8 gap-1 text-xs"
            >
              {tr(lang, "next")}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(o) => !o && setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              {selectedEvent && (
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full border",
                    CATEGORY_CONFIG[selectedEvent.category]?.color
                  )}
                >
                  {lang === "ar"
                    ? CATEGORY_CONFIG[selectedEvent.category]?.labelAr
                    : CATEGORY_CONFIG[selectedEvent.category]?.labelEn}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                ID #{selectedEvent?.id}
              </span>
            </div>
            <DialogTitle className="text-base font-bold">
              {selectedEvent?.eventName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedEvent && formatEventTime(selectedEvent.createdAt, lang).full}
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4 py-2 text-xs">
              {/* Event Summary Box */}
              <div className="bg-muted/50 p-3 rounded-lg border space-y-1.5">
                <div className="text-muted-foreground text-[11px] font-medium">
                  {tr(lang, "details")}
                </div>
                <div className="text-foreground font-medium text-sm">
                  {selectedEvent.description || "—"}
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-card p-2.5 rounded border">
                  <span className="text-muted-foreground block text-[11px]">
                    {tr(lang, "actor")}
                  </span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    {selectedEvent.actorName
                      ? `${selectedEvent.actorName} (${selectedEvent.actorType})`
                      : selectedEvent.actorType}
                  </span>
                </div>

                <div className="bg-card p-2.5 rounded border">
                  <span className="text-muted-foreground block text-[11px]">
                    {lang === "ar" ? "نوع الحدث" : "Event Code"}
                  </span>
                  <span className="font-mono text-foreground mt-0.5 block">
                    {selectedEvent.eventType}
                  </span>
                </div>
              </div>

              {/* Metadata Inspector (Structured) */}
              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-muted-foreground text-[11px] font-medium">
                    {tr(lang, "metadata")}
                  </div>
                  <div className="rounded border bg-muted/20 p-3 max-h-48 overflow-y-auto">
                    <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-foreground">
                      {JSON.stringify(selectedEvent.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* User Report Modal */}
      <UserReportModal
        userId={userId}
        userName={userName}
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        defaultLang={lang}
      />
    </div>
  );
}
