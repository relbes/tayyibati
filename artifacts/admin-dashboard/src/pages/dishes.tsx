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
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Utensils,
  CheckCircle,
} from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import { API_BASE, adminFetch } from "@/lib/api";

const PAGE_SIZE = 50;

interface DishItem {
  id: number;
  nameAr: string;
  nameEn?: string | null;
  category: string;
  description?: string | null;
  ingredientNames?: string;
  compatibility?: string;
  status?: string;
  createdAt?: string;
}

export default function DishesPage() {
  const { lang } = useLang();
  const { toast } = useToast();
  const [items, setItems] = useState<DishItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<DishItem | null>(null);
  const [deleteDish, setDeleteDish] = useState<DishItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [category, setCategory] = useState("main_dish");
  const [description, setDescription] = useState("");
  const [ingredientNames, setIngredientNames] = useState("");

  const fetchDishes = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) queryParams.append("search", search);
      if (categoryFilter && categoryFilter !== "all") queryParams.append("category", categoryFilter);

      const res = await adminFetch(`${API_BASE}/api/dishes?${queryParams}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setTotalItems(data.totalItems || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        toast({ title: "خطأ", description: data.error || "فشل جلب قائمة الأطباق", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message || "تعذر الاتصال بالخادم", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDishes();
  }, [page, categoryFilter]);

  const handleOpenAdd = () => {
    setEditingDish(null);
    setNameAr("");
    setNameEn("");
    setCategory("main_dish");
    setDescription("");
    setIngredientNames("");
    setDialogOpen(true);
  };

  const handleOpenEdit = (dish: DishItem) => {
    setEditingDish(dish);
    setNameAr(dish.nameAr);
    setNameEn(dish.nameEn || "");
    setCategory(dish.category || "main_dish");
    setDescription(dish.description || "");
    setIngredientNames(dish.ingredientNames || "");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!nameAr.trim()) {
      toast({ title: "تنبيه", description: "الرجاء إدخال اسم الطبق بالعربية", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || null,
        category,
        description: description.trim() || null,
        ingredientNames: ingredientNames.trim(),
      };

      const url = editingDish ? `${API_BASE}/api/dishes/${editingDish.id}` : `${API_BASE}/api/dishes`;
      const method = editingDish ? "PUT" : "POST";

      const res = await adminFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: editingDish ? "تم التعديل" : "تمت الإضافة",
          description: editingDish ? "تم تحديث بيانات الطبق بنجاح" : "تمت إضافة الطبق الجديد بنجاح",
        });
        setDialogOpen(false);
        fetchDishes();
      } else {
        toast({ title: "خطأ", description: data.error || "فشل حفظ بيانات الطبق", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message || "تعذر الاتصال بالخادم", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDish) return;
    setIsSubmitting(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/dishes/${deleteDish.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم الحذف", description: "تم حذف الطبق بنجاح" });
        setDeleteDish(null);
        fetchDishes();
      } else {
        toast({ title: "خطأ", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const CATEGORY_LABELS: Record<string, string> = {
    main_dish: "طبق رئيسي",
    appetizer: "مقبلات",
    soup: "شوربة",
    salad: "سلاطة",
    dessert: "حلويات",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">إدارة الأطباق (Dishes Management)</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            إضافة وتعديل وإدارة الأطباق والوجبات العربية في قاعدة المعرفة
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 ml-2" />
          إضافة طبق جديد
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث باسم الطبق بالعربية أو الإنجليزية..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchDishes()}
                className="pr-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="التصنيف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع التصنيفات</SelectItem>
                <SelectItem value="main_dish">طبق رئيسي</SelectItem>
                <SelectItem value="appetizer">مقبلات</SelectItem>
                <SelectItem value="soup">شوربة</SelectItem>
                <SelectItem value="salad">سلاطة</SelectItem>
                <SelectItem value="dessert">حلويات</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={fetchDishes}>
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
              <Utensils className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
              <p>لا توجد أطباق مسجلة حالياً</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b">
                  <tr>
                    <th className="px-4 py-3">اسم الطبق بالعربية</th>
                    <th className="px-4 py-3">الاسم بالإنجليزية</th>
                    <th className="px-4 py-3">الفئة (Category)</th>
                    <th className="px-4 py-3">المكونات (Ingredients)</th>
                    <th className="px-4 py-3">التوافق</th>
                    <th className="px-4 py-3">الحالة</th>
                    <th className="px-4 py-3 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((dish) => (
                    <tr key={dish.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold text-foreground">{dish.nameAr}</td>
                      <td className="px-4 py-3 text-muted-foreground">{dish.nameEn || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded bg-muted text-xs font-medium">
                          {CATEGORY_LABELS[dish.category] || dish.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs truncate text-muted-foreground">
                        {dish.ingredientNames || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3" />
                          {dish.compatibility || "مسموح"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          نشط
                        </span>
                      </td>
                      <td className="px-4 py-3 text-left space-x-1 space-x-reverse">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleOpenEdit(dish)}>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteDish(dish)}>
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
                عرض {items.length} من أصل {totalItems} طبق
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingDish ? "تعديل الطبق" : "إضافة طبق جديد"}</DialogTitle>
            <DialogDescription>
              {editingDish ? "تحديث بيانات المكونات والتصنيف للطبق" : "إدخال بيانات طبق جديد إلى قاعدة الأطباق"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-right">
            <div>
              <Label>الاسم بالعربية *</Label>
              <Input
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="مثل: كبسة دجاج"
              />
            </div>
            <div>
              <Label>الاسم بالإنجليزية</Label>
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g., Chicken Kabsa"
              />
            </div>
            <div>
              <Label>التصنيف</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main_dish">طبق رئيسي</SelectItem>
                  <SelectItem value="appetizer">مقبلات</SelectItem>
                  <SelectItem value="soup">شوربة</SelectItem>
                  <SelectItem value="salad">سلاطة</SelectItem>
                  <SelectItem value="dessert">حلويات</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>المكونات (مفصولة بفواصل)</Label>
              <Textarea
                value={ingredientNames}
                onChange={(e) => setIngredientNames(e.target.value)}
                placeholder="أرز, دجاج, بصل, زيت زيتون, بهارات..."
              />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="وصف مختصر للطبق ومكوناته..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {editingDish ? "حفظ التعديلات" : "إضافة الطبق"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDish} onOpenChange={(open) => !open && setDeleteDish(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الطبق</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت تأكد من حذف هذا الطبق ومكوناته نهائياً من قاعدة البيانات؟
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
