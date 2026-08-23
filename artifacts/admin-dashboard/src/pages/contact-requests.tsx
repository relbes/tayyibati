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
  Search,
  Mail,
  Phone,
  User,
  Calendar,
  MessageSquare,
  Globe,
  Tag,
  Eye,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Inbox,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAdminLeads, updateAdminLeadStatus, type LeadItem } from "@/lib/api";

const INTEREST_LABELS: Record<string, string> = {
  pro_plan: "باقت طيباتي المتقدمة (Pro)",
  enterprise: "حسابات العيادات والمؤسسات",
  free_plan: "الخطة المجانية",
  general_inquiry: "استفسار عام",
  mobile_app: "تطبيق الجوال",
  other: "أخرى",
};

const SOURCE_LABELS: Record<string, string> = {
  website: "الموقع الإلكتروني",
  landing_page: "صفحة الهبوط",
  mobile_app: "تطبيق الجوال",
};

function getInterestBadge(interest: string | null) {
  const key = interest || "general_inquiry";
  const label = INTEREST_LABELS[key] || key;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
      <Tag className="h-3 w-3 text-slate-500" />
      {label}
    </span>
  );
}

function getSourceBadge(source: string | null) {
  const key = source || "website";
  const label = SOURCE_LABELS[key] || key;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Globe className="h-3 w-3 text-muted-foreground/70" />
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: "new" | "contacted" | "closed" }) {
  if (status === "new") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        جديد
      </span>
    );
  }
  if (status === "contacted") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
        <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        تم التواصل
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
      <XCircle className="h-3 w-3 text-gray-500" />
      مغلق
    </span>
  );
}

