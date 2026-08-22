import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  CheckCircle,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Bot,
  Eye,
  ArrowRightLeft,
  Info,
  Clock,
  Sparkles,
  Layers,
} from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import { API_BASE, adminFetch } from "@/lib/api";

const PAGE_SIZE = 50;

interface AiCacheItem {
  id: number;
  cacheKey: string;
  originalQuery: string;
  normalizedQuery: string;
  inputType: string;
  entityType?: string;
  canonicalNameAr?: string | null;
  canonicalNameEn?: string | null;
  resolvedFoodName?: string | null;
  canonicalStatus?: string | null;
  confidence: number;
  provider: string;
  model: string;
  cacheVersion: string;
  language: string;
  hitCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  lastUsedAt: string;
  isDeleted: boolean;
  notes?: string | null;
  responseJson?: {
    status?: string;
    nameAr?: string;
    nameEn?: string;
    explanation?: string;
    overallScore?: number;
    forbiddenIngredients?: Array<{ name?: string; nameAr?: string; reason?: string }>;
    conditionalIngredients?: Array<{ name?: string; nameAr?: string; reason?: string }>;
    allowedIngredients?: Array<{ name?: string; nameAr?: string; reason?: string }>;
    unknownIngredients?: Array<{ name?: string; nameAr?: string }>;
    adminApproved?: boolean;
    adminReviewNotes?: string;
  };
}

