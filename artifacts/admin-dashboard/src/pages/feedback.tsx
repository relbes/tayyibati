import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ThumbsUp,
  ThumbsDown,
  Search,
  RefreshCw,
  Filter,
  Eye,
  Calendar,
  User,
  Mail,
  FileText,
  Camera,
  Tag,
  Barcode,
  HelpCircle,
  AlertCircle,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  X,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAdminFeedback, type FeedbackItem } from "@/lib/api";
import { useLocation } from "wouter";

const PAGE_SIZE = 25;

const REASON_LABELS: Record<string, string> = {
  INCORRECT_RESULT: "نتيجة غير صحيحة",
  INCORRECT_INGREDIENTS: "المكونات غير صحيحة",
  NOT_CLEAR: "غير واضح",
  WRONG_FOOD: "الطعام خاطئ",
  OTHER: "أخرى",
};

function TypeBadge({ type }: { type?: string | null }) {
  if (!type) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (type === "text") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
        <FileText className="h-3 w-3" />
        نص
      </span>
    );
  }
  if (type === "image") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
        <Camera className="h-3 w-3" />
        صورة
      </span>
    );
  }
  if (type === "label") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
        <Tag className="h-3 w-3" />
        ملصق
      </span>
    );
  }
  if (type === "barcode") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
        <Barcode className="h-3 w-3" />
        باركود
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
      {type}
    </span>
  );
}

function RatingBadge({ rating }: { rating: "positive" | "negative" }) {
  if (rating === "positive") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
        <ThumbsUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        إيجابي
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
      <ThumbsDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
      سلبي
    </span>
  );
}

function ReasonBadge({ reason }: { reason: string | null }) {
  if (!reason) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const label = REASON_LABELS[reason] || reason;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800">
      <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
      {label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const color =
    score >= 71
      ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800"
      : score >= 51
      ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
      : "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", color)}>
      {score}%
    </span>
  );
}