function LeadDetailModal({
  lead,
  open,
  onClose,
  onStatusChange,
  isUpdating,
}: {
  lead: LeadItem | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (id: number, status: "new" | "contacted" | "closed") => void;
  isUpdating: boolean;
}) {
  if (!lead) return null;

  const formattedDate = new Date(lead.createdAt).toLocaleString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto text-right" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center justify-between gap-3 text-xl font-bold border-b pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <span>تفاصيل طلب التواصل #{lead.id}</span>
            </div>
            <StatusBadge status={lead.status} />
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            تم استلام الطلب بتاريخ {formattedDate}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* USER INFO GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/40 p-4 rounded-xl border">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                <User className="h-3.5 w-3.5 text-primary" />
                الاسم
              </span>
              <p className="font-semibold text-sm text-foreground">{lead.name}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                <Mail className="h-3.5 w-3.5 text-primary" />
                البريد الإلكتروني
              </span>
              <a
                href={`mailto:${lead.email}`}
                className="font-semibold text-sm text-primary hover:underline dir-ltr block text-right"
              >
                {lead.email}
              </a>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                <Phone className="h-3.5 w-3.5 text-primary" />
                رقم الهاتف
              </span>
              {lead.phone ? (
                <a
                  href={`tel:${lead.phone}`}
                  className="font-semibold text-sm text-foreground hover:text-primary dir-ltr block text-right"
                >
                  {lead.phone}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">غير محدد</p>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                <Tag className="h-3.5 w-3.5 text-primary" />
                نوع الاهتمام
              </span>
              <div className="pt-0.5">{getInterestBadge(lead.interest)}</div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                <Globe className="h-3.5 w-3.5 text-primary" />
                المصدر
              </span>
              <div className="pt-0.5">{getSourceBadge(lead.source)}</div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                تاريخ الطلب
              </span>
              <p className="text-xs font-medium text-foreground">{formattedDate}</p>
            </div>
          </div>

          {/* MESSAGE CONTENT */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-primary" />
              الرسالة:
            </span>
            <div className="p-4 rounded-xl bg-background border shadow-sm text-sm text-foreground leading-relaxed whitespace-pre-wrap min-h-[90px]">
              {lead.message || <span className="text-muted-foreground italic">لا توجد رسالة مرفقة</span>}
            </div>
          </div>

          {/* STATUS CHANGE CONTROL */}
          <div className="space-y-2 pt-2 border-t">
            <span className="text-xs font-semibold text-foreground block">تحديث حالة الطلب:</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={lead.status === "new" ? "default" : "outline"}
                size="sm"
                disabled={isUpdating || lead.status === "new"}
                onClick={() => onStatusChange(lead.id, "new")}
                className="gap-1.5 text-xs"
              >
                <Clock className="h-3.5 w-3.5" />
                جديد
              </Button>

              <Button
                type="button"
                variant={lead.status === "contacted" ? "default" : "outline"}
                size="sm"
                disabled={isUpdating || lead.status === "contacted"}
                onClick={() => onStatusChange(lead.id, "contacted")}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                تم التواصل
              </Button>

              <Button
                type="button"
                variant={lead.status === "closed" ? "secondary" : "outline"}
                size="sm"
                disabled={isUpdating || lead.status === "closed"}
                onClick={() => onStatusChange(lead.id, "closed")}
                className="gap-1.5 text-xs"
              >
                <XCircle className="h-3.5 w-3.5" />
                مغلق
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContactRequests() {
  const { toast } = useToast();

  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [interestFilter, setInterestFilter] = useState("all");

  // Selection & Modal
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadData = useCallback(
    async (showLoadingSpinner = true) => {
      if (showLoadingSpinner) setLoading(true);
      else setRefreshing(true);

      try {
        const res = await fetchAdminLeads({
          search,
          status: statusFilter,
          interest: interestFilter,
          limit: 100,
        });

        setLeads(res.items || []);
        setTotalItems(res.totalItems || 0);
        setNewCount(res.newCount || 0);
      } catch (err: any) {
        toast({
          title: "خطأ",
          description: err?.message || "تعذر تحميل طلبات التواصل",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, statusFilter, interestFilter, toast]
  );

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  const handleStatusChange = async (id: number, newStatus: "new" | "contacted" | "closed") => {
    setUpdatingId(id);
    try {
      const res = await updateAdminLeadStatus(id, newStatus);

      setLeads((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus, updatedAt: res.item.updatedAt } : item))
      );

      if (selectedLead && selectedLead.id === id) {
        setSelectedLead((prev) => (prev ? { ...prev, status: newStatus, updatedAt: res.item.updatedAt } : null));
      }

      setNewCount(res.newCount);

      toast({
        title: "تم التحديث",
        description: "تم تحديث حالة طلب التواصل بنجاح",
      });
    } catch (err: any) {
      toast({
        title: "خطأ",
        description: err?.message || "تعذر تحديث الحالة",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const openDetails = (lead: LeadItem) => {
    setSelectedLead(lead);
    setModalOpen(true);
  };

  const contactedCount = leads.filter((l) => l.status === "contacted").length;
  const closedCount = leads.filter((l) => l.status === "closed").length;

  return (
    <div className="p-6 space-y-6 text-right" dir="rtl">
      {/* HEADER & SUMMARY */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            طلبات التواصل
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            طلبات ورسائل المستخدمين من موقع طيباتي
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData(false)}
          disabled={loading || refreshing}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          تحديث البيانات
        </Button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-emerald-100 dark:border-emerald-900/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">إجمالي الطلبات</p>
              <p className="text-2xl font-bold text-foreground mt-1">{totalItems}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Inbox className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">طلبات جديدة</p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">{newCount}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700 dark:text-amber-300">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">تم التواصل</p>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">{contactedCount}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">طلبات مغلقة</p>
              <p className="text-2xl font-bold text-foreground mt-1">{closedCount}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTERS BAR */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم، البريد الإلكتروني، أو الهاتف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="الحالة" />
                  </div>
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="new">جديد فقط</SelectItem>
                  <SelectItem value="contacted">تم التواصل</SelectItem>
                  <SelectItem value="closed">مغلق</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Interest Filter */}
            <div className="w-full md:w-56">
              <Select value={interestFilter} onValueChange={setInterestFilter}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="نوع الاهتمام" />
                  </div>
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">جميع الاهتمامات</SelectItem>
                  <SelectItem value="pro_plan">باقة طيباتي المتقدمة (Pro)</SelectItem>
                  <SelectItem value="enterprise">حسابات المؤسسات والعيادات</SelectItem>
                  <SelectItem value="general_inquiry">استفسار عام</SelectItem>
                  <SelectItem value="free_plan">الخطة المجانية</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(search || statusFilter !== "all" || interestFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setInterestFilter("all");
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                إعادة ضبط
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TABLE / LIST CONTENT */}
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-2 border-b last:border-0">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <Inbox className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">لا توجد طلبات تواصل</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                لم يتم العثور على أي طلبات تواصل تطابق معايير البحث الحالية.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase">
                    <th className="py-3.5 px-4">الاسم والتواصل</th>
                    <th className="py-3.5 px-4">نوع الاهتمام</th>
                    <th className="py-3.5 px-4">محتوى الرسالة</th>
                    <th className="py-3.5 px-4">المصدر</th>
                    <th className="py-3.5 px-4">الحالة</th>
                    <th className="py-3.5 px-4">التاريخ</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leads.map((lead) => {
                    const formattedDate = new Date(lead.createdAt).toLocaleDateString("ar-SA", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });

                    return (
                      <tr
                        key={lead.id}
                        className="hover:bg-muted/30 transition-colors group cursor-pointer"
                        onClick={() => openDetails(lead)}
                      >
                        {/* NAME & CONTACT */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {lead.name}
                            </p>
                            <p className="text-xs text-muted-foreground dir-ltr text-right">
                              {lead.email}
                            </p>
                            {lead.phone && (
                              <p className="text-xs text-muted-foreground/80 dir-ltr text-right">
                                {lead.phone}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* INTEREST */}
                        <td className="py-3.5 px-4 align-top">
                          {getInterestBadge(lead.interest)}
                        </td>

                        {/* MESSAGE PREVIEW */}
                        <td className="py-3.5 px-4 align-top max-w-xs">
                          <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                            {lead.message || <span className="text-muted-foreground italic">بدون رسالة</span>}
                          </p>
                        </td>

                        {/* SOURCE */}
                        <td className="py-3.5 px-4 align-top">
                          {getSourceBadge(lead.source)}
                        </td>

                        {/* STATUS SELECT */}
                        <td className="py-3.5 px-4 align-top" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={lead.status}
                            onValueChange={(val: "new" | "contacted" | "closed") =>
                              handleStatusChange(lead.id, val)
                            }
                            disabled={updatingId === lead.id}
                          >
                            <SelectTrigger className="h-8 border-0 bg-transparent p-0 w-auto hover:bg-muted/50 rounded px-1">
                              <StatusBadge status={lead.status} />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                              <SelectItem value="new">جديد</SelectItem>
                              <SelectItem value="contacted">تم التواصل</SelectItem>
                              <SelectItem value="closed">مغلق</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>

                        {/* DATE */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap text-xs text-muted-foreground">
                          {formattedDate}
                        </td>

                        {/* ACTIONS */}
                        <td
                          className="py-3.5 px-4 align-top text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetails(lead)}
                            className="h-8 px-2.5 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            التفاصيل
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DETAIL MODAL */}
      <LeadDetailModal
        lead={selectedLead}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onStatusChange={handleStatusChange}
        isUpdating={updatingId !== null}
      />
    </div>
  );
}
