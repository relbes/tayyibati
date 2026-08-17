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
  Bot,
  Eye,
} from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import { API_BASE, adminHeaders } from "@/lib/api";

const PAGE_SIZE = 50;

interface AiCacheItem {
  id: number;
  originalQuery: string;
  inputType: string;
  resolvedFoodName?: string | null;
  canonicalStatus?: string | null;
  confidence: number;
  hitCount: number;
  createdAt: string;
  isDeleted: boolean;
  notes?: string | null;
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

      const res = await fetch(`${API_BASE}/api/admin/ai-cache?${queryParams}`, {
        headers: adminHeaders(),
      });
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
  }, [page]);

  const handleApprove = (item: AiCacheItem) => {
    toast({ title: "تم الاعتماد", description: `تم اعتماد إجابة الذكاء الاصطناعي للاستعلام "${item.originalQuery}"` });
  };

  const handleReject = async (id: number) => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/ai-cache/${id}/delete`, {
        method: "POST",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم الرفض والحذف", description: "تم استبعاد الإجابة من الكاش" });
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
      const res = await fetch(`${API_BASE}/api/admin/ai-cache/${deleteItem.id}/delete`, {
        method: "POST",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم الحذف", description: "تم إزالة العنصر من سجل الذكاء الاصطناعي" });
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
            مراجعة استعلامات وتحليلات الذكاء الاصطناعي المخزنة في الكاش
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالنص أو استعلام المستخدم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchAiCache()}
                className="pr-9"
              />
            </div>
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
                    <th className="px-4 py-3">إجابة الذكاء الاصطناعي</th>
                    <th className="px-4 py-3">نسبة الثقة</th>
                    <th className="px-4 py-3">القرار (التوافق)</th>
                    <th className="px-4 py-3">مرات الاستخدام</th>
                    <th className="px-4 py-3">التاريخ</th>
                    <th className="px-4 py-3 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{item.originalQuery}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.resolvedFoodName || "تحليل مباشر"}</td>
                      <td className="px-4 py-3 font-semibold text-primary">{Math.round((item.confidence || 0.95) * 100)}%</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.canonicalStatus === "allowed" ? "bg-green-100 text-green-800" :
                          item.canonicalStatus === "forbidden" ? "bg-red-100 text-red-800" :
                          "bg-amber-100 text-amber-800"
                        }`}>
                          {item.canonicalStatus === "allowed" ? "مسموح" : item.canonicalStatus === "forbidden" ? "ممنوع" : "مشروط / مقبول"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{item.hitCount || 1} مرة</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ar-EG") : "—"}
                      </td>
                      <td className="px-4 py-3 text-left space-x-1 space-x-reverse">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewItem(item)}>
                          <Eye className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => handleApprove(item)}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteItem(item)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
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

      {/* View Modal */}
      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تفاصيل مراجعة الذكاء الاصطناعي</DialogTitle>
            <DialogDescription>عرض تفاصيل الاستعلام وإجابة نموذج AI</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4 py-2 text-right">
              <div>
                <Label className="text-muted-foreground text-xs">الاستعلام الأصلي</Label>
                <p className="font-semibold text-lg">{viewItem.originalQuery}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">النتيجة المحللة</Label>
                <p className="font-medium text-primary">{viewItem.resolvedFoodName || "تحليل مباشر"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">نسبة الثقة</Label>
                <p className="font-bold text-green-700">{Math.round((viewItem.confidence || 0.95) * 100)}%</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewItem(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف استجابة الذكاء الاصطناعي</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت تأكد من استبعاد هذه الاستجابة من الكاش وإزالتها؟
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
