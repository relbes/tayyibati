import { useState, useEffect } from "react";
import {
  useCreateFood,
  useUpdateFood,
} from "@workspace/api-client-react";
import type { Food, FoodInput } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/LangContext";
import { tr } from "@/lib/i18n";
import { API_BASE, adminFetch } from "@/lib/api";
import { CategorySelect } from "@/components/CategorySelect";
import { getCanonicalCategory, getCategoryLabel } from "@/lib/categories";
import { AlertCircle, CheckCircle, Loader2, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

export type FoodFormData = {
  nameAr: string;
  nameEn: string;
  category: string;
  status: "allowed" | "forbidden" | "conditional";
  reason: string;
  notes: string;
};

export const EMPTY_FOOD_FORM: FoodFormData = {
  nameAr: "",
  nameEn: "",
  category: "",
  status: "allowed",
  reason: "",
  notes: "",
};

export interface MatchedItemInfo {
  type: "food" | "dish";
  id: number;
  nameAr: string;
  nameEn?: string | null;
  category?: string | null;
  status?: string | null;
  aliasMatched?: string | null;
}

export interface CheckNameResult {
  exists: boolean;
  matchType?: "exact_food" | "food_alias" | "exact_dish" | "dish_alias";
  matchedItem?: MatchedItemInfo;
  message?: string;
  messageAr?: string;
}

export interface FoodDialogProps {
  open: boolean;
  onClose: () => void;
  food?: Food | null;
  initialNameAr?: string;
  onSaved: () => void;
}

export function FoodDialog({
  open,
  onClose,
  food,
  initialNameAr,
  onSaved,
}: FoodDialogProps) {
  const { lang } = useLang();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [form, setForm] = useState<FoodFormData>(EMPTY_FOOD_FORM);
  const [checkingName, setCheckingName] = useState(false);
  const [nameCheckResult, setNameCheckResult] = useState<CheckNameResult | null>(null);

  useEffect(() => {
    if (open) {
      if (food) {
        setForm({
          nameAr: food.nameAr,
          nameEn: food.nameEn,
          category: getCanonicalCategory(food.category),
          status: food.status as FoodFormData["status"],
          reason: food.reason ?? "",
          notes: food.notes ?? "",
        });
        setNameCheckResult(null);
        setCheckingName(false);
      } else {
        const prefilledName = initialNameAr?.trim() || "";
        setForm({
          ...EMPTY_FOOD_FORM,
          nameAr: prefilledName,
        });
        setNameCheckResult(null);
        setCheckingName(false);
      }
    } else {
      setNameCheckResult(null);
      setCheckingName(false);
    }
  }, [open, food, initialNameAr]);

  // Live debounced duplicate check for nameAr when creating a new food
  useEffect(() => {
    if (!open || food) {
      setNameCheckResult(null);
      setCheckingName(false);
      return;
    }

    const trimmed = form.nameAr.trim();
    if (!trimmed || trimmed.length < 2) {
      setNameCheckResult(null);
      setCheckingName(false);
      return;
    }

    setCheckingName(true);
    const timer = setTimeout(async () => {
      try {
        const res = await adminFetch(
          `${API_BASE}/api/admin/foods/check-name?name=${encodeURIComponent(trimmed)}`
        );
        if (res.ok) {
          const data: CheckNameResult = await res.json();
          setNameCheckResult(data);
        } else {
          setNameCheckResult(null);
        }
      } catch (err) {
        console.error("Duplicate check error:", err);
      } finally {
        setCheckingName(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [form.nameAr, open, food]);

  const createMutation = useCreateFood({
    mutation: {
      onSuccess: () => {
        toast({
          title: tr(lang, "foodCreated"),
          description: `تمت إضافة "${form.nameAr}" بنجاح إلى قاعدة البيانات`,
        });
        onSaved();
        onClose();
      },
      onError: (err: any) => {
        const status = err?.status || err?.response?.status;
        const errData = err?.data || err?.response?.data;
        if (status === 409 || errData?.error === "food_already_exists") {
          toast({
            title: tr(lang, "foodAlreadyExists"),
            description: errData?.messageAr || "هذا الطعام أو الاسم البديل موجود بالفعل في قاعدة البيانات.",
            variant: "destructive",
          });
          if (errData?.matchedItem) {
            setNameCheckResult({
              exists: true,
              matchType: errData.matchType,
              matchedItem: errData.matchedItem,
              messageAr: errData.messageAr,
            });
          }
        } else {
          toast({
            title: "تعذر إنشاء الطعام",
            description: errData?.message || err?.message || "حدث خطأ غير متوقع",
            variant: "destructive",
          });
        }
      },
    },
  });

  const updateMutation = useUpdateFood({
    mutation: {
      onSuccess: () => {
        toast({ title: tr(lang, "foodUpdated") });
        onSaved();
        onClose();
      },
      onError: () => toast({ title: "Failed to update food", variant: "destructive" }),
    },
  });

  const busy = createMutation.isPending || updateMutation.isPending;
  const isDuplicate = !food && (nameCheckResult?.exists ?? false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nameAr.trim() || !form.nameEn.trim() || !form.category || isDuplicate || checkingName) {
      return;
    }

    const canonicalCategory = getCanonicalCategory(form.category);

    const payload: FoodInput = {
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim(),
      category: canonicalCategory,
      status: form.status,
      reason: form.reason.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (food) {
      updateMutation.mutate({ id: food.id, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  }

  function set(key: keyof FoodFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const handleNavigateToExisting = (item: MatchedItemInfo) => {
    onClose();
    if (item.type === "food") {
      setLocation(`/foods?search=${encodeURIComponent(item.nameAr)}`);
    } else {
      setLocation(`/dishes?search=${encodeURIComponent(item.nameAr)}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" dir={lang === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{food ? tr(lang, "editFoodTitle") : tr(lang, "addFoodTitle")}</DialogTitle>
          <DialogDescription>
            {food ? tr(lang, "editFoodSub") : tr(lang, "addFoodSub")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="food-nameAr">{tr(lang, "foodNameAr")} *</Label>
              <Input
                id="food-nameAr"
                placeholder={lang === "ar" ? "مثال: لحم البقر" : "e.g. Beef"}
                value={form.nameAr}
                onChange={(e) => set("nameAr", e.target.value)}
                dir="rtl"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="food-nameEn">{tr(lang, "foodNameEn")} *</Label>
              <Input
                id="food-nameEn"
                placeholder={lang === "ar" ? "مثال: Beef" : "e.g. Beef"}
                value={form.nameEn}
                onChange={(e) => set("nameEn", e.target.value)}
                dir="ltr"
                required
              />
            </div>
          </div>

          {/* Duplicate check status banner */}
          {!food && form.nameAr.trim().length >= 2 && (
            <div>
              {checkingName && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>جاري التحقق من وجود الاسم والأسماء البديلة المسجلة...</span>
                </div>
              )}

              {!checkingName && nameCheckResult?.exists && (
                <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-3 text-right space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                    <div className="text-xs space-y-1 flex-1">
                      <p className="font-semibold text-amber-950">
                        {nameCheckResult.matchType === "food_alias"
                          ? "الاسم مسجل كاسم بديل (Alias)"
                          : nameCheckResult.matchType === "exact_dish" || nameCheckResult.matchType === "dish_alias"
                          ? "الاسم مسجل كطبق (Dish)"
                          : "الطعام موجود بالفعل في قاعدة البيانات"}
                      </p>
                      <p className="text-amber-900 leading-relaxed">
                        {nameCheckResult.messageAr || "هذا الاسم مسجل بالفعل ولا يمكن تكراره."}
                      </p>

                      {nameCheckResult.matchedItem && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-amber-800">
                          <span className="bg-amber-100 px-2 py-0.5 rounded font-medium border border-amber-200">
                            {nameCheckResult.matchedItem.nameAr}
                            {nameCheckResult.matchedItem.nameEn ? ` (${nameCheckResult.matchedItem.nameEn})` : ""}
                          </span>
                          {nameCheckResult.matchedItem.category && (
                            <span className="bg-white px-2 py-0.5 rounded border border-amber-200">
                              الفئة: {getCategoryLabel(nameCheckResult.matchedItem.category, lang)}
                            </span>
                          )}
                          {nameCheckResult.matchedItem.status && (
                            <span
                              className={`px-2 py-0.5 rounded border ${
                                nameCheckResult.matchedItem.status === "allowed"
                                  ? "bg-green-100 text-green-800 border-green-200"
                                  : nameCheckResult.matchedItem.status === "forbidden"
                                  ? "bg-red-100 text-red-800 border-red-200"
                                  : "bg-amber-100 text-amber-800 border-amber-200"
                              }`}
                            >
                              الحكم: {tr(lang, nameCheckResult.matchedItem.status as any)}
                            </span>
                          )}
                        </div>
                      )}

                      {nameCheckResult.matchedItem && (
                        <div className="pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 border-amber-300 text-amber-900 hover:bg-amber-100"
                            onClick={() => handleNavigateToExisting(nameCheckResult.matchedItem!)}
                          >
                            <ExternalLink className="h-3 w-3" />
                            {nameCheckResult.matchedItem.type === "dish"
                              ? "عرض الطبق في قائمة الأطباق"
                              : "عرض الطعام في قائمة الأطعمة"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!checkingName && nameCheckResult && !nameCheckResult.exists && (
                <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2.5 py-1.5 rounded border border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  <span>الاسم متاح وغير مسجل مسبقاً في الأطعمة أو الأسماء البديلة.</span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="food-category">{tr(lang, "foodCategory")} *</Label>
              <CategorySelect
                id="food-category"
                value={form.category}
                onChange={(v) => set("category", v)}
                lang={lang}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="food-status">{tr(lang, "foodStatus")} *</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as FoodFormData["status"])}
              >
                <SelectTrigger id="food-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir={lang === "ar" ? "rtl" : "ltr"}>
                  <SelectItem value="allowed">✓ {tr(lang, "allowed")}</SelectItem>
                  <SelectItem value="forbidden">✗ {tr(lang, "forbidden")}</SelectItem>
                  <SelectItem value="conditional">⚠ {tr(lang, "conditional")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="food-reason">{tr(lang, "foodReason")}</Label>
            <Input
              id="food-reason"
              placeholder={lang === "ar" ? "السبب الشرعي أو التحليلي..." : "Reason or ruling..."}
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              dir={lang === "ar" ? "rtl" : "ltr"}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="food-notes">{tr(lang, "foodNotes")}</Label>
            <Textarea
              id="food-notes"
              placeholder={lang === "ar" ? "ملاحظات إضافية..." : "Additional notes..."}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              dir={lang === "ar" ? "rtl" : "ltr"}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {tr(lang, "cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                busy ||
                checkingName ||
                isDuplicate ||
                !form.nameAr.trim() ||
                !form.nameEn.trim() ||
                !form.category
              }
              className={isDuplicate ? "bg-muted text-muted-foreground" : ""}
            >
              {busy
                ? "..."
                : isDuplicate
                ? "الاسم موجود مسبقاً"
                : food
                ? tr(lang, "save")
                : tr(lang, "createFoodBtn")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
