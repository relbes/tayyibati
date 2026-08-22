import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/LangContext";
import { tr } from "@/lib/i18n";
import { ChevronLeft, ChevronRight, Trash2, Eye, FileText, Camera, Tag, Download, Search, ExternalLink, ArrowRight, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE, adminFetch } from "@/lib/api";
import { useLocation } from "wouter";

const PAGE_SIZE = 20;

interface HistoryItem {
  id: number;
  userId: string;
  userEmail?: string;
  query: string;
  analysisType: "text" | "image" | "label";
  compatibilityScore: number;
  createdAt: string;
  report: {
    status?: string;
    explanation?: string;
    forbidden?: Array<{ name: string; nameAr?: string; reason?: string }>;
    conditional?: Array<{ name: string; nameAr?: string; reason?: string }>;
    allowed?: Array<{ name: string; nameAr?: string; reason?: string }>;
    unknown?: Array<{ name: string; nameAr?: string }>;
    matchedFoodId?: number;
    matchedDishId?: number;
  };
}

function TypeIcon({ type }: { type: string }) {
  if (type === "text") return <FileText className="h-3.5 w-3.5" />;
  if (type === "image") return <Camera className="h-3.5 w-3.5" />;
  return <Tag className="h-3.5 w-3.5" />;
}

function TypeLabel({ type, lang }: { type: string; lang: "ar" | "en" }) {
  if (type === "text") return <span>{tr(lang, "text")}</span>;
  if (type === "image") return <span>{tr(lang, "image")}</span>;
  return <span>{tr(lang, "label")}</span>;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 71 ? "bg-green-100 text-green-800 border-green-200" : score >= 51 ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-red-100 text-red-800 border-red-200";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", color)}>
      {score}%
    </span>
  );
}

