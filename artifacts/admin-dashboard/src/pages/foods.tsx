import { useState, useRef, useEffect } from "react";
import {
  useListFoods,
  useCreateFood,
  useUpdateFood,
  useDeleteFood,
  useBulkCreateFoods,
  getListFoodsQueryKey,
  getGetFoodStatsQueryKey,
} from "@workspace/api-client-react";
import type { Food, FoodInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  ChevronDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/contexts/LangContext";
import { tr } from "@/lib/i18n";
import { API_BASE, adminHeaders } from "@/lib/api";
import { CategorySelect } from "@/components/CategorySelect";
import { getCanonicalCategory, getCategoryLabel } from "@/lib/categories";

const PAGE_SIZE = 50;

const STATUS_COLORS: Record<string, string> = {
  allowed: "bg-green-100 text-green-800 border-green-200",
  forbidden: "bg-red-100 text-red-800 border-red-200",
  conditional: "bg-amber-100 text-amber-800 border-amber-200",
};

const CSV_TEMPLATE = `nameAr,nameEn,category,status,reason,notes
لحم الضأن,Lamb,لحوم,allowed,مسموح بشرط الذبح الشرعي,
الكحول,Alcohol,مشروبات,forbidden,ممنوع شرعاً,
الجيلاتين,Gelatin,إضافات,conditional,يعتمد على المصدر,يجب التحقق من المصدر`;

type ParsedRow = FoodInput & { _rowIndex: number; _error?: string };

function parseCSV(raw: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], errors: ["CSV must have a header row and at least one data row"] };

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const nameArIdx = header.indexOf("namear");
  const nameEnIdx = header.indexOf("nameen");
  const categoryIdx = header.indexOf("category");
  const statusIdx = header.indexOf("status");
  const reasonIdx = header.indexOf("reason");
  const notesIdx = header.indexOf("notes");

  if (nameArIdx === -1 || nameEnIdx === -1 || categoryIdx === -1 || statusIdx === -1) {
    return {
      rows: [],
      errors: ["Header must include: nameAr, nameEn, category, status (and optionally reason, notes)"],
    };
  }

  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = splitCSVLine(line);
    const nameAr = cols[nameArIdx]?.trim() ?? "";
    const nameEn = cols[nameEnIdx]?.trim() ?? "";
    const category = getCanonicalCategory(cols[categoryIdx]?.trim() ?? "");
    const status = cols[statusIdx]?.trim().toLowerCase() ?? "";
    const reason = reasonIdx >= 0 ? cols[reasonIdx]?.trim() || null : null;
    const notes = notesIdx >= 0 ? cols[notesIdx]?.trim() || null : null;

    if (!nameAr || !nameEn || !category) {
      errors.push(`Row ${i + 1}: missing nameAr, nameEn, or category`);
      continue;
    }
    if (!["allowed", "forbidden", "conditional"].includes(status)) {
      errors.push(`Row ${i + 1}: status must be "allowed", "forbidden", or "conditional" (got "${status}")`);
      continue;
    }

    rows.push({
      _rowIndex: i + 1,
      nameAr,
      nameEn,
      category,
      status: status as "allowed" | "forbidden" | "conditional",
      reason,
      notes,
    });
  }

  return { rows, errors };
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tayyibati_foods_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function BulkImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"input" | "preview" | "done">("input");
  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const { toast } = useToast();
  const { lang } = useLang();
  const queryClient = useQueryClient();

  const bulkMutation = useBulkCreateFoods({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        setStep("done");
        queryClient.invalidateQueries({ queryKey: getListFoodsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetFoodStatsQueryKey() });
      },
      onError: () => {
        toast({ title: "Import failed", variant: "destructive" });
      },
    },
  });

  function handleParse() {
    const { rows, errors } = parseCSV(csvText);
    setParsed(rows);
    setParseErrors(errors);
    if (rows.length > 0 || errors.length > 0) {
      setStep("preview");
    } else {
      toast({ title: "No valid rows found", variant: "destructive" });
    }
  }

  function handleImport() {
    if (parsed.length === 0) return;
    const foods: FoodInput[] = parsed.map(({ _rowIndex, _error, ...f }) => f);
    bulkMutation.mutate({ data: { foods } });
  }

  function handleClose() {
    setStep("input");
    setCsvText("");
    setParsed([]);
    setParseErrors([]);
    setResult(null);
    onClose();
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string ?? "");
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir={lang === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {tr(lang, "bulkImport")}
          </DialogTitle>
          <DialogDescription>
            {lang === "ar" ? "قم برفع ملف CSV أو لصق بيانات CSV لإضافة أطعمة متعددة." : "Upload a CSV file or paste CSV data to add many foods at once."}
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {lang === "ar" ? "تنزيل النموذج" : "Download Template"}
              </Button>
              <label>
                <Button variant="outline" size="sm" asChild>
                  <span className="cursor-pointer">
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    {lang === "ar" ? "رفع ملف CSV" : "Upload CSV File"}
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">CSV Format</p>
              <p>Required columns: <code className="font-mono">nameAr, nameEn, category, status</code></p>
              <p>Optional columns: <code className="font-mono">reason, notes</code></p>
              <p>Status values: <code className="font-mono">allowed</code> · <code className="font-mono">forbidden</code> · <code className="font-mono">conditional</code></p>
            </div>

            <div className="space-y-1.5">
              <Label>{lang === "ar" ? "لصق بيانات CSV" : "Paste CSV Data"}</Label>
              <Textarea
                placeholder={`nameAr,nameEn,category,status,reason,notes\nلحم الضأن,Lamb,لحوم,allowed,,\nالكحول,Alcohol,مشروبات,forbidden,ممنوع شرعاً,`}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={10}
                className="font-mono text-xs"
                dir="auto"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>{tr(lang, "cancel")}</Button>
              <Button onClick={handleParse} disabled={!csvText.trim()}>
                {lang === "ar" ? "معاينة الاستيراد" : "Preview Import"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              {parsed.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-1.5 border border-green-200">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {parsed.length} row{parsed.length !== 1 ? "s" : ""} ready to import
                </div>
              )}
              {parseErrors.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-200">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {parseErrors.length} row{parseErrors.length !== 1 ? "s" : ""} skipped
                </div>
              )}
            </div>

            {parseErrors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                <p className="text-xs font-medium text-amber-800">Skipped rows:</p>
                {parseErrors.map((e, i) => (
                  <p key={i} className="text-xs text-amber-700">{e}</p>
                ))}
              </div>
            )}

            {parsed.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Arabic</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">English</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Category</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((row) => (
                        <tr key={row._rowIndex} className="border-b hover:bg-muted/20">
                          <td className="px-3 py-2" dir="rtl">{row.nameAr}</td>
                          <td className="px-3 py-2">{row.nameEn}</td>
                          <td className="px-3 py-2 text-muted-foreground">{getCategoryLabel(row.category, lang)}</td>
                          <td className="px-3 py-2">
                            <span className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                              STATUS_COLORS[row.status] ?? "bg-gray-100 text-gray-700",
                            )}>
                              {tr(lang, row.status as any)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">
                            {row.reason ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("input")}>{tr(lang, "back")}</Button>
              <Button
                onClick={handleImport}
                disabled={parsed.length === 0 || bulkMutation.isPending}
              >
                {bulkMutation.isPending
                  ? `Importing ${parsed.length} foods…`
                  : `Import ${parsed.length} Food${parsed.length !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-600" />
              <div>
                <p className="text-xl font-bold">{result.created} foods imported!</p>
                {result.skipped > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {result.skipped} row{result.skipped !== 1 ? "s" : ""} skipped
                  </p>
                )}
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                <p className="text-xs font-medium text-amber-800">Skipped rows:</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-amber-700">{e}</p>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type FoodFormData = {
  nameAr: string;
  nameEn: string;
  category: string;
  status: "allowed" | "forbidden" | "conditional";
  reason: string;
  notes: string;
};

const EMPTY_FORM: FoodFormData = {
  nameAr: "",
  nameEn: "",
  category: "",
  status: "allowed",
  reason: "",
  notes: "",
};

function FoodDialog({
  open,
  onClose,
  food,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  food: Food | null;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const { toast } = useToast();

  const [form, setForm] = useState<FoodFormData>(
    food
      ? {
          nameAr: food.nameAr,
          nameEn: food.nameEn,
          category: getCanonicalCategory(food.category),
          status: food.status as FoodFormData["status"],
          reason: food.reason ?? "",
          notes: food.notes ?? "",
        }
      : EMPTY_FORM,
  );

  const createMutation = useCreateFood({
    mutation: {
      onSuccess: () => {
        toast({ title: tr(lang, "foodCreated") });
        onSaved();
        onClose();
      },
      onError: (err: any) => {
        const status = err?.status || err?.response?.status;
        if (status === 409) {
          toast({ title: tr(lang, "foodAlreadyExists"), variant: "destructive" });
        } else {
          toast({ title: tr(lang, "foodAlreadyExists"), variant: "destructive" });
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nameAr.trim() || !form.nameEn.trim() || !form.category) return;

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
              <Label htmlFor="nameAr">{tr(lang, "foodNameAr")} *</Label>
              <Input
                id="nameAr"
                placeholder={lang === "ar" ? "مثال: لحم البقر" : "e.g. Beef"}
                value={form.nameAr}
                onChange={(e) => set("nameAr", e.target.value)}
                dir="rtl"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nameEn">{tr(lang, "foodNameEn")} *</Label>
              <Input
                id="nameEn"
                placeholder={lang === "ar" ? "مثال: Beef" : "e.g. Beef"}
                value={form.nameEn}
                onChange={(e) => set("nameEn", e.target.value)}
                dir="ltr"
                required
              />
            </div>
          </div>

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
            <Label htmlFor="reason">{tr(lang, "foodReason")}</Label>
            <Input
              id="reason"
              placeholder={lang === "ar" ? "السبب الشرعي أو التحليلي..." : "Reason or ruling..."}
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              dir={lang === "ar" ? "rtl" : "ltr"}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">{tr(lang, "foodNotes")}</Label>
            <Textarea
              id="notes"
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
            <Button type="submit" disabled={busy || !form.nameAr || !form.nameEn || !form.category}>
              {busy ? "..." : food ? tr(lang, "save") : tr(lang, "createFoodBtn")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

async function bulkDeleteFoods(payload: { ids?: number[]; status?: string }) {
  const res = await fetch(`${API_BASE}/api/foods/bulk`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Bulk delete failed");
  }

  return res.json() as Promise<{ deleted: number }>;
}

export default function Foods() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [dialogFood, setDialogFood] = useState<Food | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<Food | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeletePayload, setBulkDeletePayload] = useState<{ ids?: number[]; status?: string } | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const { toast } = useToast();
  const { lang } = useLang();
  const queryClient = useQueryClient();

  const queryParams = {
    limit: PAGE_SIZE,
    offset,
    ...(search ? { search } : {}),
    ...(statusFilter !== "all"
      ? { status: statusFilter as "allowed" | "forbidden" | "conditional" }
      : {}),
    ...(categoryFilter ? { category: categoryFilter } : {}),
  };

  const { data: foods, isLoading } = useListFoods(queryParams);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/export/foods`, {
        headers: adminHeaders(),
      });
      if (!res.ok) throw new Error("Failed to export foods CSV");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `tayyibati_foods_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: tr(lang, "exportSuccess"),
        description: tr(lang, "exportFoodsDesc"),
      });
    } catch (err: any) {
      toast({
        title: tr(lang, "exportFailed"),
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Clear selection when page/filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [offset, search, statusFilter, categoryFilter]);

  const deleteMutation = useDeleteFood({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFoodsQueryKey() });
        toast({ title: tr(lang, "foodDeleted") });
        setDeleteTarget(null);
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListFoodsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetFoodStatsQueryKey() });
  }

  function handleSearch(val: string) {
    setSearch(val);
    setOffset(0);
  }

  function handleStatusFilter(val: string) {
    setStatusFilter(val);
    setOffset(0);
  }

  function handleCategoryFilter(val: string) {
    setCategoryFilter(val);
    setOffset(0);
  }

  const hasPrev = offset > 0;
  const hasNext = (foods?.length ?? 0) === PAGE_SIZE;

  const allPageIds = foods?.map((f) => f.id) ?? [];
  const allSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));
  const someSelected = allPageIds.some((id) => selectedIds.has(id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allPageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...allPageIds]));
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function executeBulkDelete(payload: { ids?: number[]; status?: string }) {
    setIsBulkDeleting(true);
    try {
      const result = await bulkDeleteFoods(payload);
      toast({ title: `${result.deleted} food${result.deleted !== 1 ? "s" : ""} deleted` });
      setSelectedIds(new Set());
      invalidate();
    } catch {
      toast({ title: "Bulk delete failed", variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
      setBulkDeletePayload(null);
    }
  }

  const bulkDeleteLabel = bulkDeletePayload?.status
    ? `Delete all "${tr(lang, bulkDeletePayload.status as any)}" foods`
    : `Delete ${bulkDeletePayload?.ids?.length ?? 0} selected food${(bulkDeletePayload?.ids?.length ?? 0) !== 1 ? "s" : ""}`;

  return (
    <div className="p-6 space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{tr(lang, "foodDb")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {lang === "ar" ? "إدارة قاعدة بيانات أحكام الطيبات" : "Manage the Tayyibat food rulings database"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCsv} disabled={isExporting}>
            <Download className="h-4 w-4 mr-1.5" />
            {isExporting ? tr(lang, "exporting") : tr(lang, "exportCSV")}
          </Button>
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" />
            {tr(lang, "bulkImport")}
          </Button>
          <Button onClick={() => setDialogFood("new")}>
            <Plus className="h-4 w-4 mr-1.5" />
            {tr(lang, "addFood")}
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={lang === "ar" ? "بحث عن طعام..." : "Search foods…"}
            className="pl-9"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent dir={lang === "ar" ? "rtl" : "ltr"}>
            <SelectItem value="all">{lang === "ar" ? "جميع الحالات" : "All Statuses"}</SelectItem>
            <SelectItem value="allowed">{tr(lang, "allowed")}</SelectItem>
            <SelectItem value="forbidden">{tr(lang, "forbidden")}</SelectItem>
            <SelectItem value="conditional">{tr(lang, "conditional")}</SelectItem>
          </SelectContent>
        </Select>
        <div className="w-48">
          <CategorySelect
            value={categoryFilter}
            onChange={handleCategoryFilter}
            lang={lang}
            allowAll
          />
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium text-primary">
            {selectedIds.size} {lang === "ar" ? "محدد" : "selected"}
          </span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="h-3 w-3 mr-1" />
            {tr(lang, "clear")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs"
            disabled={isBulkDeleting}
            onClick={() => setBulkDeletePayload({ ids: Array.from(selectedIds) })}
          >
            <Trash2 className="h-3 w-3 mr-1.5" />
            {tr(lang, "delete")} ({selectedIds.size})
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-3 w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                      className={cn(someSelected && !allSelected && "data-[state=unchecked]:bg-muted")}
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{tr(lang, "foodNameAr")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{tr(lang, "foodNameEn")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{tr(lang, "foodCategory")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{tr(lang, "foodStatus")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{tr(lang, "foodReason")}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground font-medium gap-1 px-2">
                          {tr(lang, "actions")}
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive text-xs"
                          onClick={() => setBulkDeletePayload({ status: "forbidden" })}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete all Forbidden
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive text-xs"
                          onClick={() => setBulkDeletePayload({ status: "allowed" })}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete all Allowed
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive text-xs"
                          onClick={() => setBulkDeletePayload({ status: "conditional" })}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete all Conditional
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-3"><Skeleton className="h-4 w-4 rounded" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    </tr>
                  ))
                ) : foods?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      {lang === "ar" ? "لا توجد أطعمة" : "No foods found"}
                    </td>
                  </tr>
                ) : (
                  foods?.map((food) => (
                    <tr
                      key={food.id}
                      className={cn(
                        "border-b transition-colors cursor-pointer",
                        selectedIds.has(food.id)
                          ? "bg-primary/5 hover:bg-primary/8"
                          : "hover:bg-muted/20",
                      )}
                      onClick={() => toggleSelect(food.id)}
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(food.id)}
                          onCheckedChange={() => toggleSelect(food.id)}
                          aria-label={`Select ${food.nameEn}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium" dir="rtl">
                        {food.nameAr}
                      </td>
                      <td className="px-4 py-3" dir="ltr">{food.nameEn}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {getCategoryLabel(food.category, lang)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            STATUS_COLORS[food.status] ?? "bg-gray-100 text-gray-700",
                          )}
                        >
                          {tr(lang, food.status as any)}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-muted-foreground truncate">
                          {food.reason ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setDialogFood(food)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(food)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? (lang === "ar" ? "جاري التحميل..." : "Loading…")
                : `${lang === "ar" ? "عرض" : "Showing"} ${offset + 1}–${offset + (foods?.length ?? 0)}`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                <ChevronLeft className="h-4 w-4" />
                {lang === "ar" ? "السابق" : "Previous"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                {lang === "ar" ? "التالي" : "Next"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <BulkImportDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />

      {dialogFood !== null && (
        <FoodDialog
          open={true}
          onClose={() => setDialogFood(null)}
          food={dialogFood === "new" ? null : dialogFood}
          onSaved={invalidate}
        />
      )}

      {/* Single delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{lang === "ar" ? `حذف "${deleteTarget?.nameAr}"؟` : `Delete "${deleteTarget?.nameEn}"?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "ar"
                ? `سيتم حذف ${deleteTarget?.nameAr} نهائياً من قاعدة البيانات.`
                : `This will permanently remove ${deleteTarget?.nameEn} from the database.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr(lang, "cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() =>
                deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })
              }
            >
              {tr(lang, "delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={!!bulkDeletePayload} onOpenChange={(v) => !v && setBulkDeletePayload(null)}>
        <AlertDialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{lang === "ar" ? "تأكيد الحذف الجماعي" : "Confirm Bulk Delete"}</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkDeleteLabel}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>{tr(lang, "cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={isBulkDeleting}
              onClick={() => bulkDeletePayload && executeBulkDelete(bulkDeletePayload)}
            >
              {isBulkDeleting ? "..." : tr(lang, "delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
