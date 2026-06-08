import { useState } from "react";
import {
  useListFoods,
  useCreateFood,
  useUpdateFood,
  useDeleteFood,
  getListFoodsQueryKey,
} from "@workspace/api-client-react";
import type { Food, FoodInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

const STATUS_COLORS: Record<string, string> = {
  allowed: "bg-green-100 text-green-800 border-green-200",
  forbidden: "bg-red-100 text-red-800 border-red-200",
  conditional: "bg-amber-100 text-amber-800 border-amber-200",
};

const STATUS_LABELS: Record<string, string> = {
  allowed: "Allowed",
  forbidden: "Forbidden",
  conditional: "Conditional",
};

const CATEGORIES = [
  "Meat & Poultry",
  "Seafood",
  "Dairy",
  "Grains & Bread",
  "Vegetables",
  "Fruits",
  "Legumes",
  "Nuts & Seeds",
  "Oils & Fats",
  "Beverages",
  "Additives & Preservatives",
  "Sweeteners",
  "Spices & Herbs",
  "Sauces & Condiments",
  "Processed Foods",
  "Snacks",
  "Sweets & Desserts",
  "Alcohol & Intoxicants",
  "Insects",
  "Reptiles & Amphibians",
  "Wild Animals",
  "Other",
];

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
  const [form, setForm] = useState<FoodFormData>(
    food
      ? {
          nameAr: food.nameAr,
          nameEn: food.nameEn,
          category: food.category,
          status: food.status as FoodFormData["status"],
          reason: food.reason ?? "",
          notes: food.notes ?? "",
        }
      : EMPTY_FORM,
  );
  const { toast } = useToast();

  const createMutation = useCreateFood({
    mutation: {
      onSuccess: () => {
        toast({ title: "Food created successfully" });
        onSaved();
        onClose();
      },
      onError: () => toast({ title: "Failed to create food", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateFood({
    mutation: {
      onSuccess: () => {
        toast({ title: "Food updated successfully" });
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

    const payload: FoodInput = {
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim(),
      category: form.category,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{food ? "Edit Food" : "Add New Food"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nameAr">Arabic Name *</Label>
              <Input
                id="nameAr"
                placeholder="e.g. لحم البقر"
                value={form.nameAr}
                onChange={(e) => set("nameAr", e.target.value)}
                dir="rtl"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nameEn">English Name *</Label>
              <Input
                id="nameEn"
                placeholder="e.g. Beef"
                value={form.nameEn}
                onChange={(e) => set("nameEn", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status *</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as FoodFormData["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allowed">✓ Allowed</SelectItem>
                  <SelectItem value="forbidden">✗ Forbidden</SelectItem>
                  <SelectItem value="conditional">⚠ Conditional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason / Ruling</Label>
            <Input
              id="reason"
              placeholder="Islamic ruling or reason…"
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes or conditions…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !form.nameAr || !form.nameEn || !form.category}>
              {busy ? "Saving…" : food ? "Save Changes" : "Create Food"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Foods() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [dialogFood, setDialogFood] = useState<Food | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<Food | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryParams = {
    limit: PAGE_SIZE,
    offset,
    ...(search ? { search } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter as "allowed" | "forbidden" | "conditional" } : {}),
  };

  const { data: foods, isLoading } = useListFoods(queryParams);

  const deleteMutation = useDeleteFood({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFoodsQueryKey() });
        toast({ title: "Food deleted" });
        setDeleteTarget(null);
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListFoodsQueryKey() });
  }

  function handleSearch(val: string) {
    setSearch(val);
    setOffset(0);
  }

  function handleStatusFilter(val: string) {
    setStatusFilter(val);
    setOffset(0);
  }

  const hasPrev = offset > 0;
  const hasNext = (foods?.length ?? 0) === PAGE_SIZE;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Foods Database</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage the Tayyibat food rulings database
          </p>
        </div>
        <Button onClick={() => setDialogFood("new")}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Food
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search foods…"
            className="pl-9"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="allowed">Allowed</SelectItem>
            <SelectItem value="forbidden">Forbidden</SelectItem>
            <SelectItem value="conditional">Conditional</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Arabic</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">English</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reason</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b">
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
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      No foods found
                    </td>
                  </tr>
                ) : (
                  foods?.map((food) => (
                    <tr key={food.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium" dir="rtl">
                        {food.nameAr}
                      </td>
                      <td className="px-4 py-3">{food.nameEn}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {food.category}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            STATUS_COLORS[food.status] ?? "bg-gray-100 text-gray-700",
                          )}
                        >
                          {STATUS_LABELS[food.status] ?? food.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-muted-foreground truncate">
                          {food.reason ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
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
                ? "Loading…"
                : `Showing ${offset + 1}–${offset + (foods?.length ?? 0)}`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {dialogFood !== null && (
        <FoodDialog
          open={true}
          onClose={() => setDialogFood(null)}
          food={dialogFood === "new" ? null : dialogFood}
          onSaved={invalidate}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.nameEn}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.nameAr}</strong> from the
              database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() =>
                deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