function HistoryDetailDialog({ item, open, onClose, lang }: {
  item: HistoryItem | null; open: boolean; onClose: () => void; lang: "ar" | "en";
}) {
  const [, setLocation] = useLocation();
  if (!item) return null;
  const { report } = item;

  const handleOpenKnowledge = () => {
    onClose();
    if (report.matchedFoodId) {
      setLocation(`/foods?id=${report.matchedFoodId}`);
    } else {
      setLocation(`/foods?search=${encodeURIComponent(item.query)}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <TypeIcon type={item.analysisType} />
            <span className="truncate">{item.query}</span>
            <ScoreBadge score={item.compatibilityScore} />
          </DialogTitle>
          <DialogDescription>
            سجل تحليل وتدقيق بحث المستخدم
          </DialogDescription>
        </DialogHeader>

        {/* QUERY PROCESSING FLOW */}
        <div className="space-y-4 text-sm text-right">
          <div className="p-3 bg-muted/50 rounded-lg border text-xs space-y-2">
            <span className="font-semibold text-foreground block border-b pb-1">مخطط معالجة البحث (Search Flow):</span>
            <div className="flex items-center justify-between text-muted-foreground gap-2 pt-1">
              <div className="bg-background p-2 rounded border text-center flex-1">
                <span className="text-[10px] text-muted-foreground block">استعلام المستخدم</span>
                <span className="font-bold text-foreground text-xs">{item.query}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 rotate-180" />
              <div className="bg-background p-2 rounded border text-center flex-1">
                <span className="text-[10px] text-muted-foreground block">نوع البحث والوضع</span>
                <span className="font-semibold text-primary uppercase text-xs">{item.analysisType}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 rotate-180" />
              <div className="bg-background p-2 rounded border text-center flex-1">
                <span className="text-[10px] text-muted-foreground block">الحكم والنتيجة</span>
                <span className="font-bold text-emerald-700 text-xs">{report.status || "محلل"}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground bg-background p-3 rounded border">
            <div>
              <span className="font-medium text-foreground">البريد الإلكتروني:</span>
              <p className="font-semibold mt-0.5 text-foreground">{item.userEmail || "غير متوفر"}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">{tr(lang, "date")}:</span>
              <p className="mt-0.5 text-foreground">{new Date(item.createdAt).toLocaleString("ar-EG")}</p>
            </div>
          </div>

          {report.explanation && (
            <div className="p-3 bg-blue-50/50 rounded border border-blue-100 text-xs space-y-1">
              <span className="font-semibold text-blue-900 block">التفسير والشرح:</span>
              <p className="text-blue-950 leading-relaxed">{report.explanation}</p>
            </div>
          )}

          {/* INGREDIENT BREAKDOWNS */}
          {report.forbidden && report.forbidden.length > 0 && (
            <div>
              <p className="font-semibold text-destructive mb-2">{tr(lang, "forbidden")} ({report.forbidden.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {report.forbidden.map((ing, idx) => (
                  <span key={idx} className="rounded-full border bg-red-50 px-2.5 py-0.5 text-xs text-red-800 border-red-200">
                    {ing.nameAr || ing.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {report.conditional && report.conditional.length > 0 && (
            <div>
              <p className="font-semibold text-amber-600 mb-2">{tr(lang, "conditional")} ({report.conditional.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {report.conditional.map((ing, idx) => (
                  <span key={idx} className="rounded-full border bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800 border-amber-200">
                    {ing.nameAr || ing.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {report.allowed && report.allowed.length > 0 && (
            <div>
              <p className="font-semibold text-green-700 mb-2">{tr(lang, "allowed")} ({report.allowed.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {report.allowed.map((ing, idx) => (
                  <span key={idx} className="rounded-full border bg-green-50 px-2.5 py-0.5 text-xs text-green-800 border-green-200">
                    {ing.nameAr || ing.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <Button onClick={handleOpenKnowledge} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5">
            <ExternalLink className="h-4 w-4" />
            فتح السجل المعرفي (Open Knowledge Record)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function History() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [analysisTypeFilter, setAnalysisTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HistoryItem | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();
  const { lang } = useLang();

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (search) queryParams.append("search", search);
      if (analysisTypeFilter && analysisTypeFilter !== "all") queryParams.append("analysisType", analysisTypeFilter);
      if (statusFilter && statusFilter !== "all") queryParams.append("status", statusFilter);

      const res = await adminFetch(`${API_BASE}/api/admin/history?${queryParams}`);
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
        setTotalItems(data.totalItems || data.items.length);
      } else if (Array.isArray(data)) {
        setItems(data);
        setTotalItems(data.length);
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message || "تعذر جلب سجل التحليلات", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [offset, analysisTypeFilter, statusFilter]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pageIds = items.map((i) => i.id);
      const unique = Array.from(new Set([...selectedIds, ...pageIds]));
      setSelectedIds(unique);
    } else {
      const pageIdsSet = new Set(items.map((i) => i.id));
      setSelectedIds(selectedIds.filter((id) => !pageIdsSet.has(id)));
    }
  };

  const handleSelectRow = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const isAllPageSelected = items.length > 0 && items.every((i) => selectedIds.includes(i.id));

  const handleExportCsv = async () => {
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/export/history`);
      if (!res.ok) throw new Error("فشل تصدير البيانات");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `search_history_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message || "تعذر تصدير السجل", variant: "destructive" });
    }
  };

  const handleSingleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/history`, {
        method: "DELETE",
        body: JSON.stringify({ ids: [deleteTarget.id] }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "تم الحذف بنجاح", description: `تم حذف تحليل "${deleteTarget.query}"` });
        setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
        setDeleteTarget(null);
        fetchHistory();
      } else {
        toast({ title: "خطأ في الحذف", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsDeleting(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/history`, {
        method: "DELETE",
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "تم الحذف بنجاح", description: `تم حذف ${data.count || selectedIds.length} سجلات من سجل البحث` });
        setSelectedIds([]);
        setIsBulkDeleteOpen(false);
        fetchHistory();
      } else {
        toast({ title: "خطأ في الحذف الجماعي", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const hasPrev = offset > 0;
  const hasNext = offset + items.length < totalItems;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tr(lang, "analysisHistory")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            إدارة وتدقيق جميع استعلامات وبحوث المستخدمين على المنصة
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" onClick={() => setIsBulkDeleteOpen(true)} className="gap-1.5">
              <Trash2 className="h-4 w-4" />
              حذف المحدد ({selectedIds.length})
            </Button>
          )}
          <Button variant="outline" onClick={handleExportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            تصدير CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاستعلام أو البريد الإلكتروني..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchHistory()}
                className="pr-9"
              />
            </div>
            <Select value={analysisTypeFilter} onValueChange={(val) => { setAnalysisTypeFilter(val); setOffset(0); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="نوع البحث" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأنواع</SelectItem>
                <SelectItem value="text">نص (Text)</SelectItem>
                <SelectItem value="image">صورة (Image)</SelectItem>
                <SelectItem value="label">ملصق (Label)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setOffset(0); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="الحكم" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأحكام</SelectItem>
                <SelectItem value="allowed">مسموح (Allowed)</SelectItem>
                <SelectItem value="forbidden">ممنوع (Forbidden)</SelectItem>
                <SelectItem value="conditional">مشروط (Conditional)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={fetchHistory}>
              بحث
            </Button>
          </div>

          {/* SELECTION BAR */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between bg-primary/5 p-3 rounded-lg border border-primary/20 text-xs">
              <span className="font-semibold text-primary">
                تم تحديد {selectedIds.length} سجلات
              </span>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                إلغاء التحديد
              </Button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b bg-muted/30 text-muted-foreground text-xs uppercase">
                  <th className="px-4 py-3 w-10 text-center">
                    <Checkbox
                      checked={isAllPageSelected}
                      onCheckedChange={(c) => handleSelectAll(!!c)}
                    />
                  </th>
                  <th className="px-4 py-3">التاريخ</th>
                  <th className="px-4 py-3">البريد الإلكتروني</th>
                  <th className="px-4 py-3">البحث (Query)</th>
                  <th className="px-4 py-3">نوع التحليل</th>
                  <th className="px-4 py-3">الحكم</th>
                  <th className="px-4 py-3">درجة التوافق</th>
                  <th className="px-4 py-3 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      {tr(lang, "noHistory")}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    const verdictStatus = item.report?.status || "allowed";
                    return (
                      <tr key={item.id} className={cn("hover:bg-muted/20 transition-colors", isSelected && "bg-primary/5")}>
                        <td className="px-4 py-3 w-10 text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(c) => handleSelectRow(item.id, !!c)}
                          />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(item.createdAt).toLocaleDateString("ar-EG")}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {item.userEmail || "غير متوفر"}
                        </td>
                        <td className="px-4 py-3 max-w-xs font-semibold">
                          <p className="truncate">{item.query}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                            <TypeIcon type={item.analysisType} />
                            <TypeLabel type={item.analysisType} lang={lang} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            verdictStatus === "allowed" ? "bg-green-100 text-green-800" :
                            verdictStatus === "forbidden" ? "bg-red-100 text-red-800" :
                            "bg-amber-100 text-amber-800"
                          }`}>
                            {verdictStatus === "allowed" ? "مسموح" : verdictStatus === "forbidden" ? "ممنوع" : "مشروط"}
                          </span>
                        </td>
                        <td className="px-4 py-3"><ScoreBadge score={item.compatibilityScore} /></td>
                        <td className="px-4 py-3 text-left space-x-1 space-x-reverse">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedItem(item)}>
                            <Eye className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-red-50"
                            onClick={() => setDeleteTarget(item)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-muted-foreground">
              عرض {offset + 1}–{offset + items.length} من أصل {totalItems} سجل
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!hasPrev}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                <ChevronRight className="h-4 w-4 ml-1" />
                {tr(lang, "prev")}
              </Button>
              <Button variant="outline" size="sm" disabled={!hasNext}
                onClick={() => setOffset(offset + PAGE_SIZE)}>
                {tr(lang, "next")}
                <ChevronLeft className="h-4 w-4 mr-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <HistoryDetailDialog item={selectedItem} open={!!selectedItem} onClose={() => setSelectedItem(null)} lang={lang} />

      {/* SINGLE DELETE CONFIRM DIALOG */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف هذا السجل؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف تحليل "{deleteTarget?.query}" نهائياً من سجلات البحث.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr(lang, "cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={handleSingleDelete} disabled={isDeleting}>
              {tr(lang, "delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* BULK DELETE CONFIRM DIALOG */}
      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف الجماعي</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف {selectedIds.length} سجلات من سجل البحث؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr(lang, "cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={handleBulkDelete} disabled={isDeleting}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