function FeedbackDetailModal({
  item,
  open,
  onClose,
}: {
  item: FeedbackItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  if (!item) return null;

  const formattedDate = new Date(item.createdAt).toLocaleString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const queryText = item.query || item.analysis?.query || "غير محدد";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto text-right" dir="rtl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <span>تفاصيل التقييم #{item.id}</span>
              <RatingBadge rating={item.rating} />
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            تاريخ التقديم: {formattedDate}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-sm">
          {/* USER CONTEXT */}
          <div className="p-3 bg-muted/40 rounded-lg border space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" />
              بيانات المستخدم
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block">الاسم:</span>
                <span className="font-medium text-foreground">{item.userName || item.user?.name || "غير متوفر"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">البريد الإلكتروني:</span>
                <span className="font-medium text-foreground">{item.userEmail || item.user?.email || "غير متوفر"}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground block">معرّف المستخدم (User ID):</span>
                <span className="font-mono text-[11px] text-muted-foreground break-all">{item.userId}</span>
              </div>
            </div>
          </div>

          {/* ANALYSIS CONTEXT */}
          <div className="p-3 bg-muted/40 rounded-lg border space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                سياق التحليل المرتبط
              </h4>
              {item.analysisHistoryId && (
                <span className="text-[11px] text-muted-foreground">
                  رقم التحليل: #{item.analysisHistoryId}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="sm:col-span-2">
                <span className="text-muted-foreground block">الاستعلام المبحوث عنه:</span>
                <span className="font-bold text-foreground text-sm">{queryText}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">نوع التحليل:</span>
                <TypeBadge type={item.analysisType || item.analysis?.analysisType} />
              </div>
              <div>
                <span className="text-muted-foreground block">درجة التوافق المحسوبة:</span>
                <ScoreBadge score={item.compatibilityScore ?? item.analysis?.compatibilityScore} />
              </div>
            </div>
          </div>

          {/* REASON & COMMENT */}
          <div className="p-3 bg-muted/40 rounded-lg border space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              ملاحظة التقييم
            </h4>
            {item.rating === "negative" && (
              <div className="text-xs">
                <span className="text-muted-foreground block mb-1">السبب المختار:</span>
                <ReasonBadge reason={item.reason} />
              </div>
            )}
            <div className="text-xs">
              <span className="text-muted-foreground block mb-1">تعليق المستخدم:</span>
              {item.comment ? (
                <p className="p-2.5 bg-background rounded border text-foreground leading-relaxed whitespace-pre-wrap">
                  {item.comment}
                </p>
              ) : (
                <span className="text-muted-foreground italic">لم يكتب المستخدم تعليقاً إضافياً.</span>
              )}
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            {queryText && queryText !== "غير محدد" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  setLocation(`/foods?search=${encodeURIComponent(queryText)}`);
                }}
                className="gap-1.5 text-xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                البحث عن الصنف بقاعدة الأغذية
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose} className="text-xs">
              إغلاق
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function FeedbackPage() {
  const { toast } = useToast();

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");

  // Selection / Modal
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);

  const loadData = useCallback(
    async (targetPage = page, isBackgroundRefresh = false) => {
      if (isBackgroundRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMsg(null);

      try {
        const res = await fetchAdminFeedback({
          page: targetPage,
          limit: PAGE_SIZE,
          rating: ratingFilter,
          reason: reasonFilter,
          search: activeSearch,
        });

        setItems(res.feedback || []);
        setTotalItems(res.pagination?.total || 0);
        setTotalPages(res.pagination?.totalPages || 1);
        setPage(res.pagination?.page || targetPage);
      } catch (err: any) {
        const msg = err?.message || "تعذر تحميل التقييمات من الخادم";
        setErrorMsg(msg);
        toast({
          title: "خطأ في تحميل التقييمات",
          description: msg,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, ratingFilter, reasonFilter, activeSearch, toast],
  );

  useEffect(() => {
    loadData(1, false);
  }, [ratingFilter, reasonFilter, activeSearch]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPage(1);
    setActiveSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setActiveSearch("");
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setActiveSearch("");
    setRatingFilter("all");
    setReasonFilter("all");
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    loadData(newPage, false);
  };

  // Visible counts for current dataset
  const positiveCount = items.filter((f) => f.rating === "positive").length;
  const negativeCount = items.filter((f) => f.rating === "negative").length;

  const hasActiveFilters =
    activeSearch !== "" || ratingFilter !== "all" || reasonFilter !== "all";

  return (
    <div className="p-6 space-y-6 text-right" dir="rtl">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ThumbsUp className="h-6 w-6 text-primary" />
            التقييمات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة ومتابعة تقييمات وملاحظات المستخدمين على نتائج التحليل
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData(page, true)}
          disabled={loading || refreshing}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          تحديث البيانات
        </Button>
      </div>

      {/* SUMMARY STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Feedback */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">إجمالي التقييمات</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {loading ? <Skeleton className="h-8 w-16" /> : totalItems}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {hasActiveFilters ? "مطابقة للتصفية الحالية" : "سجلات التقييم المسجلة"}
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Positive Feedback */}
        <Card className="shadow-sm border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                التقييمات الإيجابية
              </p>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : ratingFilter === "positive" ? (
                  totalItems
                ) : (
                  positiveCount
                )}
              </p>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                {ratingFilter === "positive" ? "إجمالي التقييمات الإيجابية" : "في الصفحة المعروضة"}
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
              <ThumbsUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Negative Feedback */}
        <Card className="shadow-sm border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                التقييمات السلبية
              </p>
              <p className="text-2xl font-bold text-rose-900 dark:text-rose-100 mt-1">
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : ratingFilter === "negative" ? (
                  totalItems
                ) : (
                  negativeCount
                )}
              </p>
              <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80 mt-0.5">
                {ratingFilter === "negative" ? "إجمالي التقييمات السلبية" : "في الصفحة المعروضة"}
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-700 dark:text-rose-300">
              <ThumbsDown className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ERROR STATE */}
      {errorMsg && !loading && (
        <Card className="border-destructive/40 bg-destructive/5 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">تعذر جلب التقييمات من الخادم</p>
                <p className="text-xs text-muted-foreground mt-0.5">{errorMsg}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(page, false)}
              className="gap-1.5 shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      )}

      {/* FILTERS & SEARCH */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالتعليق، الاستعلام، أو البريد الإلكتروني..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pr-9 pl-9"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Rating Filter */}
            <div className="w-full md:w-44">
              <Select
                value={ratingFilter}
                onValueChange={(val) => {
                  setRatingFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="التقييم" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل (التقييمات)</SelectItem>
                  <SelectItem value="positive">إيجابي</SelectItem>
                  <SelectItem value="negative">سلبي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reason Filter */}
            <div className="w-full md:w-56">
              <Select
                value={reasonFilter}
                onValueChange={(val) => {
                  setReasonFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="سبب التقييم السلبي" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل (الأسباب)</SelectItem>
                  <SelectItem value="INCORRECT_RESULT">نتيجة غير صحيحة</SelectItem>
                  <SelectItem value="INCORRECT_INGREDIENTS">المكونات غير صحيحة</SelectItem>
                  <SelectItem value="NOT_CLEAR">غير واضح</SelectItem>
                  <SelectItem value="WRONG_FOOD">الطعام خاطئ</SelectItem>
                  <SelectItem value="OTHER">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button type="submit" variant="secondary" size="default">
                بحث
              </Button>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  onClick={handleResetFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  إعادة ضبط
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* FEEDBACK TABLE */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase font-medium">
                  <th className="px-4 py-3.5">التاريخ</th>
                  <th className="px-4 py-3.5">المستخدم</th>
                  <th className="px-4 py-3.5">الاستعلام</th>
                  <th className="px-4 py-3.5">نوع التحليل</th>
                  <th className="px-4 py-3.5">التقييم</th>
                  <th className="px-4 py-3.5">سبب التقييم السلبي</th>
                  <th className="px-4 py-3.5 max-w-xs">التعليق</th>
                  <th className="px-4 py-3.5">درجة التوافق</th>
                  <th className="px-4 py-3.5 text-center w-16">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3.5"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3.5"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3.5"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3.5"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-4 py-3.5"><Skeleton className="h-6 w-16 rounded-full" /></td>
                      <td className="px-4 py-3.5"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3.5"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3.5"><Skeleton className="h-4 w-12" /></td>
                      <td className="px-4 py-3.5 text-center"><Skeleton className="h-8 w-8 rounded mx-auto" /></td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                          <HelpCircle className="h-6 w-6" />
                        </div>
                        <p className="text-base font-semibold text-foreground">
                          لا توجد تقييمات مطابقة للبحث.
                        </p>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          {hasActiveFilters
                            ? "جرّب تغيير معايير البحث أو تصفية التقييمات لعرض النتائج."
                            : "لم يتم تقديم أي تقييمات من قبل المستخدمين حتى الآن."}
                        </p>
                        {hasActiveFilters && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetFilters}
                            className="mt-2 text-xs"
                          >
                            إلغاء جميع الفلاتر
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const queryText = item.query || item.analysis?.query;
                    const dateFormatted = new Date(item.createdAt).toLocaleDateString("ar-SA", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });
                    const timeFormatted = new Date(item.createdAt).toLocaleTimeString("ar-SA", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                      >
                        {/* DATE */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <p className="text-xs font-medium text-foreground">{dateFormatted}</p>
                          <p className="text-[11px] text-muted-foreground">{timeFormatted}</p>
                        </td>

                        {/* USER */}
                        <td className="px-4 py-3.5 max-w-[180px]">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {item.userName || item.user?.name || item.userEmail || "مستخدم"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate" title={item.userEmail || item.userId}>
                            {item.userEmail || item.userId}
                          </p>
                        </td>

                        {/* QUERY */}
                        <td className="px-4 py-3.5 font-medium text-foreground max-w-[160px]">
                          <p className="truncate" title={queryText || ""}>
                            {queryText || <span className="text-muted-foreground text-xs">—</span>}
                          </p>
                        </td>

                        {/* ANALYSIS TYPE */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <TypeBadge type={item.analysisType || item.analysis?.analysisType} />
                        </td>

                        {/* RATING */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <RatingBadge rating={item.rating} />
                        </td>

                        {/* NEGATIVE REASON */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <ReasonBadge reason={item.reason} />
                        </td>

                        {/* COMMENT */}
                        <td className="px-4 py-3.5 max-w-xs">
                          {item.comment ? (
                            <p className="text-xs text-foreground truncate" title={item.comment}>
                              {item.comment}
                            </p>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>

                        {/* COMPATIBILITY SCORE */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <ScoreBadge score={item.compatibilityScore ?? item.analysis?.compatibilityScore} />
                        </td>

                        {/* ACTION */}
                        <td
                          className="px-4 py-3.5 text-center whitespace-nowrap"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="عرض التفاصيل"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION FOOTER */}
          {!loading && totalItems > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 border-t">
              <p className="text-xs text-muted-foreground">
                عرض {Math.min((page - 1) * PAGE_SIZE + 1, totalItems)}–
                {Math.min(page * PAGE_SIZE, totalItems)} من أصل {totalItems} تقييم
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground ml-2">
                  صفحة {page} من {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  className="gap-1 h-8 text-xs"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  السابق
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                  className="gap-1 h-8 text-xs"
                >
                  التالي
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DETAIL MODAL */}
      <FeedbackDetailModal
        item={selectedItem}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}
