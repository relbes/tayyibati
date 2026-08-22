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
  XCircle,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Eye,
  GitMerge,
  HelpCircle,
  ArrowRightLeft,
} from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import { API_BASE, adminFetch } from "@/lib/api";

const PAGE_SIZE = 50;

interface ReviewItem {
  id: number;
  itemType?: string;
  suggestedNameAr: string;
  suggestedNameEn?: string | null;
  ingredientName: string;
  normalizedName: string;
  sourceDish?: string | null;
  sourceType: string;
  status: string;
  source: string;
  confidenceScore: number;
  seenCount: number;
  createdAt: string;
  notes?: string | null;
  canonicalFoodId?: number | null;
  exampleQueries?: string[];
  resolutionAttempts?: {
    alias?: boolean;
    synonym?: boolean;
    expansion?: boolean;
    prefix?: boolean;
    token?: boolean;
    fuzzy?: boolean;
  };
  resolvedFoodId?: number | null;
  resolvedDishId?: number | null;
}

interface FoodOption {
  id: number;
  nameAr: string;
  nameEn?: string | null;
  category: string;
  status: string;
}

export default function KnowledgeReviewPage() {
  const { lang } = useLang();
  const { toast } = useToast();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [viewItem, setViewItem] = useState<ReviewItem | null>(null);
  const [editItem, setEditItem] = useState<ReviewItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<ReviewItem | null>(null);
  const [mergeItem, setMergeItem] = useState<ReviewItem | null>(null);

  // Merge modal states
  const [foodOptions, setFoodOptions] = useState<FoodOption[]>([]);
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<number | null>(null);
  const [foodSearch, setFoodSearch] = useState("");

  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (statusFilter && statusFilter !== "all") queryParams.append("status", statusFilter);
      if (search) queryParams.append("search", search);

      const res = await adminFetch(`${API_BASE}/api/admin/knowledge-review?${queryParams}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setTotalItems(data.totalItems || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        toast({ title: "خطأ", description: data.error || "فشل جلب قائمة المراجعة", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message || "تعذر الاتصال بالخادم", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchFoodsForMerge = async () => {
    try {
      const res = await adminFetch(`${API_BASE}/api/foods`);
      const data = await res.json();
      setFoodOptions(Array.isArray(data) ? data : data.items || []);
    } catch (err) {
      console.error("Failed to load foods for merge:", err);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [page, statusFilter]);

  useEffect(() => {
    if (mergeItem) {
      fetchFoodsForMerge();
    }
  }, [mergeItem]);

  const handleApprove = async (id: number) => {
    setIsActionLoading(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/knowledge-review/${id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم الاعتماد", description: "تم قبول مراجعة المعرفة وا اعتماد التعديل بنجاح" });
        fetchQueue();
      } else {
        toast({ title: "خطأ", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message, variant: "destructive" });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async (id: number) => {
    setIsActionLoading(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/knowledge-review/${id}/reject`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم الرفض", description: "تم رفض التغيير بنجاح" });
        fetchQueue();
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
      const res = await adminFetch(`${API_BASE}/api/admin/knowledge-review/${editItem.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ingredientName: editItem.suggestedNameAr,
          reviewNotes: editItem.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم التحديث", description: "تم تحديث بيانات المراجعة بنجاح" });
        setEditItem(null);
        fetchQueue();
      } else {
        toast({ title: "خطأ", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message, variant: "destructive" });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMergeConfirm = async () => {
    if (!mergeItem || !selectedCanonicalId) return;
    setIsActionLoading(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/admin/knowledge-review/${mergeItem.id}/merge`, {
        method: "POST",
        body: JSON.stringify({
          canonicalFoodId: selectedCanonicalId,
          notes: mergeItem.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم الدمج بنجاح", description: `تم دمج العنصر مع الكائن المعرفي #${selectedCanonicalId}` });
        setMergeItem(null);
        setSelectedCanonicalId(null);
        fetchQueue();
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
      const res = await adminFetch(`${API_BASE}/api/admin/knowledge-review/${deleteItem.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم الحذف", description: "تم حذف عنصر المعرفة من السجل" });
        setDeleteItem(null);
        fetchQueue();
      } else {
        toast({ title: "خطأ", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message, variant: "destructive" });
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredFoodOptions = foodOptions.filter((f) =>
    f.nameAr.toLowerCase().includes(foodSearch.toLowerCase()) ||
    (f.nameEn && f.nameEn.toLowerCase().includes(foodSearch.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مراجعة المعرفة (Knowledge Review)</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            فحص وتدقيق العناصر المعرفية الجديدة المقترحة قبل الاعتماد أو الدمج
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو المصدر..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchQueue()}
                className="pr-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">معلق (Pending)</SelectItem>
                <SelectItem value="approved">مقبول (Approved)</SelectItem>
                <SelectItem value="rejected">مرفوض (Rejected)</SelectItem>
                <SelectItem value="merged">مدمج (Merged)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={fetchQueue}>
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
              <Sparkles className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
              <p>لا توجد عناصر للمراجعة حالياً</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b">
                  <tr>
                    <th className="px-4 py-3">النوع</th>
                    <th className="px-4 py-3">الاسم بالعربية</th>
                    <th className="px-4 py-3">الحالة</th>
                    <th className="px-4 py-3">المصدر</th>
                    <th className="px-4 py-3">مرات الظهور</th>
                    <th className="px-4 py-3">نسبة الثقة</th>
                    <th className="px-4 py-3">التاريخ</th>
                    <th className="px-4 py-3 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => {
                    const displayNameAr = item.suggestedNameAr || item.ingredientName || "كيان غير مرتبط";
                    return (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            item.itemType === "food" ? "bg-emerald-100 text-emerald-800" :
                            item.itemType === "dish" ? "bg-purple-100 text-purple-800" :
                            "bg-blue-100 text-blue-800"
                          }`}>
                            {item.itemType === "food" ? "طعام" : item.itemType === "dish" ? "وجبة" : "مكون"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{displayNameAr}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === "approved" ? "bg-green-100 text-green-800" :
                            item.status === "rejected" ? "bg-red-100 text-red-800" :
                            item.status === "merged" ? "bg-purple-100 text-purple-800" :
                            "bg-amber-100 text-amber-800"
                          }`}>
                            {item.status === "approved" ? "مقبول" : item.status === "rejected" ? "مرفوض" : item.status === "merged" ? "مدمج" : "معلق"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{item.source || "AI Engine"}</td>
                        <td className="px-4 py-3 text-xs font-mono">{item.seenCount || 1} مرة</td>
                        <td className="px-4 py-3 font-semibold text-primary">{item.confidenceScore}%</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ar-EG") : "—"}
                        </td>
                        <td className="px-4 py-3 text-left space-x-1 space-x-reverse">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewItem(item)}>
                            <Eye className="h-4 w-4 text-blue-600" />
                          </Button>
                          {item.status === "pending" && (
                            <>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => handleApprove(item.id)}>
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-purple-600 hover:bg-purple-50" onClick={() => setMergeItem(item)}>
                                <GitMerge className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleReject(item.id)}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
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

      {/* FULL INSPECTION VIEW DIALOG (Side-by-Side Comparison) */}
      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Eye className="h-5 w-5 text-blue-600" />
              فحص تفاصيل عنصر المعرفة (Review #{viewItem?.id})
            </DialogTitle>
            <DialogDescription>
              مقارنة وتدقيق البيانات المقترحة مع السجل المعرفي المباشر
            </DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-6 py-2 text-right">
              {/* SIDE BY SIDE COMPARISON */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* LEFT: PENDING / SUGGESTED ITEM */}
                <div className="p-4 rounded-lg border bg-amber-50/40 border-amber-200 space-y-3">
                  <h3 className="font-semibold text-amber-900 flex items-center gap-1.5 text-sm border-b pb-2 border-amber-200">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    العنصر المعرفي المقترح (Pending Item)
                  </h3>
                  <div>
                    <span className="text-xs text-muted-foreground">الاسم المقترح</span>
                    <p className="font-bold text-base text-foreground">{viewItem.suggestedNameAr}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">الاسم المعياري (Normalized)</span>
                    <p className="font-mono text-xs text-muted-foreground">{viewItem.normalizedName}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">نوع المصدر:</span>
                      <p className="font-medium">{viewItem.sourceType}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">الوجبة المصدر:</span>
                      <p className="font-medium">{viewItem.sourceDish || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">مرات الظهور:</span>
                      <p className="font-bold text-primary">{viewItem.seenCount} مرة</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">نسبة الثقة:</span>
                      <p className="font-bold text-emerald-700">{viewItem.confidenceScore}%</p>
                    </div>
                  </div>

                  {/* EXAMPLE QUERIES */}
                  {viewItem.exampleQueries && viewItem.exampleQueries.length > 0 && (
                    <div className="border-t pt-2 border-amber-200">
                      <span className="text-xs font-medium text-amber-900 block mb-1">استعلامات المستخدمين الفعلية:</span>
                      <div className="flex flex-wrap gap-1">
                        {viewItem.exampleQueries.map((q, idx) => (
                          <span key={idx} className="bg-amber-100 text-amber-800 text-[11px] px-2 py-0.5 rounded border border-amber-300">
                            {q}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* RESOLUTION FAILURE ATTEMPTS */}
                  {viewItem.resolutionAttempts && (
                    <div className="border-t pt-2 border-amber-200 text-xs">
                      <span className="text-xs font-medium text-amber-900 block mb-1">استراتيجيات المطابقة التي تم فحصها:</span>
                      <div className="grid grid-cols-3 gap-1 text-[11px]">
                        <span className={viewItem.resolutionAttempts.alias ? "text-green-700 font-bold" : "text-gray-500"}>• Alias</span>
                        <span className={viewItem.resolutionAttempts.synonym ? "text-green-700 font-bold" : "text-gray-500"}>• Synonym</span>
                        <span className={viewItem.resolutionAttempts.expansion ? "text-green-700 font-bold" : "text-gray-500"}>• Expansion</span>
                        <span className={viewItem.resolutionAttempts.prefix ? "text-green-700 font-bold" : "text-gray-500"}>• Prefix</span>
                        <span className={viewItem.resolutionAttempts.token ? "text-green-700 font-bold" : "text-gray-500"}>• Token</span>
                        <span className={viewItem.resolutionAttempts.fuzzy ? "text-green-700 font-bold" : "text-gray-500"}>• Fuzzy</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: CANONICAL MATCH / RECORD */}
                <div className="p-4 rounded-lg border bg-blue-50/40 border-blue-200 space-y-3">
                  <h3 className="font-semibold text-blue-900 flex items-center gap-1.5 text-sm border-b pb-2 border-blue-200">
                    <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                    السجل المعرفي المعتمد في قاعدة البيانات
                  </h3>

                  {viewItem.canonicalFoodId ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-blue-950">الكائن المعرفي #{viewItem.canonicalFoodId}</span>
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">مرتبط دائم</span>
                      </div>
                      <p className="text-muted-foreground">تم ربطه ودمجه مع قاعدة البيانات المعرفية الرسمية لـ Tayyibati.</p>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground text-xs space-y-2">
                      <HelpCircle className="h-8 w-8 mx-auto text-muted-foreground/40" />
                      <p className="font-medium text-foreground">لا يوجد كائن معرفي مطابق حالياً</p>
                      <p className="text-muted-foreground max-w-[200px] mx-auto">يمكنك استخدام زِر الدمج (Merge) لربط هذا العنصر بكائن طعام معتمد.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* REVIEW NOTES */}
              {viewItem.notes && (
                <div className="p-3 bg-muted rounded-md text-xs space-y-1">
                  <span className="font-semibold text-foreground">ملاحظات المراجعة السابقة:</span>
                  <p className="text-muted-foreground">{viewItem.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewItem(null)}>إغلاق</Button>
            {viewItem && viewItem.status === "pending" && (
              <>
                <Button variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => { handleApprove(viewItem.id); setViewItem(null); }}>
                  <CheckCircle className="h-4 w-4 ml-1" />
                  قبول العنصر
                </Button>
                <Button variant="outline" className="text-purple-600 border-purple-200 hover:bg-purple-50" onClick={() => { setMergeItem(viewItem); setViewItem(null); }}>
                  <GitMerge className="h-4 w-4 ml-1" />
                  دمج مع طعام معتمد
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MERGE MODAL */}
      <Dialog open={!!mergeItem} onOpenChange={(open) => !open && setMergeItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-purple-600" />
              دمج العنصر مع طعام معتمد
            </DialogTitle>
            <DialogDescription>
              اختر الطعام المعتمد من قاعدة البيانات لدمج "{mergeItem?.suggestedNameAr}" معه.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-right">
            <div>
              <Label>بحث في قائمة الأطعمة المعتمدة</Label>
              <Input
                placeholder="ابحث باسم الطعام..."
                value={foodSearch}
                onChange={(e) => setFoodSearch(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
              {filteredFoodOptions.length === 0 ? (
                <p className="p-3 text-center text-xs text-muted-foreground">لا يوجد طعام مطابق</p>
              ) : (
                filteredFoodOptions.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedCanonicalId(f.id)}
                    className={`p-2.5 text-xs cursor-pointer flex items-center justify-between hover:bg-purple-50 ${
                      selectedCanonicalId === f.id ? "bg-purple-100 font-bold border-r-4 border-purple-600" : ""
                    }`}
                  >
                    <div>
                      <span className="font-medium text-foreground">{f.nameAr}</span>
                      {f.nameEn && <span className="text-muted-foreground text-[11px] block">{f.nameEn}</span>}
                    </div>
                    <span className="bg-muted px-2 py-0.5 rounded text-[10px] text-muted-foreground">{f.category}</span>
                  </div>
                ))
              )}
            </div>
            <div>
              <Label>ملاحظات الدمج</Label>
              <Textarea
                placeholder="أدخل ملاحظات حول سبب الدمج..."
                value={mergeItem?.notes || ""}
                onChange={(e) => mergeItem && setMergeItem({ ...mergeItem, notes: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeItem(null)}>إلغاء</Button>
            <Button onClick={handleMergeConfirm} disabled={!selectedCanonicalId || isActionLoading} className="bg-purple-600 hover:bg-purple-700">
              تأكيد الدمج
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل عنصر المعرفة</DialogTitle>
            <DialogDescription>تحديث بيانات المعرفة وملاحظات المراجعة</DialogDescription>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4 py-2 text-right">
              <div>
                <Label>الاسم بالعربية</Label>
                <Input
                  value={editItem.suggestedNameAr}
                  onChange={(e) => setEditItem({ ...editItem, suggestedNameAr: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>ملاحظات المراجعة</Label>
                <Textarea
                  value={editItem.notes || ""}
                  onChange={(e) => setEditItem({ ...editItem, notes: e.target.value })}
                  placeholder="أدخل ملاحظات المراجعة..."
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

      {/* DELETE DIALOG */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف عنصر المعرفة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا العنصر نهائياً من قائمة المراجعة؟
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
