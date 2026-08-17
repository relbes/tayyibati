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
  FileText,
  AlertCircle,
} from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import { API_BASE, adminHeaders } from "@/lib/api";

const PAGE_SIZE = 50;

interface ReviewItem {
  id: number;
  itemType?: string;
  suggestedNameAr: string;
  suggestedNameEn?: string | null;
  ingredientName?: string;
  status: string;
  source: string;
  confidenceScore: number;
  aiReasoning?: string | null;
  createdAt: string;
  notes?: string | null;
  canonicalFoodId?: number | null;
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

  const [editItem, setEditItem] = useState<ReviewItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<ReviewItem | null>(null);
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

      const res = await fetch(`${API_BASE}/api/admin/knowledge-review?${queryParams}`, {
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setTotalItems(data.totalItems || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        toast({ title: "خطأ", description: data.error || "فشل جلب قائمة المعرفة", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message || "تعذر الاتصال بالخادم", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [page, statusFilter]);

  const handleApprove = async (id: number) => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/knowledge-review/${id}/approve`, {
        method: "POST",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم القبول", description: "تم قبول العنصر بنجاح" });
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
      const res = await fetch(`${API_BASE}/api/admin/knowledge-review/${id}/reject`, {
        method: "POST",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم الرفض", description: "تم رفض العنصر بنجاح" });
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
      const res = await fetch(`${API_BASE}/api/admin/knowledge-review/${editItem.id}/approve`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ notes: editItem.notes }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم التحديث", description: "تم تحديث عنصر المعرفة" });
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

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/knowledge-review/${deleteItem.id}/reject`, {
        method: "POST",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم الحذف", description: "تم حذف عنصر المعرفة" });
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مراجعة المعرفة (Knowledge Review)</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            مراجعة العناصر الجديدة المقترحة والمضافة لقاعدة المعرفة
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
                    <th className="px-4 py-3">الاسم بالإنجليزية</th>
                    <th className="px-4 py-3">الحالة</th>
                    <th className="px-4 py-3">المصدر</th>
                    <th className="px-4 py-3">نسبة الثقة</th>
                    <th className="px-4 py-3">تاريخ الإنشاء</th>
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
                        <td className="px-4 py-3 text-muted-foreground">{item.suggestedNameEn || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === "approved" ? "bg-green-100 text-green-800" :
                            item.status === "rejected" ? "bg-red-100 text-red-800" :
                            "bg-amber-100 text-amber-800"
                          }`}>
                            {item.status === "approved" ? "مقبول" : item.status === "rejected" ? "مرفوض" : "معلق"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{item.source || "AI Engine"}</td>
                        <td className="px-4 py-3 font-semibold text-primary">{item.confidenceScore ?? 100}%</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ar-EG") : "—"}
                        </td>
                        <td className="px-4 py-3 text-left space-x-1 space-x-reverse">
                          {item.status === "pending" && (
                            <>
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleApprove(item.id)}>
                                <CheckCircle className="h-4 w-4 ml-1" />
                                قبول
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleReject(item.id)}>
                                <XCircle className="h-4 w-4 ml-1" />
                                رفض
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

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل عنصر المعرفة</DialogTitle>
            <DialogDescription>تحديث الملاحظات وتفاصيل المعرفة</DialogDescription>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4 py-2">
              <div>
                <Label>الاسم بالعربية</Label>
                <Input value={editItem.suggestedNameAr} readOnly className="bg-muted" />
              </div>
              <div>
                <Label>ملاحظات المراجعة</Label>
                <Textarea
                  value={editItem.notes || ""}
                  onChange={(e) => setEditItem({ ...editItem, notes: e.target.value })}
                  placeholder="أدخل ملاحظات المراجعة..."
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

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف عنصر المعرفة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت تأكد من إزالة هذا العنصر من قائمة المراجعة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