export default function AiReviewPage() {
  const { lang } = useLang();
  const { toast } = useToast();
  const [items, setItems] = useState<AiCacheItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [inputTypeFilter, setInputTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [editItem, setEditItem] = useState<AiCacheItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<AiCacheItem | null>(null);
  const [viewItem, setViewItem] = useState<AiCacheItem | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchAiCache = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) queryParams.append("search", search);
      if (inputTypeFilter && inputTypeFilter !== "all") queryParams.append("inputType", inputTypeFilter);
      if (statusFilter && statusFilter !== "all") queryParams.append("status", statusFilter);

      const res = await adminFetch(`${API_BASE}/api/admin/ai-cache?${queryParams}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setTotalItems(data.totalItems || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        toast({ title: "خطأ", description: data.error || "فشل جلب قائمة الذكاء الاصطناعي", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message || "تعذر الاتصال بالخادم", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAiCache();
  }, [page, inputTypeFilter, statusFilter]);

  const handleApproveConfirm = async (item: AiCacheItem) => {
    setIsActionLoading(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/ai-cache/${item.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ notes: "تمت المراجعة والاعتماد بواسطة المشرف" }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم الاعتماد", description: `تمت مراجعة واعتماد استجابة AI للاستعلام "${item.originalQuery}"` });
        fetchAiCache();
      } else {
        toast({ title: "خطأ", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message, variant: "destructive" });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    setIsActionLoading(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/ai-cache/${editItem.id}`, {
        method: "PUT",
        body: JSON.stringify({
          canonicalNameAr: editItem.canonicalNameAr,
          canonicalNameEn: editItem.canonicalNameEn,
          canonicalStatus: editItem.canonicalStatus,
          notes: editItem.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم التحديث", description: "تم تحديث بيانات الذكاء الاصطناعي بنجاح" });
        setEditItem(null);
        fetchAiCache();
      } else {
        toast({ title: "خطأ", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message, variant: "destructive" });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;
    setIsActionLoading(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/ai-cache/${deleteItem.id}/delete`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم الحذف", description: "تم إزالة العنصر من سجل الكاش" });
        setDeleteItem(null);
        fetchAiCache();
      } else {
        toast({ title: "خطأ", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message, variant: "destructive" });
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مراجعة الذكاء الاصطناعي (AI Review)</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            فحص مخرجات الذكاء الاصطناعي وتحليلات المنتجات المخزنة بالكاش ومطابقتها
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاستعلام أو اسم المنتج..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchAiCache()}
                className="pr-9"
              />
            </div>
            <Select value={inputTypeFilter} onValueChange={(val) => { setInputTypeFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="نوع المدخل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع النماذج</SelectItem>
                <SelectItem value="text">نص (Text)</SelectItem>
                <SelectItem value="camera">كاميرا (Camera)</SelectItem>
                <SelectItem value="ocr">مسح ضوئي (OCR)</SelectItem>
                <SelectItem value="barcode">باركود (Barcode)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="الحكم المعرفي" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأحكام</SelectItem>
                <SelectItem value="allowed">مسموح (Allowed)</SelectItem>
                <SelectItem value="forbidden">ممنوع (Forbidden)</SelectItem>
                <SelectItem value="conditional">مشروط (Conditional)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={fetchAiCache}>
              بحث
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Bot className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
              <p>لا توجد سجلات ذكاء اصطناعي حالياً</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b">
                  <tr>
                    <th className="px-4 py-3">الاستعلام الأصلي</th>
                    <th className="px-4 py-3">النتيجة المحللة</th>
                    <th className="px-4 py-3">النوع</th>
                    <th className="px-4 py-3">الحكم (الحكم المعرفي)</th>
                    <th className="px-4 py-3">نسبة الثقة</th>
                    <th className="px-4 py-3">الاستخدام</th>
                    <th className="px-4 py-3">التاريخ</th>
                    <th className="px-4 py-3 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => {
                    const isApproved = item.responseJson?.adminApproved;
                    return (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">
                          {item.originalQuery}
                          {isApproved && (
                            <span className="mr-2 inline-flex items-center gap-1 bg-green-50 text-green-700 text-[10px] px-1.5 py-0.5 rounded border border-green-200">
                              <CheckCircle className="h-3 w-3" /> معتمد
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.canonicalNameAr || item.resolvedFoodName || "تحليل مباشر"}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className="bg-muted px-2 py-0.5 rounded font-mono">{item.inputType}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.canonicalStatus === "allowed" ? "bg-green-100 text-green-800" :
                            item.canonicalStatus === "forbidden" ? "bg-red-100 text-red-800" :
                            "bg-amber-100 text-amber-800"
                          }`}>
                            {item.canonicalStatus === "allowed" ? "مسموح" : item.canonicalStatus === "forbidden" ? "ممنوع" : "مشروط"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-primary">{Math.round((item.confidence || 0.95) * 100)}%</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{item.hitCount || 1} مرة</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ar-EG") : "—"}
                        </td>
                        <td className="px-4 py-3 text-left space-x-1 space-x-reverse">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewItem(item)}>
                            <Eye className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => handleApproveConfirm(item)}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditItem(item)}>
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteItem(item)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-xs text-muted-foreground">
                عرض {items.length} من أصل {totalItems} عنصر
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronRight className="h-4 w-4 ml-1" />
                  السابق
                </Button>
                <span className="text-xs font-medium px-2">صفحة {page} من {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  التالي
                  <ChevronLeft className="h-4 w-4 mr-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FULL AI INSPECTION DIALOG (WITH AI VS KNOWLEDGE BASE COMPARISON) */}
      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Bot className="h-5 w-5 text-blue-600" />
              تفاصيل فحص الذكاء الاصطناعي (AI Cache #{viewItem?.id})
            </DialogTitle>
            <DialogDescription>
              استعراض المخرجات التفصيلية ومقارنة مخرجات AI مع قاعدة البيانات
            </DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-6 py-2 text-right">
              {/* TOP SUMMARY */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-lg border text-xs">
                <div>
                  <span className="text-muted-foreground">النموذج ومزود الذكاء:</span>
                  <p className="font-semibold">{viewItem.provider || "openai"} ({viewItem.model || "gpt-4o-mini"})</p>
                </div>
                <div>
                  <span className="text-muted-foreground">نوع المدخل:</span>
                  <p className="font-semibold uppercase">{viewItem.inputType}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">مرات الاستخدام:</span>
                  <p className="font-bold text-primary">{viewItem.hitCount} مرة</p>
                </div>
                <div>
                  <span className="text-muted-foreground">نسبة الثقة:</span>
                  <p className="font-bold text-emerald-700">{Math.round((viewItem.confidence || 0.95) * 100)}%</p>
                </div>
              </div>

              {/* ORIGINAL QUERY & EXPLANATION */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">الاستعلام الأصلي:</span>
                  <span className="font-mono text-xs text-muted-foreground">Key: {viewItem.cacheKey}</span>
                </div>
                <p className="font-bold text-lg bg-background p-2.5 rounded border">{viewItem.originalQuery}</p>
                {viewItem.responseJson?.explanation && (
                  <div className="bg-blue-50/50 p-3 rounded border border-blue-100 text-xs space-y-1">
                    <span className="font-semibold text-blue-900 block">شرح وتقييم الذكاء الاصطناعي:</span>
                    <p className="text-blue-950 leading-relaxed">{viewItem.responseJson.explanation}</p>
                  </div>
                )}
              </div>

              {/* DETECTED INGREDIENTS BREAKDOWN */}
              {viewItem.responseJson && (
                <div className="space-y-3 border-t pt-3">
                  <h3 className="font-bold text-sm text-foreground">تفاصيل المكونات المحللة بواسطة الذكاء الاصطناعي:</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* FORBIDDEN INGREDIENTS */}
                    <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-xs space-y-1">
                      <span className="font-bold text-red-800 block border-b pb-1 border-red-200">
                        مكونات ممنوعة ({viewItem.responseJson.forbiddenIngredients?.length || 0})
                      </span>
                      {viewItem.responseJson.forbiddenIngredients && viewItem.responseJson.forbiddenIngredients.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          {viewItem.responseJson.forbiddenIngredients.map((ing, i) => (
                            <div key={i} className="text-red-900">
                              <span className="font-semibold">• {ing.nameAr || ing.name}</span>
                              {ing.reason && <p className="text-[10px] text-red-700 font-normal">{ing.reason}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 pt-1">لا يوجد مكونات ممنوعة</p>
                      )}
                    </div>

                    {/* CONDITIONAL INGREDIENTS */}
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs space-y-1">
                      <span className="font-bold text-amber-800 block border-b pb-1 border-amber-200">
                        مكونات مشروطة ({viewItem.responseJson.conditionalIngredients?.length || 0})
                      </span>
                      {viewItem.responseJson.conditionalIngredients && viewItem.responseJson.conditionalIngredients.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          {viewItem.responseJson.conditionalIngredients.map((ing, i) => (
                            <div key={i} className="text-amber-900">
                              <span className="font-semibold">• {ing.nameAr || ing.name}</span>
                              {ing.reason && <p className="text-[10px] text-amber-700 font-normal">{ing.reason}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 pt-1">لا يوجد مكونات مشروطة</p>
                      )}
                    </div>

                    {/* ALLOWED INGREDIENTS */}
                    <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-xs space-y-1">
                      <span className="font-bold text-green-800 block border-b pb-1 border-green-200">
                        مكونات مسموحة ({viewItem.responseJson.allowedIngredients?.length || 0})
                      </span>
                      {viewItem.responseJson.allowedIngredients && viewItem.responseJson.allowedIngredients.length > 0 ? (
                        <div className="space-y-1 pt-1">
                          {viewItem.responseJson.allowedIngredients.map((ing, i) => (
                            <div key={i} className="text-green-900 font-semibold">• {ing.nameAr || ing.name}</div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 pt-1">لا يوجد مكونات مسموحة</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* AI RESULT VS TAYYIBATI KNOWLEDGE BASE COMPARISON */}
              <div className="border-t pt-3 space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                  مقارنة نتيجة الذكاء الاصطناعي مع قاعدة المعرفة (Tayyibati Knowledge Base)
                </h3>
                <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-xs text-center text-muted-foreground">
                  <Info className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                  <p className="font-medium text-foreground">No matching knowledge record available</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">لا يوجد سجل معرفي مباشر في قاعدة بيانات Tayyibati مطبق لهذه النتيجة المحددة.</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewItem(null)}>إغلاق</Button>
            {viewItem && (
              <Button onClick={() => { handleApproveConfirm(viewItem); setViewItem(null); }} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4 ml-1" />
                اعتماد المراجعة
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل سجل الذكاء الاصطناعي</DialogTitle>
            <DialogDescription>تحديث المكونات والملاحظات الإدارية للكاش</DialogDescription>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4 py-2 text-right">
              <div>
                <Label>الاسم بالعربية</Label>
                <Input
                  value={editItem.canonicalNameAr || editItem.resolvedFoodName || ""}
                  onChange={(e) => setEditItem({ ...editItem, canonicalNameAr: e.target.value, resolvedFoodName: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>الاسم بالإنجليزية</Label>
                <Input
                  value={editItem.canonicalNameEn || ""}
                  onChange={(e) => setEditItem({ ...editItem, canonicalNameEn: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>القرار المعرفي (Canonical Status)</Label>
                <Select value={editItem.canonicalStatus || "allowed"} onValueChange={(val) => setEditItem({ ...editItem, canonicalStatus: val })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allowed">مسموح (Allowed)</SelectItem>
                    <SelectItem value="forbidden">ممنوع (Forbidden)</SelectItem>
                    <SelectItem value="conditional">مشروط (Conditional)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ملاحظات المشرف</Label>
                <Textarea
                  value={editItem.notes || ""}
                  onChange={(e) => setEditItem({ ...editItem, notes: e.target.value })}
                  placeholder="أدخل ملاحظات..."
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>إلغاء</Button>
            <Button onClick={handleSaveEdit} disabled={isActionLoading}>حفظ التغييرات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SOFT DELETE DIALOG */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>استبعاد استجابة الذكاء الاصطناعي</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إزالة واستبعاد هذه الاستجابة من الكاش؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700" disabled={isActionLoading}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
